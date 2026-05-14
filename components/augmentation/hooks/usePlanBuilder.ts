"use client"

/**
 * usePlanBuilder.ts — pure-function state machine that turns the
 * DragDropRuleBuilder slot fills into a {Plan} object, and from that
 * derives the equivalent natural-language prompt + Polars expression
 * + cardinality chip.
 *
 * Deliberately framework-free: the reducer is a plain function so
 * tests can exercise it without React. The hook is a thin React shell.
 */

import * as React from "react"
import type { Cardinality } from "@/lib/types/augmentation"
import type { ColumnDType } from "./useDnDColumns"

// ─── Plan shape ───────────────────────────────────────────────────────────────

export type AggregateFn = "sum" | "last" | "first" | "count" | "min" | "max"

export const AGG_FNS: readonly AggregateFn[] = [
  "sum",
  "last",
  "first",
  "count",
  "min",
  "max",
] as const

export interface PlannedColumn {
  columnName: string
  columnType: ColumnDType
}

export interface PlannedAggregate extends PlannedColumn {
  fn: AggregateFn
  /** Output alias — defaults to `{fn}_{columnName}`. */
  alias?: string
}

export interface PlannedSort {
  columnName: string
  direction: "asc" | "desc"
}

export interface PlannedFilter {
  columnName: string
  op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains"
  value: string
}

export interface Plan {
  groupBy: PlannedColumn[]
  aggregates: PlannedAggregate[]
  sortBy: PlannedSort[]
  filters: PlannedFilter[]
}

