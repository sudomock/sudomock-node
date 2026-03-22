import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import {
  SudoMockError,
  AuthenticationError,
  RateLimitError,
  ConnectionError,
  TimeoutError,
} from '../src/errors'
import { TEST_API_KEY, TEST_BASE_URL, server } from './setup'

function createClient(overrides: Record<string, unknown> = {}) {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL, ...overrides })
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('SudoMock client', () => {
  it('requires an API key', () => {
    expect(() => new SudoMock('')).toThrow('API key is required')
  })

  it('reads API key from env when not passed', () => {
    const original = process.env['SUDOMOCK_API_KEY']
    process.env['SUDOMOCK_API_KEY'] = 'sm_from_env'
    try {
      const client = new SudoMock(undefined as unknown as string, {
        baseUrl: TEST_BASE_URL,
      })
      // Client should be constructable (we can't easily check the private key,
      // but if construction succeeds without throwing, env var was used)
      expect(client).toBeDefined()
    } finally {
      if (original === undefined) {
        delete process.env['SUDOMOCK_API_KEY']
      } else {
        process.env['SUDOMOCK_API_KEY'] = original
      }
    }
  })

  it('exposes resource namespaces', () => {
    const client = createClient()
    expect(client.mockups).toBeDefined()
    expect(client.renders).toBeDefined()
    expect(client.ai).toBeDefined()
    expect(client.uploads).toBeDefined()
    expect(client.account).toBeDefined()
    expect(client.studio).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Authentication errors
// ---------------------------------------------------------------------------

describe('authentication', () => {
  it('throws AuthenticationError on 401', async () => {
    const client = new SudoMock('sm_bad_key', { baseUrl: TEST_BASE_URL })
    await expect(client.mockups.list()).rejects.toThrow(AuthenticationError)
  })
})

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('rate limiting', () => {
  it('throws RateLimitError on 429 with retryAfter', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/mockups`, () => {
        return HttpResponse.json(
          { detail: 'Too many requests' },
          {
            status: 429,
            headers: { 'Retry-After': '30' },
          },
        )
      }),
    )

    const client = createClient({ maxRetries: 0 })
    try {
      await client.mockups.list()
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(30)
    }
  })
})

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

describe('retry', () => {
  it('retries on 500 then succeeds', async () => {
    let attempt = 0
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/me`, () => {
        attempt++
        if (attempt === 1) {
          return HttpResponse.json(
            { detail: 'Internal error' },
            { status: 500 },
          )
        }
        return HttpResponse.json({
          success: true,
          data: {
            account: {
              uuid: '44444444-4444-4444-4444-444444444444',
              email: 'test@example.com',
              name: 'Test User',
              created_at: '2026-01-01T00:00:00Z',
            },
            subscription: {
              plan: 'pro',
              tier: 'pro',
              status: 'active',
              current_period_end: '2026-04-01T00:00:00Z',
              cancel_at_period_end: false,
            },
            usage: {
              credits_used_this_month: 50,
              credits_limit: 1000,
              credits_remaining: 950,
              billing_period_start: '2026-03-01T00:00:00Z',
              billing_period_end: '2026-04-01T00:00:00Z',
            },
            api_key: {
              name: 'Production Key',
              created_at: '2026-01-15T00:00:00Z',
              last_used_at: '2026-03-20T12:00:00Z',
              total_requests: 1234,
            },
          },
        })
      }),
    )

    const client = createClient({ maxRetries: 2 })
    const result = await client.account.get()
    expect(result.account.email).toBe('test@example.com')
    expect(attempt).toBe(2)
  })

  it('does NOT retry on 400 (client error)', async () => {
    let attempt = 0
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/mockups/:uuid`, () => {
        attempt++
        return HttpResponse.json(
          { detail: 'Bad request' },
          { status: 400 },
        )
      }),
    )

    const client = createClient({ maxRetries: 3 })
    await expect(
      client.mockups.get('some-uuid'),
    ).rejects.toThrow(SudoMockError)
    expect(attempt).toBe(1) // no retries for client errors
  })
})

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('timeout', () => {
  it('throws TimeoutError when request exceeds timeout', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/me`, async () => {
        await new Promise((r) => setTimeout(r, 5000))
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    const client = createClient({ timeout: 100, maxRetries: 0 })
    await expect(client.account.get()).rejects.toThrow(TimeoutError)
  })
})

// ---------------------------------------------------------------------------
// camelCase <-> snake_case conversion
// ---------------------------------------------------------------------------

describe('case conversion', () => {
  it('converts snake_case API response to camelCase', async () => {
    const client = createClient()
    const result = await client.account.get()
    // snake_case fields like credits_remaining -> creditsRemaining
    expect(result.usage.creditsRemaining).toBe(950)
    expect(result.subscription.currentPeriodEnd).toBe('2026-04-01T00:00:00Z')
    expect(result.subscription.cancelAtPeriodEnd).toBe(false)
  })

  it('sends camelCase params as snake_case to API', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post(`${TEST_BASE_URL}/api/v1/renders`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          success: true,
          data: {
            print_files: [
              {
                export_path: 'https://cdn.sudomock.com/test.png',
                smart_object_uuid: 'so-uuid',
              },
            ],
          },
        })
      }),
    )

    const client = createClient()
    await client.renders.create({
      mockupId: 'mock-uuid',
      smartObjects: [
        {
          uuid: 'so-uuid',
          asset: {
            url: 'https://example.com/art.png',
            flipHorizontal: true,
          },
        },
      ],
      exportOptions: { imageFormat: 'webp', imageSize: 1080 },
    })

    // Verify body was sent in snake_case
    expect(capturedBody['mockup_uuid']).toBe('mock-uuid')
    expect(capturedBody['export_options']).toBeDefined()
    const exportOpts = capturedBody['export_options'] as Record<string, unknown>
    expect(exportOpts['image_format']).toBe('webp')
    expect(exportOpts['image_size']).toBe(1080)
  })
})

// ---------------------------------------------------------------------------
// Error hierarchy
// ---------------------------------------------------------------------------

describe('error hierarchy', () => {
  it('all errors extend SudoMockError', () => {
    expect(new AuthenticationError()).toBeInstanceOf(SudoMockError)
    expect(new RateLimitError()).toBeInstanceOf(SudoMockError)
    expect(new ConnectionError()).toBeInstanceOf(SudoMockError)
    expect(new TimeoutError()).toBeInstanceOf(SudoMockError)
  })

  it('SudoMockError extends Error', () => {
    expect(new SudoMockError('test')).toBeInstanceOf(Error)
  })
})
