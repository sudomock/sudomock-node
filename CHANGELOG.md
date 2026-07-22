# Changelog

All notable changes to the SudoMock Node.js SDK are documented here. This
project adheres to [Semantic Versioning](https://semver.org/).

## [2.2.1] - 2026-07-23

### Added

- 2D render print areas now accept a `base64` artwork field, matching the PSD render path. Supply `base64`, `artworkUrl`, or `color` per area.

## [2.2.0] - 2026-07-23

### Added

- PSD text personalization through `renders.create({ textLayers })`, including
  single-style text, styled segments, font, size, color, outline color, and fit
  controls. `smartObjects` is optional for text-only renders.
- Typed text-layer metadata on mockup/upload responses and font details on
  render responses.
- Successful response warnings and backend error codes are now surfaced.

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
  exportFormat }], url }`. The previous `sourceUrl` / `artworkUrl` segmentation
  flow (with `confidence` / `segmentIndex`) has been removed.
- **BREAKING — render `AdjustmentLayers`** dropped the non-existent `hue` field;
  added `opacity`, `vibrance`, `blur`.
- `ExportOptions` documented defaults corrected to BE truth: `imageFormat=webp`,
  `imageSize=2048`, `quality=90`.
- Minimum supported runtime is now Node.js 20+ (build target `node20`).
- `User-Agent` reports the real SDK version.

## [1.1.0]

- Added the `dpi` export option (print-resolution metadata).
