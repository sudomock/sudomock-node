import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock, { ValidationError } from '../src/index'
import { CreditError } from '../src/errors'
import { TEST_API_KEY, TEST_BASE_URL, server } from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

const JOB_ID = '7a7a7a7a-7a7a-7a7a-7a7a-7a7a7a7a7a7a'
const TILE = 'https://example.com/pattern-tile.png'

const CHECK_VISIBLE = {
  success: true,
  data: {
    status: 'visible_seam',
    seams: [
      { side: 'left_right', status: 'visible_seam', ranges: [[0, 412], [1630, 2048]] },
      { side: 'top_bottom', status: 'faint_seam', ranges: [[10, 20]] },
    ],
    width: 2048,
    height: 2048,
    fixable: true,
    unfixable_reason: null,
    previous_fix: {
      job_id: JOB_ID,
      result_url: 'https://cdn.sudomock.com/seam-fixed/v1/u/u1/abc-result.png',
      alternative_url: null,
    },
  },
}

const FIX_ACCEPTED = {
  job_id: JOB_ID,
  kind: 'seam_fix',
  status: 'queued',
  status_url: `/api/v1/jobs/${JOB_ID}`,
}

describe('images.checkSeams()', () => {
  it('sends the source and crop_aspect, and returns the check', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/check-seams`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(CHECK_VISIBLE)
      }),
    )

    const check = await createClient().images.checkSeams({
      url: TILE,
      cropAspect: 1.5,
    })

    expect(body).toEqual({ url: TILE, crop_aspect: 1.5 })
    expect(check).toEqual({
      status: 'visible_seam',
      seams: [
        { side: 'left_right', status: 'visible_seam', ranges: [[0, 412], [1630, 2048]] },
        { side: 'top_bottom', status: 'faint_seam', ranges: [[10, 20]] },
      ],
      width: 2048,
      height: 2048,
      fixable: true,
      unfixableReason: null,
      previousFix: {
        jobId: JOB_ID,
        resultUrl: 'https://cdn.sudomock.com/seam-fixed/v1/u/u1/abc-result.png',
        alternativeUrl: null,
      },
    })
  })

  it('returns a seamless tile with no previous fix, and drops unknown fields', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/check-seams`, () =>
        HttpResponse.json({
          success: true,
          data: {
            status: 'seamless',
            seams: [],
            width: 512,
            height: 512,
            fixable: false,
            unfixable_reason: 'transparent_edges',
            previous_fix: null,
            unexpected: 'x',
          },
        }),
      ),
    )

    const check = await createClient().images.checkSeams({
      base64: 'aW1hZ2U=',
      contentType: 'image/png',
    })

    expect(check.status).toBe('seamless')
    expect(check.seams).toEqual([])
    expect(check.unfixableReason).toBe('transparent_edges')
    expect(check.previousFix).toBeNull()
    expect(check).not.toHaveProperty('unexpected')
  })

  it('rejects both or neither source and a crop_aspect that is not above 0', async () => {
    const client = createClient()
    await expect(client.images.checkSeams({} as never)).rejects.toThrow(
      ValidationError,
    )
    await expect(
      client.images.checkSeams({ url: TILE, base64: 'eA==' } as never),
    ).rejects.toThrow(ValidationError)
    await expect(
      client.images.checkSeams({ url: TILE, cropAspect: 0 }),
    ).rejects.toThrow(ValidationError)
    await expect(
      client.images.checkSeams({ url: TILE, cropAspect: Number.NaN }),
    ).rejects.toThrow(ValidationError)
  })
})

describe('images.fixSeams()', () => {
  it('submits with a fresh Idempotency-Key and returns a seam_fix job', async () => {
    let body: Record<string, unknown> = {}
    let key: string | null = null
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/fix-seams`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        key = request.headers.get('Idempotency-Key')
        return HttpResponse.json(FIX_ACCEPTED, { status: 202 })
      }),
    )

    const job = await createClient().images.fixSeams({ url: TILE })

    expect(body).toEqual({ url: TILE })
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(job).toEqual({
      jobId: JOB_ID,
      kind: 'seam_fix',
      status: 'queued',
      statusUrl: `/api/v1/jobs/${JOB_ID}`,
    })
  })

  it('sends the caller key when one is given', async () => {
    let key: string | null = null
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/fix-seams`, ({ request }) => {
        key = request.headers.get('Idempotency-Key')
        return HttpResponse.json(FIX_ACCEPTED, { status: 202 })
      }),
    )

    await createClient().images.fixSeams({
      url: TILE,
      cropAspect: 2,
      idempotencyKey: 'tile-42',
    })

    expect(key).toBe('tile-42')
  })

  it('surfaces a refused tile with its code', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/fix-seams`, () =>
        HttpResponse.json(
          {
            detail:
              'The tile has transparent pixels along its edges, so its seams cannot be fixed.',
            error_code: 'TILE_HAS_TRANSPARENT_EDGES',
            success: false,
          },
          { status: 422 },
        ),
      ),
    )

    const error = await createClient()
      .images.fixSeams({ url: TILE })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toMatchObject({ code: 'TILE_HAS_TRANSPARENT_EDGES' })
  })

  it('throws CreditError on 402', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/fix-seams`, () =>
        HttpResponse.json({ detail: 'Insufficient credits' }, { status: 402 }),
      ),
    )
    await expect(createClient().images.fixSeams({ url: TILE })).rejects.toThrow(
      CreditError,
    )
  })
})

