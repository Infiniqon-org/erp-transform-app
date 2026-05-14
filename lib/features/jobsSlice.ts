/**
 * jobsSlice.ts — Redux Toolkit slice for the Jobs context.
 *
 * Backs the Wave-2 jobs UI uplift (jobs dashboard, scheduler config,
 * run-history drawer). Thunks wrap the API client in `lib/api/jobs-api.ts`;
 * the slice owns the local UI state for list / filters / active job / runs /
 * polling cursors.
 *
 * Pattern matches existing slices (`transformSlice`, `dashboardSlice`):
 *   - createSlice + createAsyncThunk
 *   - reducers + extraReducers
 *   - exports both the actions and the default reducer
 */

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'

import {
  createJob as apiCreateJob,
  deleteJob as apiDeleteJob,
  getJob as apiGetJob,
  listJobs as apiListJobs,
  listJobRuns as apiListJobRuns,
  pauseJob as apiPauseJob,
  pollJobRun as apiPollJobRun,
  reExportRun as apiReExportRun,
  resumeJob as apiResumeJob,
  resumeRun as apiResumeRun,
  triggerJob as apiTriggerJob,
  updateJob as apiUpdateJob,
  JobsApiError,
} from '../api/jobs-api'
import type {
  CreateJobRequest,
  Job,
  JobActionResponse,
  JobRun,
  JobStatus,
  ReExportRequest,
  UpdateJobRequest,
} from '../types/jobs'

// ─── State shape ──────────────────────────────────────────────────────────────

export interface JobsFilters {
  status?: JobStatus
  search?: string
  source_provider?: string
  destination_provider?: string
}

export interface PollingState {
  /** Currently-polled run, if any. */
  runId: string | null
  jobId: string | null
  isPolling: boolean
  error: string | null
}

export interface JobsState {
  // List view
  list: Job[]
  listLoading: boolean
  listError: string | null
  nextCursor: string | null

  // Filters
  filters: JobsFilters

  // Detail view
  activeJobId: string | null
  activeJob: Job | null
  activeJobLoading: boolean
  activeJobError: string | null

  // Run history (keyed by job_id)
  runs: Record<string, JobRun[]>
  runsLoading: boolean
  runsError: string | null

  // Mutation status
  mutating: boolean
  mutationError: string | null

  // Polling
  polling: PollingState
}

