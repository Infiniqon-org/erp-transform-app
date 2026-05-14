/**
 * jobs.ts — TypeScript types for the Jobs Context API.
 *
 * Mirrors the contract of `contexts/jobs/presentation/api/handler.py`
 * (cleanflowai_aws @ feature/soc2-remediation) and the domain entities
 * in `contexts/jobs/domain/models/job.py`. Consumed by `lib/api/jobs-api.ts`
 * and the Wave-2 jobs dashboard / scheduler UI.
 *
 * NOTE on field naming:
 *   - Backend accepts both wizard-style (`source`/`destination`) and
 *     canonical (`source_provider`/`destination_provider`) field names on
 *     POST /jobs. The types here use the canonical form everywhere; the
 *     API client passes them through as-is.
 *   - All field names mirror the DynamoDB schema (snake_case, no camel
 *     conversion) so server responses are typed directly.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Lifecycle states for a Job (`JobStatus` in domain/models/job.py). */
export type JobStatus = 'ACTIVE' | 'PAUSED' | 'AUTO_PAUSED' | 'DELETED'

export const JOB_STATUS_VALUES: readonly JobStatus[] = [
  'ACTIVE',
  'PAUSED',
  'AUTO_PAUSED',
  'DELETED',
] as const

/** Lifecycle states for a JobRun (`RunStatus` in domain/models/job.py). */
export type RunStatus =
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'PARTIAL'
  | 'NO_CHANGES'
  | 'SKIPPED'
  | 'AWAITING_REVIEW'

export const RUN_STATUS_VALUES: readonly RunStatus[] = [
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'PARTIAL',
  'NO_CHANGES',
  'SKIPPED',
  'AWAITING_REVIEW',
] as const

/** Statuses considered terminal — `pollJobRun` stops on these. */
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  'SUCCESS',
  'FAILED',
  'PARTIAL',
  'NO_CHANGES',
  'SKIPPED',
  'AWAITING_REVIEW',
] as const

/** Provider category — mirrors `_CATEGORY_BY_PROVIDER` in handler.py. */
export type ProviderCategory = 'erp' | 'warehouse' | 'storage'

/** Frequency type — "rate" / "cron" / "batch" (manual). */
export type FrequencyType = 'rate' | 'cron' | 'batch'

// ─── Job config sub-shapes ────────────────────────────────────────────────────

/**
 * Free-form per-provider config. Shape varies by provider, e.g.:
 *   - quickbooks: { connection_id, realm_id }
 *   - snowflake: { connection_id, database, schema, table }
 *   - googledrive: { connection_id, file_id }
 */
export type SourceConfig = Record<string, unknown>
export type DestinationConfig = Record<string, unknown>

/** Column-rename map (`{ src_col: dest_col }`). */
export type ColumnMapping = Record<string, string>

/** DQ overrides for a job. Forwarded to the DQ engine at run time. */
export type DqConfig = Record<string, unknown>

/** Export-side knobs (batch_size, retry policy, etc.). */
export type ExportConfig = Record<string, unknown>

/**
 * Composite "job configuration" shape — convenience wrapper around the
 * individual config fields above. The backend stores each field separately;
 * this type exists for components that want to pass them around as a bag.
 */
