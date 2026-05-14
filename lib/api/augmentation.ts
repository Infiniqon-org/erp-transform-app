/**
 * augmentation.ts — typed API client for the Augmentation Context.
 *
 * Backs the 5-step upload wizard's "Advanced Configuration" step and the
 * Augmentation-job dashboard. Mirrors the routes exposed by
 * `contexts/augmentation/presentation/api/handler.py`:
 *
 *   POST   /augmentation/jobs
 *   GET    /augmentation/jobs
 *   GET    /augmentation/jobs/{job_id}
 *   GET    /augmentation/jobs/{job_id}/output
 *   POST   /augmentation/prompt-templates
 *   GET    /augmentation/prompt-templates
 *   DELETE /augmentation/prompt-templates/{template_id}/versions/{version}
 *
 * Pattern matches `lib/api/file-management-api.ts`:
 *   - fetch() + Authorization: Bearer <access token>
 *   - Base URL from AWS_CONFIG.API_BASE_URL (env-driven)
 *   - Caller passes the access token in (loaded via loadTokens()).
 *   - For components that need 401-retry + idle-timeout, prefer the
 *     authenticatedFetch helper from lib/auth-session.ts — see the
 *     `*WithAuthedFetch` variants at the bottom of this file.
 */

import { AWS_CONFIG } from '../aws-config'
import type {
  AugmentationJob,
  AugmentationJobStatus,
  CreateJobRequest,
  CreatePromptTemplateRequest,
  JobListResponse,
  JobOutputResponse,
  PromptTemplate,
  PromptTemplateListResponse,
  PromptTemplateVersion,
} from '../types/augmentation'
import { TERMINAL_JOB_STATUSES } from '../types/augmentation'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// ─── Endpoints ────────────────────────────────────────────────────────────────

const ENDPOINTS = {
  JOBS: '/augmentation/jobs',
  JOB_BY_ID: (id: string) => `/augmentation/jobs/${encodeURIComponent(id)}`,
  JOB_OUTPUT: (id: string) =>
    `/augmentation/jobs/${encodeURIComponent(id)}/output`,
  TEMPLATES: '/augmentation/prompt-templates',
  TEMPLATE_VERSION: (templateId: string, version: number) =>
    `/augmentation/prompt-templates/${encodeURIComponent(templateId)}/versions/${version}`,
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

class AugmentationApiError extends Error {
  status: number
  payload: unknown
  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'AugmentationApiError'
    this.status = status
    this.payload = payload
  }
}

async function request<T>(
  endpoint: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const response = await fetch(url, { ...init, headers })
  const text = await response.text()
  const data = text ? safeJsonParse(text) : null

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `HTTP ${response.status} ${response.statusText}`
    throw new AugmentationApiError(message, response.status, data)
  }
  return data as T
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Build the canonical POST /augmentation/jobs body. The BE handler requires
 * the three template_id/input_key/output_key fields (see handler.py:78).
 */
function toCreateJobWirePayload(req: CreateJobRequest): Record<string, unknown> {
  return {
    prompt_template_id: req.prompt_template_id,
    input_dataset_key: req.input_dataset_key,
    output_dataset_key: req.output_dataset_key,
    sox_audit_enabled: req.sox_audit_enabled ?? false,
  }
}

function toCreateTemplateWirePayload(
  req: CreatePromptTemplateRequest
): Record<string, unknown> {
  // BE rejects empty-dict schemas via `_require_nonblank` on `prompt_text` plus
  // dict-type checks; supply a single placeholder field so the dict is non-empty
  // but stays schema-shaped. Wizard surfaces an inferred shape when available.
  const defaultInputSchema = { value: 'Utf8' }
  const defaultOutputSchema = { value: 'Utf8' }
  return {
    template_id:
      req.template_id ??
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `tmpl_${Date.now()}`),
    name: req.name,
    prompt_text: req.prompt,
    cardinality: req.expected_cardinality,
    parameters: req.parameters ?? {},
    expected_input_schema:
      req.expected_input_schema && Object.keys(req.expected_input_schema).length > 0
        ? req.expected_input_schema
        : defaultInputSchema,
    expected_output_schema:
      req.expected_output_schema && Object.keys(req.expected_output_schema).length > 0
        ? req.expected_output_schema
        : defaultOutputSchema,
  }
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

