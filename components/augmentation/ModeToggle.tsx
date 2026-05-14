"use client"

/**
 * ModeToggle.tsx
 *
 * Two-segment Prose ↔ Builder switch at the top of the configuration card.
 * Per spec §10(a) v1 decision: **disable** Prose → Builder when the prompt
 * contains free-form imperatives that cannot be parsed into structured slots.
 * Tooltip explains why; no silent drift.
 *
 * No icons in the segments themselves — labels are mono uppercase to match the
 * Linear / Causal density tone.
 */

import * as React from "react"
import { motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type EditorMode = "prose" | "builder"

export interface ModeToggleProps {
  value: EditorMode
  onChange: (mode: EditorMode) => void
  /** Set true when prose-mode content cannot be losslessly converted. */
  proseToBuilderLossy?: boolean
  /** Optional reason shown in the disabled-tooltip body. */
  lossyReason?: string
  className?: string
}

const SEGMENTS: { value: EditorMode; label: string }[] = [
  { value: "prose", label: "Prose" },
  { value: "builder", label: "Builder" },
]

export function ModeToggle({
  value,
  onChange,
  proseToBuilderLossy = false,
  lossyReason,
  className,
}: ModeToggleProps) {
  const disabledTooltip =
    lossyReason ??
    "This prompt uses free-form instructions that the structured builder cannot represent."

  return (
    <TooltipProvider delayDuration={200}>
      <div
        role="tablist"
        aria-label="Editor mode"
        className={cn(
          "relative inline-flex h-8 items-center gap-0.5 rounded-md border bg-muted/40 p-0.5",
          className
        )}
      >
        {SEGMENTS.map((seg) => {
          const isActive = value === seg.value
          const isDisabled = seg.value === "builder" && proseToBuilderLossy && value === "prose"
          const button = (
            <button
              key={seg.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(seg.value)}
              className={cn(
                "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-[5px] px-3",
                "font-mono text-[11px] font-semibold uppercase tracking-wider",
                "transition-colors duration-150",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                isDisabled && "cursor-not-allowed opacity-50"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="mode-toggle-bg"
                  className="absolute inset-0 -z-10 rounded-[5px] bg-background shadow-sm ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              {seg.label}
              {isDisabled && <AlertTriangle className="h-3 w-3" />}
            </button>
          )
          if (!isDisabled) return button
          return (
            <Tooltip key={seg.value}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {disabledTooltip}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
