import type { HttpClient } from '../client'
import type { ListMockupsParams, Mockup, MockupListResult } from '../types'

export class MockupsResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * List mockups with pagination and filtering.
   *
   * @example
   * ```ts
   * const { mockups, total } = await client.mockups.list({ limit: 10 })
   * ```
   */
  async list(params: ListMockupsParams = {}): Promise<MockupListResult> {
    return this.client.request<MockupListResult>({
      method: 'GET',
      path: '/api/v1/mockups',
      query: {
        limit: params.limit,
        offset: params.offset,
        name: params.name,
        created_after: params.createdAfter,
        created_before: params.createdBefore,
        sort: params.sort,
        order: params.order,
      },
    })
  }

  /**
   * Get a single mockup by UUID.
   *
   * @example
   * ```ts
   * const mockup = await client.mockups.get('uuid')
   * console.log(mockup.smartObjects)
   * ```
   */
  async get(uuid: string): Promise<Mockup> {
    return this.client.request<Mockup>({
      method: 'GET',
      path: `/api/v1/mockups/${uuid}`,
    })
  }

  /**
   * Update a mockup's name.
   *
   * @example
   * ```ts
   * const updated = await client.mockups.update('uuid', { name: 'New Name' })
   * ```
   */
  async update(uuid: string, params: { name: string }): Promise<Mockup> {
    return this.client.request<Mockup>({
      method: 'PATCH',
      path: `/api/v1/mockups/${uuid}`,
      body: params,
    })
  }

  /**
   * Delete a mockup permanently.
   *
   * @example
   * ```ts
   * await client.mockups.delete('uuid')
   * ```
   */
  async delete(uuid: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/api/v1/mockups/${uuid}`,
    })
  }
}
