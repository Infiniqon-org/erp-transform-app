"use client"

/**
 * job-status-badge.tsx — single-line status pill for AugmentationJob.
 * Backend statuses: PENDING / RUNNING / SUCCEEDED / FAILED / CANCELLED, plus
 * UI-only PARTIAL surfaced when backend returns SUCCEEDED with failed shards.
 */

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Check,
  Clock,
  Loader2,
  Sparkles,
  TriangleAlert,
  XCircle,
} from "lucide-react"
import type { AugmentationJobStatus } from "@/lib/types/augmentation"

const PALETTE: Record<
  AugmentationJobStatus | "PARTIAL",
  { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: "Queued",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    Icon: Clock,
  },
  RUNNING: {
    label: "Running",
    cls: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    Icon: Loader2,
  },
  SUCCEEDED: {
    label: "Succeeded",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    Icon: Check,
  },
  FAILED: {
    label: "Failed",
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    Icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
    Icon: XCircle,
  },
  PARTIAL: {
    label: "Partial",
    cls: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    Icon: TriangleAlert,
  },
}

export function JobStatusBadge({
  status,
  partial,
  className,
}: {
  status: AugmentationJobStatus
  partial?: boolean
  className?: string
}) {
  const key = partial && status === "SUCCEEDED" ? "PARTIAL" : status
  const cfg = PALETTE[key] ?? PALETTE.PENDING
  const Icon = cfg.Icon
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 border font-medium",
        cfg.cls,
        className,
      )}
    >
      <Icon
        className={cn("h-3 w-3", status === "RUNNING" && "animate-spin")}
        aria-hidden
      />
      {cfg.label}
    </Badge>
  )
}

export function ScenarioBadge({
  scenario,
  className,
}: {
  scenario?: string | null
  className?: string
}) {
  if (!scenario) return null
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 border-violet-500/30 bg-violet-500/10 font-mono text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" />
      Scenario {scenario}
    </Badge>
  )
}
