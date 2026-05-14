"use client"

/**
 * usePromptParser.ts
 *
 * Tokenises a free-form augmentation prompt into a structured plan that the
 * editor renders inline (pills, params) and that the LivePreviewPanel uses to
 * synthesise a client-side Polars-pseudo-SQL plan WITHOUT a backend round-trip.
 *
 * Grammar (intentionally tiny — this is a prose UX, not a query language):
 *   {{column_name}}      → ColumnToken    — references a dataset column
 *   {param:value}        → ParamToken     — typed parameter literal
 *   any other run        → TextToken
 *
 * Heuristic verb extraction (FOLD / EXPAND / DERIVE / SUMMARIZE / ...) drives
 * cardinality detection via the sibling useCardinalityDetect hook.
 *
 * Pure, deterministic, no network. Reused by:
 *   • PromptTemplateEditor — to slice the textarea into pill / text runs.
 *   • LivePreviewPanel    — to render the Polars-pseudo-SQL plan.
 *   • useCardinalityDetect — to source verbs + grouping columns.
 */

import { useMemo } from "react"

// ─── Token / plan shapes ─────────────────────────────────────────────────────

export type Token =
  | { kind: "text"; value: string; start: number; end: number }
  | { kind: "column"; name: string; start: number; end: number }
  | { kind: "param"; name: string; value: string; start: number; end: number }

export interface ParsedPrompt {
  tokens: Token[]
  columns: string[] // distinct column names referenced
  params: Record<string, string> // last-write-wins for duplicate keys
  unknownColumns: string[] // columns referenced but NOT in availableColumns
  verbs: string[] // detected operation verbs (lowercase)
  groupBy: string[] // columns following "by"/"keyed by"/"per"
  hasFreeFormImperative: boolean // signals lossy prose→builder translation
}

// ─── Regex constants ─────────────────────────────────────────────────────────

// Greedy on inner content but bounded by closing delimiters. Disallow newlines
// inside a token so a malformed `{{` doesn't swallow the rest of the prompt.
const COLUMN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
const PARAM_RE = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^{}\n]+?)\s*\}/g

const FOLD_VERBS = [
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
]
const EXPAND_VERBS = ["expand", "explode", "split", "fan-out", "fanout", "unfold"]
const DERIVE_VERBS = ["derive", "compute", "calculate", "augment", "enrich", "annotate", "tag"]

const GROUP_PHRASES = /\b(?:keyed\s+by|grouped?\s+by|by|per)\s+\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/gi

// Free-form imperatives the builder can't model cleanly. Tracking these lets
// ModeToggle disable Prose→Builder per spec §10(a).
const FREE_FORM_HINTS = [
  /\bflag\b/i,
  /\bcontains?\s+/i,
  /\bif\s+/i,
  /\bwhen\s+/i,
  /\bregex\b/i,
  /\bmatch(es|ing)?\b/i,
  /\b(swear|profan|obscen|toxic)/i,
]

// ─── Tokeniser ───────────────────────────────────────────────────────────────

function tokenise(text: string): Token[] {
  if (!text) return []
  const tokens: Token[] = []
  type Marker =
    | { kind: "column"; start: number; end: number; name: string }
    | { kind: "param"; start: number; end: number; name: string; value: string }
  const markers: Marker[] = []

  for (const m of text.matchAll(COLUMN_RE)) {
    if (m.index == null) continue
    markers.push({
      kind: "column",
      start: m.index,
      end: m.index + m[0].length,
      name: m[1],
    })
  }
  for (const m of text.matchAll(PARAM_RE)) {
    if (m.index == null) continue
    // Skip if this overlaps a column match (double-brace).
    if (markers.some((mk) => mk.start <= m.index! && mk.end >= m.index! + m[0].length)) continue
    markers.push({
      kind: "param",
      start: m.index,
      end: m.index + m[0].length,
      name: m[1],
      value: m[2],
    })
  }
  markers.sort((a, b) => a.start - b.start)

  let cursor = 0
  for (const mk of markers) {
    if (mk.start > cursor) {
      tokens.push({ kind: "text", value: text.slice(cursor, mk.start), start: cursor, end: mk.start })
    }
    if (mk.kind === "column") {
      tokens.push({ kind: "column", name: mk.name, start: mk.start, end: mk.end })
    } else {
      tokens.push({ kind: "param", name: mk.name, value: mk.value, start: mk.start, end: mk.end })
    }
    cursor = mk.end
  }
  if (cursor < text.length) {
    tokens.push({ kind: "text", value: text.slice(cursor), start: cursor, end: text.length })
  }
  return tokens
}

function lowerWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter(Boolean)
  )
}

function extractVerbs(text: string): string[] {
  const words = lowerWords(text)
  const found: string[] = []
  for (const v of [...FOLD_VERBS, ...EXPAND_VERBS, ...DERIVE_VERBS]) {
    if (words.has(v)) found.push(v)
  }
  return found
}

function extractGroupBy(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(GROUP_PHRASES)) {
    out.push(m[1])
  }
  return out
}

function isFreeForm(text: string): boolean {
  return FREE_FORM_HINTS.some((re) => re.test(text))
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePromptParser(
  text: string,
  availableColumns: readonly string[] = []
): ParsedPrompt {
  return useMemo(() => {
    const tokens = tokenise(text)
    const columnsArr: string[] = []
    const seen = new Set<string>()
    const params: Record<string, string> = {}
    for (const t of tokens) {
      if (t.kind === "column" && !seen.has(t.name)) {
        seen.add(t.name)
        columnsArr.push(t.name)
      } else if (t.kind === "param") {
        params[t.name] = t.value
      }
    }
    const knownSet = new Set(availableColumns)
    const unknownColumns = availableColumns.length
      ? columnsArr.filter((c) => !knownSet.has(c))
      : []
    return {
      tokens,
      columns: columnsArr,
      params,
      unknownColumns,
      verbs: extractVerbs(text),
      groupBy: extractGroupBy(text),
      hasFreeFormImperative: isFreeForm(text),
    }
  }, [text, availableColumns])
}

// Exported for unit tests + the LivePreviewPanel synth path.
export const _internal = { tokenise, extractVerbs, extractGroupBy, isFreeForm }
