/**
 * Tests for components/jobs/JobsToolbar.tsx
 *
 * Covers:
 *  - search input typing flushes through onChange under fake timers
 *  - filter chip (clear active filters) toggles call back
 *  - "New job" CTA has accessible aria-label
 */

import '@testing-library/jest-dom'

import { render, screen, act, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock next/navigation BEFORE importing the component under test.
const replaceMock = jest.fn()
const pushMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(''),
}))

import { JobsToolbar, type JobsFilterValues } from '@/components/jobs/JobsToolbar'

const baseValues: JobsFilterValues = {
  type: 'all',
  status: 'all',
  date: '30d',
  search: '',
}

function setup(overrides: Partial<React.ComponentProps<typeof JobsToolbar>> = {}) {
  const onChange = jest.fn()
  const props: React.ComponentProps<typeof JobsToolbar> = {
    values: baseValues,
    onChange,
    activeFilterCount: 0,
    ...overrides,
  }
  const utils = render(<JobsToolbar {...props} />)
  return { ...utils, onChange, props }
}

describe('JobsToolbar', () => {
  beforeEach(() => {
    replaceMock.mockClear()
    pushMock.mockClear()
  })

  it('flushes search input typing through onChange under fake timers', () => {
    jest.useFakeTimers()
    try {
      const { onChange } = setup()

      const input = screen.getByLabelText(/Search jobs/i) as HTMLInputElement
      // Simulate a debounced typing burst.
      fireEvent.change(input, { target: { value: 'inv' } })
      fireEvent.change(input, { target: { value: 'invoices' } })

      // Advance any pending debounce timer to flush.
      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(onChange).toHaveBeenCalled()
      // The most-recent call should carry the final search string.
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
      expect(lastCall.search).toBe('invoices')
    } finally {
      jest.useRealTimers()
    }
  })

  it('renders the clear-filters chip when activeFilterCount > 0 and calls onChange when clicked', () => {
    const { onChange } = setup({ activeFilterCount: 2, values: { ...baseValues, status: 'FAILED' } })

    const chip = screen.getByRole('button', { name: /Clear 2 filters/i })
    expect(chip).toBeInTheDocument()

    fireEvent.click(chip)
    // clearAll resets to defaults.
    expect(onChange).toHaveBeenCalledWith({
      type: 'all',
      status: 'all',
      date: '30d',
      search: '',
    })
  })

  it('hides the clear chip when there are no active filters', () => {
    setup({ activeFilterCount: 0 })
    expect(screen.queryByRole('button', { name: /Clear .* filter/i })).toBeNull()
  })

  it('"New job" button exposes an aria-label for assistive tech', () => {
    setup()
    const btn = screen.getByRole('button', { name: /Create a new job/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-label', 'Create a new job')

    fireEvent.click(btn)
    expect(pushMock).toHaveBeenCalledWith('/files?intent=schedule')
  })
})
