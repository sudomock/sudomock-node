import { randomUUID } from 'node:crypto'
import type { HttpClient } from '../client'
import type {
  AIRenderParams,
  AIRenderResult,
  Create2DMockupParams,
  Job,
  TwoDMockup,
  TwoDMockupDetails,
  TwoDMockupQuad,
  TwoDMockupListResult,
  List2dMockupsParams,
  TwoDPrintAreaInput,
  Update2DPrintAreasResult,
  WaitFor2DMockupOptions,
} from '../types'
import { JobFailedError, SudoMockError, ValidationError } from '../errors'
import { JobsResource, isJobBody, toJob } from './jobs'

/** Default 2D-mockup render timeout: 120s */
const AI_RENDER_TIMEOUT = 120_000

function publicQuad(quad: TwoDMockupQuad): TwoDMockupQuad {
  return {
    printAreaId: quad.printAreaId,
    points: quad.points,
    sortOrder: quad.sortOrder,
    name: quad.name,
  }
}

function publicMockup(mockup: TwoDMockup): TwoDMockup {
  return {
    mockupId: mockup.mockupId,
    name: mockup.name,
    status: mockup.status,
    customizable: mockup.customizable,
    thumbnailUrl: mockup.thumbnailUrl,
    watermarkedSourceUrl: mockup.watermarkedSourceUrl,
    sourceWidth: mockup.sourceWidth,
    sourceHeight: mockup.sourceHeight,
    quads: mockup.quads?.map(publicQuad),
    printAreas: mockup.printAreas?.map(publicQuad),
    version: mockup.version,
    createdAt: mockup.createdAt,
    updatedAt: mockup.updatedAt,
  }
}

function publicMockupDetails(mockup: TwoDMockupDetails): TwoDMockupDetails {
  return {
    ...publicMockup(mockup),
    quads: mockup.quads.map(publicQuad),
    surfaces: mockup.surfaces.map((surface) => ({
      surfaceUuid: surface.surfaceUuid,
      coverage: 'full',
    })),
  }
}

/**
 * SudoAI 2D mockups (`client.ai`).
 *
 * Create and render reusable 2D mockups, and manage your 2D-mockup catalog.
 * Creation costs 25 credits. Rendering costs 5 credits per call.
 */
