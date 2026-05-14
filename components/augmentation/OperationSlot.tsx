"use client"

/**
 * OperationSlot.tsx — type-aware drop target for the DragDropRuleBuilder
 * right pane. Accepts columns via HTML5 DnD via useDropOperation. Renders
 * placed columns as a stacked pill list. On a type-mismatched drop, fires
 * the spec's slot-shake-invalid motion (180 ms ±4 px translate-x, paired
 * with a red 1 px border flash).
 *
 * Slots are deliberately dumb: parents own the data + acceptance rules.
 * This file only renders state + emits onAccept / onRemove.
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Workflow,
  Sigma,
  ArrowDownUp,
  Filter,
  Variable,
  LayoutList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useDropOperation,
  type ColumnDType,
  type ColumnRole,
} from "./hooks/useDnDColumns"
import { ColumnTile } from "./ColumnTile"
import type { DraggableColumn } from "./hooks/useDnDColumns"

// ─── Slot taxonomy ────────────────────────────────────────────────────────────

export type SlotKey =
  | "group_by"
  | "aggregate"
  | "sort_by"
  | "filter"
  | "cardinality"
  | "output_schema"

export interface SlotConfig {
  key: SlotKey
  label: string
  hint: string
  /** Allowed dtypes; "any" disables type-gating. */
  accepts: ColumnDType[] | "any"
  icon: React.ComponentType<{ className?: string }>
}

export const SLOT_CONFIGS: Record<SlotKey, SlotConfig> = {
  group_by: {
    key: "group_by",
    label: "GROUP BY",
    hint: "drop a key, dim, or date column",
    accepts: ["Utf8", "Int32", "Int64", "Date", "Datetime", "Boolean"],
    icon: Workflow,
  },
  aggregate: {
    key: "aggregate",
    label: "AGGREGATE",
    hint: "drop a measure (sum/last/count/min/max/first)",
    accepts: ["Int32", "Int64", "Float64", "Decimal"],
    icon: Sigma,
  },
  sort_by: {
    key: "sort_by",
    label: "SORT BY",
    hint: "drop any column to order the output",
    accepts: "any",
    icon: ArrowDownUp,
  },
  filter: {
    key: "filter",
    label: "FILTER",
    hint: "drop a column to add a where-clause",
    accepts: "any",
    icon: Filter,
  },
  cardinality: {
    key: "cardinality",
    label: "OUTPUT CARDINALITY",
    hint: "derived from operations above",
    accepts: [],
    icon: Variable,
  },
  output_schema: {
    key: "output_schema",
    label: "OUTPUT SCHEMA",
    hint: "preview of columns that will be produced",
    accepts: [],
    icon: LayoutList,
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface OperationSlotProps {
  config: SlotConfig
  /** Columns already placed in this slot (rendered as pills). Only used for input slots. */
  placed?: DraggableColumn[]
  /** Optional child override — for derived slots (cardinality, output_schema). */
  children?: React.ReactNode
  /** Called when a valid drop lands. Ignored if `readOnly`. */
  onAccept?: (payload: {
    columnName: string
    columnType: ColumnDType
    role: ColumnRole
  }) => void
  onRemove?: (columnName: string) => void
  /** Renders as a non-drop derivation panel (no dashed border, no DnD hooks). */
  readOnly?: boolean
}

export function OperationSlot({
  config,
  placed = [],
  children,
  onAccept,
  onRemove,
  readOnly = false,
}: OperationSlotProps) {
  // Read-only slots (cardinality, output_schema) skip the DnD hook entirely.
  const { dropProps, state } = useDropOperation(
    readOnly ? [] : config.accepts,
    (p) => onAccept?.(p),
  )

  const isAccepting = !readOnly && state.isOver && !state.isInvalid
  const isRejecting = !readOnly && state.isInvalid

  // slot-shake-invalid motion — fires on each rejectTick increment.
  const shakeControls = state.rejectTick

  const Icon = config.icon

  return (
    <motion.div
      {...(readOnly ? {} : dropProps)}
      key={shakeControls}
      animate={
        isRejecting
          ? { x: [0, -4, 4, -4, 4, 0] }
          : { x: 0 }
      }
      transition={{ duration: 0.18, ease: [0.36, 0.07, 0.19, 0.97] }}
      className={cn(
        "group relative rounded-md p-2.5 transition-colors",
        readOnly
          ? "border border-border bg-muted/30"
          : "border-2 border-dashed bg-card",
        !readOnly && !isAccepting && !isRejecting && "border-border/70 hover:border-border",
        isAccepting && "border-teal-500/70 bg-teal-50/40 dark:bg-teal-950/20 shadow-[0_0_0_2px_color-mix(in_oklab,theme(colors.teal.400)_60%,transparent)]",
        isRejecting && "border-destructive/80",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            {config.label}
          </span>
        </div>
        {!readOnly && placed.length > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {placed.length}
          </span>
        )}
      </div>

      {/* Body */}
      {children ? (
        children
      ) : placed.length === 0 ? (
        <p className="font-mono text-[11px] text-muted-foreground/70 italic">
          {config.hint}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {placed.map((col) => (
              <motion.div
                key={col.name}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <ColumnTile
                  column={col}
                  variant="pill"
                  onRemove={() => onRemove?.(col.name)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
