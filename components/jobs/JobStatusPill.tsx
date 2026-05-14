'use client'

/**
 * JobStatusPill — dignified status pill for a JobRun.
 *
 * Spec §B2 (Status pills — dignified):
 *   - queued / cancelled → outline pill, muted-foreground
 *   - running           → filled accent pill, accent dot pulses at 1.4s
 *                          (motion on the DOT, never the pill itself)
 *   - succeeded         → filled muted-green pill, Check icon, NO motion
 *   - failed            → filled destructive pill, X icon, NO shake
 *   - partial           → filled amber pill, AlertTriangle icon
 *   - cancelled         → outline pill, Minus icon
 *
 * No spinner, no progress %, no rainbow. Pulse honours
 * `prefers-reduced-motion` (renders a static dot if the user opts out).
 *
 * Maps RunStatus (canonical BE enum) → the six visual variants above:
 *   RUNNING                    → running
 *   SUCCESS / NO_CHANGES       → succeeded
 *   FAILED                     → failed
 *   PARTIAL / AWAITING_REVIEW  → partial
 *   SKIPPED                    → cancelled
 *   (unknown / undefined)      → queued
 */

import {
  AlertTriangle,
  Check,
  Clock,
  Minus,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { RunStatus } from '@/lib/types/jobs'

export type PillVariant =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'partial'
  | 'cancelled'

export function pillVariantFromRunStatus(status: RunStatus | string | undefined | null): PillVariant {
  switch ((status ?? '').toString().toUpperCase()) {
    case 'RUNNING':
      return 'running'
    case 'SUCCESS':
    case 'NO_CHANGES':
      return 'succeeded'
    case 'FAILED':
      return 'failed'
    case 'PARTIAL':
    case 'AWAITING_REVIEW':
      return 'partial'
    case 'SKIPPED':
      return 'cancelled'
    default:
      return 'queued'
  }
}

interface JobStatusPillProps {
  status: RunStatus | string | undefined | null
  /** Override the rendered label (default: status lowercased). */
  label?: string
  /** Compact mode (12 px dot only — used for super-dense rows). */
  compact?: boolean
  className?: string
}

const LABELS: Record<PillVariant, string> = {
  queued: 'queued',
  running: 'running',
  succeeded: 'succeeded',
  failed: 'failed',
  partial: 'partial',
  cancelled: 'cancelled',
}

export function JobStatusPill({ status, label, compact = false, className }: JobStatusPillProps) {
  const variant = pillVariantFromRunStatus(status)
  const text = label ?? LABELS[variant]
  const Icon =
    variant === 'succeeded'
      ? Check
      : variant === 'failed'
      ? X
      : variant === 'partial'
      ? AlertTriangle
      : variant === 'cancelled'
      ? Minus
      : variant === 'queued'
      ? Clock
      : null // running uses a pulsing dot, not an icon

  // Per-variant styling — all colors sourced from globals.css tokens.
  // No new hex; `color-mix` derives the tinted backgrounds.
  const styles: Record<PillVariant, string> = {
    queued:
      'border border-[var(--border)] text-[var(--muted-foreground)] bg-transparent',
    running:
      'border border-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] text-[var(--accent)] bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]',
    succeeded:
      'border border-[color:color-mix(in_oklab,oklch(0.55_0.14_150)_45%,transparent)] text-[oklch(0.45_0.14_150)] bg-[color:color-mix(in_oklab,oklch(0.55_0.14_150)_10%,transparent)]',
    failed:
      'border border-[color:color-mix(in_oklab,var(--destructive)_45%,transparent)] text-[var(--destructive)] bg-[color:color-mix(in_oklab,var(--destructive)_10%,transparent)]',
    partial:
      'border border-[color:color-mix(in_oklab,oklch(0.65_0.14_75)_45%,transparent)] text-[oklch(0.45_0.14_75)] bg-[color:color-mix(in_oklab,oklch(0.65_0.14_75)_12%,transparent)]',
    cancelled:
      'border border-[var(--border)] text-[var(--muted-foreground)] bg-transparent',
  }

  return (
    <span
      role="status"
      aria-label={`job status: ${LABELS[variant]}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[11px] font-medium leading-none whitespace-nowrap',
        styles[variant],
        compact && 'px-1.5 py-1',
        className
      )}
    >
      {variant === 'running' ? <RunningDot /> : Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {!compact && <span>{text}</span>}
    </span>
  )
}

/**
 * Pulsing dot for the `running` variant.
 *
 * Motion is on the dot only (per spec §B2). Pulse is 1.4 s ease-in-out
 * looped, opacity 0.5 ↔ 1, via Tailwind's `motion-safe` modifier so users
 * with `prefers-reduced-motion: reduce` see a static dot.
 */
function RunningDot() {
  return (
    <span
      aria-hidden
      className="relative inline-flex h-2 w-2 items-center justify-center"
    >
      <span
        className={cn(
          'block h-2 w-2 rounded-full bg-current',
          'motion-safe:animate-[jobs-running-pulse_1400ms_ease-in-out_infinite]'
        )}
        style={{
          // Inline keyframes via CSS var so we don't pollute globals.css.
          // tailwindcss-jit picks up the arbitrary animation; the @keyframes
          // is declared once via a <style> tag below.
        }}
      />
      <PulseKeyframes />
    </span>
  )
}

/**
 * Inline keyframes — declared once. Tailwind's arbitrary `animate-[…]`
 * works fine but the keyframe block has to live somewhere; injecting it
 * here keeps the pill self-contained and avoids editing globals.css.
 */
function PulseKeyframes() {
  return (
    <style jsx global>{`
      @keyframes jobs-running-pulse {
        0%,
        100% {
          opacity: 0.5;
        }
        50% {
          opacity: 1;
        }
      }
    `}</style>
  )
}
