# Changelog

All notable changes to the SudoMock Node.js SDK are documented here. This
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.17.0] - 2026-11-11

### Changed
- Internal cleanup.
- An error or advisory now carries the text the API sent. A fallback is used
  only when the API sent none, so a message is never empty or of the wrong
  type.

## [2.16.0] - 2026-11-08

### Added
- `client.folders` keeps a large mockup library in a tree. PSD mockups and
  photo mockups share that tree, and every mockup sits in exactly one folder
  or at the top of the library. `list` pages the folders by name and takes
  `parentUuid`, either a folder's uuid or `'root'` for the ones at the top of
  the library; `create` adds one; `get` returns the trail of folders above it
  (`path`) and the `total` counts a recursive delete would remove; `update`
  renames or moves it; `delete` reports what went; `move` moves any mix of
  mockups and folders in one call. The family is served on
  `/api/v1/folders`, and every folder call is free.
- `FolderDetail`, `Folder`, `FolderPathEntry`, `FolderListResult`,
  `ListFoldersParams`, `CreateFolderParams`, `UpdateFolderParams`,
  `DeleteFolderParams`, `DeleteFolderResult`, `MoveToFolderParams` and
  `MoveToFolderResult` are exported.
- `client.psdMockups.list()` and `client.photoMockups.list()` take
  `folderUuid`: a folder's uuid for the mockups directly in it, or `'root'`
  for the ones at the top of the library. A call without it returns every
  mockup, as it did before.
- `Mockup`, `UploadResult` and `PhotoMockup` carry `folderUuid`, which is
  `null` at the top of the library.
- `client.uploads.create()` and `client.photoMockups.create()` take
  `folderUuid`, so a new template lands where it belongs without a second
  call.

### Fixed
- Every id the SDK puts in a request path is url-encoded, so an id that
  carries a `?` stays one path segment instead of adding a query parameter to
  the call. It covers `client.psdMockups`, `client.photoMockups`,
  `client.jobs`, `client.webhooks` and `client.folders`. This is not a
  breaking change: a uuid encodes to itself, so every call written against an
  earlier version produces the same request it did before.

### Changed
- `client.psdMockups.update()` takes `UpdateMockupParams` instead of
  `{ name: string }`: `name` is now optional and `folderUuid` moves the
  mockup. A field left out is left alone, and `folderUuid: null` moves the
  mockup to the top of the library. Moving never changes a mockup's uuid, so
  renders, webhooks and integrations keep working against the uuid they
  already hold. Code that passed `{ name }` is unaffected.

## [2.15.1] - 2026-11-06

### Added
- `Job.changedArea` says how much of the tile a seam fix changed: `part` or
  `whole`.

## [2.15.0] - 2026-11-06

### Added
- A seam fix job's `changes` can read `rearranged`: motifs were moved so none is
  cut.
- `Job.fineDetail` says how fine detail came out of a seam fix: `unchanged` or
  `softer`.

## [2.14.0] - 2026-11-06

### Added
- `images.checkSeams` checks whether copies of a pattern tile meet without a
  visible line when it repeats, and where a line appears. It takes exactly one
  of `url` or `base64` and an optional `cropAspect`, and returns `status`
  (`seamless`, `faint_seam` or `visible_seam`), `seams` with pixel `ranges`
  per side, the checked `width` and `height`, `fixable` with
  `unfixableReason`, and `previousFix`. Seam check: free.
- `images.fixSeams` takes the same fields and returns a job of kind
  `seam_fix`, sent with an `Idempotency-Key` (a fresh one unless
  `idempotencyKey` is given). Seam fix: 60 credits, refunded if the fix fails.
- `Job` carries `alternativeUrl`, `resultStatus`, `changes` and `stage` for a
  seam fix. `JobKind` gains `seam_fix` and `WebhookEvent` gains
  `seam_fix.succeeded` and `seam_fix.failed`.
- `Job.errorDetails.reason` says why a seam fix ended with `TILE_NOT_FIXABLE`:
  `not_a_pattern_tile` when the image is not a repeating pattern tile,
  `no_clean_result` when no fixed version of the tile repeated cleanly.
