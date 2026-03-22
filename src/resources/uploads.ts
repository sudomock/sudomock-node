import type { HttpClient } from '../client'
import type { UploadParams, UploadResult } from '../types'

/** Default upload timeout: 120s (PSD processing can be slow) */
const UPLOAD_TIMEOUT = 120_000

export class UploadsResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Upload and process a PSD file from a URL.
   *
   * The API downloads the PSD, extracts layers and smart objects,
   * and generates thumbnails.
   *
   * @example
   * ```ts
   * const mockup = await client.uploads.create({
   *   psdFileUrl: 'https://example.com/mockup.psd',
   *   psdName: 'My T-Shirt Mockup',
   * })
   * console.log(mockup.uuid, mockup.smartObjects)
   * ```
   */
  async create(params: UploadParams): Promise<UploadResult> {
    return this.client.request<UploadResult>({
      method: 'POST',
      path: '/api/v1/psd/upload',
      body: params,
      timeout: UPLOAD_TIMEOUT,
    })
  }
}
