import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock, {
  JobFailedError,
  TimeoutError,
  ValidationError,
  type TwoDPrintAreaInput,
} from '../src/index'
import { CreditError } from '../src/errors'
import {
  TEST_API_KEY,
  TEST_BASE_URL,
  server,
  MOCK_RENDER_RESPONSE,
  MOCK_AI_RENDER_RESPONSE,
  MOCK_2D_MOCKUP,
  MOCK_VIDEO_ACCEPTED_RESPONSE,
} from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

const TWO_D_CREATE_JOB_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

describe('renders.create()', () => {
  it('renders a mockup and returns URL', async () => {
    const client = createClient()
    const result = await client.renders.create({
      mockupId: '11111111-1111-1111-1111-111111111111',
      smartObjects: [
        {
          uuid: '22222222-2222-2222-2222-222222222222',
          asset: { url: 'https://example.com/artwork.png' },
        },
      ],
    })

    expect(result.printFiles).toHaveLength(1)
    expect(result.url).toBe(
      'https://cdn.sudomock.com/renders/test/render_123.webp',
    )
    expect(result.printFiles[0]!.smartObjectUuid).toBe(
      '22222222-2222-2222-2222-222222222222',
    )
  })

  it('sends export options in snake_case', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(MOCK_RENDER_RESPONSE)
      }),
    )

    const client = createClient()
    await client.renders.create({
      mockupId: 'test-uuid',
      smartObjects: [{ uuid: 'so-uuid' }],
      exportOptions: { imageFormat: 'webp', imageSize: 1080, quality: 90 },
      exportLabel: 'my-render',
    })

    const exportOpts = capturedBody['export_options'] as Record<string, unknown>
    expect(exportOpts['image_format']).toBe('webp')
    expect(exportOpts['image_size']).toBe(1080)
    expect(exportOpts['quality']).toBe(90)
    expect(capturedBody['export_label']).toBe('my-render')
  })

  it('passes dpi through as lowercase "dpi"', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(MOCK_RENDER_RESPONSE)
      }),
    )

    const client = createClient()
    await client.renders.create({
      mockupId: 'test-uuid',
      smartObjects: [{ uuid: 'so-uuid' }],
      exportOptions: { imageFormat: 'jpg', imageSize: 3600, dpi: 300 },
    })

    const exportOpts = capturedBody['export_options'] as Record<string, unknown>
    expect(exportOpts['dpi']).toBe(300)
    // Must remain lowercase 'dpi' -- not 'd_p_i' or any transformed key
    expect(Object.keys(exportOpts)).toContain('dpi')
    expect(Object.keys(exportOpts)).not.toContain('d_p_i')
  })

  it('throws CreditError on 402', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders`, () => {
        return HttpResponse.json(
          { detail: 'Insufficient credits' },
          { status: 402 },
        )
      }),
    )

    const client = createClient()
    await expect(
      client.renders.create({
        mockupId: 'test-uuid',
        smartObjects: [{ uuid: 'so-uuid' }],
      }),
    ).rejects.toThrow(CreditError)
  })
})

describe('ai.render() — 2D mockup', () => {
  it('renders artwork onto a 2D mockup and returns URL + renderUuid', async () => {
    const client = createClient()
    const result = await client.ai.render({
      mockupId: '11111111-1111-1111-1111-111111111111',
      printAreas: [
        {
          uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          artworkUrl: 'https://example.com/design.png',
        },
      ],
    })

    expect(result.printFiles).toHaveLength(1)
    expect(result.url).toBe(
      'https://cdn.sudomock.com/renders/sudoai/abc123.png',
    )
    expect(result.renderUuid).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')
    expect(result.printFiles[0]!.durationMs).toBe(2340)
    expect(result.printFiles[0]!.exportFormat).toBe('png')
  })

  it('posts the 2D render body in snake_case to /sudoai/2d-mockups/{id}/render (id in path, not body)', async () => {
    let capturedBody: Record<string, unknown> = {}
    let capturedPath = ''
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/sudoai/2d-mockups/:id/render`,
        async ({ request }) => {
          capturedPath = new URL(request.url).pathname
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(MOCK_AI_RENDER_RESPONSE)
        },
      ),
    )

    const client = createClient()
    await client.ai.render({
      mockupId: 'mockup-uuid',
      printAreas: [
        {
          uuid: 'pa-uuid',
          artworkUrl: 'https://example.com/design.png',
          adjustments: { opacity: 80, vibrance: 10, blur: 0 },
        },
      ],
      exportOptions: { imageFormat: 'webp', imageSize: 2048, quality: 90 },
    })

    expect(capturedPath).toBe('/api/v1/sudoai/2d-mockups/mockup-uuid/render')
    // Mockup id moved into the path -- it must NOT be in the body anymore.
    expect(capturedBody['mockup_uuid']).toBeUndefined()
    const printAreas = capturedBody['print_areas'] as Record<string, unknown>[]
    expect(printAreas).toHaveLength(1)
    expect(printAreas[0]!['uuid']).toBe('pa-uuid')
    expect(printAreas[0]!['artwork_url']).toBe('https://example.com/design.png')
    const adj = printAreas[0]!['adjustments'] as Record<string, unknown>
    expect(adj['opacity']).toBe(80)
    expect(adj['vibrance']).toBe(10)
    const exportOpts = capturedBody['export_options'] as Record<string, unknown>
    expect(exportOpts['image_format']).toBe('webp')
    expect(exportOpts['image_size']).toBe(2048)
    expect(exportOpts['quality']).toBe(90)
    // Default (sync) render must NOT send is_async.
    expect(capturedBody['is_async']).toBeUndefined()
  })

  it('returns a Job (202) and sends is_async when isAsync: true', async () => {
    let capturedBody: Record<string, unknown> = {}
    let capturedPath = ''
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/sudoai/2d-mockups/:id/render`,
        async ({ request }) => {
          capturedPath = new URL(request.url).pathname
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            {
              job_id: TWO_D_CREATE_JOB_ID,
              kind: '2d_render',
              status: 'queued',
              status_url: `/api/v1/jobs/${TWO_D_CREATE_JOB_ID}`,
            },
            { status: 202 },
          )
        },
      ),
    )

    const job = await createClient().ai.render({
      mockupId: 'mockup-uuid',
      printAreas: [
        { uuid: 'pa-uuid', artworkUrl: 'https://example.com/design.png' },
      ],
      isAsync: true,
    })

    // Still the plural path-param URL; id stays in the path, not the body.
    expect(capturedPath).toBe('/api/v1/sudoai/2d-mockups/mockup-uuid/render')
    expect(capturedBody['is_async']).toBe(true)
    expect(capturedBody['mockup_uuid']).toBeUndefined()
    // 202 resolves with the job envelope (no printFiles read -> no crash).
    expect(job).toEqual({
      jobId: TWO_D_CREATE_JOB_ID,
      kind: '2d_render',
      status: 'queued',
      statusUrl: `/api/v1/jobs/${TWO_D_CREATE_JOB_ID}`,
    })
    expect('printFiles' in job).toBe(false)
  })

  it('awaits an async 2D render via jobs.waitForJob to a result_url', async () => {
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/sudoai/2d-mockups/:id/render`,
        () =>
          HttpResponse.json(
            {
              job_id: TWO_D_CREATE_JOB_ID,
              kind: '2d_render',
              status: 'queued',
              status_url: `/api/v1/jobs/${TWO_D_CREATE_JOB_ID}`,
            },
            { status: 202 },
          ),
      ),
      http.get(`${TEST_BASE_URL}/api/v1/jobs/${TWO_D_CREATE_JOB_ID}`, () =>
        HttpResponse.json({
          success: true,
          data: {
            job_id: TWO_D_CREATE_JOB_ID,
            kind: '2d_render',
            status: 'succeeded',
            result_url: 'https://cdn.sudomock.com/renders/sudoai/async-done.png',
            error: null,
          },
        }),
      ),
    )

    const client = createClient()
    const job = await client.ai.render({
      mockupId: 'mockup-uuid',
      printAreas: [
        { uuid: 'pa-uuid', artworkUrl: 'https://example.com/design.png' },
      ],
      isAsync: true,
    })
    const done = await client.jobs.waitForJob(job.jobId, { intervalMs: 5 })

    expect(done.status).toBe('succeeded')
    expect(done.resultUrl).toBe(
      'https://cdn.sudomock.com/renders/sudoai/async-done.png',
    )
  })
})

