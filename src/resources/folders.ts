import { encodeId, type HttpClient } from '../client'
import { ValidationError } from '../errors'
import type {
  CreateFolderParams,
  DeleteFolderParams,
  DeleteFolderResult,
  Folder,
  FolderDetail,
  FolderListResult,
  ListFoldersParams,
  MoveToFolderParams,
  MoveToFolderResult,
  UpdateFolderParams,
} from '../types'

/** Path the folder family is served on. */
export const FOLDERS_PATH = '/api/v1/folders'

// A uuid that reaches the query string could turn on `recursive`, which
// deletes a folder's whole contents, so it stays one path segment.
function folderPath(uuid: string): string {
  return `${FOLDERS_PATH}/${encodeId(uuid)}`
}

function toPublicFolder(folder: Folder): Folder {
  return {
    uuid: folder.uuid,
    name: folder.name,
    parentUuid: folder.parentUuid,
    folderCount: folder.folderCount,
    psdMockupCount: folder.psdMockupCount,
    photoMockupCount: folder.photoMockupCount,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  }
}

function toPublicFolderDetail(folder: FolderDetail): FolderDetail {
  return {
    ...toPublicFolder(folder),
    path: (folder.path ?? []).map((entry) => ({
      uuid: entry.uuid,
      name: entry.name,
    })),
    totalFolderCount: folder.totalFolderCount,
    totalPsdMockupCount: folder.totalPsdMockupCount,
    totalPhotoMockupCount: folder.totalPhotoMockupCount,
  }
}

function toPublicDeleteResult(result: DeleteFolderResult): DeleteFolderResult {
  return {
    deleted: result.deleted,
    deletedFolders: result.deletedFolders,
    deletedPsdMockups: result.deletedPsdMockups,
    deletedPhotoMockups: result.deletedPhotoMockups,
  }
}

function toPublicMoveResult(result: MoveToFolderResult): MoveToFolderResult {
  return {
    targetFolderUuid: result.targetFolderUuid ?? null,
    movedPsdMockups: result.movedPsdMockups,
    movedPhotoMockups: result.movedPhotoMockups,
    movedFolders: result.movedFolders,
  }
}

/**
 * Folders keep a large mockup library in a tree. PSD mockups and photo
 * mockups share that tree, and every mockup sits in exactly one folder or at
 * the top of the library. Reading and writing folders costs no credits.
 */
export class FoldersResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * List folders, by name, with pagination.
   *
   * @example
   * ```ts
   * const { folders } = await client.folders.list({ parentUuid: 'root' })
   * ```
   */
  async list(params: ListFoldersParams = {}): Promise<FolderListResult> {
    const result = await this.client.request<FolderListResult>({
      method: 'GET',
      path: FOLDERS_PATH,
      query: {
        parent_uuid: params.parentUuid,
        limit: params.limit,
        offset: params.offset,
      },
    })
    return {
      folders: result.folders.map(toPublicFolder),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    }
  }

  /**
   * Create a folder, at the top of the library or inside another one.
   *
   * @example
   * ```ts
   * const folder = await client.folders.create({ name: 'Frames' })
   * ```
   */
  async create(params: CreateFolderParams): Promise<Folder> {
    const body: Record<string, unknown> = { name: params.name }
    if (params.parentUuid !== undefined) body['parentUuid'] = params.parentUuid
    const folder = await this.client.request<Folder>({
      method: 'POST',
      path: FOLDERS_PATH,
      body,
    })
    return toPublicFolder(folder)
  }

  /**
   * Get one folder, the trail of folders above it, and what it holds at any
   * depth. The `total` counts are what a recursive delete would remove.
   *
   * @example
   * ```ts
   * const folder = await client.folders.get('uuid')
   * console.log(folder.totalPsdMockupCount)
   * ```
   */
  async get(uuid: string): Promise<FolderDetail> {
    const folder = await this.client.request<FolderDetail>({
      method: 'GET',
      path: folderPath(uuid),
    })
    return toPublicFolderDetail(folder)
  }

  /**
   * Rename a folder, move it, or both. Everything inside moves with it.
   *
   * @example
   * ```ts
   * await client.folders.update('uuid', { name: 'Frames 8x10' })
   * await client.folders.update('uuid', { parentUuid: null })
   * ```
   */
  async update(uuid: string, params: UpdateFolderParams): Promise<FolderDetail> {
    const body: Record<string, unknown> = {}
    if (params.name !== undefined) body['name'] = params.name
    // Presence, not truthiness: writing the field out with a `null` is the
    // caller asking for the top of the library, which is not the same as
    // leaving the folder where it is.
    if (Object.prototype.hasOwnProperty.call(params, 'parentUuid')) {
      body['parentUuid'] = params.parentUuid
    }
    const folder = await this.client.request<FolderDetail>({
      method: 'PATCH',
      path: folderPath(uuid),
      body,
    })
    return toPublicFolderDetail(folder)
  }

  /**
   * Delete a folder and report what went.
   *
   * An empty folder deletes on its own. A folder that holds anything needs
   * `recursive: true`, which permanently deletes everything inside it,
   * mockups included; without it the call is refused and nothing is touched.
   * Read the folder first to tell someone what they are about to lose.
   *
   * @example
   * ```ts
   * const gone = await client.folders.delete('uuid', { recursive: true })
   * console.log(gone.deletedPsdMockups)
   * ```
   */
  async delete(
    uuid: string,
    params: DeleteFolderParams = {},
  ): Promise<DeleteFolderResult> {
    const result = await this.client.request<DeleteFolderResult>({
      method: 'DELETE',
      path: folderPath(uuid),
      query: { recursive: params.recursive ? 'true' : undefined },
    })
    return toPublicDeleteResult(result)
  }

  /**
   * Move any mix of PSD mockups, photo mockups and folders into one folder,
   * or to the top of the library. Everything listed moves together or nothing
   * does, and moving never changes a mockup's id.
   *
   * @example
   * ```ts
   * await client.folders.move({
   *   targetFolderUuid: 'folder-uuid',
   *   psdMockupUuids: ['mockup-uuid'],
   * })
   * ```
   */
  async move(params: MoveToFolderParams): Promise<MoveToFolderResult> {
    const psdMockupUuids = [...(params.psdMockupUuids ?? [])]
    const photoMockupUuids = [...(params.photoMockupUuids ?? [])]
    const folderUuids = [...(params.folderUuids ?? [])]
    // Nothing to move is a mistake in the call, not a request worth sending.
    if (
      psdMockupUuids.length + photoMockupUuids.length + folderUuids.length ===
      0
    ) {
      throw new ValidationError(
        'Name at least one mockup or folder to move in psdMockupUuids, photoMockupUuids or folderUuids',
      )
    }
    const result = await this.client.request<MoveToFolderResult>({
      method: 'POST',
      path: `${FOLDERS_PATH}/move`,
      body: {
        targetFolderUuid: params.targetFolderUuid ?? null,
        psdMockupUuids,
        photoMockupUuids,
        folderUuids,
      },
    })
    return toPublicMoveResult(result)
  }
}
