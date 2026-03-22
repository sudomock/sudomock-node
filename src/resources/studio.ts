import type { HttpClient } from '../client'
import type { CreateSessionParams, SessionResult } from '../types'

export class StudioResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Create a Studio customization session.
   *
   * Returns an opaque session token for the Studio iframe.
   * The token auto-extends on every API call (active sessions never expire).
   *
   * @example
   * ```ts
   * const session = await client.studio.createSession({
   *   mockupUuid: 'uuid',
   *   productId: 'shopify-product-123',
   * })
   * // Open Studio: studio.sudomock.com/editor?session=<session.session>
   * ```
   */
  async createSession(params: CreateSessionParams): Promise<SessionResult> {
    return this.client.request<SessionResult>({
      method: 'POST',
      path: '/api/v1/studio/create-session',
      body: params,
    })
  }
}
