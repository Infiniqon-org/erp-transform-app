"use client"

/**
 * scenario-cards.tsx — RightRev scenario picker (A / B / C).
 *
 * 3 horizontally-arranged cards with distinctive gradient surfaces, a
 * cardinality badge, and a short subtitle. Mirrors the visual register used
 * by the ERP transformation modal (gradient-on-selection) and the DQ matrix
 * viewer (ring/glow on the active card). Fully a11y — radio semantics.
 */

import * as React from "react"
import { ArrowRight, GitMerge, Layers, Sigma } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { SCENARIO_LIST, type ScenarioId, type ScenarioDef } from "./scenarios"

const ICONS: Record<ScenarioId, React.ComponentType<{ className?: string }>> = {
  A: Layers,
  B: Sigma,
  C: GitMerge,
}

const ACCENT_RING: Record<ScenarioDef["accent"], string> = {
  violet: "ring-violet-500/60 dark:ring-violet-400/60",
  emerald: "ring-emerald-500/60 dark:ring-emerald-400/60",
  amber: "ring-amber-500/60 dark:ring-amber-400/60",
}

const ACCENT_BADGE: Record<ScenarioDef["accent"], string> = {
  violet:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  emerald:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
}

interface ScenarioCardsProps {
  value: ScenarioId | null
  onChange: (id: ScenarioId) => void
  disabled?: boolean
}

export function ScenarioCards({ value, onChange, disabled }: ScenarioCardsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Augmentation scenario"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {SCENARIO_LIST.map((s) => {
        const Icon = ICONS[s.id]
        const selected = value === s.id
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Scenario ${s.id}: ${s.title}`}
            disabled={disabled}
            onClick={() => onChange(s.id)}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all",
              "hover:border-foreground/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? cn("border-transparent shadow-md ring-2", ACCENT_RING[s.accent])
                : "border-border",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {/* Gradient wash */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70 transition-opacity",
                s.gradient,
                selected ? "opacity-100" : "opacity-50 group-hover:opacity-80",
              )}
            />
            {/* Decorative corner glyph */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rotate-12 rounded-full bg-foreground/[0.04] blur-2xl"
            />

            <div className="relative flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border bg-background/70 backdrop-blur",
                      ACCENT_BADGE[s.accent],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("border font-mono text-[10px] uppercase tracking-wider", ACCENT_BADGE[s.accent])}
                  >
                    {s.cardinality.replace(/_/g, " → ")}
                  </Badge>
                </div>
                <span
                  aria-hidden
                  className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Scenario {s.id}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
                  {s.title}
                  <ArrowRight
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      selected ? "translate-x-0.5 opacity-100" : "opacity-40",
                    )}
                  />
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {s.subtitle}
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
