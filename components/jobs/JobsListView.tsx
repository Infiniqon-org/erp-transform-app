'use client'

/**
 * JobsListView — Linear "My Issues" dense list of Jobs.
 *
 * Spec §B1:
 *   - 36 px row height; hover tint `--job-row-hover`, selected tint
 *     `--job-row-selected`
 *   - Group rows by relative day (Today / Yesterday / This week / Earlier)
 *   - Columns (left → right): kind tag, name, status pill, duration,
 *     started_at, source file, overflow menu, plus an inline "trigger
 *     now" button
 *   - J/K nav (via `useKeyboardNav`); Enter opens the drawer
 *   - URL-driven filters via `JobsToolbar`
 *
 * The list is the *only* component that touches the WS hook — it owns
 * connection lifecycle and the disconnected chip.
 */

import {
  ChevronRight,
  MoreHorizontal,
  Play,
  WifiOff,
} from 'lucide-react'
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { loadTokens } from '@/lib/auth-session'
import {
  fetchJob,
  fetchJobRuns,
  fetchJobs,
  setActiveJobId,
  triggerJob,
} from '@/lib/features/jobsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/store'
import type { Job } from '@/lib/types/jobs'
import { cn, formatToIST } from '@/lib/utils'

import {
  deriveJobKind,
  formatDurationMs,
  type JobKind,
} from './_placeholder-types'
import { EmptyJobsState, FilteredZero } from './EmptyJobsState'
import { JobDetailDrawer } from './JobDetailDrawer'
import { JobStatusPill } from './JobStatusPill'
import { JobsToolbar, type JobsFilterValues } from './JobsToolbar'
import { useJobsWebSocket } from './hooks/useJobsWebSocket'
import { useKeyboardNav } from './hooks/useKeyboardNav'

interface JobsListViewProps {
  initialFilters?: JobsFilterValues
  orgId?: string | null
}

const DEFAULT_FILTERS: JobsFilterValues = {
  type: 'all',
  status: 'all',
  date: '30d',
  search: '',
}

export function JobsListView({ initialFilters, orgId }: JobsListViewProps) {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const jobs = useAppSelector((s) => s.jobs.list)
  const listLoading = useAppSelector((s) => s.jobs.listLoading)
  const listError = useAppSelector((s) => s.jobs.listError)
  const runsByJob = useAppSelector((s) => s.jobs.runs)

  const [filters, setFilters] = useState<JobsFilterValues>(initialFilters ?? DEFAULT_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { connected, fallbackPolling, errorMessage, reconnect } = useJobsWebSocket(orgId)

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = loadTokens()
    if (!t?.accessToken) return
    dispatch(fetchJobs({ accessToken: t.accessToken })).catch(() => {})
  }, [dispatch])

  // ── Filtered + grouped rows ──────────────────────────────────────────────
  const filteredJobs = useMemo(() => filterJobs(jobs, filters), [jobs, filters])
  const groups = useMemo(() => groupByRelativeDay(filteredJobs), [filteredJobs])
  const flatRows = useMemo(() => groups.flatMap((g) => g.rows), [groups])

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const openRow = useCallback(
    (index: number) => {
      const job = flatRows[index]
      if (!job) return
      const t = loadTokens()
      if (!t?.accessToken) return
      dispatch(setActiveJobId(job.job_id))
      dispatch(fetchJob({ jobId: job.job_id, accessToken: t.accessToken })).catch(() => {})
      dispatch(fetchJobRuns({ jobId: job.job_id, accessToken: t.accessToken })).catch(() => {})
      setDrawerOpen(true)
    },
    [dispatch, flatRows]
  )

  const triggerRow = useCallback(
    (index: number) => {
      const job = flatRows[index]
      if (!job) return
      const t = loadTokens()
      if (!t?.accessToken) return
      dispatch(triggerJob({ jobId: job.job_id, accessToken: t.accessToken }))
        .unwrap()
        .then(() => toast({ title: 'Run started', description: job.name }))
        .catch((err) => toast({ title: 'Trigger failed', description: String(err), variant: 'destructive' }))
    },
    [dispatch, flatRows, toast]
  )

  const { selectedIndex, setSelectedIndex, registerRowRef } = useKeyboardNav({
    itemCount: flatRows.length,
    onOpen: openRow,
    onEscape: () => setDrawerOpen(false),
    onRetry: triggerRow,
    disabled: drawerOpen,
  })

  // ── Active filter count for "clear" chip ─────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.type !== DEFAULT_FILTERS.type) n += 1
    if (filters.status !== DEFAULT_FILTERS.status) n += 1
    if (filters.date !== DEFAULT_FILTERS.date) n += 1
    if (filters.search.trim() !== '') n += 1
    return n
  }, [filters])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold text-foreground">Jobs</h1>
          <span className="font-mono text-[11px] text-muted-foreground">
            {filteredJobs.length} of {jobs.length}
          </span>
        </div>
        <ConnectionChip
          connected={connected}
          fallbackPolling={fallbackPolling}
          errorMessage={errorMessage}
          onReconnect={reconnect}
        />
      </header>

      <JobsToolbar values={filters} onChange={setFilters} activeFilterCount={activeFilterCount} />

      <div className="relative flex-1 overflow-y-auto">
        {listError && (
          <div className="border-b border-border bg-[color:color-mix(in_oklab,var(--destructive)_8%,transparent)] px-4 py-2 text-xs text-destructive">
            {listError}
          </div>
        )}

        {listLoading && jobs.length === 0 ? (
          <div className="space-y-2 px-4 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : flatRows.length === 0 ? (
          jobs.length === 0 ? (
            <EmptyJobsState />
          ) : (
            <FilteredZero onClearFilters={() => setFilters(DEFAULT_FILTERS)} />
          )
        ) : (
          <ul role="list" className="flex flex-col">
            {groups.map((group) => (
              <GroupSection
                key={group.label}
                group={group}
                flatIndexStart={group.flatIndexStart}
                selectedIndex={selectedIndex}
                setSelectedIndex={setSelectedIndex}
                registerRowRef={registerRowRef}
                runsByJob={runsByJob}
                onOpen={openRow}
                onTrigger={triggerRow}
              />
            ))}
          </ul>
        )}
      </div>

      <JobDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  )
}

