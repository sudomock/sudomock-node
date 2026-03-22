import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import { NotFoundError, ValidationError } from '../src/errors'
import { TEST_API_KEY, TEST_BASE_URL, server, MOCK_MOCKUP } from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

describe('mockups.list()', () => {
  it('returns mockups array with total count', async () => {
    const client = createClient()
    const result = await client.mockups.list()

    expect(result.mockups).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.offset).toBe(0)
  })

  it('returns camelCase smart object fields', async () => {
    const client = createClient()
    const result = await client.mockups.list()
    const mockup = result.mockups[0]!

    expect(mockup.uuid).toBe(MOCK_MOCKUP.uuid)
    expect(mockup.name).toBe('Test Mockup')
    expect(mockup.smartObjects).toHaveLength(1)
    expect(mockup.smartObjects[0]!.printAreaPresets).toHaveLength(1)
    expect(mockup.smartObjects[0]!.blendMode).toBe('normal')
  })

  it('passes query params correctly', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/mockups`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: { mockups: [], total: 0, limit: 10, offset: 5 },
        })
      }),
    )

    const client = createClient()
    await client.mockups.list({
      limit: 10,
      offset: 5,
      name: 'shirt',
      sort: 'name',
      order: 'asc',
    })

    const url = new URL(capturedUrl)
    expect(url.searchParams.get('limit')).toBe('10')
    expect(url.searchParams.get('offset')).toBe('5')
    expect(url.searchParams.get('name')).toBe('shirt')
    expect(url.searchParams.get('sort')).toBe('name')
    expect(url.searchParams.get('order')).toBe('asc')
  })
})

describe('mockups.get()', () => {
  it('returns a single mockup', async () => {
    const client = createClient()
    const mockup = await client.mockups.get(MOCK_MOCKUP.uuid)

    expect(mockup.uuid).toBe(MOCK_MOCKUP.uuid)
    expect(mockup.width).toBe(4000)
    expect(mockup.height).toBe(3000)
    expect(mockup.thumbnails).toHaveLength(1)
  })

  it('throws NotFoundError for missing mockup', async () => {
    const client = createClient()
    await expect(client.mockups.get('not-found-uuid')).rejects.toThrow(
      NotFoundError,
    )
  })
})

describe('mockups.update()', () => {
  it('updates mockup name', async () => {
    const client = createClient()
    const result = await client.mockups.update(MOCK_MOCKUP.uuid, {
      name: 'Updated Mockup',
    })

    expect(result.name).toBe('Updated Mockup')
  })
})

describe('mockups.delete()', () => {
  it('deletes a mockup (204 response)', async () => {
    const client = createClient()
    // Should not throw
    await client.mockups.delete(MOCK_MOCKUP.uuid)
  })
})