describe('ai.create() and waitForReady()', () => {
  it('creates synchronously (201) and returns the ready mockup, not a job', async () => {
    let capturedBody: Record<string, unknown> = {}
    let idempotencyKey: string | null = null
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        idempotencyKey = request.headers.get('Idempotency-Key')
        return HttpResponse.json(
          { success: true, data: MOCK_2D_MOCKUP },
          { status: 201 },
        )
      }),
    )

    const mockup = await createClient().ai.create({
      sourceUrl: 'https://example.com/product.jpg',
      name: 'Front view',
      idempotencyKey: 'front-view-v1',
    })

    // Default (sync) create must NOT send is_async, and only the provided source.
    expect(capturedBody).toEqual({
      source_url: 'https://example.com/product.jpg',
      name: 'Front view',
    })
    expect(idempotencyKey).toBe('front-view-v1')
    // Resolves with the ready mockup body (with quads), not a job envelope.
    expect(mockup.mockupId).toBe(MOCK_2D_MOCKUP.mockup_id)
    expect(mockup.status).toBe('ready')
    expect(mockup.quads[0]?.printAreaId).toBe(
      MOCK_2D_MOCKUP.quads[0]!.print_area_id,
    )
    expect(mockup.quads[0]?.name).toBe('Front')
    expect('jobId' in mockup).toBe(false)
  })

  it('sends only source_base64 with a generated idempotency key', async () => {
    let capturedBody: Record<string, unknown> = {}
    let idempotencyKey: string | null = null
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        idempotencyKey = request.headers.get('Idempotency-Key')
        return HttpResponse.json(
          { success: true, data: MOCK_2D_MOCKUP },
          { status: 201 },
        )
      }),
    )

    await createClient().ai.create({ sourceBase64: 'aW1hZ2U=' })

    expect(capturedBody).toEqual({ source_base64: 'aW1hZ2U=' })
    expect(idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('returns a Job (202) and sends is_async when isAsync: true', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            job_id: TWO_D_CREATE_JOB_ID,
            kind: '2d_create',
            status: 'queued',
            status_url: `/api/v1/jobs/${TWO_D_CREATE_JOB_ID}`,
          },
          { status: 202 },
        )
      }),
    )

    const job = await createClient().ai.create({
      sourceUrl: 'https://example.com/product.jpg',
      isAsync: true,
    })

    expect(capturedBody).toEqual({
      source_url: 'https://example.com/product.jpg',
      is_async: true,
    })
    expect(job).toEqual({
      jobId: TWO_D_CREATE_JOB_ID,
      kind: '2d_create',
      status: 'queued',
      statusUrl: `/api/v1/jobs/${TWO_D_CREATE_JOB_ID}`,
    })
  })

  it('passes through seed print_areas (with names) on create', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { success: true, data: MOCK_2D_MOCKUP },
          { status: 201 },
        )
      }),
    )

    await createClient().ai.create({
      sourceUrl: 'https://example.com/product.jpg',
      printAreas: [
        { points: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'Front' },
      ],
    })

    const printAreas = capturedBody['print_areas'] as Record<string, unknown>[]
    expect(printAreas).toHaveLength(1)
    expect(printAreas[0]!['name']).toBe('Front')
  })

  it('rejects both or neither source before making a request', async () => {
    const client = createClient()
    await expect(client.ai.create({} as never)).rejects.toThrow(ValidationError)
    await expect(
      client.ai.create({ sourceUrl: 'https://example.com/x.jpg', sourceBase64: 'eA==' } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('returns the full mockup after a successful job', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            job_id: TWO_D_CREATE_JOB_ID,
            kind: '2d_create',
            status: 'succeeded',
            mockup_uuid: MOCK_2D_MOCKUP.mockup_id,
            result_url: `/api/v1/sudoai/2d-mockups/${MOCK_2D_MOCKUP.mockup_id}`,
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups/:id`, () =>
        HttpResponse.json({ success: true, data: MOCK_2D_MOCKUP }),
      ),
    )

    const mockup = await createClient().ai.waitForReady({
      jobId: TWO_D_CREATE_JOB_ID,
      kind: '2d_create',
      status: 'queued',
      statusUrl: `/api/v1/jobs/${TWO_D_CREATE_JOB_ID}`,
    })

    expect(mockup.mockupId).toBe(MOCK_2D_MOCKUP.mockup_id)
    expect(mockup.quads[0]?.printAreaId).toBe(
      MOCK_2D_MOCKUP.quads[0]!.print_area_id,
    )
  })

  it('rejects a successful job without mockup_uuid', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            job_id: TWO_D_CREATE_JOB_ID,
            kind: '2d_create',
            status: 'succeeded',
          },
        }),
      ),
    )

    await expect(
      createClient().ai.waitForReady(TWO_D_CREATE_JOB_ID),
    ).rejects.toMatchObject({ code: 'invalid_job_response' })
  })

  it('throws JobFailedError with the NOT_MOCKUPABLE reason', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            job_id: TWO_D_CREATE_JOB_ID,
            kind: '2d_create',
            status: 'failed',
            error: {
              error_code: 'NOT_MOCKUPABLE',
              message: 'The source image is not suitable for a 2D mockup.',
            },
          },
        }),
      ),
    )

    const error = await createClient().ai.waitForReady(TWO_D_CREATE_JOB_ID, {
      intervalMs: 5,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(JobFailedError)
    expect(error).toMatchObject({
      jobId: TWO_D_CREATE_JOB_ID,
      code: 'NOT_MOCKUPABLE',
      message: 'The source image is not suitable for a 2D mockup.',
    })
  })

  it('throws TimeoutError containing the job id', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            job_id: TWO_D_CREATE_JOB_ID,
            kind: '2d_create',
            status: 'running',
          },
        }),
      ),
    )

    const error = await createClient().ai.waitForReady(TWO_D_CREATE_JOB_ID, {
      intervalMs: 5,
      timeoutMs: 20,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(TimeoutError)
    expect(error).toHaveProperty(
      'message',
      expect.stringContaining(TWO_D_CREATE_JOB_ID),
    )
  })

  it('throws CreditError on 402', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups`, () =>
        HttpResponse.json(
          { detail: 'Insufficient credits' },
          { status: 402 },
        ),
      ),
    )

    await expect(
      createClient().ai.create({ sourceUrl: 'https://example.com/product.jpg' }),
    ).rejects.toThrow(CreditError)
  })
})