// ─── Group rendering ──────────────────────────────────────────────────────────

interface Group {
  label: string
  rows: Job[]
  flatIndexStart: number
}

function GroupSection({
  group,
  flatIndexStart,
  selectedIndex,
  setSelectedIndex,
  registerRowRef,
  runsByJob,
  onOpen,
  onTrigger,
}: {
  group: Group
  flatIndexStart: number
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  registerRowRef: (i: number, el: HTMLElement | null) => void
  runsByJob: Record<string, Array<{ run_id: string; duration_ms?: number; status?: string; started_at?: string }>>
  onOpen: (i: number) => void
  onTrigger: (i: number) => void
}) {
  return (
    <li>
      <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {group.label}
      </div>
      <ul role="list" className="flex flex-col">
        {group.rows.map((job, i) => {
          const flatIndex = flatIndexStart + i
          const latest = runsByJob[job.job_id]?.[0]
          return (
            <JobRow
              key={job.job_id}
              ref={(el) => registerRowRef(flatIndex, el)}
              job={job}
              latestRunStatus={latest?.status ?? job.last_run_status}
              lastDurationMs={latest?.duration_ms}
              lastStartedAt={latest?.started_at ?? job.last_run_at}
              selected={flatIndex === selectedIndex}
              onSelect={() => setSelectedIndex(flatIndex)}
              onOpen={() => onOpen(flatIndex)}
              onTrigger={() => onTrigger(flatIndex)}
            />
          )
        })}
      </ul>
    </li>
  )
}

// ─── Single row ───────────────────────────────────────────────────────────────

interface JobRowProps {
  job: Job
  latestRunStatus?: string
  lastDurationMs?: number
  lastStartedAt?: string
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onTrigger: () => void
}

const JobRow = forwardRef<HTMLLIElement, JobRowProps>(function JobRow(
  { job, latestRunStatus, lastDurationMs, lastStartedAt, selected, onSelect, onOpen, onTrigger },
  ref
) {
    const kind = deriveJobKind(job)
    const fallbackName = `${kind}-${job.job_id.slice(0, 8)}`
    return (
      <li
        ref={ref}
        role="button"
        tabIndex={selected ? 0 : -1}
        aria-selected={selected}
        onClick={() => {
          onSelect()
          onOpen()
        }}
        onMouseEnter={onSelect}
        className={cn(
          'group flex h-9 cursor-pointer items-center gap-3 border-b border-border px-4 text-xs',
          'hover:bg-[color:color-mix(in_oklab,var(--primary)_4%,transparent)]',
          selected && 'bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)]'
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform',
            selected && 'translate-x-[1px] text-foreground'
          )}
        />
        <KindCell kind={kind} />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{job.name || fallbackName}</span>
        <JobStatusPill status={latestRunStatus} />
        <span className="w-14 text-right font-mono tabular-nums text-[11px] text-muted-foreground">
          {lastDurationMs !== undefined ? formatDurationMs(lastDurationMs) : '—'}
        </span>
        <span className="w-28 truncate text-right font-mono text-[11px] text-muted-foreground" title={lastStartedAt ? formatToIST(lastStartedAt) : undefined}>
          {lastStartedAt ? compactTimestamp(lastStartedAt) : '—'}
        </span>
        <span className="w-32 truncate text-right font-mono text-[11px] text-muted-foreground">
          {sourceLabel(job)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTrigger()
          }}
          className="ml-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
          aria-label={`Trigger ${job.name || fallbackName} now`}
          title="Trigger now"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen() }}>View</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTrigger() }}>Trigger now</DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                try {
                  navigator.clipboard.writeText(job.job_id)
                } catch { /* clipboard blocked */ }
              }}
            >
              Copy job_id
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    )
})