- `photoMockups.render` returns `warnings`, as `renders.create` does. A render
  that repeats a tile with no gap between copies carries `TILE_SEAM_VISIBLE`
  once a seam check has found a visible seam in that tile.
- New exported types: `CheckSeamsParams`, `FixSeamsParams`,
  `SeamCheckResult`, `SeamSide`, `SeamStatus`, `SeamPreviousFix` and
  `JobErrorDetails`.

## [2.13.1] - 2026-11-03

### Changed
- Background removal is documented at 5 credits per image, on
  `images.removeBackground` and on `removeBackground` for render assets and
  photo mockup print areas (5 credits per unique artwork).

## [2.13.0] - 2026-10-24

### Added
- `tileSpacing` on a smart object asset (`SmartObjectAsset.tileSpacing`: PSD
  renders and the render mode of `renders.createVideo`) and on a photo mockup
  placement (`AIPlacementBase.tileSpacing`) sets the gap between tiles when
  `tile` is true: a percentage of the tile size from 0 to 100, so the
  horizontal gap is that percent of the tile width and the vertical gap that
  percent of the tile height. It is sent as `tile_spacing`, and a value outside
  0 to 100 is refused with 422. A request without it is sent as before.
- `photoMockups.updatePrintAreas` takes an optional `printAreaId` on each area
  (`TwoDPrintAreaReplacement`). An area that carries the id of one of the
  mockup's print areas keeps that id; an area without one gets a new id. An id
  that is not one of the mockup's areas, or the same id on two areas, is
  refused with 422. A call without it is sent as before.

## [2.12.0] - 2026-10-23

### Added
- `tile` on a smart object asset (`SmartObjectAsset.tile`: PSD renders and the
  render mode of `renders.createVideo`) and on a photo mockup placement
  (`AIPlacementBase.tile`) repeats the artwork as a pattern across the whole
  target. On a PSD asset `size` is one tile, `fit` places the artwork inside
  each tile and `position` sets where the grid starts; on a photo mockup the
  sizing answer (`coverage`, `fit`, or `width` and `height`) is one tile. A
  tile without a size is refused with 422. A request without `tile` is sent as
  before.
- A photo mockup's surfaces carry `label`, what was detected there, such as
  `wall` or `pillow`.

## [2.11.0] - 2026-10-06

### Added
- `renders.create` and the render mode of `renders.createVideo` take
  `exportOptions.imageSize: 'original'`: the render comes out at the PSD's own
  size and resolution, with the template's own width and, unless `dpi` is set,
  the resolution the PSD was saved with. Their export options are typed as the
  new `PsdExportOptions`; `ExportOptions` and the photo mockup render keep a
  width in pixels, so existing code compiles as before. A template uploaded
  before this option existed needs to be uploaded again to render at its
  original size. A render that does not set `'original'` sends the same
  request as before.

## [2.10.0] - 2026-10-06

### Added
- `psdMockups.layers(uuid)`: every layer of a PSD mockup, nested the way
  Photoshop's Layers panel shows them and front-most first, each with `uuid`,
  `name`, `kind`, `visible` and `children`. A smart object whose contents hold
  layers you can fill lists those layers as its children. An artboard has
  kind `artboard`, and its own layers are listed right before it at the top
  level. Costs no credits. New types: `MockupLayer`, `MockupLayerKind` and
  `MockupLayersResult`.
- `renders.create` takes `hiddenLayers`: up to 50 layer UUIDs, as
  `psdMockups.layers()` lists them, to leave out of one render. Hiding a group
  hides every layer inside it, a layer clipped to a hidden layer is hidden
  with it, and a layer hidden inside a smart object's contents is hidden in
  every copy of that smart object. It is sent as `hidden_layers` and works on
  its own. A render that does not set it sends the same request as before.

### Fixed
- `images.removeBackground()` documents its `url` as a public PNG URL that
  stays available for 7 days, which is what the API has returned since
  2026-08-13. The type comment, the method comment and the README had called
  it a signed URL.

## [2.9.0] - 2026-10-05

