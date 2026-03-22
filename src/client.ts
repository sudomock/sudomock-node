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
import type { ApiErrorBody } from './types'

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
  /** Override default timeout for this request (ms) */
  timeout?: number
}

export interface ClientConfig {
  apiKey: string
  baseUrl: string
  timeout: number
  maxRetries: number
}

/** Initial backoff in ms for exponential retry */
const INITIAL_BACKOFF_MS = 500

/** Status codes that are safe to retry */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

export class HttpClient {
  private readonly config: ClientConfig

  constructor(config: ClientConfig) {
    this.config = config
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query)
    const timeout = options.timeout ?? this.config.timeout

    let lastError: SudoMockError | null = null
    const maxAttempts = this.config.maxRetries + 1

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.doFetch(url, options, timeout)

        // 204 No Content
        if (response.status === 204) {
          return undefined as T
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
        // Some endpoints (like studio/create-session) don't use the data wrapper
        const data = responseBody['data'] ?? responseBody
        return keysToCamel(data) as T
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
      'User-Agent': 'sudomock-node/1.0.0',
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
    const detail =
      (body as ApiErrorBody).detail ??
      (body as ApiErrorBody).message ??
      `HTTP ${status}`

    switch (status) {
      case 400:
      case 422:
        return new ValidationError(detail)
      case 401:
        return new AuthenticationError(detail)
      case 402:
        return new CreditError(detail)
      case 404:
        return new NotFoundError(detail)
      case 429: {
        const retryAfterHeader = headers.get('Retry-After')
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null
        return new RateLimitError(detail, Number.isNaN(retryAfter) ? null : retryAfter)
      }
      default:
        if (status >= 500) {
          return new InternalError(detail)
        }
        return new SudoMockError(detail, status)
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
