"use client"

/**
 * DragDropRuleBuilder.tsx — the Builder-mode surface inside the Augmentation
 * step of the upload wizard.
 *
 * Two-pane layout:
 *
 *   ┌─ Source columns (left) ──┐  ┌─ Operations track (right) ─────────────┐
 *   │  filter:  ____           │  │  GROUP BY  [ pill pill ]                │
 *   │  ── keys ──              │  │  AGGREGATE [ pill (sum▾) pill (last▾) ] │
 *   │  ▦ contract_id    KEY    │  │  SORT BY   [ pill (asc▾) ]              │
 *   │  ── measures ──          │  │  FILTER    [ col op value × ]           │
 *   │  ▦ invoice_amount #      │  │  CARDINALITY  ⟨ N → 1 ⟩ (read-only)     │
 *   │  ▦ deferred_balance $    │  │  OUTPUT SCHEMA  monthly_summary[…]      │
 *   │  ── dates ──             │  └────────────────────────────────────────┘
 *   │  ▦ invoice_date  📅      │
 *   │  ── dimensions ──        │
 *   │  ▦ region        Aa      │
 *   └──────────────────────────┘
 *
 *   ┌─ Generated prompt preview (bottom strip, full width) ─────────────────┐
 *   │  📄  Fold by contract_id, computing sum(invoice_amount) as …          │
 *   │  ƒ   df.group_by(["contract_id"]).agg([pl.col("invoice_amount").…])   │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 * Toolbar (top): "Preview output (50 rows)" CTA · cardinality chip ·
 * "Switch to Prose mode" callback (parent-owned).
 *
 * Type-aware drops + slot-shake-invalid + pill-drop motion are owned by
 * OperationSlot. This component is the glue: it holds the plan reducer,
 * routes drops into the right slot, and renders the toolbar + bottom strip.
 */

import * as React from "react"
import { Play, ArrowLeftRight, Search, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { ColumnTile } from "./ColumnTile"
import { OperationSlot, SLOT_CONFIGS } from "./OperationSlot"
import { GeneratedPromptPreview } from "./GeneratedPromptPreview"
import {
  usePlanBuilder,
  AGG_FNS,
  type Plan,
  type AggregateFn,
  type PlannedFilter,
} from "./hooks/usePlanBuilder"
import type {
  ColumnDType,
  ColumnRole,
  DraggableColumn,
} from "./hooks/useDnDColumns"
import type { Cardinality } from "@/lib/types/augmentation"

// ─── Cardinality chip ─────────────────────────────────────────────────────────

function cardinalityLabel(c: Cardinality): string {
  switch (c) {
    case "ONE_TO_MANY":
      return "1 → N"
    case "MANY_TO_ONE":
      return "N → 1"
    case "MANY_TO_MANY":
      return "N → K"
  }
}

function CardinalityInline({ cardinality }: { cardinality: Cardinality }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 h-6 rounded-md border",
        "font-mono text-[12px] font-medium",
        "border-border bg-muted/40 text-foreground",
      )}
      aria-label={`Output cardinality: ${cardinalityLabel(cardinality)}`}
    >
      {cardinalityLabel(cardinality)}
    </span>
  )
}

// ─── Left-pane grouping ───────────────────────────────────────────────────────

const ROLE_HEADERS: Array<{ key: ColumnRole; label: string }> = [
  { key: "key", label: "Keys" },
  { key: "measure", label: "Measures" },
  { key: "date", label: "Dates" },
  { key: "dim", label: "Dimensions" },
]

