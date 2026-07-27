import {
  SudoMockError,
  AuthenticationError,
  CreditError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  InternalError,
  TimeoutError,
  ConnectionError,
} from './errors'
import type { ApiErrorBody, ApiWarning } from './types'

// ---------------------------------------------------------------------------
// snake_case <-> camelCase helpers
// ---------------------------------------------------------------------------

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

/** Recursively convert object keys from camelCase to snake_case */
export function keysToSnake(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(keysToSnake)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toSnakeCase(key)] = keysToSnake(value)
    }
    return result
  }
  return obj
}

/** Recursively convert object keys from snake_case to camelCase */
export function keysToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(keysToCamel)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toCamelCase(key)] = keysToCamel(value)
    }
    return result
  }
  return obj
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  body?: unknown
  query?: Record<string, string | number | undefined>
  /** Additional request headers. */
  headers?: Record<string, string>
  /** Override default timeout for this request (ms) */
  timeout?: number
  /**
   * Return the FULL camelCased response envelope instead of unwrapping its
   * `data` field. Needed for endpoints that put pagination metadata
   * (`total` / `limit` / `offset`) as siblings of `data` rather than nesting it
   * inside `data` -- the default unwrap would drop those siblings.
   */
  rawEnvelope?: boolean
}

export interface ClientConfig {
  apiKey: string
  baseUrl: string
  timeout: number
  maxRetries: number
}

/** SDK version, surfaced in the User-Agent header. Keep in sync with package.json. */
const SDK_VERSION = '2.3.0'

/** Initial backoff in ms for exponential retry */
const INITIAL_BACKOFF_MS = 500

/** Status codes that are safe to retry */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

/** Engine diagnostics are never part of the SDK's public error contract. */
const ENGINE_DETAIL =
  /gemini|advanced.?model|\bmodel\b|prompt|mask(?:_|-|\b)|segment(?:ation)?(?:_|-|\b)|region.?index|depth|displacement|grid|warp|shading|provider|pipeline|engine|internal|private|storage|bucket|config.?version|setup.?revision|edit.?generation|\bphase\b|state.?machine|(?:internal|processing|workflow).?state/i

function publicErrorText(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value || ENGINE_DETAIL.test(value)) {
    return fallback
  }
  return value
}

function publicErrorCode(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
  return ENGINE_DETAIL.test(value) ? 'PROCESSING_FAILED' : value
}

export function publicWarnings(
  warnings: ApiWarning[] | undefined,
): ApiWarning[] | undefined {
  return warnings?.map((warning) => ({
    code: publicErrorCode(warning.code) ?? 'RENDER_WARNING',
    message: publicErrorText(
      warning.message,
      'The request completed with an advisory.',
    ),
  }))
}

/** Response wrapper that preserves the HTTP status alongside the parsed body. */
export interface ResponseWithStatus<T> {
  /** HTTP status code (e.g. 200 or 202). */
  status: number
  /** Parsed, camelCased response body. */
  data: T
}

export class HttpClient {
  private readonly config: ClientConfig

  constructor(config: ClientConfig) {
    this.config = config
  }

  async request<T>(options: RequestOptions): Promise<T> {
    return (await this.requestWithStatus<T>(options)).data
  }

  /**
   * Like {@link request}, but resolves with both the HTTP status code and the
   * parsed body. Used by endpoints that can return either 200 (inline result)
   * or 202 (async job accepted) and need to branch on the status.
   */
  async requestWithStatus<T>(options: RequestOptions): Promise<ResponseWithStatus<T>> {
    const url = this.buildUrl(options.path, options.query)
    const timeout = options.timeout ?? this.config.timeout

    let lastError: SudoMockError | null = null
    const maxAttempts = this.config.maxRetries + 1

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.doFetch(url, options, timeout)

        // 204 No Content
        if (response.status === 204) {
          return { status: 204, data: undefined as T }
        }

        // Parse response
        const responseBody = await response.json() as Record<string, unknown>

        // Error responses
        if (!response.ok) {
          const error = this.buildError(response.status, responseBody, response.headers)

          // Only retry on retryable status codes
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts - 1) {
            lastError = error
            await this.sleep(this.backoff(attempt))
            continue
          }

          throw error
        }

