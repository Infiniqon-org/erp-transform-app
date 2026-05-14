"use client"

/**
 * CardinalityChip.tsx
 *
 * Hex.tech-flavored 24 px-tall mono pill rendering 1→1 / N→1 / N→K. Pulses on
 * inferred-value change (cardinality-pulse motion, 220 ms soft-pop), click to
 * override the auto-detected value.
 *
 * Visual language: mono type (load-bearing per design spec §6), 1 px hairline
 * border, semantic accent per cardinality bucket. NO sparkles / wand / "AI"
 * iconography — the chip IS the affordance.
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Lock } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CARDINALITY_VALUES, type Cardinality } from "@/lib/types/augmentation"

const LABELS: Record<Cardinality, string> = {
  ONE_TO_MANY: "1 → N",
  MANY_TO_ONE: "N → 1",
  MANY_TO_MANY: "N → K",
}
const DESCRIPTIONS: Record<Cardinality, string> = {
  ONE_TO_MANY: "One input row expanded into many output rows.",
  MANY_TO_ONE: "Many input rows folded into one output row.",
  MANY_TO_MANY: "Arbitrary fan-out (may produce zero or many outputs per row).",
}
// Inline style values — spec §5 tokens aren't in globals.css yet; once they
// land we'll switch to var(--aug-…). Until then, literal values stay legal.
const TINT: Record<Cardinality, { fg: string; bg: string; border: string }> = {
  ONE_TO_MANY: {
    fg: "oklch(0.45 0.14 150)",
    bg: "color-mix(in oklab, oklch(0.45 0.14 150) 10%, transparent)",
    border: "color-mix(in oklab, oklch(0.45 0.14 150) 35%, transparent)",
  },
  MANY_TO_ONE: {
    fg: "#0cbeb6",
    bg: "color-mix(in oklab, #0cbeb6 12%, transparent)",
    border: "color-mix(in oklab, #0cbeb6 40%, transparent)",
  },
  MANY_TO_MANY: {
    fg: "oklch(0.55 0.18 290)",
    bg: "color-mix(in oklab, oklch(0.55 0.18 290) 12%, transparent)",
    border: "color-mix(in oklab, oklch(0.55 0.18 290) 40%, transparent)",
  },
}

export interface CardinalityChipProps {
  value: Cardinality
  inferred?: Cardinality
  confidence?: number
  isManualOverride?: boolean
  onChange?: (value: Cardinality | null) => void
  /** When true the chip is non-interactive (used inside read-only previews). */
  readOnly?: boolean
  className?: string
}

export function CardinalityChip({
  value,
  inferred,
  confidence = 1,
  isManualOverride = false,
  onChange,
  readOnly = false,
  className,
}: CardinalityChipProps) {
  const tint = TINT[value]
  const isAuto = !isManualOverride
  const muted = isAuto && confidence < 0.6

  const chipBody = (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ scale: 1, opacity: 0.6 }}
        animate={{ scale: [1, 1.06, 1], opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.22,
          ease: [0.16, 1, 0.3, 1],
          times: [0, 0.55, 1],
        }}
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 font-mono text-xs font-medium",
          "transition-colors",
          muted && "opacity-65",
          readOnly && "cursor-default",
          !readOnly && "cursor-pointer hover:brightness-105"
        )}
        style={{
          color: tint.fg,
          backgroundColor: tint.bg,
          borderColor: tint.border,
        }}
      >
        <span className="tabular-nums">{LABELS[value]}</span>
        <span
          className={cn(
            "font-sans text-[10px] uppercase tracking-wider",
            muted ? "text-muted-foreground" : "opacity-70"
          )}
        >
          {isManualOverride ? (
            <span className="inline-flex items-center gap-0.5">
              <Lock className="h-2.5 w-2.5" /> set
            </span>
          ) : (
            "auto"
          )}
        </span>
        {!readOnly && <ChevronDown className="h-3 w-3 opacity-60" />}
      </motion.span>
    </AnimatePresence>
  )

  if (readOnly || !onChange) {
    return (
      <span className={cn("inline-flex", className)} title={DESCRIPTIONS[value]}>
        {chipBody}
      </span>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        asChild
        aria-label={`Cardinality: ${LABELS[value]} — click to override`}
      >
        <button type="button" className={cn("inline-flex outline-none", className)}>
          {chipBody}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Override cardinality
        </div>
        {CARDINALITY_VALUES.map((c) => {
          const isCurrent = c === value
          const isInferred = inferred === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                isCurrent && "bg-accent/60"
              )}
            >
              <span
                className="mt-0.5 inline-flex h-5 items-center rounded font-mono text-[11px]"
                style={{ color: TINT[c].fg }}
              >
                {LABELS[c]}
              </span>
              <span className="flex-1">
                <span className="block text-sm">{DESCRIPTIONS[c]}</span>
                {isInferred && (
                  <span className="block text-[11px] text-muted-foreground">
                    auto-detected
                  </span>
                )}
              </span>
            </button>
          )
        })}
        {isManualOverride && (
          <>
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
            >
              Reset to auto-detected ({inferred ? LABELS[inferred] : "—"})
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