describe('ai.updatePrintAreas()', () => {
  it('puts the replacement geometry in the expected payload', async () => {
    let capturedBody: Record<string, unknown> = {}
    const printAreas: TwoDPrintAreaInput[] = [{
      points: [[10, 20], [110, 20], [110, 120], [10, 120]],
    }]
    server.use(
      http.put(
        `${TEST_BASE_URL}/api/v1/sudoai/2d-mockups/:id/print-areas`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            success: true,
            data: {
              mockup_id: MOCK_2D_MOCKUP.mockup_id,
              print_areas: [{
                print_area_id: MOCK_2D_MOCKUP.quads[0]!.print_area_id,
                points: printAreas[0]!.points,
                sort_order: 0,
              }],
            },
          })
        },
      ),
    )

    const result = await createClient().ai.updatePrintAreas(
      MOCK_2D_MOCKUP.mockup_id,
      printAreas,
    )

    expect(capturedBody).toEqual({ print_areas: printAreas })
    expect(result.mockupId).toBe(MOCK_2D_MOCKUP.mockup_id)
    expect(result.printAreas[0]?.sortOrder).toBe(0)
  })

  it('rejects fewer than 1 or more than 8 print areas', async () => {
    const client = createClient()
    const printArea: TwoDPrintAreaInput = {
      points: [[10, 20], [110, 20], [110, 120], [10, 120]],
    }

    await expect(
      client.ai.updatePrintAreas(MOCK_2D_MOCKUP.mockup_id, []),
    ).rejects.toThrow(ValidationError)
    await expect(
      client.ai.updatePrintAreas(
        MOCK_2D_MOCKUP.mockup_id,
        Array(9).fill(printArea),
      ),
    ).rejects.toThrow(ValidationError)
  })
})

