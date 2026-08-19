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
   * An account is funded either by a subscription allowance or by a prepaid
   * balance, so read both. An account paying as it goes has no allowance and
   * reports `creditsLimit: 0`, which renders as `0 / 0` if `prepaidBalance` is
   * ignored.
   *
   * @example
   * ```ts
   * const { usage } = await client.account.get()
   *
   * if (usage.creditsLimit > 0) {
   *   console.log(`${usage.creditsRemaining} of ${usage.creditsLimit} credits left`)
   * }
   * if (usage.prepaidBalance > 0) {
   *   console.log(`${usage.prepaidBalance.toFixed(2)} ${usage.prepaidBalanceCurrency} balance`)
   * }
   * if (usage.creditsRemaining === 0 && usage.prepaidBalance === 0) {
   *   console.log('No credits or balance. Add a credit card.')
   * }
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
        // This map is an allowlist: it rebuilds the object key by key, so a
        // field missing here is dropped without a trace no matter what the API
        // sent. Both lines below are load-bearing for that reason.
        //
        // Coalesced rather than passed through, so the declared non-optional
        // type stays honest against a deployment that predates the fields.
        prepaidBalance: result.usage.prepaidBalance ?? 0,
        prepaidBalanceCurrency: result.usage.prepaidBalanceCurrency ?? 'USD',
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
