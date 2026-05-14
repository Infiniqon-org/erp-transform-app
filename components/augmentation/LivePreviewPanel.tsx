"use client"

/**
 * LivePreviewPanel.tsx
 *
 * Right-pane preview of the simulated output. Per spec §11 the preview is a
 * **client-side simulation** — never a backend round-trip per keystroke. It
 * reads the parsed prompt + sample rows (sourced from the upstream DQ-preset
 * preview endpoint by the wizard) and renders:
 *
 *   1. The Polars-pseudo-SQL plan in monospace with syntax highlighting
 *      (keywords / column literals / param literals).
 *   2. Up to 50 rows of synthesised output (debounced 400 ms after prompt
 *      stabilises per spec §3).
 *   3. A header with row-count delta + the CardinalityChip echo.
 *
 * Synthesis rules (kept intentionally small — this is UX comfort, not a real
 * query engine):
 *   1_to_1   → echo each input row, append a `_derived` column placeholder.
 *   n_to_1   → group by detected groupBy columns, sum numeric columns.
 *   n_to_k   → echo input rows verbatim (we can't simulate fan-out cheaply).
 */

import * as React from "react"
import { motion } from "framer-motion"

import { CardinalityChip } from "./CardinalityChip"
import type { ParsedPrompt } from "./hooks/usePromptParser"
import type { CardinalityDetection } from "./hooks/useCardinalityDetect"
import { cn } from "@/lib/utils"
import type { Cardinality } from "@/lib/types/augmentation"

export interface PreviewRow {
  [column: string]: string | number | boolean | null
}

export interface LivePreviewPanelProps {
  parsed: ParsedPrompt
  detection: CardinalityDetection
  effectiveCardinality: Cardinality
  /** First-page sample rows from the upstream DQ result.parquet preview. */
  sampleRows?: PreviewRow[]
  /** Loading state passed through from the wizard's sample-fetch hook. */
  isLoadingSample?: boolean
  error?: string | null
  className?: string
}

// Hex-style segmented progress dots that read calmer than a spinner.
function ConfidenceDots({ confidence }: { confidence: number }) {
  const filled = Math.max(1, Math.round(confidence * 3))
  return (
    <span className="inline-flex gap-0.5" aria-label={`Confidence ${Math.round(confidence * 100)}%`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            i < filled ? "bg-foreground" : "bg-muted"
          )}
        />
      ))}
    </span>
  )
}

// Build a Polars-pseudo-SQL plan from the parsed prompt + cardinality.
function buildPlan(
  parsed: ParsedPrompt,
  cardinality: Cardinality
): { keywords: string[]; lines: Array<{ tokens: PlanTok[] }> } {
  const cols = parsed.columns
  const group = parsed.groupBy.length ? parsed.groupBy : cols.slice(0, 1)
  const lines: Array<{ tokens: PlanTok[] }> = []

  if (cardinality === "MANY_TO_ONE") {
    lines.push({
      tokens: [
        kw("FOLD"),
        tx(" rows"),
        kw(" BY"),
        tx(" "),
        ...joinCols(group),
      ],
    })
    const measureCols = cols.filter((c) => !group.includes(c))
    if (measureCols.length === 0) {
      lines.push({
        tokens: [tx("  "), kw("COUNT"), tx("(*) "), kw("AS"), tx(" row_count")],
      })
    } else {
      for (const c of measureCols.slice(0, 3)) {
        lines.push({
          tokens: [
            tx("  "),
            kw("SUM"),
            tx("("),
            col(c),
            tx(") "),
            kw("AS"),
            tx(` total_${c}`),
          ],
        })
      }
    }
  } else if (cardinality === "MANY_TO_MANY") {
    lines.push({
      tokens: [
        kw("EXPAND"),
        tx(" rows "),
        kw("BY"),
        tx(" "),
        ...joinCols(cols.length ? cols : ["(prompt)"]),
      ],
    })
    lines.push({ tokens: [tx("  // arbitrary fan-out — engine-decided")] })
  } else {
    lines.push({ tokens: [kw("DERIVE"), tx(" each row")] })
    if (cols.length) {
      lines.push({
        tokens: [tx("  "), kw("USING"), tx(" "), ...joinCols(cols)],
      })
    }
    for (const [pname, pval] of Object.entries(parsed.params).slice(0, 3)) {
      lines.push({
        tokens: [tx("  "), kw("WITH"), tx(` ${pname} = `), param(pval)],
      })
    }
  }
  return { keywords: ["FOLD", "BY", "SUM", "COUNT", "AS", "EXPAND", "DERIVE", "USING", "WITH"], lines }
}

type PlanTok =
  | { t: "kw"; v: string }
  | { t: "col"; v: string }
  | { t: "param"; v: string }
  | { t: "tx"; v: string }
const kw = (v: string): PlanTok => ({ t: "kw", v })
const col = (v: string): PlanTok => ({ t: "col", v })
const param = (v: string): PlanTok => ({ t: "param", v })
const tx = (v: string): PlanTok => ({ t: "tx", v })
function joinCols(cols: string[]): PlanTok[] {
  const out: PlanTok[] = []
  cols.forEach((c, i) => {
    if (i > 0) out.push(tx(", "))
    out.push(col(c))
  })
  return out
}