export const EMPTY_PLAN: Plan = {
  groupBy: [],
  aggregates: [],
  sortBy: [],
  filters: [],
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type PlanAction =
  | { type: "ADD_GROUP_BY"; col: PlannedColumn }
  | { type: "REMOVE_GROUP_BY"; columnName: string }
  | { type: "ADD_AGGREGATE"; agg: PlannedAggregate }
  | { type: "SET_AGG_FN"; index: number; fn: AggregateFn }
  | { type: "REMOVE_AGGREGATE"; index: number }
  | { type: "ADD_SORT"; sort: PlannedSort }
  | { type: "TOGGLE_SORT_DIR"; index: number }
  | { type: "REMOVE_SORT"; index: number }
  | { type: "ADD_FILTER"; filter: PlannedFilter }
  | { type: "UPDATE_FILTER"; index: number; patch: Partial<PlannedFilter> }
  | { type: "REMOVE_FILTER"; index: number }
  | { type: "RESET" }

export function planReducer(state: Plan, action: PlanAction): Plan {
  switch (action.type) {
    case "ADD_GROUP_BY": {
      if (state.groupBy.some((c) => c.columnName === action.col.columnName)) {
        return state
      }
      return { ...state, groupBy: [...state.groupBy, action.col] }
    }
    case "REMOVE_GROUP_BY":
      return {
        ...state,
        groupBy: state.groupBy.filter((c) => c.columnName !== action.columnName),
      }
    case "ADD_AGGREGATE":
      return { ...state, aggregates: [...state.aggregates, action.agg] }
    case "SET_AGG_FN":
      return {
        ...state,
        aggregates: state.aggregates.map((a, i) =>
          i === action.index ? { ...a, fn: action.fn } : a,
        ),
      }
    case "REMOVE_AGGREGATE":
      return {
        ...state,
        aggregates: state.aggregates.filter((_, i) => i !== action.index),
      }
    case "ADD_SORT":
      return { ...state, sortBy: [...state.sortBy, action.sort] }
    case "TOGGLE_SORT_DIR":
      return {
        ...state,
        sortBy: state.sortBy.map((s, i) =>
          i === action.index
            ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
            : s,
        ),
      }
    case "REMOVE_SORT":
      return {
        ...state,
        sortBy: state.sortBy.filter((_, i) => i !== action.index),
      }
    case "ADD_FILTER":
      return { ...state, filters: [...state.filters, action.filter] }
    case "UPDATE_FILTER":
      return {
        ...state,
        filters: state.filters.map((f, i) =>
          i === action.index ? { ...f, ...action.patch } : f,
        ),
      }
    case "REMOVE_FILTER":
      return {
        ...state,
        filters: state.filters.filter((_, i) => i !== action.index),
      }
    case "RESET":
      return EMPTY_PLAN
    default:
      return state
  }
}

// ─── Derivations ──────────────────────────────────────────────────────────────

/** Derive cardinality chip from the plan. */
export function deriveCardinality(plan: Plan): Cardinality {
  // Aggregates without group-by collapse everything → N→1
  if (plan.aggregates.length > 0 && plan.groupBy.length === 0) return "MANY_TO_ONE"
  // Aggregates with group-by collapse per-group → N→K (still a fold per group)
  if (plan.aggregates.length > 0 && plan.groupBy.length > 0) return "MANY_TO_ONE"
  // Pure filter / sort / passthrough = 1→N (treat passthrough as expand-of-one).
  return "ONE_TO_MANY"
}

const aliasFor = (a: PlannedAggregate): string =>
  a.alias ?? `${a.fn}_${a.columnName}`

/** Compose a natural-language sentence from the plan. Used by GeneratedPromptPreview. */
export function planToPrompt(plan: Plan): string {
  if (
    plan.groupBy.length === 0 &&
    plan.aggregates.length === 0 &&
    plan.sortBy.length === 0 &&
    plan.filters.length === 0
  ) {
    return ""
  }

  const parts: string[] = []

  if (plan.filters.length > 0) {
    const fs = plan.filters
      .map((f) => `${f.columnName} ${prettyOp(f.op)} ${quoteIfText(f.value)}`)
      .join(" and ")
    parts.push(`Keep rows where ${fs}.`)
  }

  if (plan.aggregates.length > 0 || plan.groupBy.length > 0) {
    const aggs = plan.aggregates
      .map((a) => `${a.fn}(${a.columnName}) as ${aliasFor(a)}`)
      .join(", ")
    if (plan.groupBy.length > 0) {
      const grp = plan.groupBy.map((c) => c.columnName).join(", ")
      const head = plan.aggregates.length > 0 ? `Fold by ${grp}` : `Group by ${grp}`
      parts.push(aggs ? `${head}, computing ${aggs}.` : `${head}.`)
    } else if (aggs) {
      parts.push(`Collapse all rows into a single summary: ${aggs}.`)
    }
  }

  if (plan.sortBy.length > 0) {
    const ss = plan.sortBy
      .map((s) => `${s.columnName} ${s.direction}`)
      .join(", ")
    parts.push(`Order by ${ss}.`)
  }

  return parts.join(" ")
}

function prettyOp(op: PlannedFilter["op"]): string {
  switch (op) {
    case "eq":
      return "="
    case "neq":
      return "≠"
    case "gt":
      return ">"
    case "lt":
      return "<"
    case "gte":
      return "≥"
    case "lte":
      return "≤"
    case "contains":
      return "contains"
  }
}

function quoteIfText(v: string): string {
  if (v === "") return '""'
  if (/^-?\d+(\.\d+)?$/.test(v)) return v
  return `"${v}"`
}

/** Compose an equivalent Polars expression string. Rendered in mono in the preview strip. */
export function planToPolars(plan: Plan): string {
  if (
    plan.groupBy.length === 0 &&
    plan.aggregates.length === 0 &&
    plan.sortBy.length === 0 &&
    plan.filters.length === 0
  ) {
    return ""
  }

  const lines: string[] = ["df"]

  for (const f of plan.filters) {
    lines.push(`  .filter(${polarsFilter(f)})`)
  }

  if (plan.aggregates.length > 0 || plan.groupBy.length > 0) {
    if (plan.groupBy.length > 0) {
      const keys = plan.groupBy.map((c) => `"${c.columnName}"`).join(", ")
      lines.push(`  .group_by([${keys}])`)
      if (plan.aggregates.length > 0) {
        const aggs = plan.aggregates.map(polarsAgg).join(",\n    ")
        lines.push(`  .agg([\n    ${aggs},\n  ])`)
      }
    } else if (plan.aggregates.length > 0) {
      const aggs = plan.aggregates.map(polarsAgg).join(",\n    ")
      lines.push(`  .select([\n    ${aggs},\n  ])`)
    }
  }

  if (plan.sortBy.length > 0) {
    const cols = plan.sortBy.map((s) => `"${s.columnName}"`).join(", ")
    const descs = plan.sortBy.map((s) => (s.direction === "desc" ? "True" : "False")).join(", ")
    lines.push(`  .sort([${cols}], descending=[${descs}])`)
  }

  return lines.join("\n")
}

function polarsAgg(a: PlannedAggregate): string {
  const col = `pl.col("${a.columnName}")`
  const fnPart =
    a.fn === "count" ? `pl.len()` : `${col}.${a.fn}()`
  return `${fnPart}.alias("${aliasFor(a)}")`
}

function polarsFilter(f: PlannedFilter): string {
  const col = `pl.col("${f.columnName}")`
  const val = /^-?\d+(\.\d+)?$/.test(f.value) ? f.value : `"${f.value}"`
  switch (f.op) {
    case "eq":
      return `${col} == ${val}`
    case "neq":
      return `${col} != ${val}`
    case "gt":
      return `${col} > ${val}`
    case "lt":
      return `${col} < ${val}`
    case "gte":
      return `${col} >= ${val}`
    case "lte":
      return `${col} <= ${val}`
    case "contains":
      return `${col}.str.contains(${val})`
  }
}

/** Derive the output schema (column name + dtype) the user can preview. */
export function deriveOutputSchema(plan: Plan): PlannedColumn[] {
  if (plan.aggregates.length === 0 && plan.groupBy.length === 0) {
    return [] // pure passthrough — schema unchanged
  }
  const out: PlannedColumn[] = plan.groupBy.map((c) => ({ ...c }))
  for (const a of plan.aggregates) {
    out.push({
      columnName: aliasFor(a),
      columnType: a.fn === "count" ? "Int64" : a.columnType,
    })
  }
  return out
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function usePlanBuilder(initial: Plan = EMPTY_PLAN) {
  const [plan, dispatch] = React.useReducer(planReducer, initial)

  const prompt = React.useMemo(() => planToPrompt(plan), [plan])
  const polarsExpression = React.useMemo(() => planToPolars(plan), [plan])
  const cardinality = React.useMemo(() => deriveCardinality(plan), [plan])
  const outputSchema = React.useMemo(() => deriveOutputSchema(plan), [plan])

  return { plan, dispatch, prompt, polarsExpression, cardinality, outputSchema }
}
