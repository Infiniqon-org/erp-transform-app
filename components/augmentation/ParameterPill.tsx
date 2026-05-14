"use client"

/**
 * ParameterPill.tsx
 *
 * Inline `{{column}}` / `{param:value}` pill used inside the prose editor and
 * in the read-only generated-prompt preview. Hosts:
 *   • a type icon (numeric / text / date / currency / param)
 *   • the column or parameter name in mono
 *   • a hover preview of a sample value when one is supplied
 *   • drag handle (HTML5 DnD, per spec §11 — no dnd-kit)
 *
 * Pill semantics differ by kind:
 *   kind="column" — `{{name}}`     teal/accent ink, draggable
 *   kind="param"  — `{name:value}` violet ink, click-to-edit (caller wires)
 *
 * Per spec §9: no sparkles, no wand. Lucide icons restricted to
 * Hash/Type/Calendar/DollarSign/Variable.
 */

import * as React from "react"
import { motion } from "framer-motion"
import { Calendar, DollarSign, Hash, Type, Variable, X } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type PillType = "numeric" | "text" | "date" | "currency" | "param" | "unknown"

const ICONS: Record<PillType, React.ComponentType<{ className?: string }>> = {
  numeric: Hash,
  text: Type,
  date: Calendar,
  currency: DollarSign,
  param: Variable,
  unknown: Type,
}

// Inline-style tints; will flip to var(--aug-*) once the spec tokens land.
const TINTS: Record<
  PillType,
  { fg: string; bg: string; border: string }
> = {
  numeric: {
    fg: "#0cbeb6",
    bg: "color-mix(in oklab, #0cbeb6 12%, transparent)",
    border: "color-mix(in oklab, #0cbeb6 35%, transparent)",
  },
  currency: {
    fg: "#0cbeb6",
    bg: "color-mix(in oklab, #0cbeb6 12%, transparent)",
    border: "color-mix(in oklab, #0cbeb6 35%, transparent)",
  },
  text: {
    fg: "#2a4477",
    bg: "color-mix(in oklab, #2a4477 10%, transparent)",
    border: "color-mix(in oklab, #2a4477 30%, transparent)",
  },
  date: {
    fg: "oklch(0.6 0.14 30)",
    bg: "color-mix(in oklab, oklch(0.6 0.14 30) 12%, transparent)",
    border: "color-mix(in oklab, oklch(0.6 0.14 30) 35%, transparent)",
  },
  param: {
    fg: "oklch(0.55 0.18 290)",
    bg: "color-mix(in oklab, oklch(0.55 0.18 290) 12%, transparent)",
    border: "color-mix(in oklab, oklch(0.55 0.18 290) 35%, transparent)",
  },
  unknown: {
    fg: "var(--destructive)",
    bg: "color-mix(in oklab, var(--destructive) 10%, transparent)",
    border: "color-mix(in oklab, var(--destructive) 40%, transparent)",
  },
}

export interface ParameterPillProps {
  kind: "column" | "param"
  name: string
  /** For params: the bound value, e.g. "FY26"; for columns: optional sample value. */
  value?: string
  type?: PillType
  /** Set true when the column is referenced but missing from the schema. */
  invalid?: boolean
  draggable?: boolean
  onRemove?: () => void
  onEdit?: () => void
  onDragStart?: (e: React.DragEvent<HTMLSpanElement>) => void
  tabIndex?: number
  className?: string
}

export const ParameterPill = React.forwardRef<HTMLSpanElement, ParameterPillProps>(
  function ParameterPill(props, ref) {
    const {
      kind,
      name,
      value,
      type,
      invalid = false,
      draggable = true,
      onRemove,
      onEdit,
      onDragStart,
      tabIndex = 0,
      className,
    } = props
    const resolvedType: PillType = invalid ? "unknown" : type ?? (kind === "param" ? "param" : "text")
    const Icon = ICONS[resolvedType]
    const tint = TINTS[resolvedType]
    const label = kind === "column" ? `{{${name}}}` : `{${name}:${value ?? ""}}`
    const tooltip =
      invalid
        ? `Unknown column "${name}" — not in current schema`
        : kind === "column"
          ? value
            ? `Sample value: ${value}`
            : `Column "${name}"`
          : `Parameter "${name}" = ${value ?? ""}`

    const handleDragStart = (e: React.DragEvent<HTMLSpanElement>) => {
      if (!draggable) return
      // Spec §11 — HTML5 DnD only. Payload shape matches DragDropRuleBuilder.
      const payload = JSON.stringify({ kind, name, type: resolvedType, value })
      e.dataTransfer.setData("application/x-augmentation-pill", payload)
      e.dataTransfer.setData("text/plain", label)
      e.dataTransfer.effectAllowed = "copyMove"
      onDragStart?.(e)
    }
    // framer-motion's `motion.span` types `onDragStart` as a pan-gesture handler
    // (PointerEvent + PanInfo). We want the native HTML5 DnD signature; spread
    // it via a Record<string, unknown> escape so TS doesn't try to widen the
    // motion prop into the gesture form.
    const dragStartProp: Record<string, unknown> = {
      onDragStart: handleDragStart,
    }

    return (
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.span
              ref={ref}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
              draggable={draggable}
              {...dragStartProp}
              onClick={kind === "param" ? onEdit : undefined}
              role={kind === "param" ? "button" : undefined}
              tabIndex={tabIndex}
              data-pill-kind={kind}
              data-pill-name={name}
              className={cn(
                "mx-0.5 inline-flex h-6 select-none items-center gap-1 rounded-md border px-1.5 align-baseline font-mono text-[12px] font-medium leading-none",
                draggable && "cursor-grab active:cursor-grabbing",
                kind === "param" && "cursor-text",
                invalid && "ring-1 ring-destructive/40",
                className
              )}
              style={{
                color: tint.fg,
                backgroundColor: tint.bg,
                borderColor: tint.border,
              }}
            >
              <Icon className="h-3 w-3 opacity-80" />
              <span className="whitespace-nowrap">
                {kind === "column" ? (
                  <>
                    <span className="opacity-60">{"{{"}</span>
                    {name}
                    <span className="opacity-60">{"}}"}</span>
                  </>
                ) : (
                  <>
                    <span className="opacity-60">{"{"}</span>
                    {name}
                    <span className="opacity-60">:</span>
                    <span>{value ?? ""}</span>
                    <span className="opacity-60">{"}"}</span>
                  </>
                )}
              </span>
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove()
                  }}
                  className="ml-0.5 inline-flex h-3 w-3 items-center justify-center rounded-sm opacity-50 hover:opacity-100"
                  aria-label={`Remove ${label}`}
                  tabIndex={-1}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </motion.span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs font-mono text-[11px]">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
)
