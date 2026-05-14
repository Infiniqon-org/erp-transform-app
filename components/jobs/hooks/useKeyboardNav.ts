'use client'

/**
 * useKeyboardNav — Linear-style J/K row navigation for the Jobs list.
 *
 * Spec §B7:
 *   - J / ↓        → move selection down
 *   - K / ↑        → move selection up
 *   - Enter / O    → open detail drawer for the selected row
 *   - Esc          → close the drawer (caller handles)
 *   - R            → retry selected job (caller wires)
 *   - C            → cancel selected job (caller wires)
 *
 * The hook does NOT take ownership of opening/closing the drawer — it
 * exposes `selectedIndex`, `setSelectedIndex`, and event callbacks the
 * caller can bind. Selection is a separate concern from "drawer is open".
 *
 * Implementation note: we attach the listener to `document` and skip key
 * handling when focus is in an input/textarea/contenteditable, so users
 * can type in the search box without J/K stealing keystrokes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseKeyboardNavOptions {
  /** Total number of rows currently rendered. */
  itemCount: number
  /** Called with the row index when Enter/O is pressed. */
  onOpen?: (index: number) => void
  /** Called when Esc is pressed and no drawer is open. */
  onEscape?: () => void
  /** Called when R is pressed with the selected row index. */
  onRetry?: (index: number) => void
  /** Called when C is pressed with the selected row index. */
  onCancel?: (index: number) => void
  /** Disable all keyboard handling (e.g. when the drawer is open). */
  disabled?: boolean
}

export interface UseKeyboardNavResult {
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  /** Attach to the list container; ensures the focused row stays visible. */
  registerRowRef: (index: number, el: HTMLElement | null) => void
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

export function useKeyboardNav({
  itemCount,
  onOpen,
  onEscape,
  onRetry,
  onCancel,
  disabled = false,
}: UseKeyboardNavOptions): UseKeyboardNavResult {
  const [selectedIndex, setSelectedIndexInternal] = useState(0)
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map())

  // Clamp index when the list shrinks
  useEffect(() => {
    if (selectedIndex >= itemCount) {
      setSelectedIndexInternal(Math.max(0, itemCount - 1))
    }
  }, [itemCount, selectedIndex])

  const setSelectedIndex = useCallback(
    (i: number) => {
      if (itemCount === 0) {
        setSelectedIndexInternal(0)
        return
      }
      const clamped = Math.min(Math.max(0, i), itemCount - 1)
      setSelectedIndexInternal(clamped)
      // Scroll the row into view; "nearest" avoids jarring jumps
      const el = rowRefs.current.get(clamped)
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    },
    [itemCount]
  )

  const registerRowRef = useCallback((index: number, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(index, el)
    else rowRefs.current.delete(index)
  }, [])

  useEffect(() => {
    if (disabled) return
    const handler = (e: KeyboardEvent) => {
      // Modifier keys belong to the platform — never intercept ⌘/Ctrl combos.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      switch (e.key) {
        case 'j':
        case 'J':
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(selectedIndex + 1)
          break
        case 'k':
        case 'K':
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(selectedIndex - 1)
          break
        case 'Enter':
        case 'o':
        case 'O':
          if (itemCount > 0 && onOpen) {
            e.preventDefault()
            onOpen(selectedIndex)
          }
          break
        case 'Escape':
          if (onEscape) {
            e.preventDefault()
            onEscape()
          }
          break
        case 'r':
        case 'R':
          if (itemCount > 0 && onRetry) {
            e.preventDefault()
            onRetry(selectedIndex)
          }
          break
        case 'c':
        case 'C':
          if (itemCount > 0 && onCancel) {
            e.preventDefault()
            onCancel(selectedIndex)
          }
          break
        default:
          break
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [disabled, itemCount, onCancel, onEscape, onOpen, onRetry, selectedIndex, setSelectedIndex])

  return { selectedIndex, setSelectedIndex, registerRowRef }
}
