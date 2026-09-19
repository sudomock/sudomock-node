import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import {
  MOCK_2D_MOCKUP,
  MOCK_AI_RENDER_RESPONSE,
  MOCK_MOCKUP,
  TEST_API_KEY,
  TEST_BASE_URL,
  server,
} from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

const PHOTO_ID = MOCK_2D_MOCKUP.mockup_id
const PSD_ID = MOCK_MOCKUP.uuid

// ---------------------------------------------------------------------------
// client.photoMockups / client.psdMockups are the accessors. client.ai and
// client.mockups return the same objects and warn once, so a caller on the
// earlier names keeps working and learns the new ones from the warning.
// ---------------------------------------------------------------------------

describe('deprecated accessors', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('client.ai is client.photoMockups and warns once', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    const client = createClient()
    expect(client.ai).toBe(client.photoMockups)
    expect(client.ai).toBe(client.photoMockups)
    expect(createClient().ai).toBeDefined()

    expect(warn).toHaveBeenCalledTimes(1)
    const call = warn.mock.calls[0] as unknown[] | undefined
    expect(String(call?.[0])).toContain('client.ai')
    expect(String(call?.[0])).toContain('client.photoMockups')
    expect(call?.[1]).toBe('DeprecationWarning')
  })

  it('client.mockups is client.psdMockups and warns once', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    const client = createClient()
    expect(client.mockups).toBe(client.psdMockups)
    expect(client.mockups).toBe(client.psdMockups)
    expect(createClient().mockups).toBeDefined()

    expect(warn).toHaveBeenCalledTimes(1)
    const call = warn.mock.calls[0] as unknown[] | undefined
    expect(String(call?.[0])).toContain('client.mockups')
    expect(String(call?.[0])).toContain('client.psdMockups')
    expect(call?.[1]).toBe('DeprecationWarning')
  })
})

// ---------------------------------------------------------------------------
// Each family accessor talks to its family path, for every method it has.
// ---------------------------------------------------------------------------

describe('family paths on the wire', () => {
  it('client.photoMockups sends every call to /api/v1/photo-mockups', async () => {
    const hits: string[] = []
    const record = (request: Request) => {
      hits.push(`${request.method} ${new URL(request.url).pathname}`)
    }
    const base = `${TEST_BASE_URL}/api/v1/photo-mockups`
    server.use(
      http.post(base, ({ request }) => {
        record(request)
        return HttpResponse.json(
          { success: true, data: MOCK_2D_MOCKUP },
          { status: 201 },
        )
      }),
      http.get(base, ({ request }) => {
        record(request)
        return HttpResponse.json({
          success: true,
          data: [MOCK_2D_MOCKUP],
          total: 1,
          limit: 20,
          offset: 0,
        })
      }),
      http.get(`${base}/:id`, ({ request }) => {
        record(request)
        return HttpResponse.json({ success: true, data: MOCK_2D_MOCKUP })
      }),
      http.put(`${base}/:id/print-areas`, ({ request }) => {
        record(request)
        return HttpResponse.json({
          success: true,
          data: { mockup_id: PHOTO_ID, print_areas: [] },
        })
      }),
      http.post(`${base}/:id/render`, ({ request }) => {
        record(request)
        return HttpResponse.json(MOCK_AI_RENDER_RESPONSE)
      }),
      http.delete(`${base}/:id`, ({ request }) => {
        record(request)
        return HttpResponse.json({ success: true, data: { deleted: true } })
      }),
    )

    const photoMockups = createClient().photoMockups
    await photoMockups.create({ sourceUrl: 'https://example.com/product.jpg' })
    await photoMockups.list()
    await photoMockups.get(PHOTO_ID)
    await photoMockups.updatePrintAreas(PHOTO_ID, [])
    await photoMockups.render({
      mockupId: PHOTO_ID,
      printAreas: [{ uuid: 'pa-uuid', artworkUrl: 'https://example.com/design.png' }],
    })
    await photoMockups.delete(PHOTO_ID)

    expect(hits).toEqual([
      'POST /api/v1/photo-mockups',
      'GET /api/v1/photo-mockups',
      `GET /api/v1/photo-mockups/${PHOTO_ID}`,
      `PUT /api/v1/photo-mockups/${PHOTO_ID}/print-areas`,
      `POST /api/v1/photo-mockups/${PHOTO_ID}/render`,
      `DELETE /api/v1/photo-mockups/${PHOTO_ID}`,
    ])
  })

  it('client.psdMockups sends every call to /api/v1/psd-mockups', async () => {
    const hits: string[] = []
    const record = (request: Request) => {
      hits.push(`${request.method} ${new URL(request.url).pathname}`)
    }
    const base = `${TEST_BASE_URL}/api/v1/psd-mockups`
    server.use(
      http.get(base, ({ request }) => {
        record(request)
        return HttpResponse.json({
          success: true,
          data: { mockups: [MOCK_MOCKUP], total: 1, limit: 20, offset: 0 },
        })
      }),
      http.get(`${base}/:uuid`, ({ request }) => {
        record(request)
        return HttpResponse.json({ success: true, data: MOCK_MOCKUP })
      }),
      http.patch(`${base}/:uuid`, ({ request }) => {
        record(request)
        return HttpResponse.json({ success: true, data: MOCK_MOCKUP })
      }),
      http.delete(`${base}/:uuid`, ({ request }) => {
        record(request)
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const psdMockups = createClient().psdMockups
    await psdMockups.list()
    await psdMockups.get(PSD_ID)
    await psdMockups.update(PSD_ID, { name: 'Renamed' })
    await psdMockups.delete(PSD_ID)

    expect(hits).toEqual([
      'GET /api/v1/psd-mockups',
      `GET /api/v1/psd-mockups/${PSD_ID}`,
      `PATCH /api/v1/psd-mockups/${PSD_ID}`,
      `DELETE /api/v1/psd-mockups/${PSD_ID}`,
    ])
  })
})
