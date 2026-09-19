import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import { AIResource } from '../src/resources/ai'
import { MockupsResource } from '../src/resources/mockups'
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
// client.mockups keep working and warn once, so a caller on the earlier names
// learns the new ones from the warning.
// ---------------------------------------------------------------------------

describe('deprecated accessors', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('client.ai is a photo-mockup resource and warns once', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    const client = createClient()
    expect(client.ai).toBeInstanceOf(AIResource)
    expect(client.ai).toBe(client.ai)
    expect(createClient().ai).toBeDefined()

    expect(warn).toHaveBeenCalledTimes(1)
    const call = warn.mock.calls[0] as unknown[] | undefined
    expect(String(call?.[0])).toContain('client.ai')
    expect(String(call?.[0])).toContain('client.photoMockups')
    // The two are not one object: each speaks to the path its name was
    // published on. A warning that called them the same would read as a free
    // swap and quietly move the reader's jobs to the other family's kinds.
    expect(String(call?.[0])).not.toContain('same object')
    expect(String(call?.[0])).toContain('published on')
    expect(call?.[1]).toBe('DeprecationWarning')
  })

  it('client.mockups is a PSD-mockup resource and warns once', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    const client = createClient()
    expect(client.mockups).toBeInstanceOf(MockupsResource)
    expect(client.mockups).toBe(client.mockups)
    expect(createClient().mockups).toBeDefined()

    expect(warn).toHaveBeenCalledTimes(1)
    const call = warn.mock.calls[0] as unknown[] | undefined
    expect(String(call?.[0])).toContain('client.mockups')
    expect(String(call?.[0])).toContain('client.psdMockups')
    expect(String(call?.[0])).not.toContain('same object')
    expect(String(call?.[0])).toContain('published on')
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

// ---------------------------------------------------------------------------
// The earlier accessors stay on the path they were published on. A project
// that upgrades the package without touching its code keeps opening the jobs
// it opened before, under the kinds and event names it already branches on.
// ---------------------------------------------------------------------------

describe('earlier accessors stay on the published path', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('client.ai sends every call to /api/v1/sudoai/2d-mockups', async () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const hits: string[] = []
    const record = (request: Request) => {
      hits.push(`${request.method} ${new URL(request.url).pathname}`)
    }
    const base = `${TEST_BASE_URL}/api/v1/sudoai/2d-mockups`
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

    const earlier = createClient().ai
    await earlier.create({ sourceUrl: 'https://example.com/product.jpg' })
    await earlier.list()
    await earlier.get(PHOTO_ID)
    await earlier.updatePrintAreas(PHOTO_ID, [])
    await earlier.render({
      mockupId: PHOTO_ID,
      printAreas: [{ uuid: 'pa-uuid', artworkUrl: 'https://example.com/design.png' }],
    })
    await earlier.delete(PHOTO_ID)

    expect(hits).toEqual([
      'POST /api/v1/sudoai/2d-mockups',
      'GET /api/v1/sudoai/2d-mockups',
      `GET /api/v1/sudoai/2d-mockups/${PHOTO_ID}`,
      `PUT /api/v1/sudoai/2d-mockups/${PHOTO_ID}/print-areas`,
      `POST /api/v1/sudoai/2d-mockups/${PHOTO_ID}/render`,
      `DELETE /api/v1/sudoai/2d-mockups/${PHOTO_ID}`,
    ])
  })

  it('client.mockups sends every call to /api/v1/mockups', async () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const hits: string[] = []
    const record = (request: Request) => {
      hits.push(`${request.method} ${new URL(request.url).pathname}`)
    }
    const base = `${TEST_BASE_URL}/api/v1/mockups`
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

    const earlier = createClient().mockups
    await earlier.list()
    await earlier.get(PSD_ID)
    await earlier.update(PSD_ID, { name: 'Renamed' })
    await earlier.delete(PSD_ID)

    expect(hits).toEqual([
      'GET /api/v1/mockups',
      `GET /api/v1/mockups/${PSD_ID}`,
      `PATCH /api/v1/mockups/${PSD_ID}`,
      `DELETE /api/v1/mockups/${PSD_ID}`,
    ])
  })
})

