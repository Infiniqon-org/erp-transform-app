/**
 * jobs-api.ts — typed API client for the Jobs Context.
 *
 * Backs the Wave-2 jobs UI uplift (jobs dashboard, scheduler config,
 * run-history drawer). Mirrors the routes exposed by
 * `contexts/jobs/presentation/api/handler.py`:
 *
 *   POST   /jobs/profiling-preview
 *   POST   /jobs
 *   GET    /jobs
 *   GET    /jobs/{job_id}
 *   PUT    /jobs/{job_id}
 *   DELETE /jobs/{job_id}
 *   POST   /jobs/{job_id}/pause
 *   POST   /jobs/{job_id}/resume
 *   POST   /jobs/{job_id}/trigger
 *   GET    /jobs/{job_id}/runs
 *   POST   /jobs/{job_id}/runs/{run_id}/resume
 *   POST   /jobs/{job_id}/runs/{run_id}/re-export
 *
 * Pattern matches `lib/api/augmentation.ts` and `lib/api/file-management-api.ts`:
 *   - fetch() + Authorization: Bearer <access token>
 *   - Base URL from AWS_CONFIG.API_BASE_URL (env-driven)
 *   - Caller passes the access token in (loaded via loadTokens()).
 */

import { AWS_CONFIG } from '../aws-config'
import type {
  CreateJobRequest,
  Job,
  JobActionResponse,
  JobListResponse,
  JobRun,
  JobRunsResponse,
  JobStatus,
  ProfilingPreviewRequest,
  ProfilingPreviewResponse,
  ReExportRequest,
  UpdateJobRequest,
} from '../types/jobs'
import { TERMINAL_RUN_STATUSES } from '../types/jobs'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// ─── Endpoints ────────────────────────────────────────────────────────────────