### Added
- `SmartObject.smartObjects` and `SmartObject.textLayers`: the smart objects
  and text layers inside a smart object, returned by `psdMockups.get()`,
  `psdMockups.list()`, `psdMockups.update()` and `uploads.create()`. A nested smart
  object has the same shape as a top level one; its `position` and `quad` are
  in the parent smart object's own pixel space and its `size` is its own. Fill
  a nested slot by its `uuid` in the render request, in the same
  `smartObjects` and `textLayers` arrays. Both fields are absent when a smart
  object holds nothing, so existing results are unchanged.
- A render request that fills a smart object and a slot inside it together is
  rejected with the error code `NESTED_SLOT_CONFLICT`.
- An upload may carry the warning code `PSD_NESTED_CONTENTS_UNAVAILABLE` when
  the contents of a smart object could not be read.

Nothing was removed or renamed.

## [2.8.1] - 2026-09-24

### Changed
- README: the pricing section reads "Subscriptions from $0.002 per render" and
  gives pay as you go at $0.05 per render in one sentence.

## [2.8.0] - 2026-09-22

### Added
- `AccountResult.organization`: the organization the API key belongs to, as
  `{ id, name }`, with the exported `OrganizationInfo` type. The plan, the
  credits and the prepaid balance `account.get()` reports are that
  organization's. The field is optional: check it before reading `id` or `name`.

Nothing was removed or renamed.

## [2.7.1] - 2026-09-19

### Fixed
- `client.ai` and `client.mockups` are pinned to the paths they were published
  on: `/api/v1/sudoai/2d-mockups` and `/api/v1/mockups`. 2.7.0 routed them to
  the family paths, so upgrading the package alone moved a caller's new jobs to
  the `photo_mockup_*` kinds without an error anywhere, and code branching on
  `job.kind === '2d_create'` stopped matching in silence. An async job opened
  through an earlier name again resolves with `2d_create` / `2d_render`, as
  2.6.x documented. `client.photoMockups` and `client.psdMockups` keep the
  family paths and the `photo_mockup_*` kinds; move to them to adopt the new
  names deliberately.
- `client.ai` and `client.mockups` accept assignment. They were getter-only, so
  injecting a test double threw a `TypeError` in an ES module and was dropped
  without a word in plain CommonJS -- where the call then left the test and
  reached the live API. Assigning to either now replaces only that accessor;
  `client.photoMockups` / `client.psdMockups` are untouched.

### Documentation
- The deprecation warning no longer calls an earlier name and its family name
  "the same object". They are two objects, each on the path its own name was
  published on, and the warning now says so -- the earlier wording read as a
  free swap and sent readers into the `2d_*` / `photo_mockup_*` kind change the
  release above is about.
- `WebhookEventNaming` and `CreateWebhookEndpointParams.eventNaming` describe
  the real default. An endpoint you do not pin yourself follows the spelling of
  the `eventTypes` you subscribe in: family names give `current`, the earlier
  `2d_mockup.*` / `2d_render.*` names give `legacy`, and an empty or mixed list
  gives `legacy`. The docs said a new endpoint was always pinned to `current`.
  Behaviour is the API's; nothing in this package changed.

## [2.7.0] - 2026-09-19

### Added
- `client.photoMockups` and `client.psdMockups`, the family names of the two
  mockup resources. `client.photoMockups` is the object `client.ai` was;
  `client.psdMockups` is the object `client.mockups` was.
- Family type names beside the earlier ones: `PhotoMockup`,
  `PhotoMockupDetails`, `PhotoMockupQuad`, `PhotoMockupSurface`,
  `PhotoMockupPrintAreaInput`, `PhotoMockupListResult`,
  `ListPhotoMockupsParams`, `CreatePhotoMockupParams`,
  `CreatePhotoMockupResult`, `WaitForPhotoMockupOptions`,
  `UpdatePhotoMockupPrintAreasResult`, `PhotoMockupRenderParams`,
  `PhotoMockupRenderResult`, `PhotoMockupPrintArea`, `PhotoMockupPrintFile`,
  `PhotoMockupAdjustments` and `PhotoMockupPlacement`. Each is the same shape
  as the name it stands beside; the earlier names stay exported.