function groupColumnsByRole(cols: DraggableColumn[]): Record<ColumnRole, DraggableColumn[]> {
  const out: Record<ColumnRole, DraggableColumn[]> = {
    key: [],
    measure: [],
    date: [],
    dim: [],
  }
  for (const c of cols) out[c.role].push(c)
  return out
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DragDropRuleBuilderProps {
  /** Source columns inferred from the uploaded file's parquet schema. */
  columns: DraggableColumn[]
  /**
   * Called when the user clicks "Switch to Prose mode". The sibling
   * PromptTemplateEditor consumes this to translate the plan → prompt string
   * before flipping the ModeToggle. Plan + generated prompt are both passed
   * so the sibling can pick whichever it prefers as the seed.
   */
  onSwitchToProse?: (plan: Plan, prompt: string) => void
  /**
   * Called when the user clicks "Preview output (50 rows)". Parent is
   * responsible for invoking `createAugmentationJob` (or a preview-only
   * variant) and showing results. We do not touch the network here so the
   * component remains testable + reusable inside Storybook.
   */
  onPreview?: (plan: Plan, prompt: string) => void
  /** Disables the preview button (e.g. while a preview is already running). */
  previewLoading?: boolean
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DragDropRuleBuilder({
  columns,
  onSwitchToProse,
  onPreview,
  previewLoading = false,
  className,
}: DragDropRuleBuilderProps) {
  const { plan, dispatch, prompt, polarsExpression, cardinality, outputSchema } =
    usePlanBuilder()

  const [search, setSearch] = React.useState("")
  const [filterDraft, setFilterDraft] = React.useState<PlannedFilter | null>(null)

  // ── derived left-pane data ──
  const filteredColumns = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return columns
    return columns.filter((c) => c.name.toLowerCase().includes(q))
  }, [columns, search])

  const grouped = React.useMemo(
    () => groupColumnsByRole(filteredColumns),
    [filteredColumns],
  )

  // ── lookup map for re-hydrating placed columns from {name,type} payloads ──
  const colByName = React.useMemo(() => {
    const m = new Map<string, DraggableColumn>()
    for (const c of columns) m.set(c.name, c)
    return m
  }, [columns])

  // ── slot accept handlers ──
  const acceptInto =
    (slot: "group_by" | "aggregate" | "sort_by" | "filter") =>
    (p: { columnName: string; columnType: ColumnDType; role: ColumnRole }) => {
      switch (slot) {
        case "group_by":
          dispatch({
            type: "ADD_GROUP_BY",
            col: { columnName: p.columnName, columnType: p.columnType },
          })
          break
        case "aggregate":
          dispatch({
            type: "ADD_AGGREGATE",
            agg: {
              columnName: p.columnName,
              columnType: p.columnType,
              fn: p.columnType === "Decimal" || p.columnType.startsWith("Float") || p.columnType.startsWith("Int")
                ? "sum"
                : "count",
            },
          })
          break
        case "sort_by":
          dispatch({
            type: "ADD_SORT",
            sort: { columnName: p.columnName, direction: "asc" },
          })
          break
        case "filter":
          setFilterDraft({ columnName: p.columnName, op: "eq", value: "" })
          break
      }
    }

  const commitFilterDraft = () => {
    if (!filterDraft) return
    dispatch({ type: "ADD_FILTER", filter: filterDraft })
    setFilterDraft(null)
  }

  // ── placed-column resolution ──
  const placedGroupBy = plan.groupBy
    .map((c) => colByName.get(c.columnName))
    .filter((c): c is DraggableColumn => Boolean(c))

  const placedSortNames = new Set(plan.sortBy.map((s) => s.columnName))
  const placedSort = Array.from(placedSortNames)
    .map((n) => colByName.get(n))
    .filter((c): c is DraggableColumn => Boolean(c))

  // ── render ──
  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex flex-col gap-3", className)}>
        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Cardinality
            </span>
            <CardinalityInline cardinality={cardinality} />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSwitchToProse?.(plan, prompt)}
              className="h-8 gap-1.5"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Switch to Prose
            </Button>
            <Button
              size="sm"
              onClick={() => onPreview?.(plan, prompt)}
              disabled={previewLoading || (!prompt && !polarsExpression)}
              className="h-8 gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              {previewLoading ? "Previewing…" : "Preview output (50 rows)"}
            </Button>
          </div>
        </div>

        {/* ── Two-pane body ── */}
        <div className="grid grid-cols-[260px_1fr] gap-3 min-h-[420px]">
          {/* Left pane: columns */}
          <div className="flex flex-col rounded-md border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border/60">
              <h3 className="font-mono text-[11px] uppercase tracking-wider font-medium text-muted-foreground mb-2">
                Source columns
              </h3>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="filter…"
                  className="h-7 pl-7 font-mono text-[12px]"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">
                {filteredColumns.length === 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground px-2 py-3 text-[12px]">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {columns.length === 0
                      ? "No columns yet — upload a CSV."
                      : "No columns match."}
                  </div>
                )}
                {ROLE_HEADERS.map(({ key, label }) => {
                  const list = grouped[key]
                  if (list.length === 0) return null
                  return (
                    <div key={key} className="space-y-1">
                      <div className="px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {label}
                      </div>
                      <div className="space-y-1">
                        {list.map((c) => (
                          <ColumnTile key={c.name} column={c} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right pane: operations track */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {/* Group by */}
            <OperationSlot
              config={SLOT_CONFIGS.group_by}
              placed={placedGroupBy}
              onAccept={acceptInto("group_by")}
              onRemove={(name) =>
                dispatch({ type: "REMOVE_GROUP_BY", columnName: name })
              }
            />

            {/* Aggregate — slot with per-pill fn picker */}
            <OperationSlot
              config={SLOT_CONFIGS.aggregate}
              onAccept={acceptInto("aggregate")}
            >
              {plan.aggregates.length === 0 ? (
                <p className="font-mono text-[11px] text-muted-foreground/70 italic">
                  {SLOT_CONFIGS.aggregate.hint}
                </p>
              ) : (
                <ul className="space-y-1">
                  {plan.aggregates.map((a, i) => (
                    <li key={`${a.columnName}-${i}`} className="flex items-center gap-1.5">
                      <Select
                        value={a.fn}
                        onValueChange={(v) =>
                          dispatch({
                            type: "SET_AGG_FN",
                            index: i,
                            fn: v as AggregateFn,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-[88px] font-mono text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGG_FNS.map((fn) => (
                            <SelectItem key={fn} value={fn} className="font-mono text-[12px]">
                              {fn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="font-mono text-[12px] flex-1 truncate">
                        {a.columnName}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        → {a.fn === "count" ? "Int64" : a.columnType}
                      </span>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "REMOVE_AGGREGATE", index: i })}
                        className="text-muted-foreground hover:text-destructive transition-colors text-sm leading-none px-1"
                        aria-label={`Remove aggregate on ${a.columnName}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </OperationSlot>

            {/* Sort by */}
            <OperationSlot
              config={SLOT_CONFIGS.sort_by}
              placed={placedSort}
              onAccept={acceptInto("sort_by")}
              onRemove={(name) => {
                const idx = plan.sortBy.findIndex((s) => s.columnName === name)
                if (idx >= 0) dispatch({ type: "REMOVE_SORT", index: idx })
              }}
            >
              {plan.sortBy.length === 0 ? (
                <p className="font-mono text-[11px] text-muted-foreground/70 italic">
                  {SLOT_CONFIGS.sort_by.hint}
                </p>
              ) : (
                <ul className="space-y-1">
                  {plan.sortBy.map((s, i) => (
                    <li key={`${s.columnName}-${i}`} className="flex items-center gap-1.5">
                      <span className="font-mono text-[12px] flex-1 truncate">
                        {s.columnName}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "TOGGLE_SORT_DIR", index: i })}
                            className="font-mono text-[11px] px-1.5 h-6 rounded border border-border hover:bg-muted transition-colors uppercase tracking-wider"
                          >
                            {s.direction}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[11px]">
                          Toggle sort direction
                        </TooltipContent>
                      </Tooltip>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "REMOVE_SORT", index: i })}
                        className="text-muted-foreground hover:text-destructive transition-colors text-sm leading-none px-1"
                        aria-label={`Remove sort on ${s.columnName}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </OperationSlot>

            {/* Filter */}
            <OperationSlot
              config={SLOT_CONFIGS.filter}
              onAccept={acceptInto("filter")}
            >
              <div className="space-y-1">
                {plan.filters.map((f, i) => (
                  <div
                    key={`${f.columnName}-${i}`}
                    className="flex items-center gap-1.5"
                  >
                    <span className="font-mono text-[12px] flex-1 truncate">
                      {f.columnName}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {f.op}
                    </span>
                    <span className="font-mono text-[11px] truncate max-w-[100px]">
                      {f.value || "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "REMOVE_FILTER", index: i })}
                      className="text-muted-foreground hover:text-destructive transition-colors text-sm leading-none px-1"
                      aria-label={`Remove filter on ${f.columnName}`}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {filterDraft && (
                  <div className="flex items-center gap-1.5 p-1.5 rounded border border-border bg-muted/40">
                    <span className="font-mono text-[12px] flex-1 truncate">
                      {filterDraft.columnName}
                    </span>
                    <Select
                      value={filterDraft.op}
                      onValueChange={(v) =>
                        setFilterDraft({ ...filterDraft, op: v as PlannedFilter["op"] })
                      }
                    >
                      <SelectTrigger className="h-7 w-[80px] font-mono text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["eq", "neq", "gt", "lt", "gte", "lte", "contains"] as const).map(
                          (op) => (
                            <SelectItem key={op} value={op} className="font-mono text-[12px]">
                              {op}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <Input
                      autoFocus
                      value={filterDraft.value}
                      onChange={(e) =>
                        setFilterDraft({ ...filterDraft, value: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitFilterDraft()
                        if (e.key === "Escape") setFilterDraft(null)
                      }}
                      placeholder="value"
                      className="h-7 w-[120px] font-mono text-[12px]"
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={commitFilterDraft}
                      disabled={!filterDraft.value && filterDraft.op !== "eq"}
                    >
                      Add
                    </Button>
                    <button
                      type="button"
                      onClick={() => setFilterDraft(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm leading-none px-1"
                      aria-label="Cancel filter draft"
                    >
                      ×
                    </button>
                  </div>
                )}

                {plan.filters.length === 0 && !filterDraft && (
                  <p className="font-mono text-[11px] text-muted-foreground/70 italic">
                    {SLOT_CONFIGS.filter.hint}
                  </p>
                )}
              </div>
            </OperationSlot>

            {/* Cardinality (read-only) */}
            <OperationSlot config={SLOT_CONFIGS.cardinality} readOnly>
              <div className="flex items-center gap-2">
                <CardinalityInline cardinality={cardinality} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  derived from operations
                </span>
              </div>
            </OperationSlot>

            {/* Output schema preview (read-only) */}
            <OperationSlot config={SLOT_CONFIGS.output_schema} readOnly>
              {outputSchema.length === 0 ? (
                <p className="font-mono text-[11px] text-muted-foreground/70 italic">
                  Schema unchanged — output rows mirror input rows.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {outputSchema.map((c) => (
                    <Badge
                      key={c.columnName}
                      variant="outline"
                      className="font-mono text-[11px] gap-1"
                    >
                      <span>{c.columnName}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{c.columnType}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </OperationSlot>
          </div>
        </div>

        {/* ── Bottom strip ── */}
        <GeneratedPromptPreview
          prompt={prompt}
          polarsExpression={polarsExpression}
        />
      </div>
    </TooltipProvider>
  )
}

export default DragDropRuleBuilder
