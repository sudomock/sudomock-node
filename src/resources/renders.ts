import type { HttpClient } from '../client'
import type { CreateRenderParams, RenderResult } from '../types'

/** Default render timeout: 120s (renders can be slow for large PSDs) */
const RENDER_TIMEOUT = 120_000

export class RendersResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Render a mockup with user-provided artwork.
   *
   * @example
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
   */
  async create(params: CreateRenderParams): Promise<RenderResult> {
    const body = {
      mockupUuid: params.mockupId,
      smartObjects: params.smartObjects,
      exportOptions: params.exportOptions,
      exportLabel: params.exportLabel,
    }

    const result = await this.client.request<RenderResult>({
      method: 'POST',
      path: '/api/v1/renders',
      body,
      timeout: RENDER_TIMEOUT,
    })

    // Add convenience `url` getter
    return {
      ...result,
      url: result.printFiles[0]?.exportPath ?? '',
    }
  }
}
