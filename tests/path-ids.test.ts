import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import { TEST_API_KEY, TEST_BASE_URL, server } from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

// An id often arrives from an application's own end user. Unencoded, a `?` in
// it escapes its path segment and adds a query parameter the caller never
// asked for, which on a destructive route is how a read turns into a delete.
const HOSTILE = 'a1b2c3d4-0000-0000-0000-000000000000?recursive=true&foo=1'

describe('an id stays inside its path segment', () => {
  it('on every resource that puts one in the path', async () => {
    const seen: string[] = []
    const capture = ({ request }: { request: Request }) => {
      seen.push(request.url)
      return HttpResponse.json({ success: true, data: {} })
    }
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/psd-mockups/:uuid`, capture),
      http.get(`${TEST_BASE_URL}/api/v1/photo-mockups/:id`, capture),
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:id`, capture),
      http.get(`${TEST_BASE_URL}/api/v1/webhook-endpoints/:id`, capture),
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id/deliveries/:deliveryId/replay`,
        capture,
      ),
    )
    const client = createClient()

    await client.psdMockups.get(HOSTILE).catch(() => undefined)
    await client.photoMockups.get(HOSTILE).catch(() => undefined)
    await client.jobs.retrieve(HOSTILE).catch(() => undefined)
    await client.webhooks.retrieve(HOSTILE).catch(() => undefined)
    await client.webhooks.replayDelivery(HOSTILE, HOSTILE).catch(() => undefined)

    expect(seen).toHaveLength(5)
    for (const url of seen) {
      const parsed = new URL(url)
      expect(parsed.searchParams.has('recursive'), url).toBe(false)
      expect(parsed.searchParams.has('foo'), url).toBe(false)
      expect(parsed.pathname).toContain('%3Frecursive%3Dtrue')
    }
  })
})
