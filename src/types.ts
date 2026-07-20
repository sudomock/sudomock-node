// ---------------------------------------------------------------------------
// Client Configuration
// ---------------------------------------------------------------------------

export interface SudoMockOptions {
  /** API key (defaults to SUDOMOCK_API_KEY env var) */
  apiKey?: string
  /** Base URL for the API (default: https://api.sudomock.com) */
  baseUrl?: string
  /** Default request timeout in ms (default: 30_000) */
  timeout?: number
  /** Max retry attempts for transient errors (default: 2) */
  maxRetries?: number
}

// ---------------------------------------------------------------------------
// Pagination & Filtering
// ---------------------------------------------------------------------------

export interface ListMockupsParams {
  /** Number of mockups to return (1-100, default: 20) */
  limit?: number
  /** Number of mockups to skip (default: 0) */
  offset?: number
  /** Filter by name (case-insensitive contains) */
  name?: string
  /** Filter by creation date (ISO 8601) */
  createdAfter?: string
  /** Filter by creation date (ISO 8601) */
  createdBefore?: string
  /** Field to sort by */
  sort?: 'name' | 'created_at' | 'updated_at'
  /** Sort order */
  order?: 'asc' | 'desc'
}

// ---------------------------------------------------------------------------
// Shared Primitives
// ---------------------------------------------------------------------------

export interface Size {
  width: number
  height: number
}

