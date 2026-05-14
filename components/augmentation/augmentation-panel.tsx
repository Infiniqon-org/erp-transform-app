"use client"

/**
 * augmentation-panel.tsx — composable Data Augmentation editor.
 *
 * Used in TWO places:
 *  1. The files page upload section (under "Custom Rules")
 *  2. The Jobs page when a "Recurring Data Augmentation" rule is being
 *     configured.
 *
 * Internally it composes scenario-cards + column-mapper + prompt-composer.
 * Exposes a controlled config object via `value` / `onChange` so the host
 * page can persist / forward it to the backend.
 */

import * as React from "react"
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScenarioCards } from "./scenario-cards"
import { ColumnMapper, type SourceColumn, type ColumnMapping } from "./column-mapper"
import { PromptComposer } from "./prompt-composer"
import { SCENARIOS, type ScenarioDef, type ScenarioId } from "./scenarios"
import type {
  Cardinality,
  CreatePromptTemplateRequest,
  PromptTemplate,
} from "@/lib/types/augmentation"
import type { JobCreationPlan } from "@/lib/api/augmentation"

export interface AugmentationConfig {
  enabled: boolean
  scenarioId: ScenarioId | null
  prompt: string
  templateId: string | null
  mapping: ColumnMapping
  soxAuditEnabled: boolean
}

export const EMPTY_AUGMENTATION_CONFIG: AugmentationConfig = {
  enabled: false,
  scenarioId: null,
  prompt: "",
  templateId: null,
  mapping: {},
  soxAuditEnabled: false,
}

/** Derive the input-parquet S3 key from the file's stored `s3_raw_key`. */
function deriveInputDatasetKey(uploadId: string, s3RawKey?: string | null): string {
  // s3_raw_key is the source of truth (e.g. `data/{org}/{upload}/raw.csv`).
  // The augmentation worker reads `result.parquet` in the same prefix.
  if (s3RawKey && s3RawKey.startsWith("data/")) {
    const lastSlash = s3RawKey.lastIndexOf("/")
    if (lastSlash > 0) return `${s3RawKey.slice(0, lastSlash)}/result.parquet`
  }
  // Best-effort fallback when s3_raw_key isn't available yet (e.g. fresh upload
  // mid-flight). The BE worker does its own resolution path on legacy uploads.
  return `data/uploads/${uploadId}/result.parquet`
}

/** Derive the output-parquet S3 key for the augmented dataset. */
function deriveOutputDatasetKey(
  uploadId: string,
  templateId: string,
  s3RawKey?: string | null,
  now: number = Date.now(),
): string {
  const ts = new Date(now).toISOString().replace(/[:.]/g, "-")
  if (s3RawKey && s3RawKey.startsWith("data/")) {
    const lastSlash = s3RawKey.lastIndexOf("/")
    if (lastSlash > 0) {
      return `${s3RawKey.slice(0, lastSlash)}/augmented/${templateId}_${ts}.parquet`
    }
  }
  return `data/uploads/${uploadId}/augmented/${templateId}_${ts}.parquet`
}

