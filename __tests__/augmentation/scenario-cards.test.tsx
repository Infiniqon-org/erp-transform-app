/**
 * Tests for components/augmentation/scenario-cards.tsx
 *
 * Covers:
 *  - renders 3 radio cards (Scenario A / B / C) with radiogroup semantics
 *  - clicking a card calls onChange with the right ScenarioId
 *  - selected card has aria-checked=true and others false
 *  - disabled prop disables every radio button
 *  - keyboard activation (Enter / Space) on a radio fires onChange
 */

import '@testing-library/jest-dom'

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ScenarioCards } from '@/components/augmentation/scenario-cards'

describe('ScenarioCards', () => {
  it('renders 3 scenario radio cards with labels A / B / C', () => {
    const onChange = jest.fn()
    render(<ScenarioCards value={null} onChange={onChange} />)

    expect(screen.getByRole('radiogroup', { name: /augmentation scenario/i })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /scenario a:/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /scenario b:/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /scenario c:/i })).toBeInTheDocument()
  })

  it('clicking a card invokes onChange with the scenario id', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<ScenarioCards value={null} onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: /scenario b:/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('B')
  })

  it('marks only the selected radio with aria-checked=true', () => {
    const onChange = jest.fn()
    render(<ScenarioCards value="C" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: /scenario a:/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: /scenario b:/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: /scenario c:/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('disables every radio when disabled prop is set', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<ScenarioCards value={null} onChange={onChange} disabled />)

    const radios = screen.getAllByRole('radio')
    radios.forEach((r) => expect(r).toBeDisabled())

    await user.click(radios[0])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fires onChange when activated via the keyboard (Enter / Space)', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<ScenarioCards value={null} onChange={onChange} />)

    const radioA = screen.getByRole('radio', { name: /scenario a:/i })
    radioA.focus()
    expect(radioA).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('A')

    onChange.mockClear()
    await user.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith('A')
  })
})
