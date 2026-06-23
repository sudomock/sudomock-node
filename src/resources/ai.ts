import type { HttpClient } from '../client'
import type {
  AIRenderParams,
  AIRenderResult,
  TwoDMockup,
  TwoDMockupListResult,
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
