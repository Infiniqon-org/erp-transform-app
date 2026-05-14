"use client"

/**
 * AdvancedConfiguration.tsx
 *
 * Orchestrator for the wizard's Step-4 Advanced (Augmentation) surface.
 *
 * Spec refs:
 *   - AUGMENTATION_UI_DESIGN_SPEC §2/§3/§10  (Mode tabs, three-pane intent,
 *     prose ↔ builder bidirectional translation policy)
 *   - WIZARD_AND_JOBS_UI_DESIGN_SPEC §A1/§A3/§A4 (Step-4 peer with skip,
 *     localStorage drafts, schema_hash invalidation, amber dirty dot)
 *
 * RESPONSIBILITIES
 *   - Single source of truth state — `AugmentationDraft` lives in
 *     useAugmentationDraft. Prose + Builder views read/mutate through it.
 *   - Mode tabs (ModeToggle): Prose → PromptTemplateEditor, Builder →
 *     DragDropRuleBuilder. State preserved across mode flips.
 *   - schema_hash invalidation: amber dot + "Schema changed" banner when the
 *     wizard's detected schema diverged from the draft's stored hash.
 *   - Skip-and-resume CTAs:  "Save & continue" | "Skip — I'll add this later"
 *     | "Clear". Each routes through the wizard's onContinue / onSkip / hook
 *     clearDraft.
 *   - Validation gate (per spec §A3):
 *       prose mode → disable Continue when parser surfaces unknown columns
 *       builder mode → disable Continue when no operations have been added
 *
 * SCOPE GUARD
 *   We do NOT call the augmentation API. The wizard at submit-time inspects
 *   the draft and dispatches createAugmentationJob. This component is a pure
 *   editor surface.
 */

import * as React from "react"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eraser,
  SkipForward,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Cardinality, PromptTemplate } from "@/lib/types/augmentation"

import { PromptTemplateEditor, type EditorColumn } from "./PromptTemplateEditor"
import { DragDropRuleBuilder } from "./DragDropRuleBuilder"
import type { EditorMode } from "./ModeToggle"
import type {
  ColumnDType,
  ColumnRole,
  DraggableColumn,
} from "./hooks/useDnDColumns"
import {
  useAugmentationDraft,
  computeSchemaHash,
  type AugmentationDraft,
} from "./hooks/useAugmentationDraft"
import { TemplateLibraryDrawer } from "./TemplateLibraryDrawer"

// ─── Public schema shape — accept the wizard's most convenient column type ───

export interface DetectedColumn {
  name: string
  /** Polars-flavoured dtype (preferred) — e.g. "Utf8", "Float64". */
  dtype?: string
  /** Coarse type fallback used by PromptTemplateEditor's pill colouring. */
  type?: "numeric" | "text" | "date" | "currency"
}

// ─── Mapping helpers (DetectedColumn → both editor shapes) ────────────────────

function toDType(c: DetectedColumn): ColumnDType {
  // Honour Polars dtype when present.
  if (c.dtype) {
    const d = c.dtype
    if (d.startsWith("Int")) return d === "Int32" ? "Int32" : "Int64"
    if (d.startsWith("Float")) return "Float64"
    if (d === "Decimal") return "Decimal"
    if (d === "Date") return "Date"
    if (d === "Datetime") return "Datetime"
    if (d === "Boolean") return "Boolean"
    if (d === "Utf8") return "Utf8"
  }
  // Otherwise infer from coarse type or column name heuristics.
  if (c.type === "numeric" || c.type === "currency") return "Float64"
  if (c.type === "date") return "Date"
  return "Utf8"
}

function inferRole(c: DetectedColumn, dtype: ColumnDType): ColumnRole {
  const lower = c.name.toLowerCase()
  if (/(_id|_key|^id$|^key$|customer|account|invoice_no)/.test(lower)) {
    return "key"
  }
  if (dtype === "Date" || dtype === "Datetime") return "date"
  if (
    dtype === "Float64" ||
    dtype === "Int32" ||
    dtype === "Int64" ||
    dtype === "Decimal"
  ) {
    return "measure"
  }
  return "dim"
}

function toEditorColumns(cols: ReadonlyArray<DetectedColumn>): EditorColumn[] {
  return cols.map((c) => ({
    name: c.name,
    type: c.type ?? mapDTypeToPillType(toDType(c)),
  }))
}