describe('ai 2D-mockup catalog', () => {
  it('lists 2D mockups', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups`, () =>
        HttpResponse.json({
          success: true,
          data: [MOCK_2D_MOCKUP],
          total: 1,
          limit: 20,
          offset: 0,
        }),
      ),
    )

    const client = createClient()
    const page = await client.ai.list({ limit: 20 })
    // Pagination metadata (total/limit/offset) is surfaced alongside the page.
    expect(page.total).toBe(1)
    expect(page.limit).toBe(20)
    expect(page.offset).toBe(0)
    expect(page.mockups).toHaveLength(1)
    expect(page.mockups[0]!.mockupId).toBe(
      '99999999-9999-9999-9999-999999999999',
    )
    expect(page.mockups[0]!.sourceWidth).toBe(2000)
  })

  it('gets a single 2D mockup', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups/:id`, () =>
        HttpResponse.json({ success: true, data: MOCK_2D_MOCKUP }),
      ),
    )

    const client = createClient()
    const mockup = await client.ai.get('99999999-9999-9999-9999-999999999999')
    expect(mockup.name).toBe('2D Tee')
    expect(mockup.quads?.[0]!.printAreaId).toBe(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    )
    expect(mockup.quads?.[0]!.name).toBe('Front')
  })

  it('deletes a 2D mockup', async () => {
    let hitPath = ''
    server.use(
      http.delete(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockups/:id`, ({ request }) => {
        hitPath = new URL(request.url).pathname
        return HttpResponse.json({ success: true, data: { deleted: true } })
      }),
    )

    const client = createClient()
    await expect(
      client.ai.delete('99999999-9999-9999-9999-999999999999'),
    ).resolves.toBeUndefined()
    expect(hitPath).toBe(
      '/api/v1/sudoai/2d-mockups/99999999-9999-9999-9999-999999999999',
    )
  })
})

describe('renders.createVideo() — raw-image mode', () => {
  it('sends image_url and webhook in snake_case (no mockup)', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders/video`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(MOCK_VIDEO_ACCEPTED_RESPONSE, { status: 202 })
      }),
    )

    const client = createClient()
    await client.renders.createVideo({
      imageUrl: 'https://example.com/art.png',
      video: { durationSeconds: 5, motion: 'showcase' },
      webhook: { url: 'https://example.com/hooks' },
    })

    expect(capturedBody['image_url']).toBe('https://example.com/art.png')
    expect(capturedBody['mockup_uuid']).toBeUndefined()
    const video = capturedBody['video'] as Record<string, unknown>
    expect(video['motion']).toBe('showcase')
    const webhook = capturedBody['webhook'] as Record<string, unknown>
    expect(webhook['url']).toBe('https://example.com/hooks')
  })

  it('defaults durationSeconds to 5 and forwards arbitrary webhook fields', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders/video`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(MOCK_VIDEO_ACCEPTED_RESPONSE, { status: 202 })
      }),
    )

    const client = createClient()
    await client.renders.createVideo({
      imageUrl: 'https://example.com/art.png',
      // durationSeconds intentionally omitted -> should default to 5.
      video: { audio: true },
      // BE accepts an arbitrary webhook dict; extra keys must pass through.
      webhook: { url: 'https://example.com/hooks', secretHeader: 'x-token' },
    })

    const video = capturedBody['video'] as Record<string, unknown>
    expect(video['duration_seconds']).toBe(5)
    const webhook = capturedBody['webhook'] as Record<string, unknown>
    expect(webhook['url']).toBe('https://example.com/hooks')
    expect(webhook['secret_header']).toBe('x-token')
  })
})

describe('uploads.create()', () => {
  it('uploads a PSD and returns mockup data', async () => {
    const client = createClient()
    const result = await client.uploads.create({
      psdFileUrl: 'https://example.com/test.psd',
      psdName: 'My Test PSD',
    })

    expect(result.uuid).toBe('11111111-1111-1111-1111-111111111111')
    expect(result.name).toBe('Test Mockup')
    expect(result.smartObjects).toHaveLength(1)
  })

  it('sends upload params in snake_case', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/psd/upload`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          success: true,
          data: {
            uuid: 'new-uuid',
            name: 'Test',
            thumbnail: '',
            width: 1000,
            height: 800,
            smart_objects: [],
            text_layers: [],
            collections: [],
            thumbnails: [],
          },
          message: '',
        })
      }),
    )

    const client = createClient()
    await client.uploads.create({
      psdFileUrl: 'https://example.com/test.psd',
      psdName: 'My Test',
    })

    expect(capturedBody['psd_file_url']).toBe('https://example.com/test.psd')
    expect(capturedBody['psd_name']).toBe('My Test')
  })
})

