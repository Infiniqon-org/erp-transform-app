"use client"

/**
 * useAugmentationDraft.ts — localStorage-backed draft hook for the wizard's
 * Advanced Configuration (Augmentation) step.
 *
 * Spec refs:
 *   - WIZARD_AND_JOBS_UI_DESIGN_SPEC §A4 (save & resume; localStorage key
 *     shape; schema_hash invalidation; 800 ms debounce).
 *   - AUGMENTATION_UI_DESIGN_SPEC §10(3) (sox_audit toggle lives at wizard
 *     review level, not in the augmentation card — we still persist it here
 *     so the draft can survive across steps).
 *
 * KEY SHAPE
 *   cleanflowai:augmentation_draft:{upload_id}
 *   {
 *     mode,          // "prose" | "builder"
 *     prompt,        // textual prompt (prose mode source-of-truth)
 *     plan,          // Plan object from usePlanBuilder (builder mode SoT)
 *     cardinality,   // user-overridden cardinality, null = auto
 *     templateId,    // selected saved-template id, null = none
 *     schema_hash,   // SHA-1-ish of detected column names+types
 *     last_saved_at, // epoch ms; surfaced in summary rail
 *   }
 *
 * INVALIDATION
 *   When `currentSchemaHash` differs from the stored hash, `isStale=true` and
 *   the consumer (AdvancedConfiguration) renders an amber "Schema changed"
 *   banner. The draft itself is NOT discarded — finance users would lose
 *   work; instead they get a one-click "Clear" button.
 *
 * SCOPE GUARD
 *   This hook only manages the LOCAL draft cache. It does NOT call the
 *   augmentation API. Job dispatch lives at the wizard scope so the
 *   schema_hash check happens once at submit time.
 */

import * as React from "react"
import type { Cardinality } from "@/lib/types/augmentation"
import type { EditorMode } from "../ModeToggle"
import type { Plan } from "./usePlanBuilder"
import { EMPTY_PLAN } from "./usePlanBuilder"

// ─── Shape ────────────────────────────────────────────────────────────────────

export interface AugmentationDraft {
  mode: EditorMode
  prompt: string
  plan: Plan
  cardinality: Cardinality | null
  templateId: string | null
  /** Hash of the detected schema at draft-save time. */
  schema_hash: string
  /** epoch ms */
  last_saved_at: number
}

export const EMPTY_AUGMENTATION_DRAFT: Omit<
  AugmentationDraft,
  "schema_hash" | "last_saved_at"