function mapDTypeToPillType(d: ColumnDType): EditorColumn["type"] {
  if (d === "Date" || d === "Datetime") return "date"
  if (
    d === "Float64" ||
    d === "Int32" ||
    d === "Int64" ||
    d === "Decimal" ||
    d === "Boolean"
  ) {
    return "numeric"
  }
  return "text"
}

function toDraggableColumns(
  cols: ReadonlyArray<DetectedColumn>
): DraggableColumn[] {
  return cols.map((c) => {
    const dtype = toDType(c)
    return {
      name: c.name,
      dtype,
      role: inferRole(c, dtype),
    }
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AdvancedConfigurationProps {
  /** Required so drafts can be scoped per upload. */
  uploadId: string | null | undefined

  /**
   * The wizard's currently-detected file schema. Drives column tiles, pill
   * colouring, AND the schema_hash invalidation banner.
   */
  detectedSchema: ReadonlyArray<DetectedColumn>

  /** Saved prompt templates surfaced in the drawer + slash menu. */
  templates?: ReadonlyArray<PromptTemplate>

  /** Cognito access token for "Save as template". */
  accessToken?: string | null

  /** Emitted on every meaningful draft change (debounced via the hook). */
  onChange?: (draft: AugmentationDraft, isValid: boolean) => void

  /** "Save & continue" — caller advances the wizard. */
  onContinue?: () => void

  /** "Skip — I'll add this later" — caller advances + clears the draft. */
  onSkip?: () => void

  /** Optional class for the outer wrapper. */
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdvancedConfiguration({
  uploadId,
  detectedSchema,
  templates = [],
  accessToken,
  onChange,
  onContinue,
  onSkip,
  className,
}: AdvancedConfigurationProps) {
  const currentSchemaHash = React.useMemo(
    () => computeSchemaHash(detectedSchema),
    [detectedSchema]
  )

  const { draft, setDraft, hasDraft, clearDraft, isStale, lastSavedAt } =
    useAugmentationDraft({
      uploadId: uploadId ?? null,
      currentSchemaHash,
    })

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [localTemplates, setLocalTemplates] =
    React.useState<ReadonlyArray<PromptTemplate>>(templates)

  React.useEffect(() => setLocalTemplates(templates), [templates])

  // ── Derived editor data ─────────────────────────────────────────────────────
  const editorColumns = React.useMemo(
    () => toEditorColumns(detectedSchema),
    [detectedSchema]
  )
  const draggableColumns = React.useMemo(
    () => toDraggableColumns(detectedSchema),
    [detectedSchema]
  )
  const columnNameSet = React.useMemo(
    () => new Set(detectedSchema.map((c) => c.name)),
    [detectedSchema]
  )

  // ── Validation (per spec §A3) ───────────────────────────────────────────────
  const proseUnknownColumns = React.useMemo(() => {
    if (draft.mode !== "prose") return []
    const matches = draft.prompt.matchAll(/\{\{([\w.-]+)\}\}/g)
    const unknown: string[] = []
    for (const m of matches) {
      if (m[1] && columnNameSet.size > 0 && !columnNameSet.has(m[1])) {
        unknown.push(m[1])
      }
    }
    return unknown
  }, [draft.mode, draft.prompt, columnNameSet])

  const builderEmpty =
    draft.plan.groupBy.length === 0 &&
    draft.plan.aggregates.length === 0 &&
    draft.plan.sortBy.length === 0 &&
    draft.plan.filters.length === 0

  const hasContent =
    (draft.mode === "prose" && draft.prompt.trim().length > 0) ||
    (draft.mode === "builder" && !builderEmpty)

  const validationError =
    draft.mode === "prose" && proseUnknownColumns.length > 0
      ? `Prompt references unknown column \`${proseUnknownColumns[0]}\`.`
      : null

  const canContinue = hasContent && !validationError && !isStale

  // ── Bubble draft changes up ────────────────────────────────────────────────
  React.useEffect(() => {
    onChange?.(draft, canContinue)
    // We intentionally trigger only when the persistable shape changes —
    // skipping last_saved_at, which is a side-effect not a user edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.mode,
    draft.prompt,
    draft.plan,
    draft.cardinality,
    draft.templateId,
    canContinue,
  ])

  // Keep stored schema_hash fresh once the user has acknowledged staleness
  // (i.e. by clearing or by actively editing the draft).
  const recordSchemaSeen = React.useCallback(() => {
    if (draft.schema_hash !== currentSchemaHash) {
      setDraft({ schema_hash: currentSchemaHash })
    }
  }, [draft.schema_hash, currentSchemaHash, setDraft])

  // ── Mode flips ──────────────────────────────────────────────────────────────
  const onModeChange = (next: EditorMode) => {
    setDraft({ mode: next })
  }

  // ── Template "Use" from drawer ─────────────────────────────────────────────
  const handleUseTemplate = (t: PromptTemplate) => {
    setDraft({
      mode: "prose",
      prompt: t.prompt,
      templateId: t.template_id,
      cardinality: t.expected_cardinality,
    })
    setDrawerOpen(false)
  }

  const handleTemplateSaved = (templateId: string) => {
    setDraft({ templateId })
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const lastSavedLabel = React.useMemo(() => {
    if (!lastSavedAt) return "no draft yet"
    const sec = Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000))
    if (sec < 5) return "draft saved · just now"
    if (sec < 60) return `draft saved · ${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `draft saved · ${min}m ago`
    const hr = Math.floor(min / 60)
    return `draft saved · ${hr}h ago`
  }, [lastSavedAt])

  return (
    <div className={cn("flex flex-col gap-3 rounded-md border bg-card p-4", className)}>
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-sans text-xl font-semibold tracking-tight">
            Augment columns
          </h2>
          {isStale && (
            <span
              role="status"
              aria-label="Schema changed — review augmentation plan"
              className="inline-flex h-2 w-2 rounded-full bg-amber-500"
              title="Schema changed — review augmentation plan"
            />
          )}
          <span className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">
            Step 4 of 5 · optional
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setDrawerOpen(true)}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Templates
            {localTemplates.length > 0 && (
              <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                ({localTemplates.length})
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Schema-stale banner (spec §A3) */}
      {isStale && (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2",
            "border-amber-500/40 bg-amber-500/5 text-foreground"
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 text-xs leading-relaxed">
            <p className="font-medium">Schema changed — review augmentation plan.</p>
            <p className="text-muted-foreground">
              The detected file schema no longer matches what was used when this
              draft was saved. Verify column references, then re-save or clear.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={recordSchemaSeen}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> I&apos;ve reviewed
          </Button>
        </div>
      )}

      {/* Mode-specific editor surface */}
      <div className="min-h-[420px]">
        {draft.mode === "prose" ? (
          <PromptTemplateEditor
            value={draft.prompt}
            onChange={(next) => setDraft({ prompt: next })}
            availableColumns={editorColumns}
            templates={localTemplates as PromptTemplate[]}
            selectedTemplateId={draft.templateId}
            onSelectTemplate={(id) => setDraft({ templateId: id })}
            cardinalityOverride={draft.cardinality}
            onCardinalityOverride={(c: Cardinality | null) =>
              setDraft({ cardinality: c })
            }
            mode={draft.mode}
            onModeChange={onModeChange}
            validationError={validationError}
          />
        ) : (
          <DragDropRuleBuilder
            columns={draggableColumns}
            onSwitchToProse={(_plan, prompt) => {
              // Seed prose with the generated prompt so users keep their work.
              setDraft({ mode: "prose", prompt: prompt || draft.prompt })
            }}
            onPreview={() => {
              /* preview is client-side; LivePreviewPanel is wizard-scoped */
            }}
          />
        )}
      </div>

      <Separator />

      {/* Skip-and-resume CTA strip + draft status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono">{lastSavedLabel}</span>
          {hasDraft() && (
            <>
              <span className="opacity-50">·</span>
              <span className="font-mono">
                upload {uploadId ? uploadId.slice(0, 8) : "—"}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
            disabled={!hasDraft() && !hasContent}
            onClick={() => clearDraft()}
            aria-label="Clear augmentation draft"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              clearDraft()
              onSkip?.()
            }}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip — I&apos;ll add this later
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            disabled={!canContinue}
            onClick={() => {
              recordSchemaSeen()
              onContinue?.()
            }}
          >
            Save &amp; continue
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Right-edge template drawer */}
      <TemplateLibraryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        templates={localTemplates}
        currentPrompt={draft.prompt}
        currentCardinality={draft.cardinality ?? "ONE_TO_MANY"}
        accessToken={accessToken}
        onUse={handleUseTemplate}
        onSaved={handleTemplateSaved}
      />
    </div>
  )
}

export default AdvancedConfiguration
