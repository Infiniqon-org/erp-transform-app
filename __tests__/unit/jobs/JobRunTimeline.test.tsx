/**
 * Tests for components/jobs/JobRunTimeline.tsx
 *
 * Covers:
 *  - ordered run events render newest-first (order preserved from pipeline_logs)
 *  - RUNNING run shows pulsing indicator
 *  - FAILED run shows error icon + message (failed status node)
 *  - empty (null) run shows placeholder
 */

import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import React from 'react'

import { JobRunTimeline } from '@/components/jobs/JobRunTimeline'
import type { JobRun } from '@/lib/types/jobs'

function makeRun(overrides: Partial<JobRun> = {}): JobRun {
  return {
    job_id: 'job-1',
    run_id: 'run-1',
    status: 'RUNNING',
    started_at: '2026-05-14T10:00:00Z',
    pipeline_logs: [],
    ...overrides,
  }
}

describe('JobRunTimeline', () => {
  it('renders ordered run events newest-first (preserving input order)', () => {
    const run = makeRun({
      status: 'SUCCESS',
      pipeline_logs: [
        { step_id: 'newest', label: 'Finalize export', status: 'success', duration_ms: 1000 },
        { step_id: 'middle', label: 'Apply DQ rules', status: 'success', duration_ms: 5000 },
        { step_id: 'oldest', label: 'Ingest source', status: 'success', duration_ms: 2000 },
      ],
    })
    render(<JobRunTimeline run={run} />)

    const list = screen.getByRole('list', { name: /Run timeline/i })
    const items = list.querySelectorAll('li')
    expect(items).toHaveLength(3)
    // Order matches the pipeline_logs order (caller provides newest-first).
    expect(items[0]).toHaveTextContent('Finalize export')
    expect(items[1]).toHaveTextContent('Apply DQ rules')
    expect(items[2]).toHaveTextContent('Ingest source')
  })

  it('shows a pulsing indicator for a RUNNING run', () => {
    const run = makeRun({ status: 'RUNNING', pipeline_logs: [] })
    const { container } = render(<JobRunTimeline run={run} />)

    // Single synthesized node labelled "Pipeline" in running state.
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    // The running NodeIcon renders a ring with motion-safe:animate-pulse.
    const pulser = container.querySelector('.motion-safe\\:animate-pulse')
    expect(pulser).not.toBeNull()
  })

  it('shows an error icon for a FAILED run and surfaces the failure node', () => {
    const run = makeRun({
      status: 'FAILED',
      error_code: 'DQ_THRESHOLD',
      error_message: 'Quality threshold breached',
      pipeline_logs: [
        { step_id: 's1', label: 'Ingest', status: 'success', duration_ms: 100 },
        {
          step_id: 's2',
          label: 'Run DQ',
          status: 'failed',
          duration_ms: 200,
          details: ['Quality threshold breached'],
        },
      ],
    })
    const { container } = render(<JobRunTimeline run={run} />)

    expect(screen.getByText('Run DQ')).toBeInTheDocument()
    // The failed NodeIcon wraps an X icon inside a destructive-bg pill.
    // lucide X renders as <svg class="lucide lucide-x ...">.
    const xIcons = container.querySelectorAll('svg.lucide-x')
    expect(xIcons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders a placeholder when run is null', () => {
    render(<JobRunTimeline run={null} />)
    expect(screen.getByText(/No timeline data yet/i)).toBeInTheDocument()
    // No ordered list rendered.
    expect(screen.queryByRole('list', { name: /Run timeline/i })).toBeNull()
  })
})