        // Success -- unwrap the API envelope and convert keys
        // The API wraps data in { success, data, message? }
        // Some endpoints (like studio/create-session) don't use the data wrapper.
        // `rawEnvelope` keeps the whole body so sibling pagination metadata
        // (total/limit/offset alongside `data`) survives.
        let data = options.rawEnvelope
          ? responseBody
          : (responseBody['data'] ?? responseBody)
        if (
          !options.rawEnvelope &&
          responseBody['data'] !== undefined &&
          responseBody['warnings'] !== undefined &&
          data !== null &&
          typeof data === 'object' &&
          !Array.isArray(data)
        ) {
          data = { ...data, warnings: responseBody['warnings'] ?? [] }
        }
        return { status: response.status, data: keysToCamel(data) as T }
      } catch (err) {
        if (err instanceof SudoMockError) {
          // Already a SudoMockError -- rethrow unless retryable
          if (RETRYABLE_STATUS_CODES.has(err.status) && attempt < maxAttempts - 1) {
            lastError = err
            await this.sleep(this.backoff(attempt))
            continue
          }
          throw err
        }

        // Timeout / abort detection
        // Node.js AbortSignal.timeout may throw DOMException or plain Error
        // with name 'AbortError' or 'TimeoutError', or message containing 'abort'/'timeout'
        const isAbortOrTimeout =
          (err instanceof DOMException &&
            (err.name === 'AbortError' || err.name === 'TimeoutError')) ||
          (err instanceof Error &&
            (err.name === 'AbortError' ||
              err.name === 'TimeoutError' ||
              err.message.toLowerCase().includes('abort') ||
              err.message.toLowerCase().includes('timeout')))

        if (isAbortOrTimeout) {
          const timeoutErr = new TimeoutError(`Request to ${options.path} timed out after ${timeout}ms`)
          if (attempt < maxAttempts - 1) {
            lastError = timeoutErr
            await this.sleep(this.backoff(attempt))
            continue
          }
          throw timeoutErr
        }

        // TypeError: network error, DNS failure, etc.
        if (err instanceof TypeError) {
          const connErr = new ConnectionError(`Network error: ${err.message}`)
          if (attempt < maxAttempts - 1) {
            lastError = connErr
            await this.sleep(this.backoff(attempt))
            continue
          }
          throw connErr
        }

        // Fallback
        throw new SudoMockError(
          err instanceof Error ? err.message : String(err),
        )
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError ?? new SudoMockError('Request failed after retries')
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async doFetch(
    url: string,
    options: RequestOptions,
    timeout: number,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'x-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `sudomock-node/${SDK_VERSION}`,
      ...options.headers,
    }

    const init: RequestInit = {
      method: options.method,
      headers,
      signal: AbortSignal.timeout(timeout),
    }

    if (options.body !== undefined) {
      init.body = JSON.stringify(keysToSnake(options.body))
    }

    return fetch(url, init)
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): string {
    const base = this.config.baseUrl.replace(/\/+$/, '')
    const url = new URL(`${base}${path}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }
    return url.toString()
  }

  private buildError(
    status: number,
    body: Record<string, unknown>,
    headers: Headers,
  ): SudoMockError {
    const rawDetail =
      (body as ApiErrorBody).detail ??
      (body as ApiErrorBody).message ??
      `HTTP ${status}`
    const detail = publicErrorText(
      rawDetail,
      status >= 500
        ? 'SudoMock could not complete the request. Retry shortly.'
        : 'The request could not be completed.',
    )
    const code = publicErrorCode((body as ApiErrorBody).error_code)

    switch (status) {
      case 400:
      case 422:
        return new ValidationError(detail, code)
      case 401:
        return new AuthenticationError(detail, code)
      case 402:
        return new CreditError(detail, code)
      case 404:
        return new NotFoundError(detail, code)
      case 429: {
        const retryAfterHeader = headers.get('Retry-After')
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null
        return new RateLimitError(
          detail,
          Number.isNaN(retryAfter) ? null : retryAfter,
          code,
        )
      }
      default:
        if (status >= 500) {
          return new InternalError(detail, code)
        }
        return new SudoMockError(detail, status, code)
    }
  }

  private backoff(attempt: number): number {
    // Exponential backoff with jitter: 500ms, 1s, 2s ...
    const base = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
    const jitter = Math.random() * base * 0.1
    return base + jitter
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