/** Build a deterministic-ish placeholder template id for new (unsaved) templates. */
function generateTemplateId(scenarioId: ScenarioId): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${scenarioId.toLowerCase()}-tmpl-${Date.now()}`
}

/**
 * Convert an `AugmentationConfig` into a `JobCreationPlan` consumable by
 * `executeAugmentationFromConfig` (see `lib/api/augmentation.ts`).
 *
 * The BE requires `prompt_template_id`, `input_dataset_key`, and
 * `output_dataset_key` on POST /augmentation/jobs (handler.py:78). When the
 * user hasn't picked a saved template, this plan instructs the orchestrator
 * to register a new template first (with scenario-derived schemas + the
 * BE Cardinality enum) and then create the job.
 *
 * Inputs:
 *  - `cfg`: the panel's controlled config
 *  - `uploadId`: the FileRegistry upload_id (used for fallback path derivation)
 *  - `s3RawKey`: optional `s3_raw_key` from FileStatusResponse (preferred)
 *  - `now`: optional clock injection for deterministic tests
 *
 * Returns `null` when the config is incomplete (disabled / no scenario /
 * blank prompt), matching the original gating behaviour.
 */
export function configToCreateJobPayload(
  cfg: AugmentationConfig,
  uploadId: string,
  s3RawKey?: string | null,
  now?: number,
): JobCreationPlan | null {
  if (!cfg.enabled || !cfg.scenarioId || !cfg.prompt.trim()) return null
  const scenario = SCENARIOS[cfg.scenarioId]
  const templateId = cfg.templateId ?? generateTemplateId(cfg.scenarioId)
  const inputDatasetKey = deriveInputDatasetKey(uploadId, s3RawKey)
  const outputDatasetKey = deriveOutputDatasetKey(uploadId, templateId, s3RawKey, now)

  // Convert the scenario's schema field list → { name: dtype } map for the BE.
  const expectedInputSchema: Record<string, string> = {}
  for (const f of scenario.inputSchema) {
    expectedInputSchema[f.name] = f.type
  }
  const expectedOutputSchema: Record<string, string> = {}
  for (const f of scenario.outputSchema) {
    expectedOutputSchema[f.name] = f.type
  }

  const template: CreatePromptTemplateRequest | undefined = cfg.templateId
    ? undefined
    : {
        template_id: templateId,
        name: `${scenario.title} — ${cfg.scenarioId} (${new Date(
          now ?? Date.now(),
        ).toISOString()})`,
        prompt: cfg.prompt.trim(),
        expected_cardinality: scenario.cardinality,
        parameters: {
          scenario_id: cfg.scenarioId,
          column_mapping: cfg.mapping,
        },
        expected_input_schema: expectedInputSchema,
        expected_output_schema: expectedOutputSchema,
      }

  return {
    existingTemplateId: cfg.templateId ?? null,
    template,
    inputDatasetKey,
    outputDatasetKey,
    soxAuditEnabled: cfg.soxAuditEnabled,
  }
}

interface AugmentationPanelProps {
  value: AugmentationConfig
  onChange: (next: AugmentationConfig) => void
  /** Columns auto-detected from the file (optional — falls back to manual add). */
  sourceColumns?: SourceColumn[]
  /** Existing saved templates for the picker. */
  templates?: PromptTemplate[]
  /** Cognito access token for save-as-template. */
  accessToken?: string | null
  /** Show the on/off switch + title chrome (default true). Set false when
   *  embedding inside a higher-level form like the Jobs config. */
  showToggle?: boolean
  /** Initial collapsed state when toggle is shown. */
  defaultCollapsed?: boolean
  /** Optional className for the outer wrapper. */
  className?: string
}

export function AugmentationPanel({
  value,
  onChange,
  sourceColumns = [],
  templates = [],
  accessToken,
  showToggle = true,
  defaultCollapsed = true,
  className,
}: AugmentationPanelProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const [manualSources, setManualSources] = React.useState<SourceColumn[]>([])

  const allSources = React.useMemo(() => {
    const seen = new Set<string>()
    const out: SourceColumn[] = []
    for (const c of [...sourceColumns, ...manualSources]) {
      if (seen.has(c.name)) continue
      seen.add(c.name)
      out.push(c)
    }
    return out
  }, [sourceColumns, manualSources])

  const scenario: ScenarioDef | null =
    value.scenarioId ? SCENARIOS[value.scenarioId] : null

  const isExpanded = !showToggle || (value.enabled && !collapsed)

  const handleEnabledChange = (checked: boolean) => {
    onChange({ ...value, enabled: checked })
    if (checked) setCollapsed(false)
  }

  const handleScenarioChange = (id: ScenarioId) => {
    // Reset mapping when scenario changes (target schema changes).
    const same = id === value.scenarioId
    onChange({
      ...value,
      scenarioId: id,
      mapping: same ? value.mapping : {},
    })
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card",
        value.enabled && "border-violet-500/30 shadow-sm",
        className,
      )}
    >
      {/* Decorative gradient ribbon */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          value.enabled
            ? "bg-gradient-to-r from-violet-500/0 via-violet-500/60 to-fuchsia-500/0"
            : "bg-border",
        )}
      />

      {showToggle && (
        <button
          type="button"
          onClick={() => {
            if (!value.enabled) {
              handleEnabledChange(true)
            } else {
              setCollapsed((c) => !c)
            }
          }}
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-indigo-500/20 text-violet-600 dark:text-violet-300",
                value.enabled
                  ? "border-violet-500/40 ring-2 ring-violet-500/15"
                  : "border-border",
              )}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                Data Augmentation
                <Badge
                  variant="outline"
                  className="border-violet-500/30 bg-violet-500/10 font-mono text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300"
                >
                  RightRev · Beta
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Use Groq + Polars to expand, fold, or reshape this dataset before DQ.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={value.enabled}
              onCheckedChange={handleEnabledChange}
              onClick={(e) => e.stopPropagation()}
              aria-label="Enable data augmentation"
            />
            {value.enabled &&
              (collapsed ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ))}
          </div>
        </button>
      )}

      {isExpanded && (
        <div className={cn("space-y-5 px-4 pb-4", showToggle && "border-t pt-4")}>
          {/* 1. Scenario picker */}
          <section>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Step 1 — pick a scenario
            </h4>
            <ScenarioCards
              value={value.scenarioId}
              onChange={handleScenarioChange}
            />
          </section>

          {/* 2. Column mapping (only after scenario picked) */}
          {scenario && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Step 2 — map source columns → {scenario.title.toLowerCase()} schema
                </h4>
                <span className="font-mono text-[10px] text-muted-foreground">
                  cardinality: {scenario.cardinality}
                </span>
              </div>
              <ColumnMapper
                sourceColumns={allSources}
                targetFields={scenario.inputSchema}
                mapping={value.mapping}
                onMappingChange={(m) => onChange({ ...value, mapping: m })}
                onAddSourceColumn={(name) =>
                  setManualSources((prev) =>
                    prev.find((p) => p.name === name) ? prev : [...prev, { name }],
                  )
                }
              />
              {/* Output preview */}
              <details className="group mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium text-muted-foreground">
                  <span>
                    Expected output schema — {scenario.outputSchema.length} columns
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {scenario.outputSchema.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between gap-2 rounded-sm border bg-background/60 px-2 py-1"
                    >
                      <span className="font-medium">{f.name}</span>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        {f.type}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}

          {/* 3. Prompt composer */}
          <section>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Step 3 — describe the transformation
            </h4>
            <PromptComposer
              scenario={scenario}
              prompt={value.prompt}
              onPromptChange={(p) => onChange({ ...value, prompt: p })}
              templates={templates}
              selectedTemplateId={value.templateId}
              onTemplatePick={(id) => onChange({ ...value, templateId: id })}
              accessToken={accessToken}
            />
          </section>

          {/* 4. SOX audit toggle */}
          <section className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
            <div>
              <Label
                htmlFor="aug-sox-audit"
                className="text-xs font-medium"
              >
                SOX audit trail
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Record per-row lineage + expression hash for §404 evidence.
              </p>
            </div>
            <Switch
              id="aug-sox-audit"
              checked={value.soxAuditEnabled}
              onCheckedChange={(c) =>
                onChange({ ...value, soxAuditEnabled: c })
              }
            />
          </section>
        </div>
      )}
    </div>
  )
}
