import { createHmac, timingSafeEqual } from 'node:crypto'
import type { HttpClient } from '../client'
import type {
  WebhookEndpoint,
  CreateWebhookEndpointParams,
  UpdateWebhookEndpointParams,
  WebhookDelivery,
  VerifyWebhookOptions,
  ListDeliveriesParams,
  ListWebhookEventsParams,
  ReplayFailedResult,
} from '../types'

/**
 * Default tolerance (seconds) when verifying webhook signatures. Deliveries
 * whose timestamp is further from now than this are rejected as replays.
 */
const DEFAULT_TOLERANCE_SECONDS = 300

export class WebhooksResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * List your webhook endpoints.
   *
   * @example
   * ```ts
   * const endpoints = await client.webhooks.list()
   * ```
   */
  async list(): Promise<WebhookEndpoint[]> {
    return this.client.request<WebhookEndpoint[]>({
      method: 'GET',
      path: '/api/v1/webhook-endpoints',
    })
  }

  /**
   * Get a single webhook endpoint by id.
   */
  async retrieve(id: string): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'GET',
      path: `/api/v1/webhook-endpoints/${id}`,
    })
  }

  /**
   * Create a webhook endpoint. The signing `secret` is returned in full on
   * the create response -- store it to verify inbound deliveries.
   *
   * @example
   * ```ts
   * const endpoint = await client.webhooks.create({
   *   url: 'https://example.com/hooks/sudomock',
   *   eventTypes: ['render.succeeded', 'render.failed'],
   * })
   * console.log(endpoint.secret) // store this
   * ```
   */
  async create(params: CreateWebhookEndpointParams): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'POST',
      path: '/api/v1/webhook-endpoints',
      body: params,
    })
  }

  /**
   * Update a webhook endpoint (URL, subscribed event types, description, or
   * enabled state).
   */
  async update(
    id: string,
    params: UpdateWebhookEndpointParams,
  ): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'PATCH',
      path: `/api/v1/webhook-endpoints/${id}`,
      body: params,
    })
  }

  /**
   * Delete a webhook endpoint permanently.
   */
  async delete(id: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/api/v1/webhook-endpoints/${id}`,
    })
  }

  /**
   * Rotate the endpoint's signing secret. The new `secret` is returned in
   * full -- update your verifier with it.
   */
  async rotateSecret(id: string): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${id}/rotate-secret`,
    })
  }

  /**
   * Send a test delivery to the endpoint to verify connectivity and signature
   * handling.
   */
  async test(id: string): Promise<void> {
    await this.client.request<void>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${id}/test`,
    })
  }

  /**
   * Recent deliveries across ALL of your endpoints (the dashboard Events feed).
   * Optionally filter by status and/or event type.
   *
   * @example
   * ```ts
   * const events = await client.webhooks.listEvents({ status: 'failed', limit: 50 })
   * ```
   */
  async listEvents(
    params: ListWebhookEventsParams = {},
  ): Promise<WebhookDelivery[]> {
    return this.client.request<WebhookDelivery[]>({
      method: 'GET',
      path: '/api/v1/webhook-endpoints/events',
      query: {
        status: params.status,
        event_type: params.eventType,
        limit: params.limit,
      },
    })
  }

  /**
   * List recent delivery attempts for an endpoint. Optionally filter by status
   * and/or event type, and cap the row count.
   */
  async listDeliveries(
    id: string,
    params: ListDeliveriesParams = {},
  ): Promise<WebhookDelivery[]> {
    return this.client.request<WebhookDelivery[]>({
      method: 'GET',
      path: `/api/v1/webhook-endpoints/${id}/deliveries`,
      query: {
        status: params.status,
        event_type: params.eventType,
        limit: params.limit,
      },
    })
  }

  /**
   * Replay a previous delivery by its id.
   */
  async replayDelivery(id: string, deliveryId: string): Promise<void> {
    await this.client.request<void>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${id}/deliveries/${deliveryId}/replay`,
    })
  }

  /**
   * Replay ALL failed/dead deliveries for an endpoint (bulk recovery after an
   * outage). Returns how many deliveries were re-enqueued.
   *
   * @example
   * ```ts
   * const { count } = await client.webhooks.replayFailed(endpointId)
   * ```
   */
  async replayFailed(id: string): Promise<ReplayFailedResult> {
    return this.client.request<ReplayFailedResult>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${id}/deliveries/replay-failed`,
    })
  }
}

// ---------------------------------------------------------------------------
// Signature verification (standalone, no client required)
// ---------------------------------------------------------------------------

/**
 * Verify the signature of an inbound webhook delivery.
 *
 * SudoMock sends the signature and timestamp in TWO separate headers:
 *
 *   - `X-SudoMock-Signature`: hex-encoded HMAC-SHA256 digest
 *   - `X-SudoMock-Timestamp`: unix timestamp (seconds)
 *
 * The signed payload is `` `${timestamp}.${rawBody}` `` keyed by the endpoint's
 * signing secret. Verification is constant-time and rejects deliveries whose
 * timestamp is outside the tolerance window (default 300s) to prevent replays.
 *
 * Pass the EXACT raw request body string -- re-serialized JSON will not match.
 *
 * @example
 * ```ts
 * import { verifyWebhookSignature } from 'sudomock'
 *
 * const ok = verifyWebhookSignature(
 *   rawBody,                                       // string, untouched
 *   req.headers['x-sudomock-signature'] as string,
 *   req.headers['x-sudomock-timestamp'] as string,
 *   endpointSecret,
 * )
 * if (!ok) return res.status(400).end()
 * ```
 *
 * @returns `true` if the signature is valid and within the tolerance window.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string | number,
  secret: string,
  options: VerifyWebhookOptions = {},
): boolean {
  if (!signature) return false

  const ts =
    typeof timestamp === 'number' ? timestamp : Number.parseInt(timestamp, 10)
  if (Number.isNaN(ts)) return false

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > tolerance) return false

  const expected = createHmac('sha256', secret)
    .update(`${ts}.${payload}`)
    .digest('hex')

  return safeEqualHex(signature, expected)
}

/** Constant-time hex string comparison (length-safe). */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}
