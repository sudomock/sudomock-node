import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
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
  it('renders artwork onto a 2D mockup and returns URL', async () => {
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
    expect(result.printFiles[0]!.durationMs).toBe(2340)
    expect(result.printFiles[0]!.exportFormat).toBe('png')
  })

  it('posts the 2D render body in snake_case to /sudoai/2d-mockup/render', async () => {
    let capturedBody: Record<string, unknown> = {}
    let capturedPath = ''
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/sudoai/2d-mockup/render`,
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

    expect(capturedPath).toBe('/api/v1/sudoai/2d-mockup/render')
    expect(capturedBody['mockup_uuid']).toBe('mockup-uuid')
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
    const mockups = await client.ai.list({ limit: 20 })
    expect(mockups).toHaveLength(1)
    expect(mockups[0]!.mockupId).toBe('99999999-9999-9999-9999-999999999999')
    expect(mockups[0]!.sourceWidth).toBe(2000)
  })

  it('gets a single 2D mockup', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockup/:id`, () =>
        HttpResponse.json({ success: true, data: MOCK_2D_MOCKUP }),
      ),
    )

    const client = createClient()
    const mockup = await client.ai.get('99999999-9999-9999-9999-999999999999')
    expect(mockup.name).toBe('2D Tee')
    expect(mockup.quads?.[0]!.printAreaId).toBe(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    )
  })

  it('deletes a 2D mockup', async () => {
    let hitPath = ''
    server.use(
      http.delete(`${TEST_BASE_URL}/api/v1/sudoai/2d-mockup/:id`, ({ request }) => {
        hitPath = new URL(request.url).pathname
        return HttpResponse.json({ success: true, data: { deleted: true } })
      }),
    )

    const client = createClient()
    await expect(
      client.ai.delete('99999999-9999-9999-9999-999999999999'),
    ).resolves.toBeUndefined()
    expect(hitPath).toBe(
      '/api/v1/sudoai/2d-mockup/99999999-9999-9999-9999-999999999999',
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
