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
    const result = await this.client.request<AccountResult>({
      method: 'GET',
      path: '/api/v1/me',
    })
    return {
      account: {
        uuid: result.account.uuid,
        email: result.account.email,
        name: result.account.name,
        createdAt: result.account.createdAt,
      },
      subscription: {
        plan: result.subscription.plan,
        tier: result.subscription.tier,
        status: result.subscription.status,
        currentPeriodEnd: result.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: result.subscription.cancelAtPeriodEnd,
        billingChannel: result.subscription.billingChannel,
      },
      usage: {
        creditsUsedThisMonth: result.usage.creditsUsedThisMonth,
        creditsLimit: result.usage.creditsLimit,
        creditsRemaining: result.usage.creditsRemaining,
        billingPeriodStart: result.usage.billingPeriodStart,
        billingPeriodEnd: result.usage.billingPeriodEnd,
      },
      apiKey: {
        name: result.apiKey.name,
        createdAt: result.apiKey.createdAt,
        lastUsedAt: result.apiKey.lastUsedAt,
        totalRequests: result.apiKey.totalRequests,
      },
    }
  }
}