// ---------------------------------------------------------------------------
// Assigning to an earlier accessor is how a test double gets injected. Without
// a setter the assignment throws in an ES module (strict mode) and is dropped
// without a word in plain CommonJS (sloppy mode) -- where the call then leaves
// the test and reaches the real API on the caller's own credits.
// ---------------------------------------------------------------------------

describe('earlier accessors accept assignment', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // A function built with `new Function` has a sloppy-mode body, the same mode
  // a plain CommonJS file runs in.
  const sloppyAssign = new Function(
    'target',
    'name',
    'value',
    'target[name] = value; return target[name]',
  ) as (target: unknown, name: string, value: unknown) => unknown

  it('takes the assignment in strict mode (ES module)', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const client = createClient()
    const double = { list: () => Promise.resolve(null) } as unknown as AIResource

    expect(() => {
      client.ai = double
    }).not.toThrow()
    expect(client.ai).toBe(double)
    expect(client.photoMockups).not.toBe(double)
  })

  it('takes the assignment in sloppy mode (plain CommonJS)', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const client = createClient()
    const photoDouble = { list: () => Promise.resolve(null) }
    const psdDouble = { list: () => Promise.resolve(null) }

    expect(sloppyAssign(client, 'ai', photoDouble)).toBe(photoDouble)
    expect(client.ai).toBe(photoDouble)

    expect(sloppyAssign(client, 'mockups', psdDouble)).toBe(psdDouble)
    expect(client.mockups).toBe(psdDouble)
  })
})

// ---------------------------------------------------------------------------
// An earlier accessor reads back exactly the field its setter writes, and no
// other. A save-restore round trip -- the shape every test double uses, and the
// shape vi.spyOn puts the property back in -- therefore leaves both the earlier
// and the family accessor where it found them. A setter that also wrote the
// family field would survive the assignment but not the restore: the restore
// would park the earlier-path object on the family name for the rest of the
// process, and every later call on the family name would leave its own path
// without a word.
// ---------------------------------------------------------------------------

describe('earlier accessors are symmetric', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a save-restore round trip leaves client.ai and client.photoMockups where they started', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const client = createClient()
    const earlier = client.ai
    const family = client.photoMockups
    const double = { list: () => Promise.resolve(null) } as unknown as AIResource

    client.ai = double
    expect(client.ai).toBe(double)
    expect(client.photoMockups).toBe(family)

    client.ai = earlier
    expect(client.ai).toBe(earlier)
    expect(client.photoMockups).toBe(family)
  })

  it('a save-restore round trip leaves client.mockups and client.psdMockups where they started', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const client = createClient()
    const earlier = client.mockups
    const family = client.psdMockups
    const double = { list: () => Promise.resolve(null) } as unknown as MockupsResource

    client.mockups = double
    expect(client.mockups).toBe(double)
    expect(client.psdMockups).toBe(family)

    client.mockups = earlier
    expect(client.mockups).toBe(earlier)
    expect(client.psdMockups).toBe(family)
  })

  it('vi.spyOn over an earlier accessor restores both accessors', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const client = createClient()
    const earlier = client.ai
    const family = client.photoMockups
    const double = { list: () => Promise.resolve(null) } as unknown as AIResource

    const spy = vi.spyOn(client, 'ai', 'get').mockReturnValue(double)
    expect(client.ai).toBe(double)
    expect(client.photoMockups).toBe(family)

    spy.mockRestore()
    expect(client.ai).toBe(earlier)
    expect(client.photoMockups).toBe(family)
  })

  it('an earlier accessor can be deleted off the instance without throwing', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const client = createClient()
    const family = client.photoMockups

    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (client as unknown as Record<string, unknown>)['ai']
    }).not.toThrow()
    expect(client.ai).toBeInstanceOf(AIResource)
    expect(client.photoMockups).toBe(family)
  })
})
