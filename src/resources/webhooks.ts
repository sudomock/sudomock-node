import { createHmac, timingSafeEqual } from 'node:crypto'
import type { HttpClient } from '../client'
import type {
  WebhookEndpoint,
  WebhookEndpointListResult,
  CreateWebhookEndpointParams,
  UpdateWebhookEndpointParams,
  WebhookDeliveryListResult,
  WebhookSignature,
  VerifyWebhookOptions,
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
   * const { endpoints } = await client.webhooks.list()
   * ```
   */
  async list(): Promise<WebhookEndpointListResult> {
    return this.client.request<WebhookEndpointListResult>({
      method: 'GET',
      path: '/api/v1/webhook-endpoints',
    })
  }

  /**
   * Get a single webhook endpoint by UUID.
   */
  async retrieve(uuid: string): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'GET',
      path: `/api/v1/webhook-endpoints/${uuid}`,
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
   *   events: ['render.succeeded', 'render.failed'],
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
   * Update a webhook endpoint (URL, subscribed events, or enabled state).
   */
  async update(
    uuid: string,
    params: UpdateWebhookEndpointParams,
  ): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'PATCH',
      path: `/api/v1/webhook-endpoints/${uuid}`,
      body: params,
    })
  }

  /**
   * Delete a webhook endpoint permanently.
   */
  async delete(uuid: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/api/v1/webhook-endpoints/${uuid}`,
    })
  }

  /**
   * Rotate the endpoint's signing secret. The new `secret` is returned in
   * full -- update your verifier with it.
   */
  async rotateSecret(uuid: string): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${uuid}/rotate-secret`,
    })
  }

  /**
   * Send a test delivery to the endpoint to verify connectivity and signature
   * handling.
   */
  async test(uuid: string): Promise<void> {
    await this.client.request<void>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${uuid}/test`,
    })
  }

  /**
   * List recent delivery attempts for an endpoint.
   */
  async listDeliveries(uuid: string): Promise<WebhookDeliveryListResult> {
    return this.client.request<WebhookDeliveryListResult>({
      method: 'GET',
      path: `/api/v1/webhook-endpoints/${uuid}/deliveries`,
    })
  }

  /**
   * Replay a previous delivery by its UUID.
   */
  async replayDelivery(uuid: string, deliveryId: string): Promise<void> {
    await this.client.request<void>({
      method: 'POST',
      path: `/api/v1/webhook-endpoints/${uuid}/deliveries/${deliveryId}/replay`,
    })
  }
}

// ---------------------------------------------------------------------------
// Signature verification (standalone, no client required)
// ---------------------------------------------------------------------------

/**
 * Parse a `SudoMock-Signature` header value of the form
 * `t=<unix-seconds>,v1=<hex>[,v1=<hex>...]`.
 *
 * Returns `null` if the header is malformed or carries no `v1` signature.
 */
export function parseWebhookSignatureHeader(
  header: string,
): WebhookSignature | null {
  if (!header) return null

  let timestamp: number | null = null
  const signatures: string[] = []

  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') {
      const parsed = Number.parseInt(value, 10)
      if (!Number.isNaN(parsed)) timestamp = parsed
    } else if (key === 'v1') {
      if (value) signatures.push(value)
    }
  }

  if (timestamp === null || signatures.length === 0) return null
  return { timestamp, signatures }
}

/**
 * Verify the signature of an inbound webhook delivery.
 *
 * The signed payload is `` `${timestamp}.${rawBody}` `` and the signature is a
 * hex-encoded HMAC-SHA256 keyed by the endpoint's signing secret. Verification
 * is constant-time and rejects deliveries whose timestamp is outside the
 * tolerance window (default 300s) to prevent replay attacks.
 *
 * Pass the EXACT raw request body string -- re-serialized JSON will not match.
 *
 * @example
 * ```ts
 * import { verifyWebhookSignature } from 'sudomock'
 *
 * const ok = verifyWebhookSignature(
 *   rawBody,                                   // string, untouched
 *   req.headers['sudomock-signature'] as string,
 *   endpointSecret,
 * )
 * if (!ok) return res.status(400).end()
 * ```
 *
 * @returns `true` if the signature is valid and within the tolerance window.
 */
export function verifyWebhookSignature(
  payload: string,
  header: string,
  secret: string,
  options: VerifyWebhookOptions = {},
): boolean {
  const parsed = parseWebhookSignatureHeader(header)
  if (!parsed) return false

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parsed.timestamp) > tolerance) return false

  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${payload}`)
    .digest('hex')

  // Constant-time compare against each provided v1 signature (supports rotation
  // where two valid secrets/signatures may be in flight).
  return parsed.signatures.some((sig) => safeEqualHex(sig, expected))
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
