'use client'

/**
 * JobRunTimeline — GitHub-Actions-style expandable step timeline for the
 * detail drawer.
 *
 * Spec §B3: timeline nodes with done / running / pending / failed / skipped
 * variants, each expandable to show sub-step details. Running node has a
 * primary-ring pulse (NOT the full node, just the ring) per the dignified
 * motion rule from §2.
 *
 * The timeline reads structured pipeline_logs off the JobRun; the parsing
 * happens in `_placeholder-types.ts:buildTimeline` so this file stays
 * presentation-only.
 */

import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  Minus,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import type { JobRun } from '@/lib/types/jobs'

import { buildTimeline, type TimelineNode } from './_placeholder-types'

interface JobRunTimelineProps {
  run: JobRun | null
  className?: string
}

export function JobRunTimeline({ run, className }: JobRunTimelineProps) {
  const nodes = buildTimeline(run)
  if (nodes.length === 0) {
    return (
      <div className={cn('px-4 py-3 text-xs text-muted-foreground', className)}>
        No timeline data yet.
      </div>
    )
  }
  return (
    <ol className={cn('flex flex-col', className)} aria-label="Run timeline">
      {nodes.map((node, idx) => (
        <TimelineRow key={node.id} node={node} isLast={idx === nodes.length - 1} />
      ))}
    </ol>
  )
}

function TimelineRow({ node, isLast }: { node: TimelineNode; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = node.details && node.details.length > 0
  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        disabled={!hasDetails}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-2 text-left text-xs',
          hasDetails && 'hover:bg-[color:color-mix(in_oklab,var(--primary)_4%,transparent)] cursor-pointer',
          !hasDetails && 'cursor-default'
        )}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center">
          <NodeIcon status={node.status} />
          {!isLast && (
            <span
              aria-hidden
              className={cn(
                'absolute left-1/2 top-full h-3 w-px -translate-x-1/2',
                node.status === 'pending' ? 'bg-border' : 'bg-[color:color-mix(in_oklab,var(--primary)_30%,var(--border))]'
              )}
            />
          )}
        </span>
        <span className="flex-1 truncate font-medium text-foreground">{node.label}</span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{node.duration}</span>
        {hasDetails && (
          <span className="text-muted-foreground" aria-hidden>
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </button>
      {expanded && hasDetails && (
        <ul className="ml-8 mr-4 mb-2 list-disc pl-3 text-[11px] text-muted-foreground space-y-1">
          {node.details!.map((d, i) => (
            <li key={i} className="font-mono">
              {d}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function NodeIcon({ status }: { status: TimelineNode['status'] }) {
  switch (status) {
    case 'done':
      return (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[oklch(0.55_0.14_150)] text-white">
          <Check className="h-2.5 w-2.5" aria-hidden />
        </span>
      )
    case 'running':
      return (
        <span className="relative flex h-4 w-4 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-[var(--primary)] motion-safe:animate-pulse"
          />
          <Loader2 className="h-2.5 w-2.5 text-[var(--primary)] motion-safe:animate-spin" aria-hidden />
        </span>
      )
    case 'failed':
      return (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--destructive)] text-white">
          <X className="h-2.5 w-2.5" aria-hidden />
        </span>
      )
    case 'skipped':
      return (
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-muted-foreground">
          <Minus className="h-2.5 w-2.5" aria-hidden />
        </span>
      )
    case 'pending':
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
  }
}
