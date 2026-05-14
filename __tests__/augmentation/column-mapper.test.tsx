/**
 * Tests for components/augmentation/column-mapper.tsx
 *
 * Covers:
 *  - renders source columns + target schema fields
 *  - click-to-pick + click target slot maps a source to a field
 *  - HTML5 drag-and-drop sequence (dragStart -> dragOver -> drop) maps
 *  - clear-slot X button removes the mapping
 *  - onAddSourceColumn handler is invoked when Add is pressed
 *  - empty source state renders a hint instead of column chips
 */

import '@testing-library/jest-dom'

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ColumnMapper, type SourceColumn } from '@/components/augmentation/column-mapper'
import type { SchemaField } from '@/components/augmentation/scenarios'

// Source + target names are intentionally disjoint so getByText is unambiguous.
const sources: SourceColumn[] = [
  { name: 'src_contract', dtype: 'Utf8' },
  { name: 'amount', dtype: 'Float64' },
  { name: 'currency', dtype: 'Utf8' },
]

const targets: SchemaField[] = [
  { name: 'tgt_contract_id', type: 'Utf8', required: true },
  { name: 'recognized_amount', type: 'Float64', required: true },
]

/** Build a minimal DataTransfer mock for drag/drop tests. */
function makeDataTransfer() {
  const store = new Map<string, string>()
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData: (type: string, val: string) => store.set(type, val),
    getData: (type: string) => store.get(type) ?? '',
    clearData: () => store.clear(),
    types: [] as string[],
    files: [] as File[],
    items: [] as DataTransferItem[],
    setDragImage: () => {},
  } as unknown as DataTransfer
}

describe('ColumnMapper', () => {
  it('renders source chips and target slots', () => {
    render(
      <ColumnMapper
        sourceColumns={sources}
        targetFields={targets}
        mapping={{}}
        onMappingChange={jest.fn()}
      />,
    )

    expect(screen.getByText(/source columns/i)).toBeInTheDocument()
    expect(screen.getByText(/target schema/i)).toBeInTheDocument()
    // Source chips
    sources.forEach((c) => {
      expect(screen.getByRole('button', { name: new RegExp(c.name) })).toBeInTheDocument()
    })
    // Target slots
    targets.forEach((f) => {
      expect(screen.getByText(f.name)).toBeInTheDocument()
    })
    // Count badge "0/2 mapped"
    expect(screen.getByText(/0\/2 mapped/i)).toBeInTheDocument()
  })

  it('click-to-pick flow: pick a source then click a target slot maps them', async () => {
    const user = userEvent.setup()
    const onMappingChange = jest.fn()

    render(
      <ColumnMapper
        sourceColumns={sources}
        targetFields={targets}
        mapping={{}}
        onMappingChange={onMappingChange}
      />,
    )

    // Pick the "amount" chip
    await user.click(screen.getByRole('button', { name: /amount/i }))
    // Tip hint should now appear
    expect(screen.getByText(/selected — click a target slot to map/i)).toBeInTheDocument()

    // Click on the "recognized_amount" target slot
    const slot = screen.getByText('recognized_amount').closest('div')
    expect(slot).not.toBeNull()
    await user.click(slot!)

    expect(onMappingChange).toHaveBeenCalledWith({ recognized_amount: 'amount' })
  })

  it('drag-start + drop fires onMappingChange with the dragged column', () => {
    const onMappingChange = jest.fn()

    render(
      <ColumnMapper
        sourceColumns={sources}
        targetFields={targets}
        mapping={{}}
        onMappingChange={onMappingChange}
      />,
    )

    const dt = makeDataTransfer()
    const sourceChip = screen.getByRole('button', { name: /src_contract/i })
    fireEvent.dragStart(sourceChip, { dataTransfer: dt })

    const slot = screen.getByText('tgt_contract_id').closest('div') as HTMLElement
    fireEvent.dragOver(slot, { dataTransfer: dt })
    fireEvent.drop(slot, { dataTransfer: dt })

    expect(onMappingChange).toHaveBeenCalledTimes(1)
    expect(onMappingChange).toHaveBeenCalledWith({ tgt_contract_id: 'src_contract' })
  })

  it('renders the Clear-mapping X for bound slots and fires onMappingChange on click', async () => {
    const user = userEvent.setup()
    const onMappingChange = jest.fn()

    render(
      <ColumnMapper
        sourceColumns={sources}
        targetFields={targets}
        mapping={{ recognized_amount: 'amount' }}
        onMappingChange={onMappingChange}
      />,
    )

    // Slot shows the bound chip
    expect(screen.getByText(/← amount/)).toBeInTheDocument()

    const clearBtn = screen.getByRole('button', { name: /clear recognized_amount mapping/i })
    await user.click(clearBtn)

    expect(onMappingChange).toHaveBeenCalledWith({ recognized_amount: null })
  })

  it('invokes onAddSourceColumn when typing a name and clicking Add', async () => {
    const user = userEvent.setup()
    const onAdd = jest.fn()

    render(
      <ColumnMapper
        sourceColumns={sources}
        targetFields={targets}
        mapping={{}}
        onMappingChange={jest.fn()}
        onAddSourceColumn={onAdd}
      />,
    )

    const input = screen.getByPlaceholderText(/add column name/i)
    await user.type(input, 'fiscal_year')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(onAdd).toHaveBeenCalledWith('fiscal_year')
  })

  it('renders an empty hint when sourceColumns is empty', () => {
    render(
      <ColumnMapper
        sourceColumns={[]}
        targetFields={targets}
        mapping={{}}
        onMappingChange={jest.fn()}
      />,
    )

    expect(
      screen.getByText(/no source columns yet — upload a file first/i),
    ).toBeInTheDocument()
  })
})
