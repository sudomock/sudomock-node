# SudoMock Node.js SDK

Official Node.js/TypeScript SDK for the [SudoMock API](https://sudomock.com/docs). Generate product mockups from Photoshop PSD files or use AI-powered rendering without any PSD.

## Installation

```bash
npm install sudomock
```

**Requirements:** Node.js 20+ (uses native `fetch`)

## Quick Start

```typescript
import SudoMock from 'sudomock'

const client = new SudoMock('sm_your_api_key')
// or set SUDOMOCK_API_KEY env var and call: new SudoMock()

// List your mockups
const { mockups, total } = await client.mockups.list({ limit: 10 })
console.log(`Found ${total} mockups`)

// Render a mockup with artwork
const render = await client.renders.create({
  mockupId: mockups[0].uuid,
  smartObjects: [{
    uuid: mockups[0].smartObjects[0].uuid,
    asset: { url: 'https://example.com/design.png' },
  }],
  exportOptions: { imageFormat: 'webp', imageSize: 1080 },
})
console.log(render.url) // https://cdn.sudomock.com/renders/...
```

## API Reference

### Client

```typescript
import SudoMock from 'sudomock'

const client = new SudoMock('sm_xxx', {
  baseUrl: 'https://api.sudomock.com', // default
  timeout: 30_000,                      // default (ms)
  maxRetries: 2,                        // default
})
```

The API key can be passed as the first argument or via the `SUDOMOCK_API_KEY` environment variable.

### Mockups

```typescript
// List mockups with pagination and filtering
const result = await client.mockups.list({
  limit: 20,
  offset: 0,
  name: 'shirt',        // case-insensitive contains
  sort: 'created_at',   // 'name' | 'created_at' | 'updated_at'
  order: 'desc',        // 'asc' | 'desc'
})

// Get a single mockup
const mockup = await client.mockups.get('uuid')
console.log(mockup.smartObjects)

// Update mockup name
const updated = await client.mockups.update('uuid', { name: 'New Name' })

// Delete a mockup
await client.mockups.delete('uuid')
```

> **Bulk delete all mockups** (`DELETE /api/v1/mockups/all`) requires a
> dashboard Bearer token and is **not** callable with an API key (the API
> returns 403). It is therefore intentionally not exposed by this SDK -- use
> the dashboard.

### Renders

```typescript
const render = await client.renders.create({
  mockupId: 'mockup-uuid',
  smartObjects: [{
    uuid: 'smart-object-uuid',
    asset: {
      url: 'https://example.com/artwork.png',
      fit: 'fill',           // 'fill' | 'contain' | 'cover'
      rotate: 0,
      flipHorizontal: false,
      flipVertical: false,
    },
    color: {
      hex: '#ff0000',
      blendingMode: 'multiply',
    },
  }],
  exportOptions: {
    imageFormat: 'webp',  // 'png' | 'jpg' | 'webp' (default 'webp')
    imageSize: 2048,      // max width in px, 100-10000 (default 2048)
    quality: 90,          // 1-100 (default 90)
    dpi: 300,             // optional, 72-2400: print resolution metadata (opt-in)
  },
  exportLabel: 'my-render',
})

console.log(render.url)        // convenience: first file URL
console.log(render.printFiles) // full array
```

### Async Renders & Jobs

Pass `isAsync: true` to enqueue a render instead of blocking. The API responds
with `202 Accepted` and `renders.create` resolves with a `Job` (TypeScript
narrows the return type via overload). Poll it with `client.jobs`:

```typescript
const job = await client.renders.create({
  mockupId: 'mockup-uuid',
  smartObjects: [{ uuid: 'so-uuid', asset: { url: 'https://example.com/art.png' } }],
  isAsync: true,
})
console.log(job.jobId, job.status) // 'queued'

// Poll a single time:
const status = await client.jobs.retrieve(job.jobId)

// ...or wait until it finishes (succeeded | failed):
const done = await client.jobs.waitForJob(job.jobId, {
  intervalMs: 2000,   // default
  timeoutMs: 300_000, // default; throws TimeoutError if exceeded
})
if (done.status === 'failed') throw new Error(done.error ?? 'render failed')
console.log(done.resultUrl)
```

`waitForJob` does NOT throw on a `failed` job -- inspect `status` and `error`.
It throws `TimeoutError` only when the job is still running past `timeoutMs`.

List and page your jobs (keyset pagination, newest first). Filter by `kind`
(`render` | `video` | `upload` | `2d_create`) and/or `mockupUuid`:

```typescript
const { jobs, nextCursor } = await client.jobs.list({ kind: 'video', limit: 50 })
if (nextCursor) {
  const next = await client.jobs.list({ cursor: nextCursor })
}
```

### Video Renders

`renders.createVideo` animates a mockup. It is always asynchronous and returns a
`Job` of kind `'video'`. Credit cost scales with model, duration, and audio; the
free tier allows a single lifetime video. `durationSeconds` must be one of the
durations the chosen model supports (otherwise the API returns a 400).

```typescript
const job = await client.renders.createVideo({
  mockupId: 'mockup-uuid',
  smartObjects: [{ uuid: 'so-uuid', asset: { url: 'https://example.com/art.png' } }],
  video: { durationSeconds: 5, audio: false },
})
const done = await client.jobs.waitForJob(job.jobId)
console.log(done.resultUrl) // mp4 URL
```

`video.motion` (`'ambient'` | `'showcase'`, default `'ambient'`) controls the
camera movement. You can also animate a raw image directly (no mockup) and
attach a per-call webhook:

```typescript
const job = await client.renders.createVideo({
  imageUrl: 'https://example.com/art.png', // raw-image mode
  video: { durationSeconds: 5, motion: 'showcase' },
  webhook: { url: 'https://example.com/hooks/sudomock' },
})
```

### 2D Mockups (`client.ai`)

Render artwork onto an existing 2D mockup (no PSD template) and manage your 2D
mockup catalog. `client.ai.render` posts to
`/api/v1/sudoai/2d-mockups/{mockupId}/render` (the mockup id lives in the path)
and costs **5 credits** per call. Each print area must supply `artworkUrl` OR
`color`.

#### Render an existing 2D mockup

```typescript
const result = await client.ai.render({
  mockupId: 'mockup-uuid',
  printAreas: [{
    uuid: 'print-area-uuid',
    artworkUrl: 'https://example.com/design.png',
    adjustments: { opacity: 90, vibrance: 10, blur: 0 },
  }],
  exportOptions: { imageFormat: 'webp', imageSize: 2048, quality: 90 },
})

console.log(result.url)                        // first rendered file
console.log(result.renderUuid)                 // correlate with webhooks
console.log(result.printFiles[0].durationMs)   // 2340
console.log(result.printFiles[0].exportFormat) // 'webp'
```

Prefer to render in the background? Pass `isAsync: true` and `render()` resolves
with a `Job` of kind `'2d_render'` (`202 Accepted`) you await with
`jobs.waitForJob`. A `2d_render.succeeded` / `2d_render.failed` webhook also
fires.

```typescript
const job = await client.ai.render({
  mockupId: 'mockup-uuid',
  printAreas: [{
    uuid: 'print-area-uuid',
    artworkUrl: 'https://example.com/design.png',
  }],
  isAsync: true,
})

const done = await client.jobs.waitForJob(job.jobId)
if (done.status === 'failed') throw new Error(done.error ?? 'render failed')
console.log(done.resultUrl) // rendered file URL
```

#### 2D mockups: create via API

Create a reusable 2D mockup, then render artwork. By default creation is
**synchronous**: `create()` resolves with the ready mockup (including its
`quads`). Creation costs **25 credits**. If the source image is unsuitable, the
**25 credits** are refunded automatically.

```typescript
const mockup = await client.ai.create({
  sourceUrl: 'https://example.com/product.jpg',
  name: 'Front view',
  idempotencyKey: 'front-view-v1',
})

const printArea = mockup.quads[0]
if (!printArea) throw new Error('No print area available')

const result = await client.ai.render({
  mockupId: mockup.mockupId,
  printAreas: [{
    uuid: printArea.printAreaId,
    artworkUrl: 'https://example.com/design.png',
  }],
})
console.log(result.url)
```

Prefer to create in the background? Pass `isAsync: true` and `create()` resolves
with a `Job` you await with `waitForReady`:

```typescript
const job = await client.ai.create({
  sourceUrl: 'https://example.com/product.jpg',
  isAsync: true,
})
const mockup = await client.ai.waitForReady(job, { intervalMs: 2_000 })
```

Update all print areas on a ready mockup with 1 to 8 four-point quads (each with
an optional `name`, **0 credits**):

```typescript
const updated = await client.ai.updatePrintAreas('mockup-uuid', [{
  points: [[100, 100], [900, 100], [900, 900], [100, 900]],
  name: 'Front',
}])
console.log(updated.printAreas)
```

Manage the 2D-mockup catalog:

```typescript
const { mockups, total } = await client.ai.list({ limit: 50 })
const mockup = await client.ai.get('mockup-uuid')
await client.ai.delete('mockup-uuid')
```

### Uploads

```typescript
const mockup = await client.uploads.create({
  psdFileUrl: 'https://example.com/mockup.psd',
  psdName: 'My T-Shirt Mockup',  // optional
})

console.log(mockup.uuid)
console.log(mockup.smartObjects)
console.log(mockup.thumbnails)
```

PSD upload is FREE (0 credits). Pass `isAsync: true` to process in the
background -- the call returns a `Job` (202) you poll via `client.jobs`:

```typescript
const job = await client.uploads.create({
  psdFileUrl: 'https://example.com/mockup.psd',
  isAsync: true,
})
const done = await client.jobs.waitForJob(job.jobId)
console.log(done.mockupUuid)
```

### Account

```typescript
const account = await client.account.get()

console.log(account.account.email)
console.log(account.subscription.plan)          // plan slug
console.log(account.subscription.tier)          // plan tier
console.log(account.subscription.billingChannel) // 'shopify' | 'stripe' | 'none'
console.log(account.usage.creditsRemaining)     // 950
console.log(account.usage.creditsLimit)         // 1000
console.log(account.apiKey.totalRequests)       // 1234
```

### Studio

Create customization sessions for the Studio iframe (print-on-demand integrations).

```typescript
const session = await client.studio.createSession({
  mockupUuid: 'uuid',
  productId: 'shopify-product-123',  // optional
  shop: 'store.myshopify.com',       // optional
})

// Open Studio iframe:
// studio.sudomock.com/editor?session=<session.session>
console.log(session.session)    // 'sess_xxx...'
console.log(session.expiresIn)  // 900 (seconds)
console.log(session.displayMode) // 'iframe' | 'popup' | 'page'
```

### Webhooks

Manage webhook endpoints (and verify inbound deliveries) so you can react to
async job completion without polling.

```typescript
// Create an endpoint -- the secret is returned in full on create; store it.
const endpoint = await client.webhooks.create({
  url: 'https://example.com/hooks/sudomock',
  eventTypes: ['render.succeeded', 'render.failed', 'video.succeeded'],
})

await client.webhooks.list()
await client.webhooks.update(endpoint.id, { enabled: false })
await client.webhooks.rotateSecret(endpoint.id) // returns the new secret
await client.webhooks.test(endpoint.id)         // send a test delivery
await client.webhooks.delete(endpoint.id)

// Per-endpoint delivery log (optional status / event_type / limit filters):
await client.webhooks.listDeliveries(endpoint.id, { status: 'failed', limit: 50 })
await client.webhooks.replayDelivery(endpoint.id, deliveryId) // replay one
await client.webhooks.replayFailed(endpoint.id)               // bulk replay all failed/dead

// Cross-endpoint Events feed (recent deliveries across every endpoint):
const events = await client.webhooks.listEvents({ status: 'failed', limit: 100 })
```

#### Verifying signatures

Every delivery carries TWO headers -- `X-SudoMock-Signature` (hex HMAC-SHA256
digest) and `X-SudoMock-Timestamp` (unix seconds). The signed payload is
`` `${timestamp}.${rawBody}` ``. Verify it with the exact raw request body --
re-serialized JSON will not match:

```typescript
import { verifyWebhookSignature } from 'sudomock'

// Express example -- capture the raw body (e.g. express.raw())
app.post('/hooks/sudomock', (req, res) => {
  const valid = verifyWebhookSignature(
    req.body.toString('utf8'),            // raw payload string
    req.header('X-SudoMock-Signature') ?? '',
    req.header('X-SudoMock-Timestamp') ?? '',
    process.env.SUDOMOCK_WEBHOOK_SECRET!,
    { toleranceSeconds: 300 },            // default; rejects replays
  )
  if (!valid) return res.status(400).end()
  // ...handle the event
  res.status(204).end()
})
```

The check is constant-time and rejects deliveries whose timestamp drifts more
than the tolerance from now.

## Error Handling

All errors extend `SudoMockError` and include `status` (HTTP code) and `code` (machine-readable string).

```typescript
import SudoMock, {
  SudoMockError,
  AuthenticationError,
  CreditError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  TimeoutError,
  JobFailedError,
  ConnectionError,
} from 'sudomock'

try {
  await client.renders.create({ ... })
} catch (err) {
  if (err instanceof CreditError) {
    console.log('Not enough credits, upgrade at https://sudomock.com/pricing')
  } else if (err instanceof RateLimitError) {
    console.log(`Rate limited, retry after ${err.retryAfter} seconds`)
  } else if (err instanceof AuthenticationError) {
    console.log('Invalid API key')
  } else if (err instanceof NotFoundError) {
    console.log('Mockup not found')
  } else if (err instanceof TimeoutError) {
    console.log('Request timed out')
  } else if (err instanceof SudoMockError) {
    console.log(`API error ${err.status}: ${err.message}`)
  }
}
```

### Error Classes

| Error | HTTP Status | Description |
|---|---|---|
| `AuthenticationError` | 401 | Invalid or missing API key |
| `CreditError` | 402 | Insufficient credits |
| `ValidationError` | 400/422 | Invalid request parameters |
| `NotFoundError` | 404 | Resource not found |
| `RateLimitError` | 429 | Too many requests (check `.retryAfter`) |
| `InternalError` | 500+ | Server error (auto-retried) |
| `TimeoutError` | -- | Request timed out |
| `JobFailedError` | N/A | Async job failed: `.jobId` identifies the job |
| `ConnectionError` | -- | Network/DNS failure |

## Retry Behavior

The SDK automatically retries on transient errors (HTTP 408, 429, 500, 502, 503, 504) with exponential backoff. Client errors (4xx except 408/429) are never retried.

```typescript
// Configure retries
const client = new SudoMock('sm_xxx', {
  maxRetries: 3,  // default: 2
  timeout: 60_000, // default: 30s (renders use 120s automatically)
})
```

## TypeScript

The SDK is written in TypeScript with full type definitions for all methods and responses.

```typescript
import SudoMock, {
  type Mockup,
  type SmartObject,
  type RenderResult,
  type AccountResult,
  type CreateRenderParams,
  type AIRenderParams,
  type Job,
  type JobStatus,
  type CreateVideoParams,
  type WebhookEndpoint,
  type WebhookDelivery,
} from 'sudomock'
```

> **Note:** Webhook management methods (`client.webhooks.*`) authenticate with
> your API key, the same as every other resource.

## MCP Server

SudoMock also offers an official [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server, enabling AI assistants like Claude, Cursor, and VS Code Copilot to generate mockups directly.

- **npm package:** [@sudomock/mcp](https://www.npmjs.com/package/@sudomock/mcp)
- **Remote server:** `mcp.sudomock.com` (HTTP transport, no Node.js required)
- **Documentation:** [sudomock.com/docs/mcp](https://sudomock.com/docs/mcp)

## Links

- [API Documentation](https://sudomock.com/docs)
- [Dashboard](https://sudomock.com)
- [GitHub](https://github.com/sudomock/sudomock-node)
- [MCP Server](https://github.com/sudomock/sudomock-mcp-server)

## License

MIT
