import type { HttpClient } from '../client'
import type { RemoveBackgroundParams, RemoveBackgroundResult } from '../types'
import { ValidationError } from '../errors'

/** Default background-removal timeout: 120s */
const REMOVE_BACKGROUND_TIMEOUT = 120_000

/**
 * Image utilities (`client.images`).
 *
 * Standalone image operations that produce reusable artwork.
 */
export class ImagesResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Remove the background from an image; returns a signed transparent-PNG
   * cutout URL valid for 7 days.
   *
   * Supply exactly one of `url` or `base64`. The returned `url` is ready to
   * pass straight back as render artwork. To clean artwork inline during a
   * render instead, set `removeBackground: true` on the render asset
   * (`renders.create`) or print area (`ai.render`).
   *
   * Costs 25 credits per image; credits are refunded automatically if
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

    return this.client.request<RemoveBackgroundResult>({
      method: 'POST',
      path: '/api/v1/remove-background',
      body: {
        url: params.url,
        base64: params.base64,
        contentType: params.contentType,
      },
      timeout: REMOVE_BACKGROUND_TIMEOUT,
    })
  }
}
