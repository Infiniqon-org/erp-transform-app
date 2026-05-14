/**
 * _placeholder-types.ts — local UI-only types augmenting `lib/types/jobs.ts`.
 *
 * The sibling foundation lib at `lib/types/jobs.ts` provides the canonical
 * server-shape types (Job, JobRun, JobStatus, RunStatus, ...). This file
 * adds purely-presentational types the spec needs:
 *
 *   - `JobKind`  — wizard-side "what kind of pipeline is this" tag
 *                  ('aug' / 'dq' / 'imp' / 'exp'). Backend has no such field;
 *                  we derive it from the Job at render time.
 *   - `TimelineNode` — the GitHub-Actions-style step we render in the drawer.
 *                      Built from `JobRun.pipeline_logs` at render time.
 *   - `JobsWsMessage` — the message envelope for `CleanFlowAI-WS` `/jobs`
 *                       channel. Mirrors `WSConnections` protocol.
 *
 * DO NOT add server-shape types here — those belong in `lib/types/jobs.ts`.
 */

import type { Job, JobRun, RunStatus } from '@/lib/types/jobs'

/** UI tag for the row pill ("aug" / "dq" / "imp" / "exp"). */
export type JobKind = 'aug' | 'dq' | 'imp' | 'exp'

/**
 * Derives a JobKind from a server Job. Heuristic, matches the spec wording:
 *   - source/destination connector → 'imp' / 'exp'
 *   - storage provider on either side → 'imp'
 *   - dq_config present and no destination → 'dq'
 *   - everything else with column_mapping → 'aug'
 */
export function deriveJobKind(job: Pick<Job, 'source_category' | 'destination_category' | 'column_mapping' | 'dq_config'>): JobKind {
  const src = (job.source_category ?? '').toString().toLowerCase()
  const dst = (job.destination_category ?? '').toString().toLowerCase()
  if (dst === 'erp' || dst === 'warehouse') return 'exp'
  if (src === 'erp' || src === 'storage' || src === 'warehouse') return 'imp'
  if (job.dq_config && Object.keys(job.dq_config).length > 0 && !dst) return 'dq'
  return 'aug'
}

/** A node in the GitHub Actions-style timeline. */
export interface TimelineNode {
  id: string
  label: string
  status: 'done' | 'running' | 'pending' | 'failed' | 'skipped'
  /** Duration string `MM:SS` or `HH:MM:SS`; `'—'` for pending. */
  duration: string
  /** Sub-step bullets, rendered when the node is expanded. */
  details?: string[]
}

/** Build a TimelineNode list from a JobRun's pipeline_logs. */
export function buildTimeline(run: JobRun | null): TimelineNode[] {
  if (!run) return []
  const logs = Array.isArray(run.pipeline_logs) ? run.pipeline_logs : []
  if (logs.length === 0) {
    // No structured logs yet — synthesize a minimal timeline from RunStatus
    const top = (run.status ?? 'RUNNING') as RunStatus
    return [
      {
        id: 'run',
        label: 'Pipeline',
        status:
          top === 'RUNNING'
            ? 'running'
            : top === 'SUCCESS'
            ? 'done'
            : top === 'FAILED'
            ? 'failed'
            : top === 'PARTIAL'
            ? 'done'
            : 'pending',
        duration: formatRunDuration(run),
      },
    ]
  }
  return logs.map((entry, idx) => {
    const status = mapLogStatus((entry as any).status ?? (entry as any).state)
    return {
      id: String((entry as any).step_id ?? (entry as any).id ?? idx),
      label: String((entry as any).label ?? (entry as any).step ?? `Step ${idx + 1}`),
      status,
      duration: formatDurationMs((entry as any).duration_ms),
      details: Array.isArray((entry as any).details)
        ? ((entry as any).details as string[])
        : undefined,
    }
  })
}

function mapLogStatus(raw: unknown): TimelineNode['status'] {
  const s = String(raw ?? '').toLowerCase()
  if (s === 'success' || s === 'done' || s === 'complete' || s === 'succeeded') return 'done'
  if (s === 'running' || s === 'in_progress') return 'running'
  if (s === 'failed' || s === 'error') return 'failed'
  if (s === 'skipped') return 'skipped'
  return 'pending'
}

export function formatDurationMs(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || Number.isNaN(ms) || ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function formatRunDuration(run: JobRun | null | undefined): string {
  if (!run) return '—'
  if (run.duration_ms !== undefined && run.duration_ms !== null) {
    return formatDurationMs(run.duration_ms)
  }
  if (run.started_at && run.completed_at) {
    const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
    return formatDurationMs(ms)
  }
  if (run.started_at) {
    const ms = Date.now() - new Date(run.started_at).getTime()
    return formatDurationMs(ms)
  }
  return '—'
}

/** WebSocket message envelope from `CleanFlowAI-WS` `/jobs` channel. */
export interface JobsWsMessage {
  type: 'job_update' | 'run_update' | 'log_line' | 'connected' | 'error' | string
  job_id?: string
  run_id?: string
  status?: string
  /** Partial Job/JobRun deltas — merged into store. */
  delta?: Record<string, unknown>
  /** For `log_line` events. */
  line?: string
  timestamp?: string
}
