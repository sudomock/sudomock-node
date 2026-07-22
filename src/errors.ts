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
  constructor(message = 'Invalid or missing API key', code = 'authentication_error') {
    super(message, 401, code)
    this.name = 'AuthenticationError'
  }
}

/** 402 -- Insufficient credits */
export class CreditError extends SudoMockError {
  constructor(message = 'Insufficient credits', code = 'credit_error') {
    super(message, 402, code)
    this.name = 'CreditError'
  }
}

/** 404 -- Resource not found */
export class NotFoundError extends SudoMockError {
  constructor(message = 'Resource not found', code = 'not_found') {
    super(message, 404, code)
    this.name = 'NotFoundError'
  }
}

/** 422 / 400 -- Invalid request parameters */
export class ValidationError extends SudoMockError {
  constructor(message = 'Invalid request parameters', code = 'validation_error') {
    super(message, 400, code)
    this.name = 'ValidationError'
  }
}

/** 429 -- Too many requests */
export class RateLimitError extends SudoMockError {
  /** Seconds to wait before retrying (from Retry-After header) */
  readonly retryAfter: number | null

  constructor(
    message = 'Rate limit exceeded',
    retryAfter: number | null = null,
    code = 'rate_limit_error',
  ) {
    super(message, 429, code)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/** 500+ -- Server-side error (transient, safe to retry) */
export class InternalError extends SudoMockError {
  constructor(message = 'Internal server error', code = 'internal_error') {
    super(message, 500, code)
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

/** An async job reached a failed terminal state. */
export class JobFailedError extends SudoMockError {
  /** Stable identifier of the failed job. */
  readonly jobId: string

  constructor(jobId: string, message = 'Job failed', code = 'job_failed') {
    super(message, 0, code)
    this.name = 'JobFailedError'
    this.jobId = jobId
  }
}

/** Network / connection error */
export class ConnectionError extends SudoMockError {
  constructor(message = 'Connection failed') {
    super(message, 0, 'connection_error')
    this.name = 'ConnectionError'
  }
}
