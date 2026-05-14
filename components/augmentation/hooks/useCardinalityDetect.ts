"use client"

/**
 * useCardinalityDetect.ts
 *
 * Pure-client heuristic that guesses the expected output cardinality of an
 * augmentation prompt from its verbs + grouping clauses. The result powers the
 * CardinalityChip's auto-detected default (overridable by user click per Hex
 * convention).
 *
 *   FOLD / SUMMARIZE / AGGREGATE / DEDUPE  → n_to_1
 *   EXPAND / EXPLODE / SPLIT / FAN-OUT     → n_to_k
 *   DERIVE / COMPUTE / ENRICH / annotate   → 1_to_1
 *   (no verb match)                        → 1_to_1 (safe default)
 *
 * Returns confidence in [0, 1] so the UI can render the chip in muted color
 * when confidence < 0.6 (signals "auto, but unsure").
 */

import { useMemo } from "react"
import type { Cardinality } from "@/lib/types/augmentation"
import type { ParsedPrompt } from "./usePromptParser"

export interface CardinalityDetection {
  cardinality: Cardinality
  confidence: number // 0..1
  reason: string // short human label, shown in tooltip
}

const FOLD_SET = new Set([
  "fold",
  "summarize",
  "summarise",
  "aggregate",
  "dedupe",
  "deduplicate",
  "collapse",
  "rollup",
  "roll-up",
  "group",
  "consolidate",
])
const EXPAND_SET = new Set(["expand", "explode", "split", "fan-out", "fanout", "unfold"])
const DERIVE_SET = new Set([
  "derive",
  "compute",
  "calculate",
  "augment",
  "enrich",
  "annotate",
  "tag",
])

export function useCardinalityDetect(parsed: ParsedPrompt): CardinalityDetection {
  return useMemo(() => detect(parsed), [parsed])
}

export function detect(parsed: ParsedPrompt): CardinalityDetection {
  const verbs = parsed.verbs
  if (verbs.length === 0) {
    return { cardinality: "ONE_TO_MANY", confidence: 0.3, reason: "no verb detected — default" }
  }
  let fold = 0
  let expand = 0
  let derive = 0
  for (const v of verbs) {
    if (FOLD_SET.has(v)) fold += 1
    else if (EXPAND_SET.has(v)) expand += 1
    else if (DERIVE_SET.has(v)) derive += 1
  }
  // A "group by"/"keyed by" clause biases strongly toward fold semantics.
  const groupingBoost = parsed.groupBy.length > 0 ? 1.5 : 0
  const foldScore = fold + groupingBoost
  const total = foldScore + expand + derive

  if (total === 0) {
    return { cardinality: "ONE_TO_MANY", confidence: 0.3, reason: "ambiguous verbs — default" }
  }
  if (foldScore >= expand && foldScore >= derive) {
    return {
      cardinality: "MANY_TO_ONE",
      confidence: Math.min(1, 0.6 + foldScore * 0.15),
      reason:
        parsed.groupBy.length > 0
          ? `grouped by ${parsed.groupBy[0]}`
          : "fold / summarize verb detected",
    }
  }
  if (expand >= derive) {
    return {
      cardinality: "MANY_TO_MANY",
      confidence: Math.min(1, 0.55 + expand * 0.15),
      reason: "expand / explode verb detected",
    }
  }
  return {
    cardinality: "ONE_TO_MANY",
    confidence: Math.min(1, 0.6 + derive * 0.1),
    reason: "derive / enrich verb detected",
  }
}
