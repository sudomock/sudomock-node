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
      http.post(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups`, () =>
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

    const job = await createClient().ai.create({
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

    await createClient().webhooks.listDeliveries(
      '77777777-7777-7777-7777-777777777777',
      { eventType: 'photo_mockup_render.failed' },
    )
    expect(new URL(capturedUrl).searchParams.get('event_type')).toBe(
      'photo_mockup_render.failed',
    )
  })
})