### Changed
- Requests travel on the family paths: `client.photoMockups` posts to
  `/api/v1/photo-mockups` (was `/api/v1/sudoai/2d-mockups`) and
  `client.psdMockups` to `/api/v1/psd-mockups` (was `/api/v1/mockups`). The
  API keeps serving the earlier paths, so a project pinned to 2.6.x is not
  affected.
- **Job kinds.** Because requests now travel on the family path, a job
  submitted through this SDK is named by its family: an async
  `photoMockups.create()` resolves with `kind: 'photo_mockup_create'` and an
  async `photoMockups.render()` with `kind: 'photo_mockup_render'`, where 2.6.x
  returned `'2d_create'` / `'2d_render'`. Code that compares `job.kind` against
  a `2d_*` literal must compare against the family name (or both). `JobKind`
  keeps both spellings, `jobs.list({ kind })` with either returns both, and
  webhook event names are untouched: an endpoint keeps the spelling it is
  pinned to (`eventNaming`).

### Deprecated
- `client.ai` and `client.mockups`. Both keep working and return the very same
  objects as `client.photoMockups` / `client.psdMockups`; the first access to
  each emits a one-time `DeprecationWarning` naming the replacement.

Nothing was removed.

## [2.6.0] - 2026-09-18

### Added
- `JobKind` gains `photo_mockup_create` and `photo_mockup_render`, the names a
  photo-mockup job carries when submitted on `/api/v1/photo-mockups`. A job
  submitted through `client.ai` keeps `2d_create` / `2d_render`; both spellings
  are typed, and `jobs.list({ kind })` with either returns both.
  `Create2DMockupResult.kind` admits both spellings.
- `WebhookEvent` gains `photo_mockup.ready`, `photo_mockup.rejected`,
  `photo_mockup.failed`, `photo_mockup_render.succeeded` and
  `photo_mockup_render.failed`. An endpoint receives the spelling it is pinned
  to; an endpoint created before this release keeps the `2d_mockup.*` /
  `2d_render.*` names.
- `WebhookEndpoint.eventNaming` (`'legacy' | 'current'`) reports that pin, and
  `webhooks.create` / `webhooks.update` accept `eventNaming` to choose or
  change it. Omitted on create, the API pins a new endpoint to `'current'`.

## [2.5.1] - 2026-09-18

### Added
- Every request now carries `X-SudoMock-Client: node-sdk/<version>`, and the
  same value as `User-Agent` wherever the runtime lets a script set one. The
  API can tell this SDK's traffic, and its exact version, apart from every
  other client. Browsers reserve `User-Agent` and drop it; the request is still
  identified by `X-SudoMock-Client`.
- `UsageInfo.prepaidBalance` and `UsageInfo.prepaidBalanceCurrency`, the money an
  account holds and spends per render. An account funded this way carries no
  subscription allowance, so its `creditsLimit` and `creditsRemaining` are
  legitimately `0` and reading only those reported a paying customer as
  `0 / 0 credits` with a bar stuck at 0%.

### Fixed
- The version in `User-Agent` had been a hand-copied constant and reported
  `2.3.0` through the 2.4.0 and 2.5.0 releases. It is now read from
  `package.json` at build time, so it cannot lag behind the published version.
- `account.get()` rebuilds its result key by key, which silently dropped any
  field not named in that map. The API had been sending the balance already; the
  SDK discarded it before the caller ever saw it. Both fields are now mapped,
  and coalesced to `0` and `USD` so the declared types hold against a deployment
  that predates them.

Nothing was removed or renamed.

### Changed
- The `User-Agent` prefix is `node-sdk/` (was `sudomock-node/`), matching the
  `X-SudoMock-Client` value byte for byte.

