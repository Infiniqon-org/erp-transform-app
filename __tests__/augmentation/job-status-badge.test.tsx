/**
 * Tests for components/augmentation/job-status-badge.tsx
 *
 * Covers JobStatusBadge for each AugmentationJobStatus + PARTIAL:
 *  - PENDING -> "Queued" (amber palette)
 *  - RUNNING -> "Running" (blue, spinner class)
 *  - SUCCEEDED -> "Succeeded" (emerald)
 *  - FAILED -> "Failed" (rose)
 *  - CANCELLED -> "Cancelled" (zinc)
 *  - SUCCEEDED + partial=true -> "Partial" (orange)
 *
 * Plus ScenarioBadge:
 *  - renders nothing when scenario is null / undefined
 *  - renders "Scenario X" when provided
 */

import '@testing-library/jest-dom'

import React from 'react'
import { render, screen } from '@testing-library/react'

import {
  JobStatusBadge,
  ScenarioBadge,
} from '@/components/augmentation/job-status-badge'

describe('JobStatusBadge', () => {
  const cases: Array<{
    status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
    label: RegExp
    colorFragment: string
  }> = [
    { status: 'PENDING', label: /queued/i, colorFragment: 'amber' },
    { status: 'RUNNING', label: /running/i, colorFragment: 'blue' },
    { status: 'SUCCEEDED', label: /succeeded/i, colorFragment: 'emerald' },
    { status: 'FAILED', label: /failed/i, colorFragment: 'rose' },
    { status: 'CANCELLED', label: /cancelled/i, colorFragment: 'zinc' },
  ]

  it.each(cases)(
    'renders $status with $label and the $colorFragment palette',
    ({ status, label, colorFragment }) => {
      const { container } = render(<JobStatusBadge status={status} />)
      const badge = container.firstElementChild as HTMLElement
      expect(badge).not.toBeNull()
      expect(badge.textContent).toMatch(label)
      // Tailwind palette class names contain the color fragment.
      expect(badge.className).toMatch(new RegExp(colorFragment))
    },
  )

  it('renders the RUNNING badge with the spin animation class on its icon', () => {
    const { container } = render(<JobStatusBadge status="RUNNING" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('class') || '').toMatch(/animate-spin/)
  })

  it('maps SUCCEEDED + partial=true to the orange "Partial" palette', () => {
    const { container } = render(<JobStatusBadge status="SUCCEEDED" partial />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.textContent).toMatch(/partial/i)
    expect(badge.className).toMatch(/orange/)
  })

  it('appends a caller-provided className', () => {
    const { container } = render(
      <JobStatusBadge status="PENDING" className="extra-class-123" />,
    )
    expect((container.firstElementChild as HTMLElement).className).toMatch(/extra-class-123/)
  })
})

describe('ScenarioBadge', () => {
  it('renders nothing when scenario is falsy', () => {
    const { container: c1 } = render(<ScenarioBadge scenario={null} />)
    expect(c1.firstChild).toBeNull()

    const { container: c2 } = render(<ScenarioBadge scenario={undefined} />)
    expect(c2.firstChild).toBeNull()

    const { container: c3 } = render(<ScenarioBadge scenario="" />)
    expect(c3.firstChild).toBeNull()
  })

  it('renders "Scenario X" with the violet palette when scenario is provided', () => {
    const { container } = render(<ScenarioBadge scenario="A" />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.textContent).toMatch(/scenario a/i)
    expect(badge.className).toMatch(/violet/)
  })
})
