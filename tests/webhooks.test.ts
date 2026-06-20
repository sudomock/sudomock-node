import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { http, HttpResponse } from 'msw'
import SudoMock, { verifyWebhookSignature } from '../src/index'
import {
  TEST_API_KEY,
  TEST_BASE_URL,
  server,
  MOCK_WEBHOOK_ENDPOINT,
  MOCK_WEBHOOK_DELIVERY,
} from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

const EP_ID = '77777777-7777-7777-7777-777777777777'

/** Compute the X-SudoMock-Signature value (hex HMAC-SHA256 of `${ts}.${body}`). */
function sign(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')
}

describe('webhooks CRUD', () => {
  it('lists endpoints (bare array)', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/webhook-endpoints`, ({ request }) => {
        // webhook routes accept x-api-key alt-auth
        expect(request.headers.get('x-api-key')).toBe(TEST_API_KEY)
        return HttpResponse.json([MOCK_WEBHOOK_ENDPOINT])
      }),
    )

    const client = createClient()
    const endpoints = await client.webhooks.list()
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]!.id).toBe(EP_ID)
    expect(endpoints[0]!.url).toBe('https://example.com/hooks/sudomock')
    expect(endpoints[0]!.eventTypes).toContain('render.succeeded')
  })

  it('creates an endpoint and returns the secret', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(MOCK_WEBHOOK_ENDPOINT, { status: 201 })
        },
      ),
    )

    const client = createClient()
    const ep = await client.webhooks.create({
      url: 'https://example.com/hooks/sudomock',
      eventTypes: ['render.succeeded', 'render.failed'],
    })
    expect(ep.secret).toBe('whsec_abc123')
    expect(ep.id).toBe(EP_ID)
    expect(capturedBody['url']).toBe('https://example.com/hooks/sudomock')
    // SDK sends the API field name `event_types` (snake_cased from eventTypes).
    expect(capturedBody['event_types']).toEqual([
      'render.succeeded',
      'render.failed',
    ])
  })

  it('updates an endpoint', async () => {
    server.use(
      http.patch(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id`,
        () =>
          HttpResponse.json({ ...MOCK_WEBHOOK_ENDPOINT, enabled: false }),
      ),
    )

    const client = createClient()
    const ep = await client.webhooks.update(EP_ID, { enabled: false })
    expect(ep.enabled).toBe(false)
  })

  it('deletes an endpoint (204)', async () => {
    server.use(
      http.delete(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    const client = createClient()
    await expect(client.webhooks.delete(EP_ID)).resolves.toBeUndefined()
  })

  it('rotates the signing secret', async () => {
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id/rotate-secret`,
        () =>
          HttpResponse.json({ ...MOCK_WEBHOOK_ENDPOINT, secret: 'whsec_rotated' }),
      ),
    )

    const client = createClient()
    const ep = await client.webhooks.rotateSecret(EP_ID)
    expect(ep.secret).toBe('whsec_rotated')
  })

  it('sends a test delivery', async () => {
    let hit = false
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id/test`,
        () => {
          hit = true
          return new HttpResponse(null, { status: 204 })
        },
      ),
    )

    const client = createClient()
    await client.webhooks.test(EP_ID)
    expect(hit).toBe(true)
  })

  it('lists deliveries (bare array) and replays one', async () => {
    let replayPath = ''
    server.use(
      http.get(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id/deliveries`,
        () => HttpResponse.json([MOCK_WEBHOOK_DELIVERY]),
      ),
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id/deliveries/:deliveryId/replay`,
        ({ request }) => {
          replayPath = new URL(request.url).pathname
          return new HttpResponse(null, { status: 204 })
        },
      ),
    )

    const client = createClient()
    const deliveries = await client.webhooks.listDeliveries(EP_ID)
    expect(deliveries[0]!.id).toBe('88888888-8888-8888-8888-888888888888')
    expect(deliveries[0]!.eventType).toBe('render.succeeded')
    expect(deliveries[0]!.httpStatus).toBe(500)
    expect(deliveries[0]!.attempt).toBe(2)
    expect(deliveries[0]!.lastError).toBe('non-2xx response: 500')

    await client.webhooks.replayDelivery(EP_ID, 'd-1')
    expect(replayPath).toBe(
      `/api/v1/webhook-endpoints/${EP_ID}/deliveries/d-1/replay`,
    )
  })
})

describe('verifyWebhookSignature() — split headers', () => {
  const secret = 'whsec_test_secret'
  const body = JSON.stringify({ event: 'render.succeeded', job: 'abc' })

  it('accepts a valid signature within tolerance', () => {
    const ts = Math.floor(Date.now() / 1000)
    const sig = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, sig, String(ts), secret)).toBe(true)
  })

  it('accepts a numeric timestamp', () => {
    const ts = Math.floor(Date.now() / 1000)
    const sig = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, sig, ts, secret)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const ts = Math.floor(Date.now() / 1000)
    const sig = sign(secret, ts, body)
    expect(verifyWebhookSignature(body + 'x', sig, String(ts), secret)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const ts = Math.floor(Date.now() / 1000)
    const sig = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, sig, String(ts), 'whsec_wrong')).toBe(false)
  })

  it('rejects a missing signature', () => {
    const ts = Math.floor(Date.now() / 1000)
    expect(verifyWebhookSignature(body, '', String(ts), secret)).toBe(false)
  })

  it('rejects a non-integer timestamp', () => {
    const sig = sign(secret, 1700000000, body)
    expect(verifyWebhookSignature(body, sig, 'not-a-number', secret)).toBe(false)
  })

  it('rejects an expired timestamp (replay) beyond tolerance', () => {
    const ts = Math.floor(Date.now() / 1000) - 1000 // 1000s ago, > 300 default
    const sig = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, sig, String(ts), secret)).toBe(false)
  })

  it('honors a custom tolerance', () => {
    const ts = Math.floor(Date.now() / 1000) - 400
    const sig = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, sig, String(ts), secret)).toBe(false)
    expect(
      verifyWebhookSignature(body, sig, String(ts), secret, {
        toleranceSeconds: 600,
      }),
    ).toBe(true)
  })
})