### Changed (BREAKING)
- Placement is typed per target kind, and sizing has exactly one answer per
  request. `AISurfacePlacement` takes a `coverage` percentage OR an explicit
  `width` + `height`; `AIPrintAreaPlacement` takes a `fit` OR an explicit
  `width` + `height`. Anchoring -- `position`, `offsetX`, `offsetY`, `rotation`
  -- belongs to both. Handing a target the other kind's option, naming two
  sizes at once, or sending one axis of a box no longer compiles, where before
  it compiled, travelled, and came back a 422. `AIPlacement` remains as the
  union of the two and is deprecated.
- `surfaces` now holds one entry per printable product in the photo, not only
  the ones covering a whole object. A product can carry both a surface and
  saved print areas, and they are separate render targets.

### Removed (BREAKING)
- `TwoDFullSurface.coverage`. It was always the string `'full'`, so it stated
  nothing a caller could act on while reading exactly like a dial they could
  turn. A response still carrying it is accepted and the field dropped.


## [2.5.0] - 2026-08-04

### Changed (BREAKING)
- 2D placement sizing moved from a single `scale` multiplier to independent
  `width` and `height` in print-area pixels. A one-axis stretch is now a
  supported placement; the aspect ratio is the caller's choice. Send the two
  together -- the API rejects half a size instead of guessing the other axis.

### Removed (BREAKING)
- `placement.scale`. No alias is kept: the API rejects it with 422 rather than
  ignoring it, so a stale integration fails visibly instead of quietly
  rendering the wrong size. For the old behaviour, send
  `width = artwork_width * scale` and `height = artwork_height * scale`.

## [2.4.0] - 2026-07-27

### Added

- Studio result events can be confirmed server-side with
  `client.studio.consumeAction(...)`, which returns the exactly-once action
  receipt.
- 2D full product surfaces are returned in `mockup.surfaces` and can be
  rendered with `surfaceUuid`; saved print areas continue to use `uuid`.
- 2D list/detail results expose `mockup.customizable`; pass
  `customizableOnly: true` to list only shopper-ready mockups.

### Changed

- `client.ai.updatePrintAreas(mockupId, [])` now forwards the empty
  representation. The API accepts it only for verified full product surfaces.
- Studio result and receipt payloads use `renderUuid` as the opaque
  confirmation handle.
- Async job, webhook-delivery, and API error objects now expose only documented
  outcome fields and safe customer messages.
- Render results expose output files, the render UUID, and actionable
  `warnings`.
- Video quality selection is automatic.

### Fixed

- Video renders now default to a supported 4-second duration.

## [2.3.0] - 2026-07-26

### Added

- `client.images.removeBackground({ url })` (or `{ base64 }`) removes the
  background from an image and resolves with a transparent-PNG cutout URL valid
  for 7 days, ready to reuse as render artwork. Costs 25 credits; credits are
  refunded automatically if processing fails.
- `removeBackground` on render assets (`renders.create`) and 2D print areas
  (`ai.render`) cleans the artwork inline during a render. Adds 25 credits per
  unique artwork. Optional and additive; the default (`false`) is unchanged.

## [2.2.1] - 2026-07-23

### Added

- 2D render print areas now accept a `base64` artwork field, matching the PSD render path. Supply `base64`, `artworkUrl`, or `color` per area.

## [2.2.0] - 2026-07-23

### Added

- PSD text personalization through `renders.create({ textLayers })`, including
  single-style text, styled segments, font, size, color, outline color, and fit
  controls. `smartObjects` is optional for text-only renders.
- Typed text-layer metadata on mockup/upload responses.
- Successful response warnings and API error codes are now surfaced.

## [2.1.0] - 2026-07-21

### Added

- **Async 2D renders:** `client.ai.render({ isAsync: true })` enqueues the
  render and resolves with a `Job` of kind `'2d_render'` (HTTP 202) instead of
  blocking. Await it with `client.jobs.waitForJob(job.jobId)` (or poll via
  `client.jobs`); a `2d_render.succeeded` / `2d_render.failed` webhook also
  fires. Omitting `isAsync` (the default) is unchanged: a synchronous
  `AIRenderResult` (HTTP 200). `isAsync` is optional and additive.

## [2.0.0] - 2026-07-21

### Changed