export interface JobConfig {
  source_provider: string
  source_category: ProviderCategory | string
  source_config: SourceConfig
  destination_provider: string
  destination_category: ProviderCategory | string
  destination_config: DestinationConfig
  entities: string[]
  column_mapping: ColumnMapping
  frequency_type: FrequencyType | string
  frequency_value: string
  dq_config: DqConfig
  export_config: ExportConfig
  responsible_user_id?: string
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

/**
 * Payload accepted by `createJob` (POST /jobs).
 * Field names match the canonical backend contract (handler also accepts
 * `source`/`destination` aliases but we don't use those here).
 */
export interface CreateJobRequest {
  name: string
  source_provider: string
  source_category?: ProviderCategory | string
  destination_provider: string
  destination_category?: ProviderCategory | string
  entities: string[]
  frequency_type?: FrequencyType | string
  frequency_value?: string
  source_config?: SourceConfig
  destination_config?: DestinationConfig
  column_mapping?: ColumnMapping
  dq_config?: DqConfig
  export_config?: ExportConfig
  responsible_user_id?: string
}

/** Payload accepted by `updateJob` (PUT /jobs/{job_id}). All fields optional. */
export interface UpdateJobRequest {
  name?: string
  entities?: string[]
  frequency_type?: FrequencyType | string
  frequency_value?: string
  source_config?: SourceConfig
  destination_config?: DestinationConfig
  column_mapping?: ColumnMapping
  dq_config?: DqConfig
  export_config?: ExportConfig
  responsible_user_id?: string
}

/**
 * Server-side Job record returned by GET /jobs[/{id}].
 * Field names mirror the `Job` dataclass in domain/models/job.py exactly.
 */
export interface Job {
  user_id: string
  job_id: string
  name: string

  source_provider: string
  source_category: string
  source_config: SourceConfig

  destination_provider: string
  destination_category: string
  destination_config: DestinationConfig

  entities: string[]
  column_mapping: ColumnMapping

  frequency_type: string
  frequency_value: string
  status: JobStatus | string

  dq_config: DqConfig
  export_config: ExportConfig

  consecutive_failures?: number
  total_runs?: number
  last_run_status?: string
  last_run_at?: string

  org_id?: string
  created_by?: string

  responsible_user_id?: string
  created_at: string
  updated_at?: string
}

/**
 * JobListResponse — backend currently returns either a bare list or a wrapper.
 * The API client normalizes both shapes to this interface.
 */
export interface JobListResponse {
  items: Job[]
  next_cursor?: string | null
  count?: number
}

/** Server-side JobRun record (mirrors the `JobRun` dataclass). */
export interface JobRun {
  job_id: string
  run_id: string
  user_id?: string
  status: RunStatus | string
  trigger_source?: string

  started_at?: string
  completed_at?: string
  duration_ms?: number

  total_imported?: number
  total_exported?: number
  total_quarantined?: number
  total_failed?: number

  entity_results?: Record<string, unknown>
  pipeline_logs?: Array<Record<string, unknown>>

  processing_metadata?: Record<string, unknown>
  correlation_id?: string

  error_code?: string
  error_message?: string
}

export interface JobRunsResponse {
  items: JobRun[]
  next_cursor?: string | null
  count?: number
}

// ─── Profiling Preview ────────────────────────────────────────────────────────

/** POST /jobs/profiling-preview body. */
export interface ProfilingPreviewRequest {
  source_provider: string
  source_category?: ProviderCategory | string
  entity: string
  source_config?: SourceConfig
  selected_columns?: string[]
  sample_size?: number
}

/**
 * Profiling response — shape is backend-driven and may evolve. We use a
 * permissive surface here (columns + sample rows + a free-form `profile` bag)
 * so the UI doesn't need to chase server changes.
 */
export interface ProfilingPreviewResponse {
  columns?: string[]
  sample_rows?: Array<Record<string, unknown>>
  total_rows?: number
  profile?: Record<string, unknown>
  /** Provider-side warnings (rate-limit hints, partial sample, ...). */
  warnings?: string[]
}

// ─── Run actions ──────────────────────────────────────────────────────────────

/** POST /jobs/{id}/runs/{run_id}/re-export body. */
export interface ReExportRequest {
  upload_id: string
  column_mapping?: ColumnMapping
}

/** Generic ack returned by trigger / pause / resume / re-export. */
export interface JobActionResponse {
  job_id?: string
  run_id?: string
  status?: string
  message?: string
  [key: string]: unknown
}

// ─── Generic ──────────────────────────────────────────────────────────────────

export interface JobsApiErrorPayload {
  status: number
  error: string
  details?: unknown
}
