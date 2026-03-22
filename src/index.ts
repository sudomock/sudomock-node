import { HttpClient } from './client'
import { SudoMockError } from './errors'
import { MockupsResource } from './resources/mockups'
import { RendersResource } from './resources/renders'
import { AIResource } from './resources/ai'
import { UploadsResource } from './resources/uploads'
import { AccountResource } from './resources/account'
import { StudioResource } from './resources/studio'
import type { SudoMockOptions } from './types'

const DEFAULT_BASE_URL = 'https://api.sudomock.com'
const DEFAULT_TIMEOUT = 30_000
const DEFAULT_MAX_RETRIES = 2

/**
 * SudoMock API client.
 *
 * @example
 * ```ts
 * import SudoMock from 'sudomock'
 *
 * const client = new SudoMock('sm_xxx')
 *
 * // List mockups
 * const { mockups } = await client.mockups.list()
 *
 * // Render
 * const render = await client.renders.create({
 *   mockupId: mockups[0].uuid,
 *   smartObjects: [{
 *     uuid: mockups[0].smartObjects[0].uuid,
 *     asset: { url: 'https://example.com/design.png' },
 *   }],
 * })
 * console.log(render.url)
 * ```
 */
class SudoMock {
  /** Mockup CRUD operations */
  readonly mockups: MockupsResource
  /** Render mockups with artwork */
  readonly renders: RendersResource
  /** AI-powered rendering (no PSD required) */
  readonly ai: AIResource
  /** Upload PSD files */
  readonly uploads: UploadsResource
  /** Account info and usage */
  readonly account: AccountResource
  /** Studio session management */
  readonly studio: StudioResource

  constructor(apiKey?: string, options: SudoMockOptions = {}) {
    const resolvedKey = apiKey ?? options.apiKey ?? process.env['SUDOMOCK_API_KEY'] ?? ''

    if (!resolvedKey) {
      throw new SudoMockError(
        'API key is required. Pass it as the first argument or set the SUDOMOCK_API_KEY environment variable.',
      )
    }

    const client = new HttpClient({
      apiKey: resolvedKey,
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    })

    this.mockups = new MockupsResource(client)
    this.renders = new RendersResource(client)
    this.ai = new AIResource(client)
    this.uploads = new UploadsResource(client)
    this.account = new AccountResource(client)
    this.studio = new StudioResource(client)
  }
}

// Default export for convenient `import SudoMock from 'sudomock'`
export default SudoMock

// Named export for `import { SudoMock } from 'sudomock'`
export { SudoMock }

// Re-export everything consumers might need
export {
  SudoMockError,
  AuthenticationError,
  CreditError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  InternalError,
  TimeoutError,
  ConnectionError,
} from './errors'

export type {
  SudoMockOptions,
  ListMockupsParams,
  Mockup,
  MockupListResult,
  SmartObject,
  Size,
  Position,
  ThumbnailSize,
  PrintAreaPreset,
  CreateRenderParams,
  RenderSmartObjectInput,
  SmartObjectAsset,
  SmartObjectColor,
  AdjustmentLayers,
  ExportOptions,
  PrintFile,
  RenderResult,
  AIRenderParams,
  AIAdjustments,
  AIPlacement,
  AIPrintFile,
  AIRenderResult,
  UploadParams,
  UploadResult,
  AccountResult,
  AccountInfo,
  SubscriptionInfo,
  UsageInfo,
  ApiKeyInfo,
  CreateSessionParams,
  SessionResult,
} from './types'
