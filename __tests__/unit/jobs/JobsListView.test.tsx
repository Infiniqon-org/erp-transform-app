/**
 * Tests for components/jobs/JobsListView.tsx
 *
 * Covers:
 *  - empty state renders <EmptyJobsState/>
 *  - populated list renders N rows
 *  - status filter narrows visible rows
 *  - clicking a row dispatches drawer-open (setActiveJobId + setDrawerOpen)
 *
 * `useJobsWebSocket` is mocked to a static "connected" state so the hook
 * never spins up a real WebSocket or polling timer.
 */

import '@testing-library/jest-dom'

import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import userEvent from '@testing-library/user-event'

// ── next/navigation mock (JobsToolbar uses useRouter / useSearchParams) ────
const mockReplace = jest.fn()
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => new URLSearchParams(''),
}))

// ── auth-session mock ─────────────────────────────────────────────────────
// `loadTokens` is referenced in two places inside JobsListView:
//   1. mount-time useEffect — fires `fetchJobs` if a token is present
//   2. row click handler  — gated on a token to dispatch setActiveJobId/fetchJob
// We expose a `jest.fn()` so individual tests can switch between
// "no token" (skip the useEffect fetch entirely) and "token present"
// (click handler dispatches setActiveJobId).
const mockLoadTokens = jest.fn<{ accessToken?: string } | null, []>(() => null)
jest.mock('@/lib/auth-session', () => ({
  loadTokens: () => mockLoadTokens(),
}))

// Block real network calls — the slice's thunks would otherwise hit fetch()
// Never-resolving promises keep the fetchJobs thunk in "pending" state so it
// can't overwrite the seeded list with a fresh empty response.
const neverResolves = () => new Promise(() => {})
jest.mock('@/lib/api/jobs-api', () => ({
  listJobs: jest.fn(neverResolves),
  listJobRuns: jest.fn(neverResolves),
  getJob: jest.fn(neverResolves),
  createJob: jest.fn(neverResolves),
  updateJob: jest.fn(neverResolves),
  deleteJob: jest.fn(neverResolves),
  pauseJob: jest.fn(neverResolves),
  resumeJob: jest.fn(neverResolves),
  triggerJob: jest.fn(neverResolves),
  resumeRun: jest.fn(neverResolves),
  reExportRun: jest.fn(neverResolves),
  pollJobRun: jest.fn(neverResolves),
  JobsApiError: class JobsApiError extends Error {},
}))

// ── toast mock (use-toast is a singleton hook; mock to avoid side-effects)
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn(), dismiss: jest.fn(), toasts: [] }),
}))

// ── WS hook mock — REQUIRED per the brief ─────────────────────────────────
jest.mock('@/components/jobs/hooks/useJobsWebSocket', () => ({
  useJobsWebSocket: () => ({
    connected: true,
    fallbackPolling: false,
    errorMessage: null,
    reconnect: jest.fn(),
  }),
}))

import { JobsListView } from '@/components/jobs/JobsListView'
import jobsReducer, {
  fetchJobs,
  setActiveJobId,
} from '@/lib/features/jobsSlice'
import type { Job } from '@/lib/types/jobs'

// ── Test fixtures ─────────────────────────────────────────────────────────

const nowIso = new Date().toISOString()

function mkJob(overrides: Partial<Job> = {}): Job {
  return {
    user_id: 'u-1',
    job_id: 'job-aaaaaaaa-0001',
    name: 'QuickBooks → Snowflake nightly',
    source_provider: 'quickbooks',
    source_category: 'erp',
    source_config: {},
    destination_provider: 'snowflake',
    destination_category: 'warehouse',
    destination_config: {},
    entities: ['Invoice'],
    column_mapping: {},
    frequency_type: 'cron',
    frequency_value: '0 2 * * *',
    status: 'ACTIVE',
    dq_config: {},
    export_config: {},
    last_run_status: 'SUCCESS',
    last_run_at: nowIso,
    created_at: nowIso,
    ...overrides,
  }
}

