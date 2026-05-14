/**
 * Tests for components/augmentation/prompt-composer.tsx
 *
 * Covers:
 *  - typing in the textarea calls onPromptChange
 *  - clicking an example chip fills the textarea (onPromptChange with example text)
 *  - "Save as template" button is disabled without scenario + access token + prompt
 *  - clicking "Save as template" opens the dialog
 *  - saved-template chips render and pick/unpick toggles onTemplatePick
 */

import '@testing-library/jest-dom'

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the toast hook + the API client so the component can mount without
// real fetches / providers.
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn(), dismiss: jest.fn(), toasts: [] }),
}))
jest.mock('@/lib/api/augmentation', () => ({
  createPromptTemplate: jest.fn().mockResolvedValue({ template_id: 't1', version: 1 }),
}))

import { PromptComposer } from '@/components/augmentation/prompt-composer'
import { SCENARIOS } from '@/components/augmentation/scenarios'
import type { PromptTemplate } from '@/lib/types/augmentation'

const scenarioA = SCENARIOS.A
const exampleA = scenarioA.examplePrompts[0]

describe('PromptComposer', () => {
  it('typing in the textarea fires onPromptChange', async () => {
    const user = userEvent.setup()
    const onPromptChange = jest.fn()
    render(
      <PromptComposer
        scenario={scenarioA}
        prompt=""
        onPromptChange={onPromptChange}
      />,
    )

    const textarea = screen.getByPlaceholderText(/describe the expand transformation/i)
    await user.type(textarea, 'hi')
    // onChange is called per keystroke; the first char fires onPromptChange('h')
    expect(onPromptChange).toHaveBeenCalled()
    expect(onPromptChange.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['h', 'i']),
    )
  })

  it('clicking an example chip calls onPromptChange with the example text', async () => {
    const user = userEvent.setup()
    const onPromptChange = jest.fn()
    const onTemplatePick = jest.fn()
    render(
      <PromptComposer
        scenario={scenarioA}
        prompt=""
        onPromptChange={onPromptChange}
        onTemplatePick={onTemplatePick}
      />,
    )

    const chip = screen.getByRole('button', { name: new RegExp(exampleA.slice(0, 20)) })
    await user.click(chip)

    expect(onPromptChange).toHaveBeenCalledWith(exampleA)
    expect(onTemplatePick).toHaveBeenCalledWith(null)
  })

  it('Save as template button is disabled when there is no access token', () => {
    render(
      <PromptComposer
        scenario={scenarioA}
        prompt="Some prompt"
        onPromptChange={jest.fn()}
      />,
    )

    const saveBtn = screen.getByRole('button', { name: /save as template/i })
    expect(saveBtn).toBeDisabled()
  })

  it('Save as template opens the dialog when enabled', async () => {
    const user = userEvent.setup()
    render(
      <PromptComposer
        scenario={scenarioA}
        prompt="Expand monthly rows."
        onPromptChange={jest.fn()}
        accessToken="token-abc"
      />,
    )

    const saveBtn = screen.getByRole('button', { name: /save as template/i })
    expect(saveBtn).toBeEnabled()
    await user.click(saveBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/save prompt as template/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/SaaS Annual Fold/i)).toBeInTheDocument()
    // Cardinality is locked to the scenario's value
    expect(screen.getByText(scenarioA.cardinality)).toBeInTheDocument()
  })

  it('renders saved-template chips and toggles via onTemplatePick', async () => {
    const user = userEvent.setup()
    const onTemplatePick = jest.fn()
    const onPromptChange = jest.fn()
    const templates: PromptTemplate[] = [
      {
        template_id: 'tmpl-1',
        name: 'Quarterly fold',
        active_version: 3,
        prompt: 'Fold quarters',
        expected_cardinality: 'n_to_1',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    render(
      <PromptComposer
        scenario={scenarioA}
        prompt=""
        onPromptChange={onPromptChange}
        templates={templates}
        selectedTemplateId={null}
        onTemplatePick={onTemplatePick}
      />,
    )

    const chip = screen.getByRole('button', { name: /quarterly fold/i })
    await user.click(chip)

    expect(onTemplatePick).toHaveBeenCalledWith('tmpl-1')
    expect(onPromptChange).toHaveBeenCalledWith('Fold quarters')
  })
})