const ENDPOINTS = {
  JOBS: '/jobs',
  PROFILING_PREVIEW: '/jobs/profiling-preview',
  JOB_BY_ID: (id: string) => `/jobs/${encodeURIComponent(id)}`,
  JOB_PAUSE: (id: string) => `/jobs/${encodeURIComponent(id)}/pause`,
  JOB_RESUME: (id: string) => `/jobs/${encodeURIComponent(id)}/resume`,
  JOB_TRIGGER: (id: string) => `/jobs/${encodeURIComponent(id)}/trigger`,
  JOB_RUNS: (id: string) => `/jobs/${encodeURIComponent(id)}/runs`,
  RUN_RESUME: (jobId: string, runId: string) =>
    `/jobs/${encodeURIComponent(jobId)}/runs/${encodeURIComponent(runId)}/resume`,
  RUN_RE_EXPORT: (jobId: string, runId: string) =>
    `/jobs/${encodeURIComponent(jobId)}/runs/${encodeURIComponent(runId)}/re-export`,
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

class JobsApiError extends Error {
  status: number
  payload: unknown
  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'JobsApiError'
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
    throw new JobsApiError(message, response.status, data)
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

function buildQuery(
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const out = qs.toString()
  return out ? `?${out}` : ''
}

// ─── Jobs CRUD + actions ──────────────────────────────────────────────────────

/** POST /jobs/profiling-preview */
export async function getProfilingPreview(
  payload: ProfilingPreviewRequest,
  accessToken: string
): Promise<ProfilingPreviewResponse> {
  return request<ProfilingPreviewResponse>(
    ENDPOINTS.PROFILING_PREVIEW,
    accessToken,
    { method: 'POST', body: JSON.stringify(payload) }
  )
}

/** POST /jobs */
export async function createJob(
  payload: CreateJobRequest,
  accessToken: string
): Promise<Job> {
  return request<Job>(ENDPOINTS.JOBS, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** GET /jobs */
export async function listJobs(
  accessToken: string,
  params?: { limit?: number; cursor?: string; status?: JobStatus }
): Promise<JobListResponse> {
  const suffix = buildQuery(params)
  // Backend currently returns a bare array; normalize into JobListResponse.
  const raw = await request<Job[] | JobListResponse>(
    `${ENDPOINTS.JOBS}${suffix}`,
    accessToken,
    { method: 'GET' }
  )
  if (Array.isArray(raw)) {
    return { items: raw, count: raw.length, next_cursor: null }
  }
  return raw
}

/** GET /jobs/{job_id} */
export async function getJob(jobId: string, accessToken: string): Promise<Job> {
  return request<Job>(ENDPOINTS.JOB_BY_ID(jobId), accessToken, {
    method: 'GET',
  })
}

/** PUT /jobs/{job_id} */
export async function updateJob(
  jobId: string,
  payload: UpdateJobRequest,
  accessToken: string
): Promise<Job> {
  return request<Job>(ENDPOINTS.JOB_BY_ID(jobId), accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

/** DELETE /jobs/{job_id} */
export async function deleteJob(
  jobId: string,
  accessToken: string
): Promise<JobActionResponse> {
  return request<JobActionResponse>(ENDPOINTS.JOB_BY_ID(jobId), accessToken, {
    method: 'DELETE',
  })
}

/** POST /jobs/{job_id}/pause */
export async function pauseJob(
  jobId: string,
  accessToken: string
): Promise<JobActionResponse> {
  return request<JobActionResponse>(ENDPOINTS.JOB_PAUSE(jobId), accessToken, {
    method: 'POST',
  })
}

/** POST /jobs/{job_id}/resume */
export async function resumeJob(
  jobId: string,
  accessToken: string
): Promise<JobActionResponse> {
  return request<JobActionResponse>(ENDPOINTS.JOB_RESUME(jobId), accessToken, {
    method: 'POST',
  })
}

/** POST /jobs/{job_id}/trigger */
export async function triggerJob(
  jobId: string,
  accessToken: string
): Promise<JobActionResponse> {
  return request<JobActionResponse>(ENDPOINTS.JOB_TRIGGER(jobId), accessToken, {
    method: 'POST',
  })
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

/** GET /jobs/{job_id}/runs */
export async function listJobRuns(
  jobId: string,
  accessToken: string,
  params?: { limit?: number; cursor?: string }
): Promise<JobRunsResponse> {
  const suffix = buildQuery(params)
  const raw = await request<JobRun[] | JobRunsResponse>(
    `${ENDPOINTS.JOB_RUNS(jobId)}${suffix}`,
    accessToken,
    { method: 'GET' }
  )
  if (Array.isArray(raw)) {
    return { items: raw, count: raw.length, next_cursor: null }
  }
  return raw
}

/** POST /jobs/{job_id}/runs/{run_id}/resume — resume a failed run from checkpoint. */
export async function resumeRun(
  jobId: string,
  runId: string,
  accessToken: string
): Promise<JobActionResponse> {
  return request<JobActionResponse>(
    ENDPOINTS.RUN_RESUME(jobId, runId),
    accessToken,
    { method: 'POST' }
  )
}

/** POST /jobs/{job_id}/runs/{run_id}/re-export — re-export a successful run. */
export async function reExportRun(
  jobId: string,
  runId: string,
  payload: ReExportRequest,
  accessToken: string
): Promise<JobActionResponse> {
  return request<JobActionResponse>(
    ENDPOINTS.RUN_RE_EXPORT(jobId, runId),
    accessToken,
    { method: 'POST', body: JSON.stringify(payload) }
  )
}

// ─── Polling ──────────────────────────────────────────────────────────────────

/**
 * Polls a single JobRun until it reaches a terminal status or `maxAttempts`
 * is exhausted. Mirrors `pollAugmentationJob` in `lib/api/augmentation.ts`.
 *
 * Implementation note: the backend currently exposes runs only via the
 * list endpoint (GET /jobs/{job_id}/runs); we filter client-side to the
 * target `run_id`. If/when a per-run endpoint lands we'll swap the read.
 */
export async function pollJobRun(
  jobId: string,
  runId: string,
  accessToken: string,
  onUpdate: (run: JobRun) => void,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<JobRun> {
  const intervalMs = options?.intervalMs ?? 5000
  const maxAttempts = options?.maxAttempts ?? 240 // 20 min @ 5s
  let attempts = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempts += 1
    const response = await listJobRuns(jobId, accessToken)
    const run = response.items.find((r) => r.run_id === runId)
    if (run) {
      onUpdate(run)
      if (TERMINAL_RUN_STATUSES.includes(run.status as any)) return run
    }
    if (attempts >= maxAttempts) {
      throw new JobsApiError(
        `Polling timeout for run ${runId} after ${attempts} attempts`,
        408
      )
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { JobsApiError }
export type {
  CreateJobRequest,
  Job,
  JobActionResponse,
  JobListResponse,
  JobRun,
  JobRunsResponse,
  JobStatus,
  ProfilingPreviewRequest,
  ProfilingPreviewResponse,
  ReExportRequest,
  UpdateJobRequest,
} from '../types/jobs'
