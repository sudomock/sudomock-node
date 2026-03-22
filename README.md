# SudoMock Node.js SDK

Official Node.js/TypeScript SDK for the [SudoMock API](https://docs.sudomock.com). Generate product mockups from Photoshop PSD files or use AI-powered rendering without any PSD.

## Installation

```bash
npm install sudomock
```

**Requirements:** Node.js 18+ (uses native `fetch`)

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
    imageFormat: 'webp',  // 'png' | 'jpg' | 'webp'
    imageSize: 1920,      // max width in px
    quality: 95,          // 1-100
  },
  exportLabel: 'my-render',
})

console.log(render.url)        // convenience: first file URL
console.log(render.printFiles) // full array
```

### AI Render

Render mockups from any product photo without a PSD file. The AI automatically detects the product, segments it, and applies your artwork with perspective correction.

```typescript
const result = await client.ai.render({
  sourceUrl: 'https://example.com/product-photo.jpg',
  artworkUrl: 'https://example.com/design.png',
  productType: 't-shirt',  // optional hint
  adjustments: {
    brightness: 0,
    contrast: 0,
    opacity: 1,
    warpStrength: 0.8,
    textureStrength: 0.5,
  },
  exportOptions: { imageFormat: 'png' },
})

console.log(result.url)
console.log(result.printFiles[0].confidence) // 0.95
console.log(result.printFiles[0].durationMs) // 2340
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

### Account

```typescript
const account = await client.account.get()

console.log(account.account.email)
console.log(account.subscription.plan)      // 'free' | 'pro' | 'scale'
console.log(account.usage.creditsRemaining) // 950
console.log(account.usage.creditsLimit)     // 1000
console.log(account.apiKey.totalRequests)   // 1234
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
} from 'sudomock'
```

## Links

- [API Documentation](https://docs.sudomock.com)
- [Dashboard](https://sudomock.com)
- [GitHub](https://github.com/sudomock/sudomock-node)

## License

MIT
