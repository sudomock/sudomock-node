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
  quad?: number[][] | null
  blendMode: string
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
  /** Image format (default: 'png') */
  imageFormat?: 'png' | 'jpg' | 'webp'
  /** Max width in pixels (default: 1920) */
  imageSize?: number
  /** Compression quality 1-100 (default: 95) */
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

export interface AssetPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface SmartObjectAsset {
  /** URL of the artwork image */
  url?: string
  /** Base64-encoded artwork image */
  base64?: string
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
  brightness?: number
  contrast?: number
  saturation?: number
  hue?: number
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
   * Poll the job with `client.jobs.retrieve(job.renderUuid)` or use
   * `client.jobs.waitForJob(job.renderUuid)` to await the result.
   *
   * Default: `false` (synchronous, returns a {@link RenderResult}).
   */
  isAsync?: boolean
}

export interface PrintFile {
  exportPath: string
  smartObjectUuid: string
}

export interface RenderResult {
  printFiles: PrintFile[]
  /** Convenience accessor: URL of the first rendered file */
  url: string
}

// ---------------------------------------------------------------------------
// AI Render
// ---------------------------------------------------------------------------

export interface AIAdjustments {
  brightness?: number
  contrast?: number
  opacity?: number
  saturation?: number
  vibrance?: number
  blur?: number
  blendMode?: string
  warpStrength?: number
  edgeExpand?: number
  textureStrength?: number
}

export interface AIPlacementOffset {
  x: number
  y: number
}

export interface AIPlacement {
  position?: string
  coverage?: number
  fit?: string
  rotate?: number
  size?: AssetSize
  offset?: AIPlacementOffset
}

export interface AIRenderParams {
  /** URL of the source product image */
  sourceUrl: string
  /** URL of the artwork to place on the product */
  artworkUrl?: string
  /** Product type hint for better detection */
  productType?: string
  /** Segment index (from previous segmentation) */
  segmentIndex?: number
  /** Manual print area X coordinate */
  printAreaX?: number
  /** Manual print area Y coordinate */
  printAreaY?: number
  /** Color overlay */
  color?: string
  /** Image adjustments */
  adjustments?: AIAdjustments
  /** Artwork placement options */
  placement?: AIPlacement
  /** Export options */
  exportOptions?: ExportOptions
}

export interface AIPrintFile {
  exportPath: string
  durationMs: number
  segmentIndex: number
  confidence: number
  exportFormat: string
}

export interface AIRenderResult {
  printFiles: AIPrintFile[]
  /** Convenience accessor: URL of the first rendered file */
  url: string
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
   * job with `client.jobs.retrieve(job.renderUuid)` / `waitForJob`.
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
// Jobs (async renders / videos)
// ---------------------------------------------------------------------------

/** The kind of work a job performs. */
export type JobKind = 'render' | 'video' | 'upload'

/**
 * Terminal and in-flight statuses for an async job (the API field is `status`).
 *
 * - `queued`    -- accepted, waiting for a worker
 * - `running`   -- a worker is processing the job
 * - `succeeded` -- finished; `resultUrl` is populated (terminal)
 * - `failed`    -- finished with an error; `error` is populated (terminal)
 */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/** @deprecated Use {@link JobStatus}. Kept for backward compatibility. */
export type JobState = JobStatus

/**
 * Pay-as-you-go cost breakdown for a job. Present (non-null) ONLY for PAYG
 * jobs; `null` for credit/subscription jobs. Mirrors the nested `payg` object
 * from `GET /jobs/{renderUuid}`.
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
 * An async job, returned by `POST /renders` (`isAsync`), `POST /renders/video`,
 * `POST /psd/upload` (`isAsync`), and `GET /jobs/{renderUuid}`.
 */
export interface Job {
  /** Stable identifier for the job; also the poll key. */
  renderUuid: string
  /** What the job produces. */
  kind: JobKind
  /** Current lifecycle status (API field: `status`). */
  status: JobStatus
  /**
   * Relative poll URL, e.g. `/api/v1/jobs/{renderUuid}`. Present only on the
   * 202 submit response, not on the `GET /jobs` poll.
   */
  statusUrl?: string
  /** Model used (e.g. for video renders). */
  model?: string | null
  /** Output URL once `status === 'succeeded'`. */
  resultUrl?: string | null
  /** UUID of the mockup produced/affected (set for `kind === 'upload'`). */
  mockupUuid?: string | null
  /** Error message when `status === 'failed'`. */
  error?: string | null
  /**
   * Real charge for the job. For credit/subscription jobs this is the deducted
   * credit count; for PAYG it is the billable credit count (NOT the stored 0).
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
  /** Clip duration in seconds, echoed on the video 202 submit response. */
  durationSeconds?: number | null
  /** Whether audio was generated, echoed on the video 202 submit response. */
  audio?: boolean | null
}

/** Options for {@link JobsResource.waitForJob}. */
export interface WaitForJobOptions {
  /** Milliseconds between poll attempts (default: 2000). */
  intervalMs?: number
  /** Maximum time to wait before throwing a {@link TimeoutError} (default: 300000). */
  timeoutMs?: number
}

// ---------------------------------------------------------------------------
// Video render
// ---------------------------------------------------------------------------

/** Video-specific options for {@link CreateVideoParams}. */
export interface VideoOptions {
  /**
   * Clip duration in seconds. Must be one of the durations the chosen model
   * allows -- an unsupported value is rejected by the API with a 400.
   */
  durationSeconds: number
  /** Include generated audio (default: false). */
  audio?: boolean
  /**
   * Force a specific model by id (overrides the auto-router). When omitted the
   * API auto-selects the model for your tier. An unknown/eliminated model id is
   * rejected with a 400.
   */
  advancedModel?: string
}

export interface CreateVideoParams {
  /** Mockup UUID to animate. */
  mockupId: string
  /** Smart objects with assets (same shape as a still render). */
  smartObjects?: RenderSmartObjectInput[]
  /** Video generation options. */
  video: VideoOptions
  /** Optional label for the output file. */
  exportLabel?: string
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
  /** Event types to subscribe to (empty = all events). */
  eventTypes: WebhookEvent[]
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
  /** Job UUID this delivery relates to (the idempotency anchor). */
  jobUuid?: string
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
  plan: string
  tier: string
  status: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
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
