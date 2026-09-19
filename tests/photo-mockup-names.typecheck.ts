// Compile-time contract for the photo-mockup names (checked by `npm run lint`
// through tsconfig.typecheck.json, never executed).
//
// `WebhookEvent` carries a `(string & {})` escape hatch so unknown event names
// still type-check; the named members are pinned here by stripping that hatch
// (`string extends T` holds for the hatch and for no literal member).
import type {
  Create2DMockupResult,
  CreateWebhookEndpointParams,
  JobKind,
  ListJobsParams,
  UpdateWebhookEndpointParams,
  WebhookEndpoint,
  WebhookEvent,
  WebhookEventNaming,
} from '../src/index'

type StripEscapeHatch<T> = T extends unknown
  ? string extends T
    ? never
    : T
  : never
type NamedWebhookEvent = StripEscapeHatch<WebhookEvent>

// Job kinds: the family names next to the legacy spellings.
export const photoMockupCreateKind: JobKind = 'photo_mockup_create'
export const photoMockupRenderKind: JobKind = 'photo_mockup_render'
export const legacyCreateKind: JobKind = '2d_create'
export const legacyRenderKind: JobKind = '2d_render'
export const listPhotoMockupRenders: ListJobsParams = { kind: 'photo_mockup_render' }

// The 202 body of an async create names the job by either spelling.
export const acceptedCurrent: Create2DMockupResult = {
  jobId: '11111111-1111-4111-8111-111111111111',
  kind: 'photo_mockup_create',
  status: 'queued',
  statusUrl: '/api/v1/jobs/11111111-1111-4111-8111-111111111111',
}
export const acceptedLegacy: Create2DMockupResult = {
  jobId: '11111111-1111-4111-8111-111111111111',
  kind: '2d_create',
  status: 'queued',
  statusUrl: '/api/v1/jobs/11111111-1111-4111-8111-111111111111',
}

// Webhook events: the five current names and the five legacy names are both
// members of the union, not merely tolerated strings.
export const currentEvents: NamedWebhookEvent[] = [
  'photo_mockup.ready',
  'photo_mockup.rejected',
  'photo_mockup.failed',
  'photo_mockup_render.succeeded',
  'photo_mockup_render.failed',
]
export const legacyEvents: NamedWebhookEvent[] = [
  '2d_mockup.ready',
  '2d_mockup.rejected',
  '2d_mockup.failed',
  '2d_render.succeeded',
  '2d_render.failed',
]

// An endpoint pins the spelling it was built against.
export const pinnedCurrent: WebhookEventNaming = 'current'
export const pinnedLegacy: WebhookEventNaming = 'legacy'
export const createPinnedCurrent: CreateWebhookEndpointParams = {
  url: 'https://example.com/hooks/sudomock',
  eventTypes: ['photo_mockup_render.succeeded'],
  eventNaming: 'current',
}
export const createPinnedLegacy: CreateWebhookEndpointParams = {
  url: 'https://example.com/hooks/sudomock',
  eventTypes: ['2d_render.succeeded'],
  eventNaming: 'legacy',
}
export const repin: UpdateWebhookEndpointParams = { eventNaming: 'current' }
export const endpoint: WebhookEndpoint = {
  id: '77777777-7777-7777-7777-777777777777',
  url: 'https://example.com/hooks/sudomock',
  eventTypes: [],
  eventNaming: 'legacy',
  enabled: true,
}

// Family type names: each is the same shape as the name it stands beside, so a
// caller can switch spelling without a cast.
import type {
  AIAdjustments,
  AIPlacement,
  AIPrintArea,
  AIPrintFile,
  AIRenderParams,
  AIRenderResult,
  Create2DMockupParams,
  CreatePhotoMockupParams,
  CreatePhotoMockupResult,
  List2dMockupsParams,
  ListPhotoMockupsParams,
  PhotoMockup,
  PhotoMockupAdjustments,
  PhotoMockupDetails,
  PhotoMockupListResult,
  PhotoMockupPlacement,
  PhotoMockupPrintArea,
  PhotoMockupPrintAreaInput,
  PhotoMockupPrintFile,
  PhotoMockupQuad,
  PhotoMockupRenderParams,
  PhotoMockupRenderResult,
  PhotoMockupSurface,
  TwoDFullSurface,
  TwoDMockup,
  TwoDMockupDetails,
  TwoDMockupListResult,
  TwoDMockupQuad,
  TwoDPrintAreaInput,
  Update2DPrintAreasResult,
  UpdatePhotoMockupPrintAreasResult,
  WaitFor2DMockupOptions,
  WaitForPhotoMockupOptions,
} from '../src/index'

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false

export const familyNamesAreTheSameShapes: [
  Same<PhotoMockup, TwoDMockup>,
  Same<PhotoMockupDetails, TwoDMockupDetails>,
  Same<PhotoMockupQuad, TwoDMockupQuad>,
  Same<PhotoMockupSurface, TwoDFullSurface>,
  Same<PhotoMockupPrintAreaInput, TwoDPrintAreaInput>,
  Same<PhotoMockupListResult, TwoDMockupListResult>,
  Same<ListPhotoMockupsParams, List2dMockupsParams>,
  Same<CreatePhotoMockupParams, Create2DMockupParams>,
  Same<CreatePhotoMockupResult, Create2DMockupResult>,
  Same<WaitForPhotoMockupOptions, WaitFor2DMockupOptions>,
  Same<UpdatePhotoMockupPrintAreasResult, Update2DPrintAreasResult>,
  Same<PhotoMockupRenderParams, AIRenderParams>,
  Same<PhotoMockupRenderResult, AIRenderResult>,
  Same<PhotoMockupPrintArea, AIPrintArea>,
  Same<PhotoMockupPrintFile, AIPrintFile>,
  Same<PhotoMockupAdjustments, AIAdjustments>,
  Same<PhotoMockupPlacement, AIPlacement>,
] = [
  true, true, true, true, true, true, true, true, true, true, true, true, true,
  true, true, true, true,
]
