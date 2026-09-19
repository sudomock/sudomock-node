import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import {
  TEST_API_KEY,
  TEST_BASE_URL,
  server,
  MOCK_WEBHOOK_ENDPOINT,
} from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

const EP_ID = '77777777-7777-7777-7777-777777777777'
const JOB_ID = '99999999-9999-4999-8999-999999999999'

describe('photo-mockup job kinds', () => {
  it('reads a photo_mockup_render job kind as the API names it', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:uuid`, () =>
        HttpResponse.json({
          success: true,
          data: {
            job_id: JOB_ID,
            kind: 'photo_mockup_render',
            status: 'succeeded',
            result_url: 'https://cdn.sudomock.com/renders/async/done.webp',
          },
        }),
      ),
    )

    const job = await createClient().jobs.retrieve(JOB_ID)
    expect(job.kind).toBe('photo_mockup_render')
  })

  it('filters the job list by a photo-mockup kind', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: { jobs: [], next_cursor: null },
        })
      }),
    )

    await createClient().jobs.list({ kind: 'photo_mockup_create' })
    expect(new URL(capturedUrl).searchParams.get('kind')).toBe(
      'photo_mockup_create',
    )
  })

  it('returns the 202 create job under its family kind', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/photo-mockups`, () =>
        HttpResponse.json(
          {
            job_id: JOB_ID,
            kind: 'photo_mockup_create',
            status: 'queued',
            status_url: `/api/v1/jobs/${JOB_ID}`,
          },
          { status: 202 },
        ),
      ),
    )

    const job = await createClient().photoMockups.create({
      sourceUrl: 'https://example.com/product.jpg',
      isAsync: true,
    })
    expect(job).toEqual({
      jobId: JOB_ID,
      kind: 'photo_mockup_create',
      status: 'queued',
      statusUrl: `/api/v1/jobs/${JOB_ID}`,
    })
  })
})

describe('photo-mockup webhook events', () => {
  it('subscribes to the current photo-mockup event names', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            {
              ...MOCK_WEBHOOK_ENDPOINT,
              event_types: [
                'photo_mockup.ready',
                'photo_mockup_render.succeeded',
              ],
            },
            { status: 201 },
          )
        },
      ),
    )

    const ep = await createClient().webhooks.create({
      url: 'https://example.com/hooks/sudomock',
      eventTypes: ['photo_mockup.ready', 'photo_mockup_render.succeeded'],
    })

    expect(capturedBody['event_types']).toEqual([
      'photo_mockup.ready',
      'photo_mockup_render.succeeded',
    ])
    expect(ep.eventTypes).toEqual([
      'photo_mockup.ready',
      'photo_mockup_render.succeeded',
    ])
  })

  it('filters deliveries by a current photo-mockup event name', async () => {
    let capturedUrl = ''
    server.use(
      http.get(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id/deliveries`,
        ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        },
      ),
    )

    await createClient().webhooks.listDeliveries(EP_ID, {
      eventType: 'photo_mockup_render.failed',
    })
    expect(new URL(capturedUrl).searchParams.get('event_type')).toBe(
      'photo_mockup_render.failed',
    )
  })
})

describe('webhook endpoint event naming', () => {
  it('pins a new endpoint to the current names', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            { ...MOCK_WEBHOOK_ENDPOINT, event_naming: 'current' },
            { status: 201 },
          )
        },
      ),
    )

    const ep = await createClient().webhooks.create({
      url: 'https://example.com/hooks/sudomock',
      eventTypes: ['photo_mockup_render.succeeded'],
      eventNaming: 'current',
    })
    // SDK sends the API field name `event_naming` (snake_cased from eventNaming).
    expect(capturedBody['event_naming']).toBe('current')
    expect(ep.eventNaming).toBe('current')
  })

  it('leaves the naming to the API default when not given', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            { ...MOCK_WEBHOOK_ENDPOINT, event_naming: 'current' },
            { status: 201 },
          )
        },
      ),
    )

    await createClient().webhooks.create({
      url: 'https://example.com/hooks/sudomock',
    })
    expect(capturedBody).not.toHaveProperty('event_naming')
  })

  it('reads the pinned naming back on list and retrieve', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/webhook-endpoints`, () =>
        HttpResponse.json([{ ...MOCK_WEBHOOK_ENDPOINT, event_naming: 'legacy' }]),
      ),
      http.get(`${TEST_BASE_URL}/api/v1/webhook-endpoints/:id`, () =>
        HttpResponse.json({ ...MOCK_WEBHOOK_ENDPOINT, event_naming: 'legacy' }),
      ),
    )

    const client = createClient()
    const [listed] = await client.webhooks.list()
    expect(listed!.eventNaming).toBe('legacy')
    expect(listed).not.toHaveProperty('privateEndpointState')
    const retrieved = await client.webhooks.retrieve(EP_ID)
    expect(retrieved.eventNaming).toBe('legacy')
  })

  it('leaves eventNaming undefined on a response that predates it', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/webhook-endpoints/:id`, () =>
        HttpResponse.json(MOCK_WEBHOOK_ENDPOINT),
      ),
    )

    const ep = await createClient().webhooks.retrieve(EP_ID)
    expect(ep.eventNaming).toBeUndefined()
  })

  it('re-pins an endpoint to the current names on update', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.patch(
        `${TEST_BASE_URL}/api/v1/webhook-endpoints/:id`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            ...MOCK_WEBHOOK_ENDPOINT,
            event_naming: 'current',
          })
        },
      ),
    )

    const ep = await createClient().webhooks.update(EP_ID, {
      eventNaming: 'current',
    })
    expect(capturedBody['event_naming']).toBe('current')
    expect(ep.eventNaming).toBe('current')
  })
})