- **BREAKING — `client.ai.create()` is synchronous by default.** It now returns
  the ready `TwoDMockupDetails` (HTTP 201) instead of an accepted job. Pass
  `isAsync: true` to get the old behavior: a `Job` (HTTP 202) you await with
  `client.ai.waitForReady(job)`. `waitForReady` is retained for the async flow.
- **BREAKING — 2D-mockup paths are pluralized** (`2d-mockup` -> `2d-mockups`).
  `render` / `get` / `updatePrintAreas` / `delete` now target
  `/api/v1/sudoai/2d-mockups/...`; the old singular paths are gone.
- **BREAKING — `client.ai.render()` takes the mockup id in the path**
  (`POST /api/v1/sudoai/2d-mockups/{mockupId}/render`). The `mockup_uuid` body
  field has been removed. Render remains synchronous (no `isAsync`).

### Added

- `client.ai.create()` accepts optional seed `printAreas` (4-point quads, each
  with an optional `name`).
- `AIRenderResult.renderUuid` — the render's transaction id, for correlating
  with webhook deliveries.
- `TwoDMockupQuad.name` / `TwoDPrintAreaInput.name` — print areas can carry an
  optional display name (create seed, `updatePrintAreas`, and read responses).

## [1.2.0] - 2026-06-24

### Added

- **Async renders & jobs:** `renders.create({ isAsync: true })` returns a `Job`
  (202); poll with `jobs.retrieve` / `jobs.waitForJob`.
- **`jobs.list()`** — keyset-paginated listing of async jobs (`kind`,
  `mockupUuid`, `limit`, `cursor` filters).
- **Video renders:** `renders.createVideo()` with `video.motion`
  (`ambient` | `showcase`), raw-image mode (`imageUrl`, no mockup), per-call
  `webhook`, and render-mode `exportOptions`.
- **Async PSD upload:** `uploads.create({ isAsync: true })`.
- **Webhook management:** `webhooks` CRUD plus `rotateSecret`, `test`,
  `listDeliveries` (now with `status` / `eventType` / `limit` filters),
  `replayDelivery`, **`replayFailed`** (bulk), and **`listEvents`**
  (cross-endpoint feed). Standalone `verifyWebhookSignature` (split
  `X-SudoMock-Signature` / `X-SudoMock-Timestamp` headers, timestamp tolerance).
- **SudoAI 2D mockups (`client.ai`):** `list` / `get` / `delete` 2D mockups.
  `ai.list()` now returns a paginated `TwoDMockupListResult`
  (`{ mockups, total, limit, offset }`) instead of a bare array, surfacing the
  backend pagination metadata.
- `SmartObjectAsset.contentType`, render `AdjustmentLayers.opacity` / `vibrance`
  / `blur`, sync render `renderUuid`, `SubscriptionInfo.billingChannel`.
- `AIPlacement.scale` / `AIPlacement.rotation` (preferred over the legacy
  `size` / `rotate`); video `Job.outcomeTier`; `jobs.list()` item display
  fields `mockupName` / `posterUrl` (alongside `durationSeconds` / `audio`).
- `createVideo` `video.durationSeconds` is now optional (defaults to 5) and the
  per-call `webhook` accepts an arbitrary object (`VideoWebhookOverride`), not
  just `{ url }`.
- `webhooks.create` `eventTypes` is now optional (defaults to `[]` = all events).

### Changed

- **BREAKING — `client.ai.render()`** now renders artwork onto an existing 2D
  mockup via `POST /sudoai/2d-mockup/render`. It takes `{ mockupId, printAreas,
  exportOptions }` and returns `{ printFiles: [{ exportPath, durationMs,
  exportFormat }], url }`. The previous source/artwork preprocessing fields
  have been removed.
- **BREAKING — render `AdjustmentLayers`** dropped the non-existent `hue` field;
  added `opacity`, `vibrance`, `blur`.
- `ExportOptions` documented defaults corrected to BE truth: `imageFormat=webp`,
  `imageSize=2048`, `quality=90`.
- Minimum supported runtime is now Node.js 20+ (build target `node20`).
- `User-Agent` reports the real SDK version.

## [1.1.0]

- Added the `dpi` export option (print-resolution metadata).