> = {
  mode: "prose",
  prompt: "",
  plan: EMPTY_PLAN,
  cardinality: null,
  templateId: null,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KEY_PREFIX = "cleanflowai:augmentation_draft:"
const SAVE_DEBOUNCE_MS = 800

function storageKey(uploadId: string): string {
  return `${KEY_PREFIX}${uploadId}`
}

/**
 * Tiny non-cryptographic schema fingerprint. We are not securing anything;
 * we just need to detect "schema changed between sessions". djb2-derived.
 */
export function computeSchemaHash(
  columns: ReadonlyArray<{ name: string; dtype?: string; type?: string }>
): string {
  if (!columns || columns.length === 0) return "empty"
  let hash = 5381
  const sorted = [...columns]
    .map((c) => `${c.name}::${c.dtype ?? c.type ?? "?"}`)
    .sort()
  for (const s of sorted) {
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0
    }
  }
  // 8-char hex to keep the storage payload compact and human-comparable.
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function safeReadDraft(uploadId: string): AugmentationDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(storageKey(uploadId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AugmentationDraft
    // Defensive: re-hydrate missing nested fields rather than throw.
    if (!parsed || typeof parsed !== "object") return null
    return {
      mode: parsed.mode === "builder" ? "builder" : "prose",
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      plan: parsed.plan && typeof parsed.plan === "object" ? parsed.plan : EMPTY_PLAN,
      cardinality: parsed.cardinality ?? null,
      templateId: parsed.templateId ?? null,
      schema_hash: typeof parsed.schema_hash === "string" ? parsed.schema_hash : "",
      last_saved_at: typeof parsed.last_saved_at === "number" ? parsed.last_saved_at : 0,
    }
  } catch {
    return null
  }
}

function safeWriteDraft(uploadId: string, draft: AugmentationDraft): void {
  if (typeof window === "undefined") return
  try {
    const payload = JSON.stringify(draft)
    // 64 KB guard per spec §A4 — silently drop oversize drafts rather than
    // throwing QuotaExceededError mid-typing.
    if (payload.length > 64 * 1024) return
    window.localStorage.setItem(storageKey(uploadId), payload)
  } catch {
    /* localStorage may be disabled (private mode, quota) — fall through. */
  }
}

function safeDeleteDraft(uploadId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(storageKey(uploadId))
  } catch {
    /* ignore */
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseAugmentationDraftOptions {
  /** Required — drafts are scoped by upload. */
  uploadId: string | null | undefined
  /** Hash of the wizard's currently-detected schema. */
  currentSchemaHash: string
}

export interface UseAugmentationDraftReturn {
  draft: AugmentationDraft
  /** Updates the in-memory draft and schedules a debounced localStorage write. */
  setDraft: (patch: Partial<AugmentationDraft>) => void
  /** True iff there is a persisted draft with content. */
  hasDraft: () => boolean
  /** Removes the persisted draft + resets in-memory state. */
  clearDraft: () => void
  /** True when stored schema_hash differs from currentSchemaHash. */
  isStale: boolean
  /** ms-since-epoch of the last successful save (0 = never saved). */
  lastSavedAt: number
}

/**
 * useAugmentationDraft
 *
 * Single source of truth for the wizard's augmentation step. AdvancedConfiguration
 * lifts state up to this hook; the prose + builder views read/mutate via
 * setDraft callbacks.
 */
export function useAugmentationDraft({
  uploadId,
  currentSchemaHash,
}: UseAugmentationDraftOptions): UseAugmentationDraftReturn {
  // Lazy-init from localStorage (only when uploadId is known).
  const [draft, setDraftState] = React.useState<AugmentationDraft>(() => {
    if (!uploadId) {
      return {
        ...EMPTY_AUGMENTATION_DRAFT,
        schema_hash: currentSchemaHash,
        last_saved_at: 0,
      }
    }
    const persisted = safeReadDraft(uploadId)
    if (persisted) return persisted
    return {
      ...EMPTY_AUGMENTATION_DRAFT,
      schema_hash: currentSchemaHash,
      last_saved_at: 0,
    }
  })

  // Rehydrate when uploadId becomes available (e.g. after file upload).
  React.useEffect(() => {
    if (!uploadId) return
    const persisted = safeReadDraft(uploadId)
    if (persisted) {
      setDraftState(persisted)
    } else {
      setDraftState((prev) => ({
        ...prev,
        schema_hash: prev.schema_hash || currentSchemaHash,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId])

  // Debounced persistence.
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    if (!uploadId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const toWrite: AugmentationDraft = {
        ...draft,
        last_saved_at: Date.now(),
      }
      safeWriteDraft(uploadId, toWrite)
      setDraftState((prev) =>
        prev.last_saved_at === toWrite.last_saved_at
          ? prev
          : { ...prev, last_saved_at: toWrite.last_saved_at }
      )
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // last_saved_at intentionally excluded — we only debounce on content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    uploadId,
    draft.mode,
    draft.prompt,
    draft.plan,
    draft.cardinality,
    draft.templateId,
    draft.schema_hash,
  ])

  const setDraft = React.useCallback(
    (patch: Partial<AugmentationDraft>) => {
      setDraftState((prev) => ({ ...prev, ...patch }))
    },
    []
  )

  const hasDraft = React.useCallback(() => {
    if (!uploadId) return false
    const persisted = safeReadDraft(uploadId)
    if (!persisted) return false
    // "Has content" = either a non-empty prompt or a non-empty plan.
    const hasPrompt = persisted.prompt.trim().length > 0
    const hasPlan =
      persisted.plan.groupBy.length > 0 ||
      persisted.plan.aggregates.length > 0 ||
      persisted.plan.sortBy.length > 0 ||
      persisted.plan.filters.length > 0
    return hasPrompt || hasPlan
  }, [uploadId])

  const clearDraft = React.useCallback(() => {
    if (uploadId) safeDeleteDraft(uploadId)
    setDraftState({
      ...EMPTY_AUGMENTATION_DRAFT,
      schema_hash: currentSchemaHash,
      last_saved_at: 0,
    })
  }, [uploadId, currentSchemaHash])

  // Stale when there is some persisted content AND the schema_hash diverged.
  const isStale = React.useMemo(() => {
    if (!draft.schema_hash || !currentSchemaHash) return false
    if (draft.schema_hash === currentSchemaHash) return false
    const hasPrompt = draft.prompt.trim().length > 0
    const hasPlan =
      draft.plan.groupBy.length > 0 ||
      draft.plan.aggregates.length > 0 ||
      draft.plan.sortBy.length > 0 ||
      draft.plan.filters.length > 0
    return hasPrompt || hasPlan
  }, [draft.schema_hash, draft.prompt, draft.plan, currentSchemaHash])

  return {
    draft,
    setDraft,
    hasDraft,
    clearDraft,
    isStale,
    lastSavedAt: draft.last_saved_at,
  }
}
