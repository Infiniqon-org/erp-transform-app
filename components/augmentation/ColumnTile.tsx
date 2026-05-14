"use client"

/**
 * ColumnTile.tsx — draggable 32 px column chip for the DragDropRuleBuilder
 * left rail. Type icon + name + inferred-role badge. Hover surfaces sample
 * values via Tooltip. Uses framer-motion for the drag-origin micro-bounce
 * (NOT for the drop landing — that's owned by OperationSlot).
 *
 * Drag transport: HTML5 native via useDragColumn — see hooks/useDnDColumns.ts.
 */

import * as React from "react"
import { motion } from "framer-motion"
import {
  GripVertical,
  Hash,
  Type as TypeIcon,
  Calendar,
  DollarSign,
  ToggleLeft,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useDragColumn,
  type ColumnDType,
  type ColumnRole,
  type DraggableColumn,
} from "./hooks/useDnDColumns"

// ─── Icon + role-tint maps ────────────────────────────────────────────────────

function dtypeIcon(t: ColumnDType) {
  switch (t) {
    case "Int32":
    case "Int64":
    case "Float64":
      return Hash
    case "Decimal":
      return DollarSign
    case "Date":
    case "Datetime":
      return Calendar
    case "Boolean":
      return ToggleLeft
    case "Utf8":
      return TypeIcon
    default:
      return HelpCircle
  }
}

/**
 * Role tint — maps to the design spec's --aug-* tokens. Since we cannot
 * modify globals.css, we inline the equivalent OKLCH values (light theme)
 * with Tailwind's text-* utility shorthand for muted state.
 */
function roleTint(role: ColumnRole): {
  border: string
  textIcon: string
  bg: string
} {
  switch (role) {
    case "key":
      // warm amber — chart-5 cousin
      return {
        border: "border-amber-400/60",
        textIcon: "text-amber-700 dark:text-amber-400",
        bg: "bg-amber-50/40 dark:bg-amber-950/20",
      }
    case "measure":
      // teal accent
      return {
        border: "border-teal-400/60",
        textIcon: "text-teal-700 dark:text-teal-400",
        bg: "bg-teal-50/40 dark:bg-teal-950/20",
      }
    case "date":
      return {
        border: "border-violet-400/50",
        textIcon: "text-violet-700 dark:text-violet-400",
        bg: "bg-violet-50/40 dark:bg-violet-950/20",
      }
    case "dim":
    default:
      return {
        border: "border-border",
        textIcon: "text-muted-foreground",
        bg: "bg-card",
      }
  }
}

const ROLE_LABEL: Record<ColumnRole, string> = {
  key: "KEY",
  measure: "MEAS",
  date: "DATE",
  dim: "DIM",
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ColumnTileProps {
  column: DraggableColumn
  /** Visual compact mode — used inside an OperationSlot pill stack. */
  variant?: "rail" | "pill"
  onRemove?: () => void
}

export function ColumnTile({
  column,
  variant = "rail",
  onRemove,
}: ColumnTileProps) {
  const { isDragging, dragProps } = useDragColumn(column)
  const Icon = dtypeIcon(column.dtype)
  const tint = roleTint(column.role)

  const sampleText =
    column.samples && column.samples.length > 0
      ? column.samples.slice(0, 5).map((s) => (s === null ? "∅" : String(s))).join(", ")
      : "no samples"

  const body = (
    <motion.div
      {...dragProps}
      whileTap={{ scale: 0.97 }}
      animate={{
        opacity: isDragging ? 0.45 : 1,
        scale: isDragging ? 0.98 : 1,
      }}
      transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "group flex items-center gap-2 select-none cursor-grab active:cursor-grabbing",
        "border rounded-md transition-colors",
        tint.border,
        tint.bg,
        variant === "rail"
          ? "h-8 px-2 text-[13px]"
          : "h-7 px-1.5 text-[12px]",
      )}
      role="button"
      aria-label={`Drag column ${column.name}`}
    >
      {variant === "rail" && (
        <GripVertical
          aria-hidden
          className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-muted-foreground"
        />
      )}
      <Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", tint.textIcon)} />
      <span className="font-mono truncate flex-1 min-w-0" title={column.name}>
        {column.name}
      </span>
      {variant === "rail" && (
        <span
          className={cn(
            "font-mono text-[10px] tracking-wider uppercase px-1 rounded-sm",
            "bg-muted/60 text-muted-foreground",
          )}
        >
          {ROLE_LABEL[column.role]}
        </span>
      )}
      {variant === "pill" && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors text-[11px] leading-none"
          aria-label={`Remove ${column.name}`}
        >
          ×
        </button>
      )}
    </motion.div>
  )

  if (variant === "pill") return body

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{body}</TooltipTrigger>
        <TooltipContent side="right" className="font-mono text-[11px] max-w-xs">
          <div className="space-y-0.5">
            <div className="text-muted-foreground">
              {column.dtype} · {ROLE_LABEL[column.role]}
            </div>
            <div className="truncate">samples: {sampleText}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
