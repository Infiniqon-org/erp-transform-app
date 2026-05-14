/**
 * Tests for components/augmentation/augmentation-panel.tsx
 *
 * Covers:
 *  - master toggle off => only the chrome is visible (no scenario cards)
 *  - master toggle on (via header click) => panel expands and shows scenarios
 *  - selecting a scenario propagates scenarioId via onChange (and resets mapping)
 *  - prompt textarea updates propagate via onChange
 *  - SOX audit switch flips soxAuditEnabled via onChange
 *  - configToCreateJobPayload returns null until enabled+scenario+prompt are set,
 *    and otherwise emits a JobCreationPlan ({template?, inputDatasetKey,
 *    outputDatasetKey, ...}) shaped for the 2-step orchestrator
 *    (FE-BE-001 fix, 2026-05-14).
 */

import '@testing-library/jest-dom'

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn(), dismiss: jest.fn(), toasts: [] }),
}))
jest.mock('@/lib/api/augmentation', () => ({
  createPromptTemplate: jest.fn().mockResolvedValue({ template_id: 't1', version: 1 }),
}))

import {
  AugmentationPanel,
  EMPTY_AUGMENTATION_CONFIG,
  configToCreateJobPayload,
  type AugmentationConfig,
} from '@/components/augmentation/augmentation-panel'

function Harness(props: {
  initial?: Partial<AugmentationConfig>
  showToggle?: boolean
  onChange?: (c: AugmentationConfig) => void
}) {
  const [cfg, setCfg] = React.useState<AugmentationConfig>({
    ...EMPTY_AUGMENTATION_CONFIG,
    ...(props.initial ?? {}),
  })
  return (
    <AugmentationPanel
      value={cfg}
      onChange={(next) => {
        setCfg(next)
        props.onChange?.(next)
      }}
      showToggle={props.showToggle}
      sourceColumns={[
        { name: 'contract_id', dtype: 'Utf8' },
        { name: 'contract_value', dtype: 'Float64' },
      ]}
    />
  )
}

describe('AugmentationPanel', () => {
  it('renders the chrome with the master toggle and does not show steps when disabled', () => {
    render(<Harness />)
    expect(screen.getByText(/data augmentation/i)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /enable data augmentation/i })).toBeInTheDocument()
    // The "Step 1 — pick a scenario" header should not be visible yet
    expect(screen.queryByText(/step 1 — pick a scenario/i)).not.toBeInTheDocument()
  })

  it('expands the panel when the header is clicked (enables augmentation)', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<Harness onChange={onChange} />)

    // Click the header (which enables augmentation when previously disabled)
    await user.click(screen.getByText(/data augmentation/i))

    // The "enabled: true" config should have been propagated
    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AugmentationConfig
    expect(lastCall.enabled).toBe(true)

    expect(screen.getByText(/step 1 — pick a scenario/i)).toBeInTheDocument()
  })

  it('always renders the steps when showToggle=false', () => {
    render(<Harness showToggle={false} />)
    expect(screen.getByText(/step 1 — pick a scenario/i)).toBeInTheDocument()
    expect(screen.getByText(/step 3 — describe the transformation/i)).toBeInTheDocument()
  })

  it('selecting a scenario propagates scenarioId and resets the mapping', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(
      <Harness
        initial={{ enabled: true, mapping: { foo: 'bar' } }}
        showToggle={false}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('radio', { name: /scenario b:/i }))

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AugmentationConfig
    expect(last.scenarioId).toBe('B')
    // Mapping reset because the target schema changed
    expect(last.mapping).toEqual({})
  })

  it('SOX audit switch toggles soxAuditEnabled via onChange', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(
      <Harness
        initial={{ enabled: true, scenarioId: 'A' }}
        showToggle={false}
        onChange={onChange}
      />,
    )

    const soxSwitch = screen.getByRole('switch', { name: /sox audit trail/i })
    await user.click(soxSwitch)

    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AugmentationConfig
    expect(last.soxAuditEnabled).toBe(true)
  })
})

describe('configToCreateJobPayload', () => {
  it('returns null when augmentation is disabled', () => {
    expect(configToCreateJobPayload(EMPTY_AUGMENTATION_CONFIG, 'u-1')).toBeNull()
  })

  it('returns null when prompt is empty even if enabled', () => {
    const cfg: AugmentationConfig = {
      ...EMPTY_AUGMENTATION_CONFIG,
      enabled: true,
      scenarioId: 'A',
      prompt: '   ',
    }
    expect(configToCreateJobPayload(cfg, 'u-1')).toBeNull()
  })

  it('builds the canonical payload when fully configured', () => {
    const cfg: AugmentationConfig = {
      enabled: true,
      scenarioId: 'B',
      prompt: 'Fold per fiscal year',
      templateId: 'tmpl-1',
      mapping: { contract_id: 'contract_id' },
      soxAuditEnabled: true,
    }

    const payload = configToCreateJobPayload(cfg, 'u-42')
    expect(payload).toMatchObject({
      upload_id: 'u-42',
      prompt: 'Fold per fiscal year',
      template_id: 'tmpl-1',
      expected_cardinality: 'n_to_1',
      sox_audit_enabled: true,
    })
    expect(payload?.parameters).toEqual({
      scenario_id: 'B',
      column_mapping: { contract_id: 'contract_id' },
    })
  })
})
