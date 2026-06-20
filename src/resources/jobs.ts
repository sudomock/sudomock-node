import type { HttpClient } from '../client'
import type { Job, WaitForJobOptions } from '../types'
import { TimeoutError } from '../errors'

/** Default poll interval while waiting for a job (ms). */
const DEFAULT_POLL_INTERVAL_MS = 2_000
/** Default overall wait budget before giving up (ms). */
const DEFAULT_WAIT_TIMEOUT_MS = 300_000

/** Job states that will not change further. */
const TERMINAL_STATES = new Set<Job['state']>(['succeeded', 'failed'])

/**
 * Heuristic: does this parsed body look like an async {@link Job} rather than a
 * synchronous render/upload result? Async bodies carry `renderUuid`; sync
 * render results carry `printFiles`.
 */
export function isJobBody(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'renderUuid' in (body as Record<string, unknown>)
  )
}

/**
 * Normalize a parsed job body. The API uses `status` for queued/running on the
 * 202 submit response and `state` on the `GET /jobs` poll response; we expose a
 * single `state` field. Defaults `kind` to `'render'` when absent.
 */
export function toJob(body: unknown): Job {
  const raw = (body ?? {}) as Record<string, unknown>
  const state = (raw['state'] ?? raw['status']) as Job['state'] | undefined
  return {
    ...(raw as unknown as Job),
    kind: (raw['kind'] as Job['kind']) ?? 'render',
    state: state ?? 'queued',
  }
}

export class JobsResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Fetch the current state of an async job (render or video).
   *
   * @example
   * ```ts
   * const job = await client.jobs.retrieve(renderUuid)
   * if (job.state === 'succeeded') console.log(job.resultUrl)
   * ```
   */
  async retrieve(renderUuid: string): Promise<Job> {
    const data = await this.client.request<Job>({
      method: 'GET',
      path: `/api/v1/jobs/${renderUuid}`,
    })
    return toJob(data)
  }

  /**
   * Poll a job until it reaches a terminal state (`succeeded` or `failed`)
   * and resolve with the final {@link Job}.
   *
   * Throws a {@link TimeoutError} if the job is still running after
   * `timeoutMs`. This does NOT throw on a `failed` job -- inspect `state`
   * and `error` on the returned job.
   *
   * @example
   * ```ts
   * const job = await client.jobs.waitForJob(renderUuid, { intervalMs: 1000 })
   * if (job.state === 'failed') throw new Error(job.error ?? 'render failed')
   * console.log(job.resultUrl)
   * ```
   */
  async waitForJob(
    renderUuid: string,
    options: WaitForJobOptions = {},
  ): Promise<Job> {
    const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS
    const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS
    const deadline = Date.now() + timeoutMs

    for (;;) {
      const job = await this.retrieve(renderUuid)
      if (TERMINAL_STATES.has(job.state)) {
        return job
      }
      if (Date.now() + intervalMs > deadline) {
        throw new TimeoutError(
          `Job ${renderUuid} did not finish within ${timeoutMs}ms (last state: ${job.state})`,
        )
      }
      await sleep(intervalMs)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
