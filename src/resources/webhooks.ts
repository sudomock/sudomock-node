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

const ENGINE_DETAIL =
  new RegExp(
  // Encoded: this package is PUBLIC on npm and the spelled-out list names
  // every provider and pipeline concept it exists to hide.
  Buffer.from("Z2VtaW5pfGFkdmFuY2VkLj9tb2RlbHxcYm1vZGVsXGJ8cHJvbXB0fG1hc2soPzpffC18XGIpfHNlZ21lbnQoPzphdGlvbik/KD86X3wtfFxiKXxyZWdpb24uP2luZGV4fGRlcHRofGRpc3BsYWNlbWVudHxncmlkfHdhcnB8c2hhZGluZ3xwcm92aWRlcnxwaXBlbGluZXxlbmdpbmV8aW50ZXJuYWx8cHJpdmF0ZXxzdG9yYWdlfGJ1Y2tldHxjb25maWcuP3ZlcnNpb258c2V0dXAuP3JldmlzaW9ufGVkaXQuP2dlbmVyYXRpb258XGJwaGFzZVxifHN0YXRlLj9tYWNoaW5lfCg/OmludGVybmFsfHByb2Nlc3Npbmd8d29ya2Zsb3cpLj9zdGF0ZQ==", "base64").toString(),
  "i",
)

function toWebhookDelivery(value: WebhookDelivery): WebhookDelivery {
  return {
    id: value.id,
    endpointId: value.endpointId,
    jobId: value.jobId,
    eventType: value.eventType,
    status: value.status,
    httpStatus: value.httpStatus,
    attempt: value.attempt,
    lastError:
      value.lastError && ENGINE_DETAIL.test(value.lastError)
        ? 'Delivery failed. Retry it or contact support with the delivery ID.'
        : value.lastError,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function toWebhookEndpoint(value: WebhookEndpoint): WebhookEndpoint {
  return {
    id: value.id,
    url: value.url,
    secret: value.secret,
    description: value.description,
    eventTypes: value.eventTypes,
    enabled: value.enabled,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

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
    const endpoints = await this.client.request<WebhookEndpoint[]>({
      method: 'GET',
      path: '/api/v1/webhook-endpoints',
    })
    return endpoints.map(toWebhookEndpoint)
  }

  /**
   * Get a single webhook endpoint by id.
   */
  async retrieve(id: string): Promise<WebhookEndpoint> {
    const endpoint = await this.client.request<WebhookEndpoint>({
      method: 'GET',
      path: `/api/v1/webhook-endpoints/${id}`,
    })
    return toWebhookEndpoint(endpoint)
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
    const endpoint = await this.client.request<WebhookEndpoint>({
      method: 'POST',
      path: '/api/v1/webhook-endpoints',
      // Default to the wildcard subscription (all events) when omitted.
      body: {
        url: params.url,
        eventTypes: params.eventTypes ?? [],
        description: params.description,
      },
    })
    return toWebhookEndpoint(endpoint)
  }

  /**
   * Update a webhook endpoint (URL, subscribed event types, description, or
   * enabled state).
   */
  async update(
    id: string,
    params: UpdateWebhookEndpointParams,
  ): Promise<WebhookEndpoint> {
    const endpoint = await this.client.request<WebhookEndpoint>({
      method: 'PATCH',
      path: `/api/v1/webhook-endpoints/${id}`,
      body: {
        url: params.url,
        eventTypes: params.eventTypes,
        description: params.description,
        enabled: params.enabled,
      },
    })
    return toWebhookEndpoint(endpoint)
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
    const endpoint = await this.client.request<WebhookEndpoint>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${id}/rotate-secret`,
    })
    return toWebhookEndpoint(endpoint)
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
    const deliveries = await this.client.request<WebhookDelivery[]>({
      method: 'GET',
      path: '/api/v1/webhook-endpoints/events',
      query: {
        status: params.status,
        event_type: params.eventType,
        limit: params.limit,
      },
    })
    return deliveries.map(toWebhookDelivery)
  }

  /**
   * List recent delivery attempts for an endpoint. Optionally filter by status
   * and/or event type, and cap the row count.
   */
  async listDeliveries(
    id: string,
    params: ListDeliveriesParams = {},
  ): Promise<WebhookDelivery[]> {
    const deliveries = await this.client.request<WebhookDelivery[]>({
      method: 'GET',
      path: `/api/v1/webhook-endpoints/${id}/deliveries`,
      query: {
        status: params.status,
        event_type: params.eventType,
        limit: params.limit,
      },
    })
    return deliveries.map(toWebhookDelivery)
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
    const result = await this.client.request<ReplayFailedResult>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${id}/deliveries/replay-failed`,
    })
    return { status: result.status, count: result.count }
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
