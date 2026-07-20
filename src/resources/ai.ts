import { randomUUID } from 'node:crypto'
import type { HttpClient } from '../client'
import type {
  AIRenderParams,
  AIRenderResult,
  Create2DMockupParams,
  Create2DMockupResult,
  TwoDMockup,
  TwoDMockupDetails,
  TwoDMockupListResult,
  List2dMockupsParams,
  TwoDPrintAreaInput,
  Update2DPrintAreasResult,
  WaitFor2DMockupOptions,
} from '../types'
import { JobFailedError, SudoMockError, ValidationError } from '../errors'
import { JobsResource } from './jobs'

/** Default 2D-mockup render timeout: 120s */
const AI_RENDER_TIMEOUT = 120_000

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
   * Supply exactly one of `sourceUrl` or `sourceBase64`. The accepted job can
   * be passed directly to {@link waitForReady}. Costs 25 credits. If the image
   * is not suitable, the job fails and the credits are refunded automatically.
   *
   * @example
   * ```ts
   * const job = await client.ai.create({
   *   sourceUrl: 'https://example.com/product.jpg',
   *   name: 'Front view',
   *   idempotencyKey: 'front-view-v1',
   * })
   * const mockup = await client.ai.waitForReady(job)
   * ```
   */
  async create(params: Create2DMockupParams): Promise<Create2DMockupResult> {
    if (
      (params.sourceUrl === undefined) ===
      (params.sourceBase64 === undefined)
    ) {
      throw new ValidationError(
        'Provide exactly one of sourceUrl or sourceBase64',
      )
    }

    const idempotencyKey = params.idempotencyKey ?? randomUUID()
    return this.client.request<Create2DMockupResult>({
      method: 'POST',
      path: '/api/v1/sudoai/2d-mockups',
      body: {
        sourceUrl: params.sourceUrl,
        sourceBase64: params.sourceBase64,
        name: params.name,
      },
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  }

  /**
   * Wait for a 2D-mockup creation job and return the completed mockup.
   *
   * Throws {@link JobFailedError} with the API failure code and message when
   * creation fails. Throws {@link TimeoutError} when the wait exceeds
   * `timeoutMs`.
   */
  async waitForReady(
    jobIdOrCreateResult: string | Create2DMockupResult,
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
   * Targets `POST /api/v1/sudoai/2d-mockup/render` (the canonical endpoint; the
   * legacy `/sudoai/render` alias is deprecated and sunsets 2026-09-30). Each
   * print area must supply `artworkUrl` OR `color`. Costs 5 credits.
   *
   * @example
   * ```ts
   * const result = await client.ai.render({
   *   mockupId: 'mockup-uuid',
   *   printAreas: [{
   *     uuid: 'print-area-uuid',
   *     artworkUrl: 'https://example.com/design.png',
   *   }],
   * })
   * console.log(result.url)
   * ```
   */
  async render(params: AIRenderParams): Promise<AIRenderResult> {
    const body = {
      mockupUuid: params.mockupId,
      printAreas: params.printAreas,
      exportOptions: params.exportOptions,
    }

    const result = await this.client.request<AIRenderResult>({
      method: 'POST',
      path: '/api/v1/sudoai/2d-mockup/render',
      body,
      timeout: AI_RENDER_TIMEOUT,
    })

    // Add convenience `url` getter
    return {
      ...result,
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
      },
      rawEnvelope: true,
    })

    return {
      mockups: body.data ?? [],
      total: body.total ?? 0,
      limit: body.limit ?? params.limit ?? 20,
      offset: body.offset ?? params.offset ?? 0,
    }
  }

  /**
   * Get a single 2D mockup by id.
   */
  async get(mockupId: string): Promise<TwoDMockupDetails> {
    return this.client.request<TwoDMockupDetails>({
      method: 'GET',
      path: `/api/v1/sudoai/2d-mockup/${mockupId}`,
    })
  }

  /**
   * Replace all print areas on a 2D mockup with 1 to 8 four-point quads.
   */
  async updatePrintAreas(
    mockupId: string,
    printAreas: readonly TwoDPrintAreaInput[],
  ): Promise<Update2DPrintAreasResult> {
    if (printAreas.length === 0 || printAreas.length > 8) {
      throw new ValidationError('Provide between 1 and 8 print areas')
    }

    return this.client.request<Update2DPrintAreasResult>({
      method: 'PUT',
      path: `/api/v1/sudoai/2d-mockup/${mockupId}/print-areas`,
      body: { printAreas },
    })
  }

  /**
   * Permanently delete a 2D mockup and all of its associated data.
   */
  async delete(mockupId: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/api/v1/sudoai/2d-mockup/${mockupId}`,
    })
  }
}
