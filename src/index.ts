import { HttpClient } from './client'
import { SudoMockError } from './errors'
import { MockupsResource } from './resources/mockups'
import { RendersResource } from './resources/renders'
import { AIResource } from './resources/ai'
import { ImagesResource } from './resources/images'
import { UploadsResource } from './resources/uploads'
import { AccountResource } from './resources/account'
import { StudioResource } from './resources/studio'
import { JobsResource } from './resources/jobs'
import { WebhooksResource } from './resources/webhooks'
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
  /** Create and render reusable 2D mockups */
  readonly ai: AIResource
  /** Standalone image operations (background removal) */
  readonly images: ImagesResource
  /** Upload PSD files */
  readonly uploads: UploadsResource
  /** Account info and usage */
  readonly account: AccountResource
  /** Studio session management */
  readonly studio: StudioResource
  /** Poll async render, video, upload, and 2D-creation jobs */
  readonly jobs: JobsResource
  /** Manage webhook endpoints and their deliveries */
  readonly webhooks: WebhooksResource

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
    this.images = new ImagesResource(client)
    this.uploads = new UploadsResource(client)
    this.account = new AccountResource(client)
    this.studio = new StudioResource(client)
    this.jobs = new JobsResource(client)
    this.webhooks = new WebhooksResource(client)
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
  JobFailedError,
  ConnectionError,
} from './errors'

// Webhook signature verification (usable without a client instance)
export { verifyWebhookSignature } from './resources/webhooks'

export type {
  SudoMockOptions,
  ListMockupsParams,
  Mockup,
  MockupListResult,
  SmartObject,
  TextLayer,
  TextSegment,
  ApiWarning,
  Size,
  Position,
  ThumbnailSize,
  PrintAreaPreset,
  CreateRenderParams,
  RenderSmartObjectInput,
  TextLayerInput,
  TextSegmentInput,
  SmartObjectAsset,
  SmartObjectColor,
  AdjustmentLayers,
  ExportOptions,
  PrintFile,
  RenderResult,
  AIRenderParams,
  AIPrintArea,
  AIAdjustments,
  AIPlacement,
  AIPlacementBase,
  AISurfacePlacement,
  AIPrintAreaPlacement,
  AIPrintFile,
  AIRenderResult,
  Create2DMockupParams,
  Create2DMockupResult,
  WaitFor2DMockupOptions,
  TwoDPoint,
  TwoDQuadPoints,
  TwoDFullSurface,
  TwoDPrintAreaInput,
  Update2DPrintAreasResult,
  TwoDMockup,
  TwoDMockupDetails,
  TwoDMockupQuad,
  TwoDMockupListResult,
  List2dMockupsParams,
  RemoveBackgroundParams,
  RemoveBackgroundResult,
  UploadParams,
  UploadResult,
  AccountResult,
  AccountInfo,
  SubscriptionInfo,
  UsageInfo,
  ApiKeyInfo,
  CreateSessionParams,
  SessionResult,
  StudioSessionUi,
  StudioResultEvent,
  StudioResultPayload,
  StudioActionContext,
  StudioActionReceiptContext,
  StudioActionReceipt,
  ConsumeStudioActionResult,
  Job,
  JobKind,
  JobStatus,
  JobPayg,
  WaitForJobOptions,
  ListJobsParams,
  JobListResult,
  VideoOptions,
  CreateVideoParams,
  VideoWebhookOverride,
  WebhookEvent,
  WebhookEndpoint,
  CreateWebhookEndpointParams,
  UpdateWebhookEndpointParams,
  WebhookDelivery,
  VerifyWebhookOptions,
  ListDeliveriesParams,
  ListWebhookEventsParams,
  ReplayFailedResult,
} from './types'
