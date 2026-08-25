import { getLookupResolveJob, getLookupSyncJob, getOlderMatchesJob, getPinnedSyncJob, getSyncJob } from './client'
import type { LookupResolveJob, LookupSyncJob, OlderMatchesJob, PinnedSyncJob, SyncJob } from './types'

const TERMINAL = new Set(['complete', 'failed'])

export class SyncTimeoutError extends Error {}

interface Job {
  status: string
}

async function poll<T extends Job>(
  fetchJob: (jobId: string) => Promise<T>,
  jobId: string,
  onStatus?: (job: T) => void,
  { intervalMs = 1000, timeoutMs = 180_000 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const job = await fetchJob(jobId)
    onStatus?.(job)
    if (TERMINAL.has(job.status)) return job
    if (Date.now() > deadline) {
      throw new SyncTimeoutError('Sync is taking longer than expected.')
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

export function waitForSync(
  jobId: string,
  onStatus?: (job: SyncJob) => void,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<SyncJob> {
  return poll(getSyncJob, jobId, onStatus, options)
}

export function waitForPinnedSync(
  jobId: string,
  onStatus?: (job: PinnedSyncJob) => void,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<PinnedSyncJob> {
  return poll(getPinnedSyncJob, jobId, onStatus, options)
}

export function waitForLookupSync(
  jobId: string,
  onStatus?: (job: LookupSyncJob) => void,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<LookupSyncJob> {
  return poll(getLookupSyncJob, jobId, onStatus, options)
}

export function waitForLookupResolve(
  jobId: string,
  onStatus?: (job: LookupResolveJob) => void,
): Promise<LookupResolveJob> {
  return poll(getLookupResolveJob, jobId, onStatus, { intervalMs: 200, timeoutMs: 20_000 })
}

export function waitForOlderMatchesSync(jobId: string): Promise<OlderMatchesJob> {
  return poll(getOlderMatchesJob, jobId)
}

export function describeJobError(errorName: string | null): string {
  switch (errorName) {
    case 'RiotAuthError':
      return 'Riot rejected the API key. Development keys expire every 24h, so get a fresh one.'
    case 'RiotNotFoundError':
      return 'Riot ID not found. Double check the spelling and tag line.'
    case 'RiotApiError':
      return 'Riot API error, possibly rate-limited. Try again in a bit.'
    default:
      return errorName
        ? `Sync failed (${errorName}). Your Riot ID may be wrong, or Riot is unreachable.`
        : 'Sync failed. Your Riot ID may be wrong, or Riot is unreachable.'
  }
}
