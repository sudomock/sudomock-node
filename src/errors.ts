/**
 * Base error class for all SudoMock SDK errors.
 *
 * Every error exposes `status` (HTTP status code) and `code`
 * (machine-readable string) for programmatic handling.
 */
export class SudoMockError extends Error {
  /** HTTP status code from the API response, or 0 for client-side errors */
  readonly status: number
  /** Machine-readable error code */
  readonly code: string

  constructor(message: string, status: number = 0, code: string = 'unknown_error') {
    super(message)
    this.name = 'SudoMockError'
    this.status = status
    this.code = code
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** 401 -- Invalid or missing API key */
export class AuthenticationError extends SudoMockError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401, 'authentication_error')
    this.name = 'AuthenticationError'
  }
}

/** 402 -- Insufficient credits */
export class CreditError extends SudoMockError {
  constructor(message = 'Insufficient credits') {
    super(message, 402, 'credit_error')
    this.name = 'CreditError'
  }
}

/** 404 -- Resource not found */
export class NotFoundError extends SudoMockError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'not_found')
    this.name = 'NotFoundError'
  }
}

/** 422 / 400 -- Invalid request parameters */
export class ValidationError extends SudoMockError {
  constructor(message = 'Invalid request parameters') {
    super(message, 400, 'validation_error')
    this.name = 'ValidationError'
  }
}

/** 429 -- Too many requests */
export class RateLimitError extends SudoMockError {
  /** Seconds to wait before retrying (from Retry-After header) */
  readonly retryAfter: number | null

  constructor(message = 'Rate limit exceeded', retryAfter: number | null = null) {
    super(message, 429, 'rate_limit_error')
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/** 500+ -- Server-side error (transient, safe to retry) */
export class InternalError extends SudoMockError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'internal_error')
    this.name = 'InternalError'
  }
}

/** Client-side timeout */
export class TimeoutError extends SudoMockError {
  constructor(message = 'Request timed out') {
    super(message, 0, 'timeout')
    this.name = 'TimeoutError'
  }
}

/** Network / connection error */
export class ConnectionError extends SudoMockError {
  constructor(message = 'Connection failed') {
    super(message, 0, 'connection_error')
    this.name = 'ConnectionError'
  }
}
