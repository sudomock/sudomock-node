import type { HttpClient } from '../client'
import type {
  AIRenderParams,
  AIRenderResult,
  TwoDMockup,
  List2dMockupsParams,
} from '../types'

/** Default 2D-mockup render timeout: 120s */
const AI_RENDER_TIMEOUT = 120_000

/**
 * SudoAI 2D mockups (`client.ai`).
 *
 * Render artwork onto an existing 2D mockup and manage your 2D-mockup catalog.
 * Rendering costs 5 credits per call.
 */
export class AIResource {
  constructor(private readonly client: HttpClient) {}

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
   * List your 2D mockups (newest first).
   *
   * @example
   * ```ts
   * const mockups = await client.ai.list({ limit: 50 })
   * ```
   */
  async list(params: List2dMockupsParams = {}): Promise<TwoDMockup[]> {
    return this.client.request<TwoDMockup[]>({
      method: 'GET',
      path: '/api/v1/sudoai/2d-mockups',
      query: {
        limit: params.limit,
        offset: params.offset,
      },
    })
  }

  /**
   * Get a single 2D mockup by id.
   */
  async get(mockupId: string): Promise<TwoDMockup> {
    return this.client.request<TwoDMockup>({
      method: 'GET',
      path: `/api/v1/sudoai/2d-mockup/${mockupId}`,
    })
  }

  /**
   * Delete a 2D mockup (and its masks, quads, and storage) permanently.
   */
  async delete(mockupId: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/api/v1/sudoai/2d-mockup/${mockupId}`,
    })
  }
}
