// Compile-time contract for the photo-mockup names (checked by `npm run lint`
// through tsconfig.typecheck.json, never executed).
//
// `WebhookEvent` carries a `(string & {})` escape hatch so unknown event names
// still type-check; the named members are pinned here by stripping that hatch
// (`string extends T` holds for the hatch and for no literal member).
import type {
  Create2DMockupResult,
  JobKind,
  ListJobsParams,
  WebhookEvent,
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
