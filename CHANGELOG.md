# Changelog

All notable changes to the SudoMock Node.js SDK are documented here. This
project adheres to [Semantic Versioning](https://semver.org/).

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