/** POST /augmentation/jobs */
export async function createAugmentationJob(
  payload: CreateJobRequest,
  accessToken: string
): Promise<AugmentationJob> {
  return request<AugmentationJob>(ENDPOINTS.JOBS, accessToken, {
    method: 'POST',
    body: JSON.stringify(toCreateJobWirePayload(payload)),
  })
}

/** GET /augmentation/jobs */
export async function listAugmentationJobs(
  accessToken: string,
  params?: { limit?: number; cursor?: string; status?: AugmentationJobStatus }
): Promise<JobListResponse> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.cursor) qs.set('cursor', params.cursor)
  if (params?.status) qs.set('status', params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''

  // Backend currently returns a bare array; normalize into JobListResponse.
  const raw = await request<AugmentationJob[] | JobListResponse>(
    `${ENDPOINTS.JOBS}${suffix}`,
    accessToken,
    { method: 'GET' }
  )
  if (Array.isArray(raw)) {
    return { items: raw, count: raw.length, next_cursor: null }
  }
  return raw
}

/** GET /augmentation/jobs/{job_id} */
export async function getAugmentationJob(
  jobId: string,
  accessToken: string
): Promise<AugmentationJob> {
  return request<AugmentationJob>(ENDPOINTS.JOB_BY_ID(jobId), accessToken, {
    method: 'GET',
  })
}

/** GET /augmentation/jobs/{job_id}/output */
export async function getAugmentationJobOutput(
  jobId: string,
  accessToken: string,
  params?: { offset?: number; limit?: number }
): Promise<JobOutputResponse> {
  const qs = new URLSearchParams()
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''

  return request<JobOutputResponse>(
    `${ENDPOINTS.JOB_OUTPUT(jobId)}${suffix}`,
    accessToken,
    { method: 'GET' }
  )
}

/**
 * Polls an augmentation job until it reaches a terminal status or `maxAttempts`
 * is exhausted. Mirrors the smart-poll pattern in `file-management-api.ts`.
 */