const initialState: JobsState = {
  list: [],
  listLoading: false,
  listError: null,
  nextCursor: null,

  filters: {},

  activeJobId: null,
  activeJob: null,
  activeJobLoading: false,
  activeJobError: null,

  runs: {},
  runsLoading: false,
  runsError: null,

  mutating: false,
  mutationError: null,

  polling: {
    runId: null,
    jobId: null,
    isPolling: false,
    error: null,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof JobsApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

// ─── Async thunks ─────────────────────────────────────────────────────────────

export const fetchJobs = createAsyncThunk<
  { items: Job[]; nextCursor: string | null },
  { accessToken: string; limit?: number; cursor?: string; status?: JobStatus } | string,
  { rejectValue: string }
>('jobs/fetchJobs', async (arg, { rejectWithValue }) => {
  // Accept either a plain access-token string (common case) or a params object.
  const params = typeof arg === 'string' ? { accessToken: arg } : arg
  const { accessToken, ...rest } = params
  try {
    const res = await apiListJobs(accessToken, rest)
    return { items: res.items, nextCursor: res.next_cursor ?? null }
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to load jobs'))
  }
})

export const fetchJob = createAsyncThunk<
  Job,
  { jobId: string; accessToken: string },
  { rejectValue: string }
>('jobs/fetchJob', async ({ jobId, accessToken }, { rejectWithValue }) => {
  try {
    return await apiGetJob(jobId, accessToken)
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to load job'))
  }
})

export const createJob = createAsyncThunk<
  Job,
  { payload: CreateJobRequest; accessToken: string },
  { rejectValue: string }
>('jobs/createJob', async ({ payload, accessToken }, { rejectWithValue }) => {
  try {
    return await apiCreateJob(payload, accessToken)
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to create job'))
  }
})

export const updateJob = createAsyncThunk<
  Job,
  { jobId: string; payload: UpdateJobRequest; accessToken: string },
  { rejectValue: string }
>('jobs/updateJob', async ({ jobId, payload, accessToken }, { rejectWithValue }) => {
  try {
    return await apiUpdateJob(jobId, payload, accessToken)
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to update job'))
  }
})

export const deleteJob = createAsyncThunk<
  { jobId: string; response: JobActionResponse },
  { jobId: string; accessToken: string },
  { rejectValue: string }
>('jobs/deleteJob', async ({ jobId, accessToken }, { rejectWithValue }) => {
  try {
    const response = await apiDeleteJob(jobId, accessToken)
    return { jobId, response }
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to delete job'))
  }
})

export const pauseJob = createAsyncThunk<
  { jobId: string; response: JobActionResponse },
  { jobId: string; accessToken: string },
  { rejectValue: string }
>('jobs/pauseJob', async ({ jobId, accessToken }, { rejectWithValue }) => {
  try {
    const response = await apiPauseJob(jobId, accessToken)
    return { jobId, response }
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to pause job'))
  }
})

export const resumeJob = createAsyncThunk<
  { jobId: string; response: JobActionResponse },
  { jobId: string; accessToken: string },
  { rejectValue: string }
>('jobs/resumeJob', async ({ jobId, accessToken }, { rejectWithValue }) => {
  try {
    const response = await apiResumeJob(jobId, accessToken)
    return { jobId, response }
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to resume job'))
  }
})

export const triggerJob = createAsyncThunk<
  { jobId: string; response: JobActionResponse },
  { jobId: string; accessToken: string },
  { rejectValue: string }
>('jobs/triggerJob', async ({ jobId, accessToken }, { rejectWithValue }) => {
  try {
    const response = await apiTriggerJob(jobId, accessToken)
    return { jobId, response }
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to trigger job'))
  }
})

export const fetchJobRuns = createAsyncThunk<
  { jobId: string; runs: JobRun[] },
  { jobId: string; accessToken: string; limit?: number; cursor?: string },
  { rejectValue: string }
>('jobs/fetchJobRuns', async ({ jobId, accessToken, ...rest }, { rejectWithValue }) => {
  try {
    const res = await apiListJobRuns(jobId, accessToken, rest)
    return { jobId, runs: res.items }
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to load job runs'))
  }
})

export const resumeRun = createAsyncThunk<
  JobActionResponse,
  { jobId: string; runId: string; accessToken: string },
  { rejectValue: string }
>('jobs/resumeRun', async ({ jobId, runId, accessToken }, { rejectWithValue }) => {
  try {
    return await apiResumeRun(jobId, runId, accessToken)
  } catch (err) {
    return rejectWithValue(errorMessage(err, 'Failed to resume run'))
  }
})

export const reExportRun = createAsyncThunk<
  JobActionResponse,
  { jobId: string; runId: string; payload: ReExportRequest; accessToken: string },
  { rejectValue: string }
>(
  'jobs/reExportRun',
  async ({ jobId, runId, payload, accessToken }, { rejectWithValue }) => {
    try {
      return await apiReExportRun(jobId, runId, payload, accessToken)
    } catch (err) {
      return rejectWithValue(errorMessage(err, 'Failed to re-export run'))
    }
  }
)

/**
 * pollRun — kicks off polling for a JobRun and dispatches incremental
 * updates into `state.runs[jobId]` as the run progresses. Resolves with
 * the terminal-status JobRun (or rejects on timeout).
 */
export const pollRun = createAsyncThunk<
  JobRun,
  {
    jobId: string
    runId: string
    accessToken: string
    intervalMs?: number
    maxAttempts?: number
  },
  { rejectValue: string }
>(
  'jobs/pollRun',
  async (
    { jobId, runId, accessToken, intervalMs, maxAttempts },
    { dispatch, rejectWithValue }
  ) => {
    try {
      return await apiPollJobRun(
        jobId,
        runId,
        accessToken,
        (run) => dispatch(runProgressUpdate({ jobId, run })),
        { intervalMs, maxAttempts }
      )
    } catch (err) {
      return rejectWithValue(errorMessage(err, 'Polling failed'))
    }
  }
)

// ─── Slice ────────────────────────────────────────────────────────────────────

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<JobsFilters>) => {
      state.filters = action.payload
    },
    updateFilters: (state, action: PayloadAction<Partial<JobsFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    clearFilters: (state) => {
      state.filters = {}
    },
    setActiveJobId: (state, action: PayloadAction<string | null>) => {
      state.activeJobId = action.payload
      if (action.payload === null) {
        state.activeJob = null
        state.activeJobError = null
      }
    },
    clearActiveJob: (state) => {
      state.activeJobId = null
      state.activeJob = null
      state.activeJobError = null
    },
    clearMutationError: (state) => {
      state.mutationError = null
    },
    runProgressUpdate: (
      state,
      action: PayloadAction<{ jobId: string; run: JobRun }>
    ) => {
      const { jobId, run } = action.payload
      const bucket = state.runs[jobId] ? [...state.runs[jobId]] : []
      const idx = bucket.findIndex((r) => r.run_id === run.run_id)
      if (idx >= 0) bucket[idx] = run
      else bucket.unshift(run)
      state.runs[jobId] = bucket
    },
    resetJobs: () => initialState,
  },
  extraReducers: (builder) => {
    // fetchJobs
    builder
      .addCase(fetchJobs.pending, (state) => {
        state.listLoading = true
        state.listError = null
      })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.listLoading = false
        state.list = action.payload.items
        state.nextCursor = action.payload.nextCursor
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.listLoading = false
        state.listError = action.payload ?? action.error.message ?? 'Failed to load jobs'
      })

    // fetchJob
    builder
      .addCase(fetchJob.pending, (state) => {
        state.activeJobLoading = true
        state.activeJobError = null
      })
      .addCase(fetchJob.fulfilled, (state, action) => {
        state.activeJobLoading = false
        state.activeJob = action.payload
        state.activeJobId = action.payload.job_id
      })
      .addCase(fetchJob.rejected, (state, action) => {
        state.activeJobLoading = false
        state.activeJobError =
          action.payload ?? action.error.message ?? 'Failed to load job'
      })

    // createJob
    builder
      .addCase(createJob.pending, (state) => {
        state.mutating = true
        state.mutationError = null
      })
      .addCase(createJob.fulfilled, (state, action) => {
        state.mutating = false
        state.list.unshift(action.payload)
        state.activeJob = action.payload
        state.activeJobId = action.payload.job_id
      })
      .addCase(createJob.rejected, (state, action) => {
        state.mutating = false
        state.mutationError =
          action.payload ?? action.error.message ?? 'Failed to create job'
      })

    // updateJob
    builder
      .addCase(updateJob.pending, (state) => {
        state.mutating = true
        state.mutationError = null
      })
      .addCase(updateJob.fulfilled, (state, action) => {
        state.mutating = false
        const updated = action.payload
        const idx = state.list.findIndex((j) => j.job_id === updated.job_id)
        if (idx >= 0) state.list[idx] = updated
        if (state.activeJobId === updated.job_id) state.activeJob = updated
      })
      .addCase(updateJob.rejected, (state, action) => {
        state.mutating = false
        state.mutationError =
          action.payload ?? action.error.message ?? 'Failed to update job'
      })

    // deleteJob
    builder
      .addCase(deleteJob.pending, (state) => {
        state.mutating = true
        state.mutationError = null
      })
      .addCase(deleteJob.fulfilled, (state, action) => {
        state.mutating = false
        const { jobId } = action.payload
        state.list = state.list.filter((j) => j.job_id !== jobId)
        if (state.activeJobId === jobId) {
          state.activeJobId = null
          state.activeJob = null
        }
      })
      .addCase(deleteJob.rejected, (state, action) => {
        state.mutating = false
        state.mutationError =
          action.payload ?? action.error.message ?? 'Failed to delete job'
      })

    // pauseJob / resumeJob — patch status on success
    builder
      .addCase(pauseJob.fulfilled, (state, action) => {
        const { jobId } = action.payload
        const idx = state.list.findIndex((j) => j.job_id === jobId)
        if (idx >= 0) state.list[idx].status = 'PAUSED'
        if (state.activeJob && state.activeJob.job_id === jobId) {
          state.activeJob.status = 'PAUSED'
        }
      })
      .addCase(pauseJob.rejected, (state, action) => {
        state.mutationError =
          action.payload ?? action.error.message ?? 'Failed to pause job'
      })
      .addCase(resumeJob.fulfilled, (state, action) => {
        const { jobId } = action.payload
        const idx = state.list.findIndex((j) => j.job_id === jobId)
        if (idx >= 0) state.list[idx].status = 'ACTIVE'
        if (state.activeJob && state.activeJob.job_id === jobId) {
          state.activeJob.status = 'ACTIVE'
        }
      })
      .addCase(resumeJob.rejected, (state, action) => {
        state.mutationError =
          action.payload ?? action.error.message ?? 'Failed to resume job'
      })

    // triggerJob — no state mutation beyond clearing error
    builder
      .addCase(triggerJob.pending, (state) => {
        state.mutationError = null
      })
      .addCase(triggerJob.rejected, (state, action) => {
        state.mutationError =
          action.payload ?? action.error.message ?? 'Failed to trigger job'
      })

    // fetchJobRuns
    builder
      .addCase(fetchJobRuns.pending, (state) => {
        state.runsLoading = true
        state.runsError = null
      })
      .addCase(fetchJobRuns.fulfilled, (state, action) => {
        state.runsLoading = false
        state.runs[action.payload.jobId] = action.payload.runs
      })
      .addCase(fetchJobRuns.rejected, (state, action) => {
        state.runsLoading = false
        state.runsError =
          action.payload ?? action.error.message ?? 'Failed to load runs'
      })

    // pollRun
    builder
      .addCase(pollRun.pending, (state, action) => {
        state.polling.isPolling = true
        state.polling.runId = action.meta.arg.runId
        state.polling.jobId = action.meta.arg.jobId
        state.polling.error = null
      })
      .addCase(pollRun.fulfilled, (state) => {
        state.polling.isPolling = false
      })
      .addCase(pollRun.rejected, (state, action) => {
        state.polling.isPolling = false
        state.polling.error =
          action.payload ?? action.error.message ?? 'Polling failed'
      })
  },
})

export const {
  setFilters,
  updateFilters,
  clearFilters,
  setActiveJobId,
  clearActiveJob,
  clearMutationError,
  runProgressUpdate,
  resetJobs,
} = jobsSlice.actions

export default jobsSlice.reducer
