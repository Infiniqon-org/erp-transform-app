/**
 * scenarios.ts — RightRev / Data Augmentation scenario catalog.
 *
 * Mirrors the three scenarios in
 * `cleanflowai_aws/docs/PHASE2_R1_RIGHTREV_BC_DESIGN_2026-05-14.md` and the
 * backend's `contexts/augmentation/infrastructure/prompts/scenarios.py`.
 *
 * - A: 1 contract → M monthly RevRec rows (EXPAND, ONE_TO_MANY emit per month)
 * - B: N monthly invoices → 1 annual summary (FOLD, MANY_TO_ONE, ASC 606)
 * - C: N events → K deduped rows (RESHAPE, MANY_TO_MANY, SOX merged_from lineage)
 *
 * Cardinality values mirror the BE Cardinality enum in
 * `contexts/augmentation/domain/models/prompt_template.py`.
 */

import type { Cardinality } from "@/lib/types/augmentation"

export type ScenarioId = "A" | "B" | "C"

export interface SchemaField {
  name: string
  type: string
  notes?: string
  required?: boolean
}

export interface ScenarioDef {
  id: ScenarioId
  title: string
  subtitle: string
  cardinality: Cardinality
  inputSchema: SchemaField[]
  outputSchema: SchemaField[]
  examplePrompts: string[]
  /** Tailwind gradient classes used in the scenario card. */
  gradient: string
  /** Short accent color tag used for badges + dots. */
  accent: "violet" | "emerald" | "amber"
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  A: {
    id: "A",
    title: "Expand",
    subtitle: "1 contract → M monthly RevRec rows",
    cardinality: "ONE_TO_MANY",
    accent: "violet",
    gradient:
      "from-violet-500/15 via-fuchsia-500/10 to-indigo-500/15 dark:from-violet-500/25 dark:via-fuchsia-500/15 dark:to-indigo-500/25",
    inputSchema: [
      { name: "contract_id", type: "Utf8", notes: "Group key", required: true },
      { name: "start_date", type: "Date", required: true },
      { name: "end_date", type: "Date", required: true },
      { name: "contract_value", type: "Float64", required: true },
      { name: "currency", type: "Utf8" },
    ],
    outputSchema: [
      { name: "contract_id", type: "Utf8" },
      { name: "period_month", type: "Utf8", notes: "YYYY-MM" },
      { name: "recognized_amount", type: "Float64" },
      { name: "deferred_balance_end", type: "Float64" },
      { name: "augmented_at_utc", type: "Utf8" },
    ],
    examplePrompts: [
      "Expand each contract into 12 monthly rev-rec rows using straight-line recognition over the contract term.",
      "For every contract, emit one row per fiscal month between start_date and end_date with recognized_amount = value / months.",
      "Generate ASC 606 monthly recognition schedule per contract; carry the deferred_balance_end forward.",
    ],
  },
  B: {
    id: "B",
    title: "Fold",
    subtitle: "N monthly invoices → 1 annual summary",
    cardinality: "MANY_TO_ONE",
    accent: "emerald",
    gradient:
      "from-emerald-500/15 via-teal-500/10 to-cyan-500/15 dark:from-emerald-500/25 dark:via-teal-500/15 dark:to-cyan-500/25",
    inputSchema: [
      { name: "contract_id", type: "Utf8", required: true },
      { name: "invoice_month", type: "Utf8", notes: "YYYY-MM", required: true },
      { name: "invoice_amount", type: "Float64", required: true },
      { name: "recognized_amount", type: "Float64" },
      { name: "deferred_balance_end", type: "Float64", required: true },
      { name: "fiscal_year", type: "Int32" },
      { name: "quarter", type: "Int32" },
    ],
    outputSchema: [
      { name: "contract_id", type: "Utf8" },
      { name: "fiscal_year", type: "Int32" },
      { name: "total_invoiced", type: "Float64" },
      { name: "total_recognized", type: "Float64" },
      { name: "ending_deferred", type: "Float64" },
      { name: "months_billed", type: "Int32" },
      { name: "prompt_template_version", type: "Int32" },
    ],
    examplePrompts: [
      "Fold these 12 monthly invoices into one annual summary row with total revenue, total deferred balance, and months present.",
      "Summarise each contract's revenue for the fiscal year: sum invoiced, keep last deferred balance, count months billed, flag partial years.",
      "Group monthly SaaS invoices by contract into an annual row — include Q1–Q4 sub-totals for the recognition schedule per ASC 606-10-32.",
    ],
  },
  C: {
    id: "C",
    title: "Reshape",
    subtitle: "N events → K canonical rows (SOX lineage)",
    cardinality: "MANY_TO_MANY",
    accent: "amber",
    gradient:
      "from-amber-500/15 via-orange-500/10 to-rose-500/15 dark:from-amber-500/25 dark:via-orange-500/15 dark:to-rose-500/25",
    inputSchema: [
      { name: "vendor", type: "Utf8", notes: "Raw name", required: true },
      { name: "amount", type: "Float64", required: true },
      { name: "id", type: "Utf8", notes: "Preserved in lineage_ids", required: true },
      { name: "invoice_date", type: "Utf8", notes: "ISO date" },
      { name: "contract_id", type: "Utf8" },
    ],
    outputSchema: [
      { name: "vendor", type: "Utf8", notes: "Canonical" },
      { name: "_key", type: "Utf8", notes: "Normalised dedupe key" },
      { name: "amount", type: "Float64" },
      { name: "lineage_ids", type: "List[Utf8]", notes: "SOX merged_from" },
      { name: "merge_count", type: "Int32" },
      { name: "source_row_hash", type: "Utf8" },
    ],
    examplePrompts: [
      "Dedupe vendor names like 'ACME Inc.' / 'Acme Inc' / 'ACME INCORPORATED' into one canonical row, keep the row with the largest invoice.",
      "Merge near-duplicate revenue events by contract and month, sum amounts, preserve all source event IDs in lineage_ids.",
      "Canonicalize supplier records: lowercase + strip whitespace, group by normalised name, keep the most recent row.",
    ],
  },
}

export const SCENARIO_LIST: ScenarioDef[] = [SCENARIOS.A, SCENARIOS.B, SCENARIOS.C]