export class AIResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Create a reusable 2D mockup from a public URL or base64 image.
   *
   * Supply exactly one of `sourceUrl` or `sourceBase64`. By default the mockup
   * is created synchronously: the API responds with HTTP 201 and this method
   * resolves with the ready {@link TwoDMockupDetails} (including its `quads`).
   * Pass `isAsync: true` to enqueue creation instead: the API responds with
   * HTTP 202 and this method resolves with a {@link Job} you can pass to
   * {@link waitForReady} (or poll via `client.jobs`).
   *
   * Costs 25 credits. If the source image is not suitable the request fails
   * (sync) or the job fails (async) and the credits are refunded automatically.
   *
   * @example Synchronous (default)
   * ```ts
   * const mockup = await client.ai.create({
   *   sourceUrl: 'https://example.com/product.jpg',
   *   name: 'Front view',
   *   idempotencyKey: 'front-view-v1',
   * })
   * console.log(mockup.mockupId, mockup.quads)
   * ```
   *
   * @example Asynchronous
   * ```ts
   * const job = await client.ai.create({
   *   sourceUrl: 'https://example.com/product.jpg',
   *   isAsync: true,
   * })
   * const mockup = await client.ai.waitForReady(job)
   * ```
   */
  create(params: Create2DMockupParams & { isAsync: true }): Promise<Job>
  create(params: Create2DMockupParams): Promise<TwoDMockupDetails>
  async create(
    params: Create2DMockupParams,
  ): Promise<TwoDMockupDetails | Job> {
    if (
      (params.sourceUrl === undefined) ===
      (params.sourceBase64 === undefined)
    ) {
      throw new ValidationError(
        'Provide exactly one of sourceUrl or sourceBase64',
      )
    }

    const idempotencyKey = params.idempotencyKey ?? randomUUID()
    const body: Record<string, unknown> = {
      sourceUrl: params.sourceUrl,
      sourceBase64: params.sourceBase64,
      name: params.name,
      printAreas: params.printAreas,
    }
    // Only send is_async when explicitly opting into the async job flow; the
    // default (sync) create must not carry the flag.
    if (params.isAsync) {
      body['isAsync'] = true
    }

    const { status, data } = await this.client.requestWithStatus<
      TwoDMockupDetails | Job
    >({
      method: 'POST',
      path: '/api/v1/sudoai/2d-mockups',
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    })

    // 202 Accepted -> async job (has `job_id`, not the mockup body). Sync 201
    // returns the ready mockup directly.
    if (status === 202 || isJobBody(data)) {
      return toJob(data)
    }

    return publicMockupDetails(data as TwoDMockupDetails)
  }

  /**
   * Wait for a 2D-mockup creation job and return the completed mockup.
   *
   * Only needed for the async create flow (`create({ isAsync: true })`); the
   * default sync create already returns the ready mockup. Throws
   * {@link JobFailedError} with the API failure code and message when creation
   * fails. Throws {@link TimeoutError} when the wait exceeds `timeoutMs`.
   */
  async waitForReady(
    jobIdOrCreateResult: string | Job,
    {
      intervalMs = 2_000,
      timeoutMs = 180_000,
    }: WaitFor2DMockupOptions = {},
  ): Promise<TwoDMockupDetails> {
    const jobId =
      typeof jobIdOrCreateResult === 'string'
        ? jobIdOrCreateResult
        : jobIdOrCreateResult.jobId
    const job = await new JobsResource(this.client).waitForJob(jobId, {
      intervalMs,
      timeoutMs,
    })

    if (job.status === 'failed') {
      throw new JobFailedError(
        jobId,
        job.error ?? '2D mockup creation failed',
        job.errorCode ?? 'job_failed',
      )
    }
    if (!job.mockupUuid) {
      throw new SudoMockError(
        `Job ${jobId} completed without a mockup ID`,
        0,
        'invalid_job_response',
      )
    }
    return this.get(job.mockupUuid)
  }

  /**
   * Render artwork (or a color) onto an existing 2D mockup.
   *
   * Targets `POST /api/v1/sudoai/2d-mockups/{mockupId}/render` (the mockup id
   * lives in the path). Target a saved print area with `uuid`, or a
   * full-coverage product surface with `surfaceUuid`. Each target must supply `artworkUrl` OR
   * `color`. Costs 5 credits.
   *
   * By default this blocks until the render finishes and resolves with an
   * {@link AIRenderResult} (the rendered `printFiles` plus a `renderUuid` you
   * can use to correlate the render with webhook / transaction records). Pass
   * `isAsync: true` to enqueue the render instead: the API responds with
   * HTTP 202 and this method resolves with a {@link Job} of kind `'2d_render'`
   * you await with `client.jobs.waitForJob(job.jobId)` (or poll via
   * `client.jobs`).
   *
   * @example Synchronous (default)
   * ```ts
   * const result = await client.ai.render({
   *   mockupId: 'mockup-uuid',
   *   printAreas: [{
   *     uuid: 'print-area-uuid',
   *     artworkUrl: 'https://example.com/design.png',
   *   }],
   * })
   * console.log(result.url, result.renderUuid)
   * ```
   *
   * @example Asynchronous
   * ```ts
   * const job = await client.ai.render({
   *   mockupId: 'mockup-uuid',
   *   printAreas: [{ uuid: 'print-area-uuid', artworkUrl: '...' }],
   *   isAsync: true,
   * })
   * const done = await client.jobs.waitForJob(job.jobId)
   * console.log(done.resultUrl)
   * ```
   */
  render(params: AIRenderParams & { isAsync: true }): Promise<Job>
  render(params: AIRenderParams): Promise<AIRenderResult>
  async render(params: AIRenderParams): Promise<AIRenderResult | Job> {
    const printAreas = params.printAreas.map((target) => ({
      ...('uuid' in target && target.uuid
        ? { uuid: target.uuid }
        : { surfaceUuid: target.surfaceUuid }),
      artworkUrl: target.artworkUrl,
      base64: target.base64,
      color: target.color,
      adjustments: target.adjustments
        ? {
            brightness: target.adjustments.brightness,
            contrast: target.adjustments.contrast,
            opacity: target.adjustments.opacity,
            saturation: target.adjustments.saturation,
            vibrance: target.adjustments.vibrance,
            blur: target.adjustments.blur,
          }
        : undefined,
      placement: target.placement
        ? {
            position: target.placement.position,
            coverage: target.placement.coverage,
            fit: target.placement.fit,
            // Both axes are forwarded. This alone-standing list is why a new
            // placement field is dropped on the floor unless it is added here.
            width: target.placement.width,
            height: target.placement.height,
            rotation: target.placement.rotation,
            offsetX: target.placement.offsetX,
            offsetY: target.placement.offsetY,
          }
        : undefined,
      removeBackground: target.removeBackground,
    }))
    const body: Record<string, unknown> = {
      printAreas,
      exportOptions: params.exportOptions,
    }
    // Only send is_async when explicitly opting into the async job flow; the
    // default (sync) render must not carry the flag.
    if (params.isAsync) {
      body['isAsync'] = true
    }

    const { status, data } = await this.client.requestWithStatus<
      AIRenderResult | Job
    >({
      method: 'POST',
      path: `/api/v1/sudoai/2d-mockups/${params.mockupId}/render`,
      body,
      timeout: AI_RENDER_TIMEOUT,
    })

    // 202 Accepted -> async job (has `job_id`, not `print_files`). Sync 200
    // returns the rendered result directly, so we must NOT read printFiles[0]
    // here (that would crash on the async envelope).
    if (status === 202 || isJobBody(data)) {
      return toJob(data)
    }

    const result = data as AIRenderResult
    return {
      printFiles: result.printFiles.map((file) => ({
        exportPath: file.exportPath,
        durationMs: file.durationMs,
        exportFormat: file.exportFormat,
      })),
      renderUuid: result.renderUuid,
      url: result.printFiles[0]?.exportPath ?? '',
    }
  }

  /**
   * List your 2D mockups (newest first), with pagination metadata.
   *
   * Returns the page of mockups plus `total` / `limit` / `offset` so callers
   * can drive "load more" without a separate count call.
   *
   * @example
   * ```ts
   * const { mockups, total } = await client.ai.list({ limit: 50 })
   * ```
   */
  async list(
    params: List2dMockupsParams = {},
  ): Promise<TwoDMockupListResult> {
    // The BE returns `{ data: [...], total, limit, offset, success }` -- the
    // pagination lives as siblings of `data`, so we keep the raw envelope
    // (the default unwrap would discard total/limit/offset).
    const body = await this.client.request<{
      data?: TwoDMockup[]
      total?: number
      limit?: number
      offset?: number
    }>({
      method: 'GET',
      path: '/api/v1/sudoai/2d-mockups',
      query: {
        limit: params.limit,
        offset: params.offset,
        customizable_only: params.customizableOnly ? 'true' : undefined,
      },
      rawEnvelope: true,
    })

    return {
      mockups: (body.data ?? []).map(publicMockup),
      total: body.total ?? 0,
      limit: body.limit ?? params.limit ?? 20,
      offset: body.offset ?? params.offset ?? 0,
    }
  }

  /**
   * Get a single 2D mockup by id.
   */
  async get(mockupId: string): Promise<TwoDMockupDetails> {
    const mockup = await this.client.request<TwoDMockupDetails>({
      method: 'GET',
      path: `/api/v1/sudoai/2d-mockups/${mockupId}`,
    })
    return publicMockupDetails(mockup)
  }

  /**
   * Replace all print areas on a 2D mockup with up to 8 four-point quads. An
   * empty array is accepted only when the API has verified every product
   * surface as full coverage. Each quad may carry an optional `name`.
   */
  async updatePrintAreas(
    mockupId: string,
    printAreas: readonly TwoDPrintAreaInput[],
  ): Promise<Update2DPrintAreasResult> {
    if (printAreas.length > 8) {
      throw new ValidationError('Provide at most 8 print areas')
    }

    const result = await this.client.request<Update2DPrintAreasResult>({
      method: 'PUT',
      path: `/api/v1/sudoai/2d-mockups/${mockupId}/print-areas`,
      body: { printAreas },
    })
    return {
      mockupId: result.mockupId,
      printAreas: result.printAreas.map(publicQuad),
    }
  }

  /**
   * Permanently delete a 2D mockup and all of its associated data.
   */
  async delete(mockupId: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/api/v1/sudoai/2d-mockups/${mockupId}`,
    })
  }
}
