/**
 * augmentation.ts — TypeScript types for the Augmentation Context API.
 *
 * Mirrors the contract of `contexts/augmentation/presentation/api/handler.py`
 * (cleanflowai_aws @ feature/soc2-remediation). These types are consumed by
 * `lib/api/augmentation.ts` and by wizard / dashboard components in the
 * "Advanced Configuration" upload step.
 *
 * Wire shape (post FE-BE-001 fix, 2026-05-14):
 *   POST /augmentation/prompt-templates →
 *     { template_id, name, prompt_text, cardinality, expected_input_schema,
 *       expected_output_schema }
 *   POST /augmentation/jobs →
 *     { prompt_template_id, input_dataset_key, output_dataset_key,
 *       sox_audit_enabled? }
 *
 * The FE owns the contract translation: scenario-card configs are unpacked
 * client-side into two sequential POSTs (template register → job create).
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * Expected output cardinality relative to the input rows.
 *  - ONE_TO_MANY: 1 contract → M monthly rev-rec rows (expand)
 *  - MANY_TO_ONE: N monthly invoices → 1 annual summary (fold)
 *  - MANY_TO_MANY: N events → K canonical rows (reshape, with SOX lineage)
 *
 * Values mirror `contexts/augmentation/domain/models/prompt_template.Cardinality`.
 */
export type Cardinality = 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY'

export const CARDINALITY_VALUES: readonly Cardinality[] = [
  'ONE_TO_MANY',
  'MANY_TO_ONE',
  'MANY_TO_MANY',
] as const

/** Lifecycle states for an AugmentationJob (mirrors backend Step Functions). */
export type AugmentationJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

/** Statuses considered terminal — polling should stop on these. */
export const TERMINAL_JOB_STATUSES: readonly AugmentationJobStatus[] = [
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const

// ─── Jobs ─────────────────────────────────────────────────────────────────────

/**
 * Canonical wire payload for POST /augmentation/jobs. The BE handler at
 * `contexts/augmentation/presentation/api/handler.py:78` requires the three
 * `prompt_template_id` / `input_dataset_key` / `output_dataset_key` fields;
 * everything else is optional.
 *
 * The wizard does not invoke this directly — call `executeAugmentationFromConfig`
 * (see `lib/api/augmentation.ts`) which orchestrates the
 * register-template-then-create-job flow.
 */
export interface CreateJobRequest {
  /** Active prompt-template id (must exist server-side). */
  prompt_template_id: string
  /** S3 key of the input parquet (typically `data/{org}/{upload_id}/result.parquet`). */
  input_dataset_key: string
  /** S3 key where the augmented parquet should be written. */
  output_dataset_key: string
  /** Toggle SOX audit trail (required for regulated tenants). */
  sox_audit_enabled?: boolean
}

/**
 * Server-side job record returned by GET /augmentation/jobs[/{id}].
 * Field names match the DynamoDB schema exactly (no camelCase conversion).
 */
export interface AugmentationJob {
  job_id: string
  org_id: string
  user_id: string
  status: AugmentationJobStatus
  created_at: string
  updated_at?: string
  /** Server-rendered ISO timestamp used to sort jobs in the GSI. */
  status_created_at?: string
  prompt_template_id?: string
  input_dataset_key?: string
  output_dataset_key?: string
  output_s3_key?: string
  /** 0-100 integer; absent / 0 when the job has not started shard execution. */
  percent?: number
  rows_in?: number
  rows_out?: number
  error_message?: string
  sox_audit_enabled?: boolean
}

export interface JobListResponse {
  items: AugmentationJob[]
  next_cursor?: string | null
  count?: number
}

/** Single row in a job's output preview (`GET /augmentation/jobs/{id}/output`). */
export interface JobOutputRow {
  row_index: number
  /** Free-form column→value map; null indicates a deleted/quarantined cell. */
  values: Record<string, string | number | boolean | null>
}

export interface JobOutputResponse {
  /** Inline rows when the result is small; otherwise empty. */
  rows?: JobOutputRow[]
  /** Total rows available across all pages. */
  total?: number
  next_offset?: number | null
  /** Presigned URL when the server prefers a direct S3 download over inline rows. */
  presigned_url?: string
  /** S3 key (relative to the data-lake bucket) — useful for diagnostics. */
  output_s3_key?: string
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────

/**
 * Wizard-facing payload for POST /augmentation/prompt-templates.
 * The client expands this into the backend canonical fields
 * (`template_id`, `prompt_text`, `cardinality`, expected schemas).
 *
 * Note: BE requires `expected_input_schema` + `expected_output_schema` as
 * non-empty dicts. The client supplies sensible defaults if omitted.
 */
export interface CreatePromptTemplateRequest {
  /** Human-readable name shown in the wizard's template picker. */
  name: string
  /** Natural-language augmentation prompt (Jinja-style placeholders allowed). */
  prompt: string
  /** Backend `Cardinality` enum value (ONE_TO_MANY | MANY_TO_ONE | MANY_TO_MANY). */
  expected_cardinality: Cardinality
  /** Optional structured parameter schema (JSON-schema-ish). */
  parameters?: Record<string, unknown>
  /** Optional explicit template_id; client generates a UUID if omitted. */
  template_id?: string
  /** Optional input/output schemas — required by backend; client supplies defaults. */
  expected_input_schema?: Record<string, unknown>
  expected_output_schema?: Record<string, unknown>
}

/** A single immutable version of a prompt template. */
export interface PromptTemplateVersion {
  template_id: string
  version: number
  is_active: boolean
  name: string
  prompt_text: string
  cardinality: Cardinality
  parameters?: Record<string, unknown>
  expected_input_schema?: Record<string, unknown>
  expected_output_schema?: Record<string, unknown>
  created_at: string
  created_by?: string
}

/**
 * Active prompt template (collapsed view).
 * The GET endpoint returns the currently-active version; older versions are
 * read via the `versions` array when present.
 */
export interface PromptTemplate {
  template_id: string
  name: string
  active_version: number
  prompt: string
  expected_cardinality: Cardinality
  parameters?: Record<string, unknown>
  created_at: string
  updated_at?: string
  /** Optionally populated by list endpoints that pre-join the version table. */
  versions?: PromptTemplateVersion[]
}

export interface PromptTemplateListResponse {
  items: PromptTemplate[]
  next_cursor?: string | null
}

// ─── Generic ──────────────────────────────────────────────────────────────────

export interface AugmentationApiError {
  status: number
  error: string
  details?: unknown
}
