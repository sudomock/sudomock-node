# Changelog

All notable changes to the SudoMock Node.js SDK are documented here. This
project adheres to [Semantic Versioning](https://semver.org/).

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
