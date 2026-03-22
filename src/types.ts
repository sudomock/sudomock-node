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