function KindCell({ kind }: { kind: JobKind }) {
  return (
    <span
      className="inline-flex h-5 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[10px] uppercase text-muted-foreground"
      aria-label={`type: ${kind}`}
    >
      {kind}
    </span>
  )
}

// ─── Skeleton (loading state) ─────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex h-9 items-center gap-3 px-4">
      <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
      <div className="h-5 w-9 rounded-full bg-muted animate-pulse" />
      <div className="h-3 flex-1 rounded bg-muted animate-pulse" />
      <div className="h-4 w-16 rounded-full bg-muted animate-pulse" />
      <div className="h-3 w-12 rounded bg-muted animate-pulse" />
      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
    </div>
  )
}

// ─── Connection chip ──────────────────────────────────────────────────────────

function ConnectionChip({
  connected,
  fallbackPolling,
  errorMessage,
  onReconnect,
}: {
  connected: boolean
  fallbackPolling: boolean
  errorMessage: string | null
  onReconnect: () => void
}) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        live
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onReconnect}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
      title={errorMessage ?? 'Reconnect now'}
    >
      <WifiOff className="h-3 w-3" />
      {fallbackPolling ? 'polling — reconnecting' : 'disconnected — reconnecting'}
    </button>
  )
}

// ─── Filtering / grouping helpers ─────────────────────────────────────────────

function filterJobs(jobs: Job[], filters: JobsFilterValues): Job[] {
  const search = filters.search.trim().toLowerCase()
  const cutoff = computeDateCutoff(filters.date)
  return jobs.filter((j) => {
    if (filters.type !== 'all' && deriveJobKind(j) !== filters.type) return false
    if (filters.status !== 'all') {
      const status = (j.last_run_status ?? '').toString().toUpperCase()
      if (status !== filters.status) return false
    }
    if (cutoff && j.last_run_at) {
      const t = Date.parse(j.last_run_at)
      if (!Number.isNaN(t) && t < cutoff) return false
    }
    if (search) {
      const hay = `${j.name} ${j.job_id} ${j.source_provider} ${j.destination_provider}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
}

function computeDateCutoff(date: string): number | null {
  if (date === 'all') return null
  const now = Date.now()
  switch (date) {
    case '1d':
      return now - 24 * 60 * 60 * 1000
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000
    default:
      return null
  }
}

function groupByRelativeDay(jobs: Job[]): Group[] {
  // Sort by last_run_at DESC, then created_at DESC as fallback.
  const sorted = [...jobs].sort((a, b) => {
    const at = Date.parse(a.last_run_at ?? a.created_at ?? '') || 0
    const bt = Date.parse(b.last_run_at ?? b.created_at ?? '') || 0
    return bt - at
  })
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 24 * 60 * 60 * 1000
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000

  const buckets: Record<string, Job[]> = { Today: [], Yesterday: [], 'This week': [], Earlier: [] }
  for (const j of sorted) {
    const t = Date.parse(j.last_run_at ?? j.created_at ?? '') || 0
    if (t >= today) buckets.Today.push(j)
    else if (t >= yesterday) buckets.Yesterday.push(j)
    else if (t >= weekAgo) buckets['This week'].push(j)
    else buckets.Earlier.push(j)
  }
  const order = ['Today', 'Yesterday', 'This week', 'Earlier']
  const groups: Group[] = []
  let flatIndex = 0
  for (const label of order) {
    const rows = buckets[label]
    if (rows.length === 0) continue
    groups.push({ label, rows, flatIndexStart: flatIndex })
    flatIndex += rows.length
  }
  return groups
}

function compactTimestamp(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t)
  const today = new Date()
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')} ${hh}:${mm}`
}

function sourceLabel(job: Job): string {
  if (job.source_provider) return job.source_provider
  const ent = job.entities?.[0]
  return ent ? `${ent}` : '—'
}
