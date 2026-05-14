'use client'

/**
 * JobDetailDrawer — right-side 480 px slide-in drawer for a selected Job.
 *
 * Spec §B3: GitHub-Actions-style detail view with header (job_id, source,
 * elapsed), expandable timeline, log tail (placeholder for now — wired
 * to WS log_line messages once the BE channel ships), Output artefacts,
 * and contextual primary action (Retry / Reprocess / Run again).
 *
 * The drawer is a thin presentation layer on top of:
 *   - `jobs.activeJob` (Job)
 *   - `jobs.runs[activeJobId]` (JobRun[]) — latest run is the rendered one
 *
 * Run dispatchers (pause / resume / trigger / delete / resumeRun) come
 * directly from `jobsSlice` thunks.
 */

import {
  Copy,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { loadTokens } from '@/lib/auth-session'
import {
  deleteJob,
  pauseJob,
  resumeJob,
  resumeRun,
  triggerJob,
} from '@/lib/features/jobsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/store'
import type { Job, JobRun } from '@/lib/types/jobs'
import { cn, formatToIST } from '@/lib/utils'

import {
  deriveJobKind,
  formatRunDuration,
  type JobKind,
} from './_placeholder-types'
import { JobRunTimeline } from './JobRunTimeline'
import { JobStatusPill, pillVariantFromRunStatus } from './JobStatusPill'

interface JobDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JobDetailDrawer({ open, onOpenChange }: JobDetailDrawerProps) {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const job = useAppSelector((s) => s.jobs.activeJob)
  const allRuns = useAppSelector((s) => (s.jobs.activeJobId ? s.jobs.runs[s.jobs.activeJobId] : undefined))

  const latestRun: JobRun | null = useMemo(() => {
    if (!allRuns || allRuns.length === 0) return null
    // The slice's runProgressUpdate unshifts new entries, so [0] is freshest.
    return allRuns[0]
  }, [allRuns])

  const variant = pillVariantFromRunStatus(latestRun?.status)
  const kind: JobKind | null = job ? deriveJobKind(job) : null

  const requireToken = (): string | null => {
    const t = loadTokens()
    if (!t?.accessToken) {
      toast({ title: 'Sign in required', description: 'Your session expired.', variant: 'destructive' })
      return null
    }
    return t.accessToken
  }

  const handleTrigger = () => {
    if (!job) return
    const accessToken = requireToken()
    if (!accessToken) return
    dispatch(triggerJob({ jobId: job.job_id, accessToken }))
      .unwrap()
      .then(() => toast({ title: 'Run started', description: job.name }))
      .catch((err) => toast({ title: 'Trigger failed', description: String(err), variant: 'destructive' }))
  }

  const handlePauseResume = () => {
    if (!job) return
    const accessToken = requireToken()
    if (!accessToken) return
    const isPaused = String(job.status).toUpperCase() === 'PAUSED'
    const thunk = isPaused ? resumeJob : pauseJob
    dispatch(thunk({ jobId: job.job_id, accessToken }))
      .unwrap()
      .then(() => toast({ title: isPaused ? 'Job resumed' : 'Job paused' }))
      .catch((err) => toast({ title: 'Action failed', description: String(err), variant: 'destructive' }))
  }

  const handleDelete = () => {
    if (!job) return
    const accessToken = requireToken()
    if (!accessToken) return
    if (!window.confirm(`Delete job "${job.name}"? This cannot be undone.`)) return
    dispatch(deleteJob({ jobId: job.job_id, accessToken }))
      .unwrap()
      .then(() => {
        toast({ title: 'Job deleted' })
        onOpenChange(false)
      })
      .catch((err) => toast({ title: 'Delete failed', description: String(err), variant: 'destructive' }))
  }

  const handleRetry = () => {
    if (!job || !latestRun) return
    const accessToken = requireToken()
    if (!accessToken) return
    dispatch(resumeRun({ jobId: job.job_id, runId: latestRun.run_id, accessToken }))
      .unwrap()
      .then(() => toast({ title: 'Retry queued' }))
      .catch((err) => toast({ title: 'Retry failed', description: String(err), variant: 'destructive' }))
  }

  const copyJobId = () => {
    if (!job) return
    try {
      navigator.clipboard.writeText(job.job_id)
      toast({ title: 'Copied job_id' })
    } catch {
      /* clipboard blocked — silent no-op */
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-[480px] !max-w-[92vw] p-0 flex flex-col data-[state=open]:duration-[280ms]"
      >
        <SheetHeader className="space-y-2 border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {kind && <KindTag kind={kind} />}
                <SheetTitle className="truncate text-sm font-semibold">
                  {job?.name ?? 'No job selected'}
                </SheetTitle>
              </div>
              <SheetDescription className="sr-only">
                Detail view for job {job?.job_id ?? ''}
              </SheetDescription>
            </div>
            <JobStatusPill status={latestRun?.status} />
          </div>
          {job && (
            <dl className="grid grid-cols-[68px_1fr] gap-x-3 gap-y-1 text-[11px]">
              <dt className="text-muted-foreground">job_id</dt>
              <dd className="flex items-center gap-1 font-mono">
                <span className="truncate">{job.job_id}</span>
                <button
                  type="button"
                  onClick={copyJobId}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Copy job id"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </dd>
              <dt className="text-muted-foreground">source</dt>
              <dd className="font-mono truncate">
                {job.source_provider} · {job.source_category}
              </dd>
              <dt className="text-muted-foreground">schedule</dt>
              <dd className="font-mono truncate">
                {job.frequency_type === 'batch' ? 'manual' : `${job.frequency_type} · ${job.frequency_value}`}
              </dd>
              {latestRun?.started_at && (
                <>
                  <dt className="text-muted-foreground">started</dt>
                  <dd className="font-mono truncate">{formatToIST(latestRun.started_at)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">elapsed</dt>
              <dd className="font-mono tabular-nums">{formatRunDuration(latestRun)}</dd>
            </dl>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <SectionHeader>Timeline</SectionHeader>
          <JobRunTimeline run={latestRun} />

          <SectionHeader>Output</SectionHeader>
          <OutputArtefacts run={latestRun} />

          {latestRun?.error_message && (
            <>
              <SectionHeader tone="destructive">Error</SectionHeader>
              <div className="px-4 py-3">
                {latestRun.error_code && (
                  <div className="font-mono text-[11px] text-muted-foreground">
                    code: {latestRun.error_code}
                  </div>
                )}
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-destructive">
                  {latestRun.error_message}
                </pre>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 flex items-center gap-2">
          {variant === 'failed' || variant === 'partial' ? (
            <Button size="sm" className="h-8 text-xs" onClick={handleRetry} disabled={!latestRun}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {variant === 'partial' ? 'Reprocess failed shards' : 'Retry from failed step'}
            </Button>
          ) : variant === 'succeeded' ? (
            <Button size="sm" className="h-8 text-xs" onClick={handleTrigger} disabled={!job}>
              <Play className="mr-1 h-3.5 w-3.5" />
              Run again
            </Button>
          ) : (
            <Button size="sm" className="h-8 text-xs" onClick={handleTrigger} disabled={!job}>
              <Play className="mr-1 h-3.5 w-3.5" />
              Trigger now
            </Button>
          )}

          {job && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handlePauseResume}>
              {String(job.status).toUpperCase() === 'PAUSED' ? (
                <>
                  <Play className="mr-1 h-3.5 w-3.5" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-1 h-3.5 w-3.5" />
                  Pause
                </>
              )}
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={!job}
              aria-label="Delete job"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => onOpenChange(false)}
              aria-label="Close drawer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SectionHeader({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'destructive'
}) {
  return (
    <div
      className={cn(
        'px-4 pt-4 pb-2 text-[10px] font-medium uppercase tracking-[0.06em]',
        tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'
      )}
    >
      {children}
    </div>
  )
}

function KindTag({ kind }: { kind: JobKind }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-border bg-muted px-1.5 font-mono text-[10px] uppercase text-muted-foreground">
      {kind}
    </span>
  )
}

function OutputArtefacts({ run }: { run: JobRun | null }) {
  if (!run) {
    return <div className="px-4 py-2 text-xs text-muted-foreground">No output yet.</div>
  }
  // Pull artefacts from `processing_metadata` if the BE filled it; otherwise
  // synthesize the canonical S3 paths from CLAUDE.md so the user at least
  // sees what to expect.
  const meta = (run.processing_metadata ?? {}) as Record<string, unknown>
  const artefacts = Array.isArray(meta.artefacts) ? (meta.artefacts as Array<{ key: string; size?: number; status?: string }>) : []
  if (artefacts.length === 0) {
    return (
      <ul className="px-4 py-1 text-xs space-y-1">
        <li className="flex items-center justify-between">
          <span className="font-mono">result.parquet</span>
          <span className="text-muted-foreground">pending</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="font-mono">dq_matrix.json</span>
          <span className="text-muted-foreground">pending</span>
        </li>
      </ul>
    )
  }
  return (
    <ul className="px-4 py-1 text-xs space-y-1">
      {artefacts.map((a) => (
        <li key={a.key} className="flex items-center justify-between">
          <span className="font-mono truncate">{a.key.split('/').pop()}</span>
          <span className="text-muted-foreground">{a.status ?? 'ready'}</span>
        </li>
      ))}
    </ul>
  )
}
