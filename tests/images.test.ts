import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock, { ValidationError } from '../src/index'
import { AuthenticationError, CreditError, InternalError } from '../src/errors'
import {
  TEST_API_KEY,
  TEST_BASE_URL,
  server,
  MOCK_REMOVE_BACKGROUND_RESPONSE,
} from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

describe('images.removeBackground()', () => {
  it('returns the cutout URL, dimensions, and credits charged', async () => {
    const client = createClient()
    const cutout = await client.images.removeBackground({
      url: 'https://example.com/product-photo.jpg',
    })

    expect(cutout.url).toBe(
      'https://cdn.sudomock.com/bg-cutouts/test/cutout.png',
    )
    expect(cutout.width).toBe(1200)
    expect(cutout.height).toBe(1600)
    expect(cutout.creditsCharged).toBe(25)
  })

  it('sends only the url source', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/remove-background`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(MOCK_REMOVE_BACKGROUND_RESPONSE)
        },
      ),
    )

    await createClient().images.removeBackground({
      url: 'https://example.com/product-photo.jpg',
    })

    expect(capturedBody).toEqual({
      url: 'https://example.com/product-photo.jpg',
    })
  })

  it('sends base64 with content_type in snake_case', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/v1/remove-background`,
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(MOCK_REMOVE_BACKGROUND_RESPONSE)
        },
      ),
    )

    await createClient().images.removeBackground({
      base64: 'aW1hZ2U=',
      contentType: 'image/jpeg',
    })

    expect(capturedBody).toEqual({
      base64: 'aW1hZ2U=',
      content_type: 'image/jpeg',
    })
  })

  it('rejects both or neither source before making a request', async () => {
    const client = createClient()
    await expect(
      client.images.removeBackground({} as never),
    ).rejects.toThrow(ValidationError)
    await expect(
      client.images.removeBackground({
        url: 'https://example.com/x.jpg',
        base64: 'eA==',
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws CreditError on 402', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/remove-background`, () =>
        HttpResponse.json({ detail: 'Insufficient credits' }, { status: 402 }),
      ),
    )

    await expect(
      createClient().images.removeBackground({
        url: 'https://example.com/product-photo.jpg',
      }),
    ).rejects.toThrow(CreditError)
  })

  it('surfaces backend error codes on an unusable image', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/remove-background`, () =>
        HttpResponse.json(
          {
            detail: 'The provided file is not a supported image.',
            error_code: 'INVALID_IMAGE',
            success: false,
          },
          { status: 422 },
        ),
      ),
    )

    const error = await createClient()
      .images.removeBackground({ url: 'https://example.com/not-an-image.txt' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toMatchObject({ code: 'INVALID_IMAGE' })
  })

  it('surfaces a 502 processing failure (credits auto-refunded)', async () => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/remove-background`, () =>
        HttpResponse.json(
          {
            detail: 'The background could not be removed.',
            error_code: 'BACKGROUND_REMOVAL_FAILED',
            success: false,
          },
          { status: 502 },
        ),
      ),
    )

    // 502 is retryable; skip the backoff so the test stays fast.
    const client = new SudoMock(TEST_API_KEY, {
      baseUrl: TEST_BASE_URL,
      maxRetries: 0,
    })
    const error = await client.images
      .removeBackground({ url: 'https://example.com/product.jpg' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(InternalError)
    expect(error).toMatchObject({ code: 'BACKGROUND_REMOVAL_FAILED' })
  })

  it('throws AuthenticationError with a bad API key', async () => {
    const client = new SudoMock('wrong-key', { baseUrl: TEST_BASE_URL })
    await expect(
      client.images.removeBackground({
        url: 'https://example.com/product-photo.jpg',
      }),
    ).rejects.toThrow(AuthenticationError)
  })
})