function makeStore(jobs: Job[]) {
  const store = configureStore({
    reducer: { jobs: jobsReducer },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, immutableCheck: false }),
  })
  // Always seed via the fetchJobs.fulfilled lifecycle so listLoading
  // flips to false. The skeleton-row path is `listLoading && jobs.length===0`,
  // and we want either the empty-state path or the populated path.
  store.dispatch(
    fetchJobs.fulfilled(
      { items: jobs, nextCursor: null },
      'req-id',
      { accessToken: 'tok' } as any
    )
  )
  return store
}

function renderWith(jobs: Job[]) {
  const store = makeStore(jobs)
  const utils = render(
    <Provider store={store}>
      <JobsListView orgId="org-test" />
    </Provider>
  )
  return { ...utils, store }
}

describe('JobsListView', () => {
  it('renders the empty state when there are no jobs', () => {
    renderWith([])
    expect(screen.getByText(/No jobs yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start an augmentation/i })).toBeInTheDocument()
  })

  it('renders one row per Job in the populated list', () => {
    const jobs = [
      mkJob({ job_id: 'job-aaaaaaaa-0001', name: 'Alpha pipeline' }),
      mkJob({ job_id: 'job-aaaaaaaa-0002', name: 'Beta pipeline' }),
      mkJob({ job_id: 'job-aaaaaaaa-0003', name: 'Gamma pipeline' }),
    ]
    renderWith(jobs)
    expect(screen.getByText('Alpha pipeline')).toBeInTheDocument()
    expect(screen.getByText('Beta pipeline')).toBeInTheDocument()
    expect(screen.getByText('Gamma pipeline')).toBeInTheDocument()
    // Header shows "3 of 3"
    expect(screen.getByText(/3 of 3/)).toBeInTheDocument()
  })

  it('narrows the visible rows when a status filter excludes a job', () => {
    // Seed via initialFilters so we don't need to drive the Radix Select widget
    // (Radix uses portals + pointer events which jsdom handles poorly).
    const jobs = [
      mkJob({ job_id: 'job-aaaaaaaa-0001', name: 'Running job', last_run_status: 'RUNNING' }),
      mkJob({ job_id: 'job-aaaaaaaa-0002', name: 'Succeeded job', last_run_status: 'SUCCESS' }),
      mkJob({ job_id: 'job-aaaaaaaa-0003', name: 'Failed job', last_run_status: 'FAILED' }),
    ]
    const store = makeStore(jobs)
    render(
      <Provider store={store}>
        <JobsListView
          orgId="org-test"
          initialFilters={{ type: 'all', status: 'FAILED', date: 'all', search: '' }}
        />
      </Provider>
    )
    expect(screen.getByText('Failed job')).toBeInTheDocument()
    expect(screen.queryByText('Running job')).not.toBeInTheDocument()
    expect(screen.queryByText('Succeeded job')).not.toBeInTheDocument()
    // Header reflects narrowed count: "1 of 3"
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument()
  })

  it('fires the drawer-open path (setActiveJobId) when a row is clicked', () => {
    // Click handler requires a token to dispatch setActiveJobId
    mockLoadTokens.mockReturnValue({ accessToken: 'stub-access-token' })
    const jobs = [mkJob({ job_id: 'job-aaaaaaaa-0001', name: 'Click me' })]
    const store = makeStore(jobs)

    // CRITICAL: spy must be attached BEFORE render. React-Redux's useDispatch
    // captures `store.dispatch` at hook-mount time; replacing the reference
    // later does not retroactively rewire the component.
    const spy = jest.spyOn(store, 'dispatch')

    render(
      <Provider store={store}>
        <JobsListView orgId="org-test" />
      </Provider>
    )

    // Clear out the mount-effect's fetchJobs dispatch so we only count the
    // click's actions.
    spy.mockClear()

    const row = screen.getByText('Click me').closest('[role="button"]') as HTMLElement
    expect(row).toBeInTheDocument()
    fireEvent.click(row)

    const dispatched = spy.mock.calls.map((c) => c[0])
    const sawSetActive = dispatched.some(
      (a: any) => a && a.type === setActiveJobId.type && a.payload === 'job-aaaaaaaa-0001'
    )
    expect(sawSetActive).toBe(true)

    // reset to default for any subsequent test
    mockLoadTokens.mockReturnValue(null)
  })
})
