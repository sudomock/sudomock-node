import type { HttpClient } from '../client'
import type {
  ConsumeStudioActionResult,
  CreateSessionParams,
  SessionResult,
  StudioActionContext,
  StudioResultEvent,
} from '../types'

export class StudioResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Create a Studio session.
   *
   * Returns an opaque session token for the Studio iframe.
   * The token refreshes its idle window while the session is active.
   *
   * @example
   * ```ts
   * const session = await client.studio.createSession({
   *   mockupType: '2d',
   *   sessionKind: 'customize',
   *   mockupUuid: 'uuid',
   *   allowedOrigin: 'https://shop.example',
   *   productId: 'product-123',
   *   variantId: 'variant-456',
   * })
   * // Open Studio: studio.sudomock.com/editor?session=<session.session>
   * ```
   */
  async createSession(params: CreateSessionParams): Promise<SessionResult> {
    const result = await this.client.request<SessionResult>({
      method: 'POST',
      path: '/api/v1/studio/create-session',
      body: {
        mockupType: params.mockupType,
        sessionKind: params.sessionKind,
        mockupUuid: params.mockupUuid,
        allowedOrigin: params.allowedOrigin,
        productId: params.productId,
        variantId: params.variantId,
        actionId: params.actionId,
        ui: 'ui' in params ? params.ui : undefined,
      },
    })
    return {
      success: true,
      mockupType: result.mockupType,
      session: result.session,
      expiresIn: result.expiresIn,
      messageSessionId: result.messageSessionId,
      bootstrapSecret: result.bootstrapSecret,
    }
  }

  /** Confirm one iframe result on the server before saving or adding to cart. */
  async consumeAction(
    event: StudioResultEvent,
    actionContext: StudioActionContext = {},
  ): Promise<ConsumeStudioActionResult> {
    const publicContext = {
      shop: actionContext.shop,
      productId: actionContext.productId,
      variantId: actionContext.variantId,
    }
    const result = await this.client.request<ConsumeStudioActionResult>({
      method: 'POST',
      path: '/api/v1/studio/actions/consume',
      body: {
        version: event.version,
        requestId: event.request_id,
        messageSessionId: event.message_session_id,
        type: event.type,
        payload: {
          mockupUuid: event.payload.mockup_uuid,
          renderUuid: event.payload.render_uuid,
          actionId: event.payload.action_id,
          actionContext: publicContext,
        },
      },
    })
    const receipt = result.receipt
    return {
      success: true,
      replayed: result.replayed,
      receipt: {
        version: 1,
        requestId: receipt.requestId,
        messageSessionId: receipt.messageSessionId,
        type: receipt.type,
        mockupType: receipt.mockupType,
        sessionKind: receipt.sessionKind,
        actionId: receipt.actionId,
        actionContext: {
          shop: receipt.actionContext.shop,
          productId: receipt.actionContext.productId,
          variantId: receipt.actionContext.variantId,
        },
        mockupUuid: receipt.mockupUuid,
        renderUuid: receipt.renderUuid,
      },
    }
  }
}