describe('seam fix jobs', () => {
  it('carry the alternative, the result status, the changes and the stage', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/${JOB_ID}`, () =>
        HttpResponse.json({
          job_id: JOB_ID,
          kind: 'seam_fix',
          status: 'succeeded',
          result_url: 'https://cdn.sudomock.com/seam-fixed/v1/u/u1/abc-result.png',
          alternative_url:
            'https://cdn.sudomock.com/seam-fixed/v1/u/u1/abc-alternative.png',
          result_status: 'seamless',
          changes: 'edges',
          stage: 'finishing',
          mockup_uuid: null,
          error: null,
          credits_charged: 60,
          payg: null,
          created_at: '2026-11-05T00:00:00Z',
          updated_at: '2026-11-05T00:00:40Z',
        }),
      ),
    )

    const job = await createClient().jobs.retrieve(JOB_ID)

    expect(job.kind).toBe('seam_fix')
    expect(job.alternativeUrl).toBe(
      'https://cdn.sudomock.com/seam-fixed/v1/u/u1/abc-alternative.png',
    )
    expect(job.resultStatus).toBe('seamless')
    expect(job.changes).toBe('edges')
    expect(job.stage).toBe('finishing')
    expect(job.creditsCharged).toBe(60)
  })

  it('a failed fix keeps its public code and is refunded', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs/${JOB_ID}`, () =>
        HttpResponse.json({
          job_id: JOB_ID,
          kind: 'seam_fix',
          status: 'failed',
          result_url: null,
          alternative_url: null,
          result_status: null,
          changes: null,
          stage: 'fixing',
          error: {
            error_code: 'TILE_NOT_FIXABLE',
            message: 'This image could not be made into a seamless tile.',
            details: { reason: 'no_clean_result' },
          },
          credits_charged: 0,
          payg: null,
        }),
      ),
    )

    const job = await createClient().jobs.waitForJob(JOB_ID)

    expect(job.status).toBe('failed')
    expect(job.errorCode).toBe('TILE_NOT_FIXABLE')
    expect(job.errorDetails).toEqual({ reason: 'no_clean_result' })
    expect(job.error).toBe('This image could not be made into a seamless tile.')
    expect(job.creditsCharged).toBe(0)
    expect(job.stage).toBe('fixing')
  })

  it('lists seam fix jobs by kind', async () => {
    let kind: string | null = null
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/jobs`, ({ request }) => {
        kind = new URL(request.url).searchParams.get('kind')
        return HttpResponse.json({ jobs: [], next_cursor: null })
      }),
    )

    await createClient().jobs.list({ kind: 'seam_fix' })

    expect(kind).toBe('seam_fix')
  })
})

describe('photo mockup render warnings', () => {
  it('keeps the seam advisory a render carries', async () => {
    const message =
      'The pattern tile shows a visible line where its copies meet. ' +
      'Check it with POST /api/v1/check-seams and fix it with POST /api/v1/fix-seams.'
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/photo-mockups/m1/render`, () =>
        HttpResponse.json({
          success: true,
          data: {
            render_uuid: 'r1',
            print_files: [
              {
                export_path: 'https://cdn.sudomock.com/r1.webp',
                duration_ms: 900,
                export_format: 'webp',
              },
            ],
          },
          warnings: [{ code: 'TILE_SEAM_VISIBLE', message }],
        }),
      ),
    )

    const result = await createClient().photoMockups.render({
      mockupId: 'm1',
      printAreas: [{ uuid: 'p1', artworkUrl: TILE, placement: { tile: true } }],
    })

    expect(result.url).toBe('https://cdn.sudomock.com/r1.webp')
    expect(result.warnings).toEqual([{ code: 'TILE_SEAM_VISIBLE', message }])
  })

  it('is empty when the render has none', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/photo-mockups/m1/render`, () =>
        HttpResponse.json({
          success: true,
          data: {
            render_uuid: 'r1',
            print_files: [{ export_path: 'https://cdn.sudomock.com/r1.webp' }],
          },
          warnings: null,
        }),
      ),
    )

    const result = await createClient().photoMockups.render({
      mockupId: 'm1',
      printAreas: [{ uuid: 'p1', artworkUrl: TILE }],
    })

    expect(result.warnings).toEqual([])
  })
})
