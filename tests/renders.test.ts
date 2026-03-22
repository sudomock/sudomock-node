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

describe('ai.render()', () => {
  it('renders with AI and returns URL', async () => {
    const client = createClient()
    const result = await client.ai.render({
      sourceUrl: 'https://example.com/product.jpg',
      artworkUrl: 'https://example.com/design.png',
    })

    expect(result.printFiles).toHaveLength(1)
    expect(result.url).toBe(
      'https://cdn.sudomock.com/renders/sudoai/abc123.png',
    )
    expect(result.printFiles[0]!.durationMs).toBe(2340)
    expect(result.printFiles[0]!.confidence).toBe(0.95)
  })

  it('sends all AI render params in snake_case', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/sudoai/render`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(MOCK_AI_RENDER_RESPONSE)
        },
      ),
    )

    const client = createClient()
    await client.ai.render({
      sourceUrl: 'https://example.com/product.jpg',
      artworkUrl: 'https://example.com/design.png',
      productType: 't-shirt',
      segmentIndex: 2,
      printAreaX: 100,
      printAreaY: 200,
      adjustments: {
        warpStrength: 0.8,
        textureStrength: 0.5,
        edgeExpand: 3,
      },
    })

    expect(capturedBody['source_url']).toBe(
      'https://example.com/product.jpg',
    )
    expect(capturedBody['artwork_url']).toBe(
      'https://example.com/design.png',
    )
    expect(capturedBody['product_type']).toBe('t-shirt')
    expect(capturedBody['segment_index']).toBe(2)
    expect(capturedBody['print_area_x']).toBe(100)
    expect(capturedBody['print_area_y']).toBe(200)
    const adjustments = capturedBody['adjustments'] as Record<string, unknown>
    expect(adjustments['warp_strength']).toBe(0.8)
    expect(adjustments['texture_strength']).toBe(0.5)
    expect(adjustments['edge_expand']).toBe(3)
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
