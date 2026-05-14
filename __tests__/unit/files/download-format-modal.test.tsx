/**
 * Tests for components/files/download-format-modal.tsx
 *
 * Covers:
 *  - render without crash (modal open, file present)
 *  - default selections (clean + csv) submit through onDownload on primary click
 *  - Cancel click closes the modal via onOpenChange(false)
 *  - downloading=true disables both action buttons and switches Download label/spinner
 *  - file=null edge case: header falls back to placeholder text
 */

import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'

import { DownloadFormatModal } from '@/components/files/download-format-modal'
import type { FileStatusResponse } from '@/lib/api/file-management-api'
import React from 'react'
import userEvent from '@testing-library/user-event'

const baseFile: FileStatusResponse = {
  upload_id: 'u-123',
  status: 'DQ_FIXED',
  original_filename: 'invoices.csv',
}

function setup(overrides: Partial<React.ComponentProps<typeof DownloadFormatModal>> = {}) {
  const onOpenChange = jest.fn()
  const onDownload = jest.fn()
  const props: React.ComponentProps<typeof DownloadFormatModal> = {
    open: true,
    onOpenChange,
    file: baseFile,
    onDownload,
    downloading: false,
    ...overrides,
  }
  const utils = render(<DownloadFormatModal {...props} />)
  return { ...utils, onOpenChange, onDownload, props }
}

describe('DownloadFormatModal', () => {
  it('renders the dialog with the file name and default selections', () => {
    setup()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Download File/i)).toBeInTheDocument()
    // file's original_filename appears in the description line
    expect(screen.getByText(/invoices\.csv/)).toBeInTheDocument()
    // Default action button label = format upper-case
    expect(screen.getByRole('button', { name: /Download CSV/i })).toBeInTheDocument()
    // Default preview line: Cleaned + CSV
    expect(screen.getByText(/Cleaned.*CSV Format/i)).toBeInTheDocument()
  })

  it('invokes onDownload with the default csv/clean selection on primary click', async () => {
    const user = userEvent.setup()
    const { onDownload } = setup()

    await user.click(screen.getByRole('button', { name: /Download CSV/i }))

    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onDownload).toHaveBeenCalledWith('csv', 'clean')
  })

  it('closes the modal when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onOpenChange, onDownload } = setup()

    await user.click(screen.getByRole('button', { name: /Cancel/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onDownload).not.toHaveBeenCalled()
  })

  it('disables both action buttons and shows the downloading spinner state', () => {
    setup({ downloading: true })

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    // While downloading the primary button's accessible name flips to "Downloading..."
    const downloadingBtn = screen.getByRole('button', { name: /Downloading/i })

    expect(cancelBtn).toBeDisabled()
    expect(downloadingBtn).toBeDisabled()
    // Old "Download CSV" label is gone while downloading
    expect(screen.queryByRole('button', { name: /Download CSV/i })).not.toBeInTheDocument()
  })

  it('falls back to a placeholder when file is null', () => {
    setup({ file: null })

    // Description renders "Choose the format and data type for this file" when no file
    expect(screen.getByText(/Choose the format and data type for this file/i)).toBeInTheDocument()
  })
})
