import { encodeId, type HttpClient } from '../client'
import type {
  ReadyMadeTemplateDetail,
  ReadyMadeTemplatePage,
  SearchReadyMadeParams,
} from '../types'

export const READY_MADE_PATH = '/api/v1/library/templates'

/** A comma-separated query value, or undefined when the caller sent nothing. */
function joined(values: readonly string[] | undefined): string | undefined {
  return values && values.length ? values.join(',') : undefined
}

/**
 * SudoMock's own catalogue of product scenes, free to read and free to start
 * from.
 *
 * Nothing here needs a Photoshop file or a product photo of your own. A
 * mockup is one view of a scene and a template is the set of views of that
 * scene, so a search answers with templates and each one carries its views.
 *
 * This is not your account's own library: that is `client.folders` and
 * `client.psdMockups`.
 */
export class ReadyMadeMockupsResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Search the catalogue, or list it when no filter is given.
   *
   * @example
   * ```ts
   * const { templates, totalMockups } = await client.readyMadeMockups.search({
   *   search: 'coffee mug',
   *   limit: 5,
   * })
   * const view = templates[0].mockups?.[0]
   * ```
   */
  async search(params: SearchReadyMadeParams = {}): Promise<ReadyMadeTemplatePage> {
    return this.client.request<ReadyMadeTemplatePage>({
      method: 'GET',
      path: READY_MADE_PATH,
      query: {
        search: params.search,
        category: params.category,
        subcategory: params.subcategory,
        product_type: params.productType,
        tags: joined(params.tags),
        platforms: joined(params.platforms),
        industries: joined(params.industries),
        use_cases: joined(params.useCases),
        // The query builder takes strings and numbers; a boolean filter
        // travels as the word the API reads.
        is_featured: params.isFeatured === undefined ? undefined : String(params.isFeatured),
        page: params.page,
        limit: params.limit,
        sort_by: params.sortBy,
        sort_order: params.sortOrder,
      },
    })
  }

  /**
   * Read one template by its slug, with its long-form copy and every facet.
   *
   * @example
   * ```ts
   * const template = await client.readyMadeMockups.getTemplate(
   *   'accent-coffee-mug-11-15oz-mockup-5afc',
   * )
   * ```
   */
  async getTemplate(slug: string): Promise<ReadyMadeTemplateDetail> {
    return this.client.request<ReadyMadeTemplateDetail>({
      method: 'GET',
      path: `${READY_MADE_PATH}/${encodeId(slug)}`,
    })
  }
}
