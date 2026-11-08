import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import { ValidationError } from '../src/errors'
import { TEST_API_KEY, TEST_BASE_URL, server, MOCK_FOLDER } from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

describe('folders.list()', () => {
  it('returns the page, camelCased, without fields the API never publishes', async () => {
    const client = createClient()
    const result = await client.folders.list()
    const folder = result.folders[0]!

    expect(result.total).toBe(1)
    expect(result.limit).toBe(20)
    expect(folder.uuid).toBe(MOCK_FOLDER.uuid)
    expect(folder.parentUuid).toBeNull()
    expect(folder.psdMockupCount).toBe(12)
    expect(folder.photoMockupCount).toBe(4)
    expect(folder).not.toHaveProperty('privateStorageKey')
  })

  it('sends parentUuid, limit and offset, and leaves out what was not asked for', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/folders`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: { folders: [], total: 0, limit: 20, offset: 0 },
        })
      }),
    )
    const client = createClient()

    await client.folders.list({ parentUuid: 'root', limit: 50 })
    const withParent = new URL(capturedUrl).searchParams
    expect(withParent.get('parent_uuid')).toBe('root')
    expect(withParent.get('limit')).toBe('50')
    expect(withParent.has('offset')).toBe(false)

    await client.folders.list()
    expect(new URL(capturedUrl).searchParams.has('parent_uuid')).toBe(false)
  })
})

describe('folders.create()', () => {
  it('sends the name alone, and the parent when one is given', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/folders`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ success: true, data: MOCK_FOLDER }, { status: 201 })
      }),
    )
    const client = createClient()

    const folder = await client.folders.create({ name: 'Frames' })
    expect(bodies[0]).toEqual({ name: 'Frames' })
    expect(folder.name).toBe('Frames')

    await client.folders.create({ name: '8x10', parentUuid: MOCK_FOLDER.uuid })
    expect(bodies[1]).toEqual({ name: '8x10', parent_uuid: MOCK_FOLDER.uuid })
  })
})

