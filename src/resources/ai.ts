import type { HttpClient } from '../client'
import type { AIRenderParams, AIRenderResult } from '../types'

/** Default AI render timeout: 120s */
const AI_RENDER_TIMEOUT = 120_000

export class AIResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Render using AI -- no PSD required.
   *
   * Automatically segments the product image, detects the print area,
   * and composites the artwork with perspective correction.
   *
   * @example
   * ```ts
   * const result = await client.ai.render({
   *   sourceUrl: 'https://example.com/product.jpg',
   *   artworkUrl: 'https://example.com/design.png',
   * })
   * console.log(result.url)
   * ```
   */
  async render(params: AIRenderParams): Promise<AIRenderResult> {
    const result = await this.client.request<AIRenderResult>({
      method: 'POST',
      path: '/api/v1/sudoai/render',
      body: params,
      timeout: AI_RENDER_TIMEOUT,
    })

    // Add convenience `url` getter
    return {
      ...result,
      url: result.printFiles[0]?.exportPath ?? '',
    }
  }
}
