import type { HttpClient } from '../client'
import type { AccountResult } from '../types'

export class AccountResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Get current user's account information.
   *
   * Returns account details, subscription info, credit usage,
   * and API key metadata.
   *
   * @example
   * ```ts
   * const account = await client.account.get()
   * console.log(`Credits: ${account.usage.creditsRemaining}`)
   * console.log(`Plan: ${account.subscription.plan}`)
   * ```
   */
  async get(): Promise<AccountResult> {
    return this.client.request<AccountResult>({
      method: 'GET',
      path: '/api/v1/me',
    })
  }
}