describe('account.get()', () => {
  it('returns account info with usage', async () => {
    const client = createClient()
    const result = await client.account.get()

    expect(result.account.email).toBe('test@example.com')
    expect(result.subscription.plan).toBe('pro')
    expect(result.usage.creditsRemaining).toBe(950)
    expect(result.apiKey.totalRequests).toBe(1234)
  })
})

describe('studio.createSession()', () => {
  it('creates a session and returns token', async () => {
    const client = createClient()
    const result = await client.studio.createSession({
      mockupUuid: '11111111-1111-1111-1111-111111111111',
    })

    expect(result.session).toContain('sess_')
    expect(result.expiresIn).toBe(900)
    expect(result.displayMode).toBe('iframe')
  })

  it('sends session params in snake_case', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/studio/create-session`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            success: true,
            session: 'sess_xyz',
            expires_in: 900,
            displayMode: 'popup',
          })
        },
      ),
    )

    const client = createClient()
    await client.studio.createSession({
      mockupUuid: 'mock-uuid',
      productId: 'prod-123',
      shop: 'example.myshopify.com',
    })

    expect(capturedBody['mockup_uuid']).toBe('mock-uuid')
    expect(capturedBody['product_id']).toBe('prod-123')
    expect(capturedBody['shop']).toBe('example.myshopify.com')
  })
})
