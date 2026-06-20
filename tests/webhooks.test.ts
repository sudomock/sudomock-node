import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { http, HttpResponse } from 'msw'
import SudoMock, {
  verifyWebhookSignature,
  parseWebhookSignatureHeader,
} from '../src/index'
import {
  TEST_API_KEY,
  TEST_BASE_URL,
  server,
  MOCK_WEBHOOK_ENDPOINT,
} from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

const EP_UUID = '77777777-7777-7777-7777-777777777777'

function sign(secret: string, timestamp: number, body: string): string {
  const hex = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')
  return `t=${timestamp},v1=${hex}`
}

describe('webhooks CRUD', () => {
  it('lists endpoints', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/webhook-endpoints`, ({ request }) => {
        // webhook routes accept x-api-key alt-auth
        expect(request.headers.get('x-api-key')).toBe(TEST_API_KEY)
        return HttpResponse.json({
          success: true,
          data: { endpoints: [MOCK_WEBHOOK_ENDPOINT], total: 1 },
        })
      }),
    )

    const client = createClient()
    const { endpoints, total } = await client.webhooks.list()
    expect(total).toBe(1)
    expect(endpoints[0]!.url).toBe('https://example.com/hooks/sudomock')
    expect(endpoints[0]!.events).toContain('render.succeeded')
  })

  it('creates an endpoint and returns the secret', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({ success: true, data: MOCK_WEBHOOK_ENDPOINT })
        },
      ),
    )

    const client = createClient()
    const ep = await client.webhooks.create({
      url: 'https://example.com/hooks/sudomock',
      events: ['render.succeeded', 'render.failed'],
    })
    expect(ep.secret).toBe('whsec_abc123')
    expect(capturedBody['url']).toBe('https://example.com/hooks/sudomock')
    expect(capturedBody['events']).toEqual([
      'render.succeeded',
      'render.failed',
    ])
  })

  it('updates an endpoint', async () => {
    server.use(
      http.patch(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:uuid`,
        () =>
          HttpResponse.json({
            success: true,
            data: { ...MOCK_WEBHOOK_ENDPOINT, enabled: false },
          }),
      ),
    )

    const client = createClient()
    const ep = await client.webhooks.update(EP_UUID, { enabled: false })
    expect(ep.enabled).toBe(false)
  })

  it('deletes an endpoint (204)', async () => {
    server.use(
      http.delete(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:uuid`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    const client = createClient()
    await expect(client.webhooks.delete(EP_UUID)).resolves.toBeUndefined()
  })

  it('rotates the signing secret', async () => {
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:uuid/rotate-secret`,
        () =>
          HttpResponse.json({
            success: true,
            data: { ...MOCK_WEBHOOK_ENDPOINT, secret: 'whsec_rotated' },
          }),
      ),
    )

    const client = createClient()
    const ep = await client.webhooks.rotateSecret(EP_UUID)
    expect(ep.secret).toBe('whsec_rotated')
  })

  it('sends a test delivery', async () => {
    let hit = false
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:uuid/test`,
        () => {
          hit = true
          return new HttpResponse(null, { status: 204 })
        },
      ),
    )

    const client = createClient()
    await client.webhooks.test(EP_UUID)
    expect(hit).toBe(true)
  })

  it('lists deliveries and replays one', async () => {
    let replayPath = ''
    server.use(
      http.get(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:uuid/deliveries`,
        () =>
          HttpResponse.json({
            success: true,
            data: {
              deliveries: [
                {
                  uuid: 'd-1',
                  event: 'render.succeeded',
                  response_status: 200,
                  success: true,
                  job_uuid: 'j-1',
                },
              ],
              total: 1,
            },
          }),
      ),
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:uuid/deliveries/:id/replay`,
        ({ request }) => {
          replayPath = new URL(request.url).pathname
          return new HttpResponse(null, { status: 204 })
        },
      ),
    )

    const client = createClient()
    const { deliveries } = await client.webhooks.listDeliveries(EP_UUID)
    expect(deliveries[0]!.responseStatus).toBe(200)
    expect(deliveries[0]!.jobUuid).toBe('j-1')

    await client.webhooks.replayDelivery(EP_UUID, 'd-1')
    expect(replayPath).toBe(
      `/api/v1/webhook-endpoints/${EP_UUID}/deliveries/d-1/replay`,
    )
  })
})

describe('verifyWebhookSignature()', () => {
  const secret = 'whsec_test_secret'
  const body = JSON.stringify({ event: 'render.succeeded', job: 'abc' })

  it('parses a well-formed header', () => {
    const parsed = parseWebhookSignatureHeader('t=1700000000,v1=deadbeef')
    expect(parsed).not.toBeNull()
    expect(parsed!.timestamp).toBe(1700000000)
    expect(parsed!.signatures).toEqual(['deadbeef'])
  })

  it('returns null for malformed headers', () => {
    expect(parseWebhookSignatureHeader('')).toBeNull()
    expect(parseWebhookSignatureHeader('garbage')).toBeNull()
    expect(parseWebhookSignatureHeader('t=123')).toBeNull() // no v1
  })

  it('accepts a valid signature within tolerance', () => {
    const ts = Math.floor(Date.now() / 1000)
    const header = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, header, secret)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const ts = Math.floor(Date.now() / 1000)
    const header = sign(secret, ts, body)
    expect(verifyWebhookSignature(body + 'x', header, secret)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const ts = Math.floor(Date.now() / 1000)
    const header = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, header, 'whsec_wrong')).toBe(false)
  })

  it('rejects an expired timestamp (replay) beyond tolerance', () => {
    const ts = Math.floor(Date.now() / 1000) - 1000 // 1000s ago, > 300 default
    const header = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, header, secret)).toBe(false)
  })

  it('honors a custom tolerance', () => {
    const ts = Math.floor(Date.now() / 1000) - 400
    const header = sign(secret, ts, body)
    expect(verifyWebhookSignature(body, header, secret)).toBe(false)
    expect(
      verifyWebhookSignature(body, header, secret, { toleranceSeconds: 600 }),
    ).toBe(true)
  })

  it('accepts when one of multiple v1 signatures matches (rotation)', () => {
    const ts = Math.floor(Date.now() / 1000)
    const good = createHmac('sha256', secret)
      .update(`${ts}.${body}`)
      .digest('hex')
    const header = `t=${ts},v1=${'0'.repeat(64)},v1=${good}`
    expect(verifyWebhookSignature(body, header, secret)).toBe(true)
  })
})
