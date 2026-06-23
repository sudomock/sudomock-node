import type { HttpClient } from '../client'
import type {
  CreateRenderParams,
  RenderResult,
  CreateVideoParams,
  Job,
} from '../types'
import { isJobBody, toJob } from './jobs'

/** Default render timeout: 120s (renders can be slow for large PSDs) */
const RENDER_TIMEOUT = 120_000

export class RendersResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Render a mockup with user-provided artwork.
   *
   * By default this blocks until the render finishes and resolves with a
   * {@link RenderResult}. Pass `isAsync: true` to enqueue the render instead:
   * the API responds with HTTP 202 and this method resolves with a {@link Job}
   * you can poll via `client.jobs`.
   *
   * @example Synchronous
   * ```ts
   * const render = await client.renders.create({
   *   mockupId: 'uuid',
   *   smartObjects: [{
   *     uuid: 'so-uuid',
   *     asset: { url: 'https://example.com/design.png' },
   *   }],
   *   exportOptions: { imageFormat: 'webp' },
   * })
   * console.log(render.url)
   * ```
   *
   * @example Asynchronous
   * ```ts
   * const job = await client.renders.create({
   *   mockupId: 'uuid',
   *   smartObjects: [{ uuid: 'so-uuid', asset: { url: '...' } }],
   *   isAsync: true,
   * })
   * const done = await client.jobs.waitForJob(job.jobId)
   * console.log(done.resultUrl)
   * ```
   */
  create(params: CreateRenderParams & { isAsync: true }): Promise<Job>
  create(params: CreateRenderParams): Promise<RenderResult>
  async create(params: CreateRenderParams): Promise<RenderResult | Job> {
    const body = {
      mockupUuid: params.mockupId,
      smartObjects: params.smartObjects,
      exportOptions: params.exportOptions,
      exportLabel: params.exportLabel,
      isAsync: params.isAsync,
    }

    const { status, data } = await this.client.requestWithStatus<
      RenderResult | Job
    >({
      method: 'POST',
      path: '/api/v1/renders',
      body,
      timeout: RENDER_TIMEOUT,
    })

    // 202 Accepted -> async job. The body has `job_id`, not `print_files`,
    // so we must NOT read printFiles[0] here (that would crash on async).
    if (status === 202 || isJobBody(data)) {
      return toJob(data)
    }

    const result = data as RenderResult
    return {
      ...result,
      url: result.printFiles[0]?.exportPath ?? '',
    }
  }

  /**
   * Render an animated video mockup. Always asynchronous: the API responds
   * with HTTP 202 and a {@link Job} of kind `'video'`.
   *
   * Credit cost scales with the model, duration, and audio. The free tier
   * allows a single lifetime video render. `video.durationSeconds` must be one
   * of the durations the chosen model supports, or the API returns a 400.
   *
   * @example
   * ```ts
   * const job = await client.renders.createVideo({
   *   mockupId: 'uuid',
   *   smartObjects: [{ uuid: 'so-uuid', asset: { url: '...' } }],
   *   video: { durationSeconds: 5, audio: false },
   * })
   * const done = await client.jobs.waitForJob(job.jobId)
   * console.log(done.resultUrl) // mp4 URL
   * ```
   */
  async createVideo(params: CreateVideoParams): Promise<Job> {
    const body = {
      mockupUuid: params.mockupId,
      smartObjects: params.smartObjects,
      exportOptions: params.exportOptions,
      imageUrl: params.imageUrl,
      video: params.video,
      webhook: params.webhook,
      exportLabel: params.exportLabel,
    }

    const data = await this.client.request<Job>({
      method: 'POST',
      path: '/api/v1/renders/video',
      body,
      timeout: RENDER_TIMEOUT,
    })

    return toJob(data)
  }
}