describe('folders.get()', () => {
  it('returns the trail above the folder and the counts a delete would remove', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/folders/:uuid`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...MOCK_FOLDER,
            path: [{ uuid: '9e3b6c14-27af-4d58-b0e1-5c8a2f9d7340', name: 'My mockups' }],
            total_folder_count: 4,
            total_psd_mockup_count: 31,
            total_photo_mockup_count: 8,
          },
        }),
      ),
    )
    const client = createClient()
    const folder = await client.folders.get(MOCK_FOLDER.uuid)

    expect(folder.path).toEqual([
      { uuid: '9e3b6c14-27af-4d58-b0e1-5c8a2f9d7340', name: 'My mockups' },
    ])
    expect(folder.totalPsdMockupCount).toBe(31)
    expect(folder).not.toHaveProperty('privateStorageKey')
  })
})

describe('folders.update()', () => {
  it('tells a field left out apart from one sent as null', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.patch(`${TEST_BASE_URL}/api/v1/folders/:uuid`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({
          success: true,
          data: {
            ...MOCK_FOLDER,
            path: [],
            total_folder_count: 0,
            total_psd_mockup_count: 0,
            total_photo_mockup_count: 0,
          },
        })
      }),
    )
    const client = createClient()

    await client.folders.update(MOCK_FOLDER.uuid, { name: 'Frames 8x10' })
    expect(bodies[0]).toEqual({ name: 'Frames 8x10' })
    expect(bodies[0]).not.toHaveProperty('parent_uuid')

    await client.folders.update(MOCK_FOLDER.uuid, { parentUuid: null })
    expect(bodies[1]).toEqual({ parent_uuid: null })
  })
})

describe('folders.delete()', () => {
  it('asks for recursive only when told to, and reports what went', async () => {
    let capturedUrl = ''
    server.use(
      http.delete(`${TEST_BASE_URL}/api/v1/folders/:uuid`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: {
            deleted: MOCK_FOLDER.uuid,
            deleted_folders: 4,
            deleted_psd_mockups: 12,
            deleted_photo_mockups: 3,
          },
        })
      }),
    )
    const client = createClient()

    await client.folders.delete(MOCK_FOLDER.uuid)
    expect(new URL(capturedUrl).searchParams.has('recursive')).toBe(false)

    const gone = await client.folders.delete(MOCK_FOLDER.uuid, { recursive: true })
    expect(new URL(capturedUrl).searchParams.get('recursive')).toBe('true')
    expect(gone.deletedPsdMockups).toBe(12)
    expect(gone.deletedFolders).toBe(4)
  })
})

describe('folders: what reaches the wire', () => {
  it('keeps a uuid in the path, so it cannot turn on a recursive delete', async () => {
    let capturedUrl = ''
    server.use(
      http.delete(`${TEST_BASE_URL}/api/v1/folders/:uuid`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          success: true,
          data: {
            deleted: MOCK_FOLDER.uuid,
            deleted_folders: 1,
            deleted_psd_mockups: 0,
            deleted_photo_mockups: 0,
          },
        })
      }),
    )
    const client = createClient()

    // An id an application took from its own end user must stay one segment.
    await client.folders.delete(`${MOCK_FOLDER.uuid}?recursive=true`)
    expect(new URL(capturedUrl).searchParams.has('recursive')).toBe(false)
  })

  it('drops fields the API never published from a delete and a move', async () => {
    server.use(
      http.delete(`${TEST_BASE_URL}/api/v1/folders/:uuid`, () =>
        HttpResponse.json({
          success: true,
          data: {
            deleted: MOCK_FOLDER.uuid,
            deleted_folders: 1,
            deleted_psd_mockups: 0,
            deleted_photo_mockups: 0,
            private_storage_prefix: 'private/folders',
          },
        }),
      ),
      http.post(`${TEST_BASE_URL}/api/v1/folders/move`, () =>
        HttpResponse.json({
          success: true,
          data: {
            target_folder_uuid: MOCK_FOLDER.uuid,
            moved_psd_mockups: 1,
            moved_photo_mockups: 0,
            moved_folders: 0,
            private_storage_prefix: 'private/folders',
          },
        }),
      ),
    )
    const client = createClient()

    const gone = await client.folders.delete(MOCK_FOLDER.uuid)
    expect(gone).not.toHaveProperty('privateStoragePrefix')

    const moved = await client.folders.move({ psdMockupUuids: ['mockup-uuid'] })
    expect(moved).not.toHaveProperty('privateStoragePrefix')
  })
})

describe('folders.move()', () => {
  it('sends every list and reads a missing target as the top of the library', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/folders/move`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({
          success: true,
          data: {
            target_folder_uuid: null,
            moved_psd_mockups: 1,
            moved_photo_mockups: 0,
            moved_folders: 0,
          },
        })
      }),
    )
    const client = createClient()

    const moved = await client.folders.move({
      psdMockupUuids: ['8f2c1d90-6b4e-4a37-9e55-0d1c7a3f21b8'],
    })
    expect(bodies[0]).toEqual({
      target_folder_uuid: null,
      psd_mockup_uuids: ['8f2c1d90-6b4e-4a37-9e55-0d1c7a3f21b8'],
      photo_mockup_uuids: [],
      folder_uuids: [],
    })
    expect(moved.movedPsdMockups).toBe(1)
  })

  it('refuses a move that names nothing, without calling the API', async () => {
    let called = false
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/folders/move`, () => {
        called = true
        return HttpResponse.json({ success: true, data: {} })
      }),
    )
    const client = createClient()

    await expect(client.folders.move({ targetFolderUuid: MOCK_FOLDER.uuid })).rejects.toThrow(
      ValidationError,
    )
    expect(called).toBe(false)
  })
})

describe('folderUuid on the mockup surfaces', () => {
  it('filters both mockup lists and reports where each mockup sits', async () => {
    const urls: string[] = []
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/psd-mockups`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            mockups: [
              {
                uuid: '8f2c1d90-6b4e-4a37-9e55-0d1c7a3f21b8',
                name: 'Oak frame 8x10',
                folder_uuid: MOCK_FOLDER.uuid,
                thumbnail: 'https://cdn.sudomock.com/thumbs/oak.webp',
                width: 2000,
                height: 2000,
                smart_objects: [],
                text_layers: [],
                collections: [],
                thumbnails: [],
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          },
        })
      }),
      http.get(`${TEST_BASE_URL}/api/v1/photo-mockups`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json({
          success: true,
          data: [
            {
              mockup_id: '7d1e4c09-2a68-4f35-9b4e-3c0f8a2d6517',
              name: 'Oak frame on a wall',
              folder_uuid: null,
              status: 'ready',
              customizable: false,
              thumbnail_url: null,
              watermarked_source_url: null,
              source_width: 1200,
              source_height: 900,
              version: 1,
              created_at: '2026-11-08T10:00:00Z',
              updated_at: '2026-11-08T10:00:00Z',
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        })
      }),
    )
    const client = createClient()

    const psd = await client.psdMockups.list({ folderUuid: MOCK_FOLDER.uuid })
    expect(new URL(urls[0]!).searchParams.get('folder_uuid')).toBe(MOCK_FOLDER.uuid)
    expect(psd.mockups[0]!.folderUuid).toBe(MOCK_FOLDER.uuid)

    const photo = await client.photoMockups.list({ folderUuid: 'root' })
    expect(new URL(urls[1]!).searchParams.get('folder_uuid')).toBe('root')
    expect(photo.mockups[0]!.folderUuid).toBeNull()

    await client.psdMockups.list()
    expect(new URL(urls[2]!).searchParams.has('folder_uuid')).toBe(false)
  })

  it('moves one mockup with update, and tells a null apart from a field left out', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.patch(`${TEST_BASE_URL}/api/v1/psd-mockups/:uuid`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({
          success: true,
          data: {
            uuid: '8f2c1d90-6b4e-4a37-9e55-0d1c7a3f21b8',
            name: 'Oak frame 8x10',
            folder_uuid: null,
            thumbnail: 'https://cdn.sudomock.com/thumbs/oak.webp',
            width: 2000,
            height: 2000,
            smart_objects: [],
            text_layers: [],
            collections: [],
            thumbnails: [],
          },
        })
      }),
    )
    const client = createClient()

    await client.psdMockups.update('8f2c1d90-6b4e-4a37-9e55-0d1c7a3f21b8', { name: 'Renamed' })
    expect(bodies[0]).toEqual({ name: 'Renamed' })

    const moved = await client.psdMockups.update('8f2c1d90-6b4e-4a37-9e55-0d1c7a3f21b8', {
      folderUuid: null,
    })
    expect(bodies[1]).toEqual({ folder_uuid: null })
    expect(moved.folderUuid).toBeNull()
  })

  it('puts a new mockup straight into a folder on upload and on create', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/psd/upload`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({
          success: true,
          data: {
            uuid: '8f2c1d90-6b4e-4a37-9e55-0d1c7a3f21b8',
            name: 'Oak frame 8x10',
            folder_uuid: MOCK_FOLDER.uuid,
            thumbnail: 'https://cdn.sudomock.com/thumbs/oak.webp',
            width: 2000,
            height: 2000,
            smart_objects: [],
            text_layers: [],
            collections: [],
            thumbnails: [],
          },
        })
      }),
      http.post(`${TEST_BASE_URL}/api/v1/photo-mockups`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          {
            success: true,
            data: {
              mockup_id: '7d1e4c09-2a68-4f35-9b4e-3c0f8a2d6517',
              name: 'Oak frame on a wall',
              folder_uuid: MOCK_FOLDER.uuid,
              status: 'ready',
              customizable: false,
              thumbnail_url: null,
              watermarked_source_url: null,
              source_width: 1200,
              source_height: 900,
              quads: [],
              surfaces: [],
              version: 1,
              created_at: '2026-11-08T10:00:00Z',
              updated_at: '2026-11-08T10:00:00Z',
            },
          },
          { status: 201 },
        )
      }),
    )
    const client = createClient()

    const uploaded = await client.uploads.create({
      psdFileUrl: 'https://example.com/frame.psd',
      psdName: 'Oak frame 8x10',
      folderUuid: MOCK_FOLDER.uuid,
    })
    expect(bodies[0]!['folder_uuid']).toBe(MOCK_FOLDER.uuid)
    expect(uploaded.folderUuid).toBe(MOCK_FOLDER.uuid)

    const created = await client.photoMockups.create({
      sourceUrl: 'https://example.com/frame-photo.jpg',
      name: 'Oak frame on a wall',
      folderUuid: MOCK_FOLDER.uuid,
    })
    expect(bodies[1]!['folder_uuid']).toBe(MOCK_FOLDER.uuid)
    expect(created.folderUuid).toBe(MOCK_FOLDER.uuid)
  })
})
