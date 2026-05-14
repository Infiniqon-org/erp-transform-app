"use client"

/**
 * useDnDColumns.ts — HTML5-native drag-and-drop wrapper hooks for the
 * DragDropRuleBuilder. We deliberately do NOT pull in @dnd-kit: the slot
 * count is tiny (≤ 6), drag distances are short, and HTML5 DnD gives us
 * type-aware drop targets for free via `dataTransfer`.
 *
 * Payload contract on dataTransfer:
 *   - mime: "application/x-augmentation-column"
 *   - body: JSON {kind:"augmentation-column", columnName, columnType, role}
 *
 * The "kind" discriminator lets us coexist with other native drags on the
 * page (e.g. the legacy column-mapper.tsx) without cross-contamination.
 */

import * as React from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

/** Polars-flavoured dtype tags we surface to the user. */
export type ColumnDType =
  | "Utf8"
  | "Int32"
  | "Int64"
  | "Float64"
  | "Decimal"
  | "Date"
  | "Datetime"
  | "Boolean"
  | "Unknown"

/** Semantic role inferred from name+dtype. Drives left-pane grouping. */
export type ColumnRole = "key" | "measure" | "date" | "dim"

export interface DraggableColumn {
  name: string
  dtype: ColumnDType
  role: ColumnRole
  /** Optional sample values for hover tooltip. */
  samples?: Array<string | number | null>
}

export const DND_MIME = "application/x-augmentation-column"

interface DragPayload {
  kind: "augmentation-column"
  columnName: string
  columnType: ColumnDType
  role: ColumnRole
}

// ─── useDragColumn ────────────────────────────────────────────────────────────

export interface DragColumnProps {
  draggable: true
  onDragStart: (e: React.DragEvent<HTMLElement>) => void
  onDragEnd: (e: React.DragEvent<HTMLElement>) => void
}

export function useDragColumn(column: DraggableColumn): {
  isDragging: boolean
  dragProps: DragColumnProps
} {
  const [isDragging, setIsDragging] = React.useState(false)

  const dragProps: DragColumnProps = {
    draggable: true,
    onDragStart: (e) => {
      const payload: DragPayload = {
        kind: "augmentation-column",
        columnName: column.name,
        columnType: column.dtype,
        role: column.role,
      }
      // Two channels: the typed MIME for our slots, and text/plain as a
      // graceful fallback for paste-into-text-editor accidents.
      e.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
      e.dataTransfer.setData("text/plain", column.name)
      e.dataTransfer.effectAllowed = "copy"
      setIsDragging(true)
    },
    onDragEnd: () => setIsDragging(false),
  }

  return { isDragging, dragProps }
}

// ─── useDropOperation ─────────────────────────────────────────────────────────

export interface DropOperationProps {
  onDragEnter: (e: React.DragEvent<HTMLElement>) => void
  onDragOver: (e: React.DragEvent<HTMLElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLElement>) => void
  onDrop: (e: React.DragEvent<HTMLElement>) => void
}

export interface DropState {
  /** Drag is hovering and the payload is type-compatible. */
  isOver: boolean
  /** Drag is hovering but the payload would be rejected. */
  isInvalid: boolean
  /** A reject-shake should play once on drop; consume + reset via clearReject. */
  rejectTick: number
  clearReject: () => void
}

/**
 * @param acceptedTypes - the dtypes this slot allows. Empty = accept all.
 * @param onAccept       - called with the parsed payload when a valid drop lands.
 */
export function useDropOperation(
  acceptedTypes: ColumnDType[] | "any",
  onAccept: (payload: {
    columnName: string
    columnType: ColumnDType
    role: ColumnRole
  }) => void
): { dropProps: DropOperationProps; state: DropState } {
  const [isOver, setIsOver] = React.useState(false)
  const [isInvalid, setIsInvalid] = React.useState(false)
  const [rejectTick, setRejectTick] = React.useState(0)

  const peekPayload = React.useCallback(
    (e: React.DragEvent<HTMLElement>): DragPayload | null => {
      // dataTransfer.getData is only available on drop, but we can sniff
      // types[] on dragenter/dragover to know SHAPE without reading body.
      const types = Array.from(e.dataTransfer.types || [])
      if (!types.includes(DND_MIME)) return null
      // Body unavailable during drag for security reasons; we treat all
      // augmentation drags as "potentially valid" until drop, then verify.
      return null
    },
    [],
  )

  const accepts = React.useCallback(
    (t: ColumnDType): boolean => {
      if (acceptedTypes === "any") return true
      return acceptedTypes.includes(t)
    },
    [acceptedTypes],
  )

  const dropProps: DropOperationProps = {
    onDragEnter: (e) => {
      const types = Array.from(e.dataTransfer.types || [])
      if (!types.includes(DND_MIME)) return
      e.preventDefault()
      // Optimistic: assume valid until drop reveals the dtype.
      setIsOver(true)
      setIsInvalid(false)
    },
    onDragOver: (e) => {
      const types = Array.from(e.dataTransfer.types || [])
      if (!types.includes(DND_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    },
    onDragLeave: () => {
      setIsOver(false)
      setIsInvalid(false)
    },
    onDrop: (e) => {
      e.preventDefault()
      setIsOver(false)
      const raw = e.dataTransfer.getData(DND_MIME)
      if (!raw) return
      let payload: DragPayload
      try {
        payload = JSON.parse(raw) as DragPayload
      } catch {
        return
      }
      if (payload.kind !== "augmentation-column") return
      if (!accepts(payload.columnType)) {
        setIsInvalid(true)
        setRejectTick((t) => t + 1)
        // Auto-clear the invalid flag so the border doesn't stay red.
        window.setTimeout(() => setIsInvalid(false), 250)
        return
      }
      onAccept({
        columnName: payload.columnName,
        columnType: payload.columnType,
        role: payload.role,
      })
    },
  }

  return {
    dropProps,
    state: {
      isOver,
      isInvalid,
      rejectTick,
      clearReject: () => setIsInvalid(false),
    },
  }
}