export async function pollAugmentationJob(
  jobId: string,
  accessToken: string,
  onUpdate: (job: AugmentationJob) => void,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<AugmentationJob> {
  const intervalMs = options?.intervalMs ?? 5000
  const maxAttempts = options?.maxAttempts ?? 240 // 20 min @ 5s
  let attempts = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempts += 1
    const job = await getAugmentationJob(jobId, accessToken)
    onUpdate(job)
    if (TERMINAL_JOB_STATUSES.includes(job.status)) return job
    if (attempts >= maxAttempts) {
      throw new AugmentationApiError(
        `Polling timeout for job ${jobId} after ${attempts} attempts`,
        408
      )
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────

/** POST /augmentation/prompt-templates */
export async function createPromptTemplate(
  payload: CreatePromptTemplateRequest,
  accessToken: string
): Promise<PromptTemplateVersion> {
  return request<PromptTemplateVersion>(ENDPOINTS.TEMPLATES, accessToken, {
    method: 'POST',
    body: JSON.stringify(toCreateTemplateWirePayload(payload)),
  })
}

/**
 * GET /augmentation/prompt-templates
 *
 * The backend currently requires `template_id` and returns a single active
 * version. Until a list endpoint lands, this client returns a list-shaped
 * response so callers can render a (possibly single-item) picker.
 */
export async function listPromptTemplates(
  accessToken: string,
  params?: { template_id?: string }
): Promise<PromptTemplateListResponse> {
  const qs = new URLSearchParams()
  if (params?.template_id) qs.set('template_id', params.template_id)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''

  try {
    const raw = await request<any>(
      `${ENDPOINTS.TEMPLATES}${suffix}`,
      accessToken,
      { method: 'GET' }
    )
    if (Array.isArray(raw)) return { items: raw as PromptTemplate[] }
    if (raw && Array.isArray(raw.items)) return raw as PromptTemplateListResponse
    if (raw && raw.template_id) {
      // Single-active-version shape from the current handler.
      const t: PromptTemplate = {
        template_id: raw.template_id,
        name: raw.name ?? raw.template_id,
        active_version: Number(raw.version ?? 1),
        prompt: raw.prompt_text ?? '',
        expected_cardinality: raw.cardinality ?? 'ONE_TO_MANY',
        parameters: raw.parameters ?? {},
        created_at: raw.created_at ?? '',
      }
      return { items: [t] }
    }
    return { items: [] }
  } catch (err) {
    // 404 → no active template for this id; surface as empty list.
    if (err instanceof AugmentationApiError && err.status === 404) {
      return { items: [] }
    }
    throw err
  }
}

/** DELETE /augmentation/prompt-templates/{template_id}/versions/{version} */
export async function deletePromptTemplateVersion(
  templateId: string,
  version: number,
  accessToken: string
): Promise<{ deactivated: boolean; template_id: string; version: number }> {
  return request(ENDPOINTS.TEMPLATE_VERSION(templateId, version), accessToken, {
    method: 'DELETE',
  })
}

// ─── 2-step orchestrator (FE-BE-001 fix) ──────────────────────────────────────

/**
 * Caller-side plan describing what the wizard wants to dispatch. The
 * `configToCreateJobPayload` helper (and equivalents in the Wave N+4 wizard)
 * emit this; `executeAugmentationFromConfig` consumes it.
 *
 * If `existingTemplateId` is set, the template registration step is skipped
 * and that id is used directly. Otherwise the orchestrator POSTs to
 * /augmentation/prompt-templates first to obtain a template_id.
 *
 * `inputDatasetKey` / `outputDatasetKey` are computed by the caller from
 * the file's `s3_raw_key`. Today we follow the convention
 *   input:  data/{org}/{upload_id}/result.parquet
 *   output: data/{org}/{upload_id}/augmented/{template_id}_{timestamp}.parquet
 * The BE never re-derives these from upload_id — it consumes the strings as-is.
 */
export interface JobCreationPlan {
  /** Reuse an existing template instead of POSTing a new one. */
  existingTemplateId?: string | null
  /** Fields used to register a new template when `existingTemplateId` is null. */
  template?: CreatePromptTemplateRequest
  /** Canonical S3 key of the input parquet. */
  inputDatasetKey: string
  /** Canonical S3 key of the output parquet. */
  outputDatasetKey: string
  /** Whether to enable SOX audit trail on the resulting job. */
  soxAuditEnabled?: boolean
}

export interface AugmentationDispatchResult {
  job: AugmentationJob
  templateId: string
  templateCreated: boolean
}

/**
 * Two-step dispatch: register the prompt template if needed, then create the
 * augmentation job. Surfaces a typed error when the BE rejects either call.
 */
export async function executeAugmentationFromConfig(
  plan: JobCreationPlan,
  accessToken: string
): Promise<AugmentationDispatchResult> {
  let templateId = plan.existingTemplateId ?? null
  let templateCreated = false

  if (!templateId) {
    if (!plan.template) {
      throw new AugmentationApiError(
        'JobCreationPlan: neither existingTemplateId nor template was provided',
        400
      )
    }
    const version = await createPromptTemplate(plan.template, accessToken)
    templateId = version.template_id
    templateCreated = true
  }

  const job = await createAugmentationJob(
    {
      prompt_template_id: templateId,
      input_dataset_key: plan.inputDatasetKey,
      output_dataset_key: plan.outputDatasetKey,
      sox_audit_enabled: plan.soxAuditEnabled ?? false,
    },
    accessToken
  )
  return { job, templateId, templateCreated }
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export { AugmentationApiError }
export type {
  AugmentationJob,
  AugmentationJobStatus,
  CreateJobRequest,
  CreatePromptTemplateRequest,
  JobListResponse,
  JobOutputResponse,
  PromptTemplate,
  PromptTemplateListResponse,
  PromptTemplateVersion,
} from '../types/augmentation'
