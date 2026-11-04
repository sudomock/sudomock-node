import { randomUUID } from 'node:crypto'
import type { HttpClient } from '../client'
import type {
  CheckSeamsParams,
  FixSeamsParams,
  Job,
  RemoveBackgroundParams,
  RemoveBackgroundResult,
  SeamCheckResult,
} from '../types'
import { ValidationError } from '../errors'
import { toJob } from './jobs'

/** Default background-removal timeout: 120s */
const REMOVE_BACKGROUND_TIMEOUT = 120_000
/** Default seam check and seam fix submit timeout: 120s */
const SEAMS_TIMEOUT = 120_000

function seamsBody(params: CheckSeamsParams): Record<string, unknown> {
  if ((params.url === undefined) === (params.base64 === undefined)) {
    throw new ValidationError('Provide exactly one of url or base64')
  }
  if (
    params.cropAspect !== undefined &&
    !(Number.isFinite(params.cropAspect) && params.cropAspect > 0)
  ) {
    throw new ValidationError('cropAspect must be a number greater than 0')
  }
  return {
    url: params.url,
    base64: params.base64,
    contentType: params.contentType,
    cropAspect: params.cropAspect,
  }
}

/**
 * Image utilities (`client.images`).
 *
 * Standalone image operations that produce reusable artwork.
 */
export class ImagesResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Remove the background from an image; returns a public transparent-PNG
   * cutout URL that stays available for 7 days.
   *
   * Supply exactly one of `url` or `base64`. The returned `url` is ready to
   * pass straight back as render artwork. To clean artwork inline during a
   * render instead, set `removeBackground: true` on the render asset
   * (`renders.create`) or print area (`ai.render`).
   *
   * Costs 5 credits per image; credits are refunded automatically if
   * processing fails.
   *
   * @example
   * ```ts
   * const cutout = await client.images.removeBackground({
   *   url: 'https://example.com/product-photo.jpg',
   * })
   * console.log(cutout.url, cutout.width, cutout.height)
   *
   * const render = await client.renders.create({
   *   mockupId: 'mockup-uuid',
   *   smartObjects: [{ uuid: 'so-uuid', asset: { url: cutout.url } }],
   * })
   * ```
   */
  async removeBackground(
    params: RemoveBackgroundParams,
  ): Promise<RemoveBackgroundResult> {
    if ((params.url === undefined) === (params.base64 === undefined)) {
      throw new ValidationError('Provide exactly one of url or base64')
    }

    const result = await this.client.request<RemoveBackgroundResult>({
      method: 'POST',
      path: '/api/v1/remove-background',
      body: {
        url: params.url,
        base64: params.base64,
        contentType: params.contentType,
      },
      timeout: REMOVE_BACKGROUND_TIMEOUT,
    })
    return {
      url: result.url,
      width: result.width,
      height: result.height,
      creditsCharged: result.creditsCharged,
    }
  }

  /**
   * Check whether copies of a pattern tile meet without a visible line when
   * it repeats on a mockup, and where a line appears.
   *
   * Supply exactly one of `url` or `base64`. Pass `cropAspect` when the
   * render places the tile with `fit: 'crop'`, so the check sees exactly the
   * tile the render shows. `previousFix` hands back your latest completed
   * fix of the same tile, which you can use again at no cost.
   *
   * Seam check: free. Seam fix: 60 credits, refunded if the fix fails.
   *
   * @example
   * ```ts
   * const check = await client.images.checkSeams({
   *   url: 'https://example.com/pattern-tile.png',
   * })
   * if (check.status === 'visible_seam' && check.fixable) {
   *   const job = await client.images.fixSeams({
   *     url: 'https://example.com/pattern-tile.png',
   *   })
   * }
   * ```
   */
  async checkSeams(params: CheckSeamsParams): Promise<SeamCheckResult> {
    const body = seamsBody(params)
    const result = await this.client.request<SeamCheckResult>({
      method: 'POST',
      path: '/api/v1/check-seams',
      body,
      timeout: SEAMS_TIMEOUT,
    })
    const previous = result.previousFix
    return {
      status: result.status,
      seams: (result.seams ?? []).map((seam) => ({
        side: seam.side,
        status: seam.status,
        ranges: seam.ranges,
      })),
      width: result.width,
      height: result.height,
      fixable: result.fixable,
      unfixableReason: result.unfixableReason ?? null,
      previousFix: previous
        ? {
            jobId: previous.jobId,
            resultUrl: previous.resultUrl,
            alternativeUrl: previous.alternativeUrl ?? null,
          }
        : null,
    }
  }

  /**
   * Fix the seams of a pattern tile so its copies meet without a visible
   * line, keeping its width and height.
   *
   * Always asynchronous: resolves with a {@link Job} of kind `'seam_fix'`.
   * Wait for it with `client.jobs.waitForJob(job.jobId)`; the finished job
   * carries `resultUrl`, `alternativeUrl` (a second fixed version, or
   * `null`), `resultStatus` and `changes`. Takes the same `url` or `base64`
   * and `cropAspect` as {@link checkSeams}. A tile with transparent edges,
   * or one larger than a fix takes, is refused with a `ValidationError` and
   * nothing is charged.
   *
   * Seam fix: 60 credits, refunded if the fix fails. Seam check: free.
   *
   * @example
   * ```ts
   * const job = await client.images.fixSeams({
   *   url: 'https://example.com/pattern-tile.png',
   * })
   * const done = await client.jobs.waitForJob(job.jobId)
   * if (done.status === 'succeeded') console.log(done.resultUrl)
   * ```
   */
  async fixSeams(params: FixSeamsParams): Promise<Job> {
    const body = seamsBody(params)
    const data = await this.client.request<Job>({
      method: 'POST',
      path: '/api/v1/fix-seams',
      body,
      headers: { 'Idempotency-Key': params.idempotencyKey ?? randomUUID() },
      timeout: SEAMS_TIMEOUT,
    })
    return toJob(data)
  }
}
