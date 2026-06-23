import type { HttpClient } from '../client'
import type { UploadParams, UploadResult, Job } from '../types'
import { isJobBody, toJob } from './jobs'

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
   * By default this blocks until processing finishes and resolves with the
   * {@link UploadResult}. Pass `isAsync: true` to process in the background:
   * the API responds with HTTP 202 (PSD upload is FREE -- 0 credits) and this
   * method resolves with a {@link Job} you can poll via `client.jobs`.
   *
   * @example Synchronous
   * ```ts
   * const mockup = await client.uploads.create({
   *   psdFileUrl: 'https://example.com/mockup.psd',
   *   psdName: 'My T-Shirt Mockup',
   * })
   * console.log(mockup.uuid, mockup.smartObjects)
   * ```
   *
   * @example Asynchronous
   * ```ts
   * const job = await client.uploads.create({
   *   psdFileUrl: 'https://example.com/mockup.psd',
   *   isAsync: true,
   * })
   * const done = await client.jobs.waitForJob(job.jobId)
   * console.log(done.mockupUuid)
   * ```
   */
  create(params: UploadParams & { isAsync: true }): Promise<Job>
  create(params: UploadParams): Promise<UploadResult>
  async create(params: UploadParams): Promise<UploadResult | Job> {
    const { status, data } = await this.client.requestWithStatus<
      UploadResult | Job
    >({
      method: 'POST',
      path: '/api/v1/psd/upload',
      body: params,
      timeout: UPLOAD_TIMEOUT,
    })

    if (status === 202 || isJobBody(data)) {
      return toJob(data)
    }

    return data as UploadResult
  }
}