export interface Position {
  x: number
  y: number
  width: number
  height: number
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

export interface ThumbnailSize {
  width: number
  url: string
}

// ---------------------------------------------------------------------------
// Print Area Preset
// ---------------------------------------------------------------------------

export interface PrintAreaPreset {
  uuid: string
  name: string
  thumbnails: ThumbnailSize[]
  size: Size
  position: Position
}

// ---------------------------------------------------------------------------
// Smart Object
// ---------------------------------------------------------------------------

export interface SmartObject {
  uuid: string
  name: string
  size: Size
  position: Position
  printAreaPresets: PrintAreaPreset[]
  layerName?: string | null
  /** Distorted quad corners (Scale tier only; `null` otherwise). */
  quad?: number[][] | null
  /** Layer blend mode (optional on the BE; may be absent). */
  blendMode?: string
  /** Number of instances of this smart object in the PSD, when present. */
  instanceCount?: number | null
}

// ---------------------------------------------------------------------------
// Mockup
// ---------------------------------------------------------------------------

export interface Mockup {
  uuid: string
  name: string
  thumbnail: string
  width: number | null
  height: number | null
  smartObjects: SmartObject[]
  textLayers: unknown[]
  collections: unknown[]
  thumbnails: ThumbnailSize[]
}

// ---------------------------------------------------------------------------
// Mockup List
// ---------------------------------------------------------------------------

export interface MockupListResult {
  mockups: Mockup[]
  total: number
  limit: number
  offset: number
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** Image format (default: 'webp'; 'jpeg' is normalized to 'jpg') */
  imageFormat?: 'png' | 'jpg' | 'webp'
  /** Max width in pixels, 100-10000 (default: 2048) */
  imageSize?: number
  /** Compression quality 1-100 (default: 90) */
  quality?: number
  /**
   * Print resolution tag embedded in the output file metadata (range 72-2400).
   *
   * This is a metadata-only tag and does NOT change the pixel dimensions of
   * the image -- `imageSize` controls the actual pixels. For a true print
   * file, size your pixels: `imageSize = print_inches * dpi`
   * (e.g. 12 in * 300 = 3600 px).
   *
   * The tag is written for all formats: JPEG (Exif XResolution/YResolution),
   * PNG (pHYs chunk), WebP (Exif XResolution/YResolution). For maximum
   * print-tool compatibility prefer `jpg` or `png`, whose resolution lives in
   * the universally read density fields.
   *
   * Default: none (opt-in).
   */
  dpi?: number
}

export interface AssetSize {
  width: number
  height: number
}

/**
 * Custom position override for a render asset.
 *
 * A top-left offset in pixels on the smart-object canvas. Use `size` (width /
 * height) for dimensions -- width/height set here is ignored.
 */
export interface AssetPosition {
  /** Top offset in pixels (Y axis). */
  top?: number
  /** Left offset in pixels (X axis). */
  left?: number
}

export interface SmartObjectAsset {
  /** URL of the artwork image */
  url?: string
  /** Base64-encoded artwork image (takes priority over `url`) */
  base64?: string
  /** Override the asset MIME type (e.g. 'image/png', 'image/jpeg', 'image/webp', 'image/gif') */
  contentType?: string
  /** Fit mode */
  fit?: 'fill' | 'contain' | 'cover'
  /** Rotation angle in degrees */
  rotate?: number
  /** Flip horizontally */
  flipHorizontal?: boolean
  /** Flip vertically */
  flipVertical?: boolean
  /** Custom size for the artwork */
  size?: AssetSize
  /** Custom position for the artwork */
  position?: AssetPosition
}

export interface SmartObjectColor {
  /** Hex color code (e.g. '#ff0000') */
  hex: string
  /** Blending mode (e.g. 'multiply', 'overlay') */
  blendingMode?: string
}

export interface AdjustmentLayers {
  /** Brightness adjustment (-150 to 150, default 0). */
  brightness?: number
  /** Contrast adjustment (-100 to 100, default 0). */
  contrast?: number
  /** Layer opacity (0 to 100, default 100). */
  opacity?: number
  /** Saturation adjustment (-100 to 100, default 0). */
  saturation?: number
  /** Vibrance adjustment (-100 to 100, default 0). */
  vibrance?: number
  /** Gaussian blur (0 to 100, default 0). */
  blur?: number
}

export interface RenderSmartObjectInput {
  /** Smart object UUID */
  uuid: string
  /** Artwork asset */
  asset?: SmartObjectAsset
  /** Color overlay */
  color?: SmartObjectColor
  /** Adjustment layers */
  adjustmentLayers?: AdjustmentLayers
}

export interface CreateRenderParams {
  /** Mockup UUID to render */
  mockupId: string
  /** Smart objects with assets */
  smartObjects: RenderSmartObjectInput[]
  /** Export options */
  exportOptions?: ExportOptions
  /** Optional label for the export file */
  exportLabel?: string
  /**
   * Submit the render asynchronously.
   *
   * When `true`, the API enqueues the render and immediately returns a
   * {@link Job} (HTTP 202) instead of blocking until the render completes.
   * Poll the job with `client.jobs.retrieve(job.jobId)` or use
   * `client.jobs.waitForJob(job.jobId)` to await the result.
   *
   * Default: `false` (synchronous, returns a {@link RenderResult}).
   */
  isAsync?: boolean
}

export interface PrintFile {
  exportPath: string
  smartObjectUuid: string
  /**
   * Render UUID for this output. Present on the sync render response. Use it to
   * correlate a render with webhook / jobs records.
   */
  renderUuid?: string
}

export interface RenderResult {
  printFiles: PrintFile[]
  /**
   * Render UUID, present on the sync render response. This is the render's
   * transaction id (NOT an async-job poll path) -- use it to correlate this
   * render with webhook deliveries and transaction records. The async job poll
   * is `GET /jobs/{jobId}`, keyed by {@link Job.jobId}.
   */
  renderUuid?: string
  /** Convenience accessor: URL of the first rendered file */
  url: string
}

// ---------------------------------------------------------------------------
// SudoAI 2D Mockups (client.ai)
// ---------------------------------------------------------------------------

/** Image adjustments applied to a 2D-mockup print area. */
export interface AIAdjustments {
  /** Brightness adjustment. */
  brightness?: number
  /** Contrast adjustment. */
  contrast?: number
  /** Layer opacity (0-100). */
  opacity?: number
  /** Saturation adjustment. */
  saturation?: number
  /** Vibrance adjustment. */
  vibrance?: number
  /** Gaussian blur. */
  blur?: number
  /** Blend mode for the overlay. */
  blendMode?: string
  /** Warp strength for perspective fitting. */
  warpStrength?: number
  /** Expand the print area edges. */
  edgeExpand?: number
  /** Texture preservation strength. */
  textureStrength?: number
}

/**
 * Pixel offset of the artwork from its calculated position in a 2D print area.
 *
 * Sent as the API's `offset_x` / `offset_y` fields (`offset_x = left`,
 * `offset_y = top`). Sending `{ x, y }` here would be dropped, leaving the
 * offset at 0.
 */
export interface AIPlacementOffset {
  /** Vertical offset in pixels (Y axis) -> backend `offset_y`. */
  top?: number
  /** Horizontal offset in pixels (X axis) -> backend `offset_x`. */
  left?: number
}

/** Placement of the artwork within a print area. */
export interface AIPlacement {
  position?: string
  coverage?: number
  fit?: string
  /**
   * Scale multiplier applied to the artwork (0.01-10). OVERRIDES `coverage` +
   * `fit` sizing. Prefer this over the deprecated `size` field.
   */
  scale?: number
  /**
   * Rotation in degrees, clockwise positive (-360 to 360). Prefer this over the
   * deprecated `rotate` field.
   */
  rotation?: number
  /** @deprecated Use {@link AIPlacement.rotation}. Legacy rotation in degrees. */
  rotate?: number
  /** @deprecated Use {@link AIPlacement.scale}. Legacy explicit size in pixels. */
  size?: AssetSize
  offset?: AIPlacementOffset
}

/** A single print area to render artwork (or a color) into. */
export interface AIPrintArea {
  /** Print-area UUID. */
  uuid: string
  /** URL of the artwork to place. Supply `artworkUrl` OR `color`. */
  artworkUrl?: string
  /** Hex color overlay (e.g. '#ff0000'). Supply `artworkUrl` OR `color`. */
  color?: string
  /** Image adjustments for this print area. */
  adjustments?: AIAdjustments
  /** Artwork placement options. */
  placement?: AIPlacement
}

export interface AIRenderParams {
  /** UUID of the existing 2D mockup to render artwork onto. */
  mockupId: string
  /** Print areas to render (at least one). */
  printAreas: AIPrintArea[]
  /** Export options. */
  exportOptions?: ExportOptions
}

export interface AIPrintFile {
  /** URL of the rendered output. */
  exportPath: string
  /** Render duration in milliseconds. */
  durationMs: number
  /** Output image format. */
  exportFormat: string
}

export interface AIRenderResult {
  printFiles: AIPrintFile[]
  /** Convenience accessor: URL of the first rendered file */
  url: string
}

/** Parameters for creating a reusable 2D mockup from exactly one image source. */
export type Create2DMockupParams = {
  /** Optional display name. */
  name?: string
  /** Optional key for safely retrying the same create request. */
  idempotencyKey?: string
} & (
  | { sourceUrl: string; sourceBase64?: never }
  | { sourceUrl?: never; sourceBase64: string }
)

/** Accepted 2D-mockup creation job. */
export interface Create2DMockupResult {
  jobId: string
  kind: '2d_create'
  status: 'queued'
  statusUrl: string
}

/** Options for `client.ai.waitForReady()`. */
export interface WaitFor2DMockupOptions {
  /** Milliseconds between polls (default: 2000). */
  intervalMs?: number
  /** Maximum wait before a {@link TimeoutError} is thrown (default: 180000). */
  timeoutMs?: number
}

/** One 2D image coordinate. */
export type TwoDPoint = readonly [number, number]

/** Four corners ordered top-left, top-right, bottom-right, bottom-left. */
export type TwoDQuadPoints = readonly [
  TwoDPoint,
  TwoDPoint,
  TwoDPoint,
  TwoDPoint,
]

/** A single distorted-quad print area on a 2D mockup. */
export interface TwoDMockupQuad {
  printAreaId: string
  points: number[][]
  sortOrder: number
}

/** Replacement geometry for one 2D print area. */
export interface TwoDPrintAreaInput {
  points: TwoDQuadPoints
}

/** Updated geometry returned by `client.ai.updatePrintAreas()`. */
export interface Update2DPrintAreasResult {
  mockupId: string
  printAreas: TwoDMockupQuad[]
}

/** A 2D mockup as returned by `client.ai.get()` / `client.ai.list()`. */
export interface TwoDMockup {
  mockupId: string
  name: string
  status: string
  thumbnailUrl: string | null
  watermarkedSourceUrl: string | null
  sourceWidth: number | null
  sourceHeight: number | null
  /** Quads (present on the single-get response). */
  quads?: TwoDMockupQuad[]
  /** Print areas (present on the list response). */
  printAreas?: TwoDMockupQuad[]
  version: number
  createdAt: string
  updatedAt: string
}

/** Full 2D mockup returned by `client.ai.get()` and `waitForReady()`. */
export interface TwoDMockupDetails extends TwoDMockup {
  quads: TwoDMockupQuad[]
}

/** Pagination params for `client.ai.list()`. */
export interface List2dMockupsParams {
  /** Number of mockups to return (1-100, default: 20). */
  limit?: number
  /** Number of mockups to skip (default: 0). */
  offset?: number
}

/**
 * An offset-paginated page of 2D mockups (`client.ai.list()`).
 *
 * The backend returns the pagination metadata (`total` / `limit` / `offset`)
 * as siblings of the `data` array; this surfaces it so callers can drive
 * "load more" without guessing whether another page exists.
 */
export interface TwoDMockupListResult {
  /** The page of 2D mockups (newest first). */
  mockups: TwoDMockup[]
  /** Total number of 2D mockups matching the query (across all pages). */
  total: number
  /** Page size that was applied. */
  limit: number
  /** Offset that was applied. */
  offset: number
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadParams {
  /** URL of the PSD file to upload */
  psdFileUrl: string
  /** Optional name for the mockup */
  psdName?: string
  /**
   * Process the PSD asynchronously.
   *
   * When `true`, the API enqueues processing and immediately returns a
   * {@link Job} (HTTP 202). PSD upload is FREE (0 credits) either way. Poll the
   * job with `client.jobs.retrieve(job.jobId)` / `waitForJob`.
   *
   * Default: `false` (synchronous, returns an {@link UploadResult}).
   */
  isAsync?: boolean
}

export interface UploadResult {
  uuid: string
  name: string
  thumbnail: string
  width: number | null
  height: number | null
  smartObjects: SmartObject[]
  textLayers: unknown[]
  collections: unknown[]
  thumbnails: ThumbnailSize[]
}

// ---------------------------------------------------------------------------
// Jobs (async renders / videos / uploads / 2D creation)
// ---------------------------------------------------------------------------

/** The kind of work a job performs. */
export type JobKind = 'render' | 'video' | 'upload' | '2d_create'

/**
 * Terminal and in-flight statuses for an async job (the API field is `status`).
 *
 * - `queued`    -- accepted, waiting for a worker
 * - `running`   -- a worker is processing the job
 * - `succeeded` -- finished; `resultUrl` is populated (terminal)
 * - `failed`: finished with failure details (terminal)
 */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/**
 * Pay-as-you-go cost breakdown for a job. Present (non-null) ONLY for PAYG
 * jobs; `null` for credit/subscription jobs. Mirrors the nested `payg` object
 * from `GET /jobs/{jobId}`.
 */
export interface JobPayg {
  /** Billable credit count for the PAYG job. */
  credits?: number | null
  /** Per-credit price in USD. */
  unitPrice?: number | null
  /** Total USD cost (`credits * unitPrice`), or `null` if either is missing. */
  cost?: number | null
}

/**
 * An async job returned by render, upload, 2D creation, and job endpoints.
 */
export interface Job {
  /** Stable identifier for the job; also the poll key. */
  jobId: string
  /** What the job produces. */
  kind: JobKind
  /** Current lifecycle status (API field: `status`). */
  status: JobStatus
  /**
   * Relative poll URL, e.g. `/api/v1/jobs/{jobId}`. Present only on the
   * 202 submit response, not on the `GET /jobs` poll.
   */
  statusUrl?: string
  /** Model used (e.g. for video renders). */
  model?: string | null
  /** Output URL once `status === 'succeeded'`. */
  resultUrl?: string | null
  /** UUID produced by an upload or 2D-creation job. */
  mockupUuid?: string | null
  /** Failure message when `status === 'failed'`. */
  error?: string | null
  /** Stable failure code when `status === 'failed'`. */
  errorCode?: string | null
  /**
   * Real charge for the job. For credit/subscription jobs this is the deducted
   * credit count; for PAYG it is the billable credit count.
   * The dollar amount lives in {@link payg}.
   */
  creditsCharged?: number | null
  /** Pay-as-you-go cost breakdown, present only for PAYG jobs (else `null`). */
  payg?: JobPayg | null
  /** ISO 8601 creation timestamp (poll response). */
  createdAt?: string
  /** ISO 8601 last-update timestamp (poll response). */
  updatedAt?: string
  /**
   * Cost-based credit quote echoed on the 202 submit response (video). Not
   * present on the `GET /jobs` poll.
   */
  estimatedCredits?: number | null
  /**
   * UX-facing quality label for the auto-routed video model (e.g. `'standard'`,
   * `'premium'`), echoed on the video 202 submit response alongside the real
   * `model` id. Not present on the `GET /jobs` poll.
   */
  outcomeTier?: string | null
  /**
   * Clip duration in seconds. Echoed on the video 202 submit response and
   * surfaced as a list display field on `jobs.list()` items (null for
   * non-video kinds).
   */
  durationSeconds?: number | null
  /**
   * Whether audio was generated. Echoed on the video 202 submit response and
   * surfaced as a list display field on `jobs.list()` items (null for
   * non-video kinds).
   */
  audio?: boolean | null
  /**
   * Source mockup's display name. List-only display field on `jobs.list()`
   * items; `null` when unavailable (e.g. raw-image video, upload).
   */
  mockupName?: string | null
  /**
   * URL of the video poster image. List-only display field on
   * `jobs.list()` items; `null` until produced / for non-video kinds.
   */
  posterUrl?: string | null
}

/** Options for {@link JobsResource.waitForJob}. */
export interface WaitForJobOptions {
  /** Milliseconds between poll attempts (default: 2000). */
  intervalMs?: number
  /** Maximum time to wait before throwing a {@link TimeoutError} (default: 300000). */
  timeoutMs?: number
}

/** Filters for {@link JobsResource.list} (`GET /jobs`). */
export interface ListJobsParams {
  /** Only return jobs of this kind. */
  kind?: JobKind
  /** Only return jobs sourced from this mockup (raw-image videos excluded). */
  mockupUuid?: string
  /** Page size (1-50, default: 20). */
  limit?: number
  /** Opaque keyset cursor from a previous {@link JobListResult.nextCursor}. */
  cursor?: string
}

/** A keyset page of async jobs, newest first (`GET /jobs`). */
export interface JobListResult {
  jobs: Job[]
  /** Cursor for the next page, or `null` when there are no more results. */
  nextCursor?: string | null
}

// ---------------------------------------------------------------------------
// Video render
// ---------------------------------------------------------------------------

/** Video-specific options for {@link CreateVideoParams}. */
export interface VideoOptions {
  /**
   * Clip duration in seconds (default: 5). Must be one of the durations the
   * chosen model allows -- an unsupported value is rejected by the API with a
   * 400.
   */
  durationSeconds?: number
  /** Include generated audio (default: false). */
  audio?: boolean
  /**
   * Camera motion style (default: `'ambient'`).
   *
   * - `ambient`  -- subtle, looping idle motion
   * - `showcase` -- more pronounced product-showcase movement
   */
  motion?: 'ambient' | 'showcase'
  /**
   * Force a specific model by id (overrides the auto-router). When omitted the
   * API auto-selects the model for your tier. An unknown/eliminated model id is
   * rejected with a 400.
   */
  advancedModel?: string
}

export interface CreateVideoParams {
  /**
   * Mockup UUID to animate.
   *
   * - **Render mode:** required -- the video is generated from this mockup +
   *   `smartObjects`.
   * - **Raw-image mode:** optional -- pure association when animating an
   *   `imageUrl` directly.
   */
  mockupId?: string
  /** Smart objects with assets (render mode; same shape as a still render). */
  smartObjects?: RenderSmartObjectInput[]
  /** Export options for the render-mode input still. */
  exportOptions?: ExportOptions
  /**
   * Raw-image mode: a public HTTPS image URL to animate directly (mutually
   * exclusive with the render-mode `mockupId` + `smartObjects` inputs).
   */
  imageUrl?: string
  /** Video generation options. */
  video: VideoOptions
  /**
   * Per-call webhook override, e.g. `{ url: 'https://example.com/hooks' }`.
   * Delivered when the video job completes.
   */
  webhook?: VideoWebhookOverride
  /** Optional label for the output file. */
  exportLabel?: string
}

/**
 * Per-call completion webhook override for {@link CreateVideoParams.webhook}.
 *
 * The webhook is an arbitrary object; `url` is the meaningful field, but
 * additional keys are forwarded as-is.
 */
export interface VideoWebhookOverride {
  /** Destination URL the completion delivery is POSTed to. */
  url: string
  /** Any additional fields the backend accepts (forwarded verbatim). */
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Webhook endpoints
// ---------------------------------------------------------------------------

/** Event types a webhook endpoint can subscribe to. */
export type WebhookEvent =
  | 'render.succeeded'
  | 'render.failed'
  | 'upload.succeeded'
  | 'video.succeeded'
  | 'video.failed'
  | 'webhook.test'
  | (string & {})

export interface WebhookEndpoint {
  /** Endpoint identifier (API field: `id`). */
  id: string
  /** Destination URL deliveries are POSTed to. */
  url: string
  /**
   * Signing secret. Returned in full ONLY on create and rotate-secret;
   * otherwise masked (`whsec_****<last4>`).
   */
  secret?: string
  /** Optional human-readable description. */
  description?: string | null
  /** Subscribed event types (empty array = subscribe to all events). */
  eventTypes: WebhookEvent[]
  /** Whether the endpoint is currently active. */
  enabled: boolean
  createdAt?: string
  updatedAt?: string | null
}

export interface CreateWebhookEndpointParams {
  /** Destination URL (must be HTTPS). */
  url: string
  /**
   * Event types to subscribe to. Omit or pass `[]` to subscribe to ALL events
   * (the backend treats an empty list as a wildcard). Default: `[]`.
   */
  eventTypes?: WebhookEvent[]
  /** Optional description. */
  description?: string
}

export interface UpdateWebhookEndpointParams {
  url?: string
  eventTypes?: WebhookEvent[]
  description?: string
  enabled?: boolean
}

/** A single delivery-attempt log row. */
export interface WebhookDelivery {
  /** Delivery row identifier (API field: `id`). */
  id: string
  /** Endpoint this delivery belongs to. */
  endpointId?: string
  /** Job id this delivery relates to (the idempotency anchor). */
  jobId?: string
  /** Event type that was delivered (API field: `event_type`). */
  eventType: WebhookEvent
  /** Delivery status: `pending` | `delivered` | `failed` | `dead`. */
  status: string
  /** HTTP status code returned by the destination, if the attempt completed. */
  httpStatus?: number | null
  /** Retry attempt counter (0 on first try). */
  attempt: number
  /** Last error message when the attempt failed. */
  lastError?: string | null
  createdAt?: string
  updatedAt?: string | null
}

export interface VerifyWebhookOptions {
  /**
   * Maximum allowed difference (seconds) between the signature timestamp and
   * now, to reject replayed payloads (default: 300).
   */
  toleranceSeconds?: number
}

/** Filters for {@link WebhooksResource.listDeliveries}. */
export interface ListDeliveriesParams {
  /** Filter by delivery status (e.g. 'pending' | 'delivered' | 'failed' | 'dead'). */
  status?: string
  /** Filter by event type. */
  eventType?: WebhookEvent
  /** Max rows (1-200, default: 50). */
  limit?: number
}

/** Filters for {@link WebhooksResource.listEvents} (cross-endpoint feed). */
export interface ListWebhookEventsParams {
  /** Filter by delivery status. */
  status?: string
  /** Filter by event type. */
  eventType?: WebhookEvent
  /** Max rows (1-200, default: 100). */
  limit?: number
}

/** Result of {@link WebhooksResource.replayFailed}. */
export interface ReplayFailedResult {
  /** Enqueue status (e.g. 'enqueued'). */
  status: string
  /** Number of failed/dead deliveries re-enqueued. */
  count: number
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface AccountInfo {
  uuid: string
  email: string
  name: string | null
  createdAt: string
}

export interface SubscriptionInfo {
  /** Plan slug. */
  plan: string
  /** Plan tier. */
  tier: string
  /** Subscription status. */
  status: string
  /** Current billing-period end (ISO 8601); absent for free/no subscription. */
  currentPeriodEnd?: string
  cancelAtPeriodEnd: boolean
  /** Billing channel the subscription is managed through. */
  billingChannel?: 'shopify' | 'stripe' | 'none' | (string & {})
}

export interface UsageInfo {
  creditsUsedThisMonth: number
  creditsLimit: number
  creditsRemaining: number
  billingPeriodStart: string
  billingPeriodEnd: string
}

export interface ApiKeyInfo {
  name: string
  createdAt: string
  lastUsedAt: string | null
  totalRequests: number
}

export interface AccountResult {
  account: AccountInfo
  subscription: SubscriptionInfo
  usage: UsageInfo
  apiKey: ApiKeyInfo
}

// ---------------------------------------------------------------------------
// Studio
// ---------------------------------------------------------------------------

export interface CreateSessionParams {
  /** Mockup UUID to lock the session to */
  mockupUuid: string
  /** Optional product ID from the platform */
  productId?: string
  /** Optional shop domain */
  shop?: string
}

export interface SessionResult {
  session: string
  expiresIn: number
  displayMode: 'iframe' | 'popup' | 'page'
}

// ---------------------------------------------------------------------------
// API Envelope (internal)
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// ---------------------------------------------------------------------------
// Error Response (internal)
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  detail?: string
  error_code?: string
  message?: string
}
