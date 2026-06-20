import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import { TimeoutError } from '../src/errors'
import {
  TEST_API_KEY,
  TEST_BASE_URL,
  server,
  MOCK_JOB_ACCEPTED_RESPONSE,
  MOCK_VIDEO_ACCEPTED_RESPONSE,
  MOCK_JOB_SUCCEEDED_RESPONSE,
  MOCK_JOB_PAYG_SUCCEEDED_RESPONSE,
} from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

const ASYNC_UUID = '55555555-5555-5555-5555-555555555555'

describe('renders.create({ isAsync: true })', () => {
  it('returns a Job on 202 without crashing on missing printFiles', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders`, () => {
        return HttpResponse.json(MOCK_JOB_ACCEPTED_RESPONSE, { status: 202 })
      }),
    )

    const client = createClient()
    const job = await client.renders.create({
      mockupId: 'mock-uuid',
      smartObjects: [{ uuid: 'so-uuid', asset: { url: 'https://x/a.png' } }],
      isAsync: true,
    })

    // `job` is typed as Job via the overload -- no `url`/`printFiles` access.
    expect(job.renderUuid).toBe(ASYNC_UUID)
    expect(job.kind).toBe('render')
    expect(job.status).toBe('queued')
    expect(job.statusUrl).toBe(`/api/v1/jobs/${ASYNC_UUID}`)
  })

  it('sends is_async in snake_case', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(MOCK_JOB_ACCEPTED_RESPONSE, { status: 202 })
      }),
    )

    const client = createClient()
    await client.renders.create({
      mockupId: 'mock-uuid',
      smartObjects: [{ uuid: 'so-uuid' }],
      isAsync: true,
    })

    expect(capturedBody['is_async']).toBe(true)
  })

  it('still returns a RenderResult (with url) on a 200 sync response', async () => {
    const client = createClient()
    const result = await client.renders.create({
      mockupId: '11111111-1111-1111-1111-111111111111',
      smartObjects: [{ uuid: 'so-uuid', asset: { url: 'https://x/a.png' } }],
    })
    expect(result.url).toBe(
      'https://cdn.sudomock.com/renders/test/render_123.webp',
    )
  })
})

describe('renders.createVideo()', () => {
  it('returns a video Job', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders/video`, () => {
        return HttpResponse.json(MOCK_VIDEO_ACCEPTED_RESPONSE, { status: 202 })
      }),
    )

    const client = createClient()
    const job = await client.renders.createVideo({
      mockupId: 'mock-uuid',
      smartObjects: [{ uuid: 'so-uuid' }],
      video: { durationSeconds: 5, audio: false },
    })

    expect(job.kind).toBe('video')
    expect(job.renderUuid).toBe('66666666-6666-6666-6666-666666666666')
  })

  it('sends video options in snake_case', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders/video`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(MOCK_VIDEO_ACCEPTED_RESPONSE, { status: 202 })
      }),
    )

    const client = createClient()
    await client.renders.createVideo({
      mockupId: 'mock-uuid',
      video: { durationSeconds: 8, audio: true, advancedModel: 'veo-3.1-fast' },
    })

    expect(capturedBody['mockup_uuid']).toBe('mock-uuid')
    const video = capturedBody['video'] as Record<string, unknown>
    expect(video['duration_seconds']).toBe(8)
    expect(video['audio']).toBe(true)
    expect(video['advanced_model']).toBe('veo-3.1-fast')
  })
})

describe('jobs.retrieve()', () => {
  it('fetches and normalizes a terminal job', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:uuid`, () => {
        return HttpResponse.json(MOCK_JOB_SUCCEEDED_RESPONSE)
      }),
    )

    const client = createClient()
    const job = await client.jobs.retrieve(ASYNC_UUID)
    expect(job.status).toBe('succeeded')
    expect(job.resultUrl).toBe(
      'https://cdn.sudomock.com/renders/async/done.webp',
    )
    expect(job.mockupUuid).toBeNull()
    expect(job.creditsCharged).toBe(1)
    expect(job.payg).toBeNull()
  })

  it('surfaces the nested PAYG cost breakdown', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:uuid`, () => {
        return HttpResponse.json(MOCK_JOB_PAYG_SUCCEEDED_RESPONSE)
      }),
    )

    const client = createClient()
    const job = await client.jobs.retrieve(ASYNC_UUID)
    expect(job.creditsCharged).toBe(2)
    expect(job.payg?.credits).toBe(2)
    expect(job.payg?.unitPrice).toBe(0.0035)
    expect(job.payg?.cost).toBe(0.007)
  })
})

describe('jobs.waitForJob()', () => {
  it('polls until the job reaches a terminal state', async () => {
    let calls = 0
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:uuid`, () => {
        calls++
        if (calls < 3) {
          return HttpResponse.json({
            success: true,
            data: { render_uuid: ASYNC_UUID, kind: 'render', status: 'running' },
          })
        }
        return HttpResponse.json(MOCK_JOB_SUCCEEDED_RESPONSE)
      }),
    )

    const client = createClient()
    const job = await client.jobs.waitForJob(ASYNC_UUID, { intervalMs: 5 })
    expect(job.status).toBe('succeeded')
    expect(calls).toBe(3)
  })

  it('returns a failed job without throwing', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:uuid`, () => {
        return HttpResponse.json({
          success: true,
          data: {
            render_uuid: ASYNC_UUID,
            kind: 'render',
            status: 'failed',
            error: 'render engine error',
          },
        })
      }),
    )

    const client = createClient()
    const job = await client.jobs.waitForJob(ASYNC_UUID, { intervalMs: 5 })
    expect(job.status).toBe('failed')
    expect(job.error).toBe('render engine error')
  })

  it('throws TimeoutError when the job never finishes', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:uuid`, () => {
        return HttpResponse.json({
          success: true,
          data: { render_uuid: ASYNC_UUID, kind: 'render', status: 'running' },
        })
      }),
    )

    const client = createClient()
    await expect(
      client.jobs.waitForJob(ASYNC_UUID, { intervalMs: 5, timeoutMs: 20 }),
    ).rejects.toThrow(TimeoutError)
  })
})

describe('uploads.create({ isAsync: true })', () => {
  it('returns a Job on 202 (FREE upload)', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/psd/upload`, () => {
        return HttpResponse.json(MOCK_JOB_ACCEPTED_RESPONSE, { status: 202 })
      }),
    )

    const client = createClient()
    const job = await client.uploads.create({
      psdFileUrl: 'https://example.com/x.psd',
      isAsync: true,
    })
    expect(job.renderUuid).toBe(ASYNC_UUID)
    expect(job.status).toBe('queued')
  })

  it('still returns an UploadResult on a sync 200', async () => {
    const client = createClient()
    const result = await client.uploads.create({
      psdFileUrl: 'https://example.com/x.psd',
    })
    expect(result.uuid).toBe('11111111-1111-1111-1111-111111111111')
    expect(result.smartObjects).toHaveLength(1)
  })
})
