import type { HttpClient } from '../client'
import type {
  Job,
  JobListResult,
  ListJobsParams,
  WaitForJobOptions,
} from '../types'
import { TimeoutError } from '../errors'

/** Default poll interval while waiting for a job (ms). */
const DEFAULT_POLL_INTERVAL_MS = 2_000
/** Default overall wait budget before giving up (ms). */
const DEFAULT_WAIT_TIMEOUT_MS = 300_000

/** Job statuses that will not change further. */
const TERMINAL_STATUSES = new Set<Job['status']>(['succeeded', 'failed'])

/**
 * Heuristic: does this parsed body look like an async {@link Job} rather than a
 * synchronous render/upload result? Async bodies carry `jobId`; sync
 * render results carry `printFiles`.
 */
export function isJobBody(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'jobId' in (body as Record<string, unknown>)
  )
}

/**
 * Normalize a parsed job body. The API exposes the lifecycle on a `status`
 * field (on both the 202 submit response and the `GET /jobs` poll). We also
 * accept a legacy `state` key for forward/backward compatibility. Defaults
 * `kind` to `'render'` when absent.
 */
export function toJob(body: unknown): Job {
  const raw = (body ?? {}) as Record<string, unknown>
  const status = (raw['status'] ?? raw['state']) as Job['status'] | undefined
  return {
    ...(raw as unknown as Job),
    kind: (raw['kind'] as Job['kind']) ?? 'render',
    status: status ?? 'queued',
  }
}

export class JobsResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * List your async jobs (renders, videos, uploads), newest first.
   *
   * Keyset-paginated: pass the returned `nextCursor` back as `cursor` to fetch
   * the next page. Filter by `kind` and/or `mockupUuid`.
   *
   * @example
   * ```ts
   * const { jobs, nextCursor } = await client.jobs.list({ kind: 'video', limit: 50 })
   * if (nextCursor) {
   *   const next = await client.jobs.list({ cursor: nextCursor })
   * }
   * ```
   */
  async list(params: ListJobsParams = {}): Promise<JobListResult> {
    const data = await this.client.request<{
      jobs?: unknown[]
      nextCursor?: string | null
    }>({
      method: 'GET',
      path: '/api/v1/jobs',
      query: {
        kind: params.kind,
        mockup_uuid: params.mockupUuid,
        limit: params.limit,
        cursor: params.cursor,
      },
    })
    return {
      jobs: (data.jobs ?? []).map(toJob),
      nextCursor: data.nextCursor ?? null,
    }
  }

  /**
   * Fetch the current state of an async job (render or video).
   *
   * @example
   * ```ts
   * const job = await client.jobs.retrieve(jobId)
   * if (job.status === 'succeeded') console.log(job.resultUrl)
   * ```
   */
  async retrieve(jobId: string): Promise<Job> {
    const data = await this.client.request<Job>({
      method: 'GET',
      path: `/api/v1/jobs/${jobId}`,
    })
    return toJob(data)
  }

  /**
   * Poll a job until it reaches a terminal state (`succeeded` or `failed`)
   * and resolve with the final {@link Job}.
   *
   * Throws a {@link TimeoutError} if the job is still running after
   * `timeoutMs`. This does NOT throw on a `failed` job -- inspect `status`
   * and `error` on the returned job.
   *
   * @example
   * ```ts
   * const job = await client.jobs.waitForJob(jobId, { intervalMs: 1000 })
   * if (job.status === 'failed') throw new Error(job.error ?? 'render failed')
   * console.log(job.resultUrl)
   * ```
   */
  async waitForJob(
    jobId: string,
    options: WaitForJobOptions = {},
  ): Promise<Job> {
    const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS
    const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS
    const deadline = Date.now() + timeoutMs

    for (;;) {
      const job = await this.retrieve(jobId)
      if (TERMINAL_STATUSES.has(job.status)) {
        return job
      }
      if (Date.now() + intervalMs > deadline) {
        throw new TimeoutError(
          `Job ${jobId} did not finish within ${timeoutMs}ms (last status: ${job.status})`,
        )
      }
      await sleep(intervalMs)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