// Synth output rows from sample input. Cheap, deterministic.
function synthRows(
  parsed: ParsedPrompt,
  cardinality: Cardinality,
  sample: PreviewRow[]
): PreviewRow[] {
  if (!sample.length) return []
  if (cardinality === "ONE_TO_MANY") {
    return sample.slice(0, 50).map((r) => ({ ...r, _derived: "—" }))
  }
  if (cardinality === "MANY_TO_MANY") {
    return sample.slice(0, 50)
  }
  // MANY_TO_ONE: group by parsed.groupBy (or first referenced column) + sum numerics.
  const groupKeys = parsed.groupBy.length ? parsed.groupBy : parsed.columns.slice(0, 1)
  if (!groupKeys.length) {
    // Fold everything into a single bucket.
    const folded: PreviewRow = { _bucket: "ALL" }
    for (const r of sample) {
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "number") folded[`total_${k}`] = ((folded[`total_${k}`] as number) ?? 0) + v
      }
    }
    folded.row_count = sample.length
    return [folded]
  }
  const buckets = new Map<string, PreviewRow>()
  for (const r of sample) {
    const key = groupKeys.map((k) => String(r[k] ?? "—")).join("∥")
    const bucket = buckets.get(key) ?? {
      ...Object.fromEntries(groupKeys.map((k) => [k, r[k] ?? null])),
      row_count: 0,
    }
    bucket.row_count = (bucket.row_count as number) + 1
    for (const [k, v] of Object.entries(r)) {
      if (groupKeys.includes(k)) continue
      if (typeof v === "number") bucket[`total_${k}`] = ((bucket[`total_${k}`] as number) ?? 0) + v
    }
    buckets.set(key, bucket)
  }
  return Array.from(buckets.values()).slice(0, 50)
}

// Highlighter for the plan — uses the spec §5 syntax token literals inline.
function PlanLine({ tokens }: { tokens: PlanTok[] }) {
  return (
    <div className="whitespace-pre">
      {tokens.map((t, i) => {
        if (t.t === "kw")
          return (
            <span key={i} style={{ color: "#2a4477" }} className="font-semibold">
              {t.v}
            </span>
          )
        if (t.t === "col")
          return (
            <span key={i} style={{ color: "#0cbeb6" }}>
              {t.v}
            </span>
          )
        if (t.t === "param")
          return (
            <span key={i} style={{ color: "oklch(0.55 0.18 290)" }}>
              {t.v}
            </span>
          )
        return (
          <span key={i} className="text-foreground/85">
            {t.v}
          </span>
        )
      })}
    </div>
  )
}

export function LivePreviewPanel({
  parsed,
  detection,
  effectiveCardinality,
  sampleRows = [],
  isLoadingSample = false,
  error = null,
  className,
}: LivePreviewPanelProps) {
  // Debounce: only recompute 400 ms after parsed changes (spec §3).
  const [debounced, setDebounced] = React.useState({ parsed, effectiveCardinality })
  React.useEffect(() => {
    const id = window.setTimeout(
      () => setDebounced({ parsed, effectiveCardinality }),
      400
    )
    return () => window.clearTimeout(id)
  }, [parsed, effectiveCardinality])

  const plan = React.useMemo(
    () => buildPlan(debounced.parsed, debounced.effectiveCardinality),
    [debounced]
  )
  const rows = React.useMemo(
    () => synthRows(debounced.parsed, debounced.effectiveCardinality, sampleRows),
    [debounced, sampleRows]
  )
  const inputRows = sampleRows.length
  const outputRows = rows.length
  const columnOrder = rows[0] ? Object.keys(rows[0]) : []

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-md border bg-card",
        className
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Live preview
          </span>
          {parsed.unknownColumns.length > 0 && (
            <span className="rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive">
              {parsed.unknownColumns.length} unknown col
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            rows: {inputRows} → {outputRows}
          </span>
          <CardinalityChip
            value={effectiveCardinality}
            confidence={detection.confidence}
            readOnly
          />
          <ConfidenceDots confidence={detection.confidence} />
        </div>
      </header>

      {/* Plan */}
      <section className="border-b px-3 pb-2">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Plan
        </div>
        <pre className="overflow-x-auto rounded-sm bg-muted/40 p-2 font-mono text-[12px] leading-relaxed">
          {plan.lines.map((l, i) => (
            <PlanLine key={i} tokens={l.tokens} />
          ))}
        </pre>
      </section>

      {/* Rows */}
      <section className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Rows
        </div>
        {error ? (
          <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            Preview unavailable: {error}
          </div>
        ) : isLoadingSample ? (
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-5 animate-pulse rounded-sm bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-sm border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
            Run preview (⌘↵) once a prompt is typed.
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="border-b">
                {columnOrder.map((c) => (
                  <th
                    key={c}
                    className="px-1.5 py-1 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.24,
                    delay: i < 8 ? i * 0.02 : 0,
                    ease: "easeOut",
                  }}
                  className="border-b border-border/40"
                >
                  {columnOrder.map((c) => (
                    <td key={c} className="px-1.5 py-1 tabular-nums">
                      {formatCell(r[c])}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function formatCell(v: string | number | boolean | null | undefined): string {
  if (v == null) return "—"
  if (typeof v === "number") return v.toLocaleString()
  if (typeof v === "boolean") return v ? "true" : "false"
  return v
}
