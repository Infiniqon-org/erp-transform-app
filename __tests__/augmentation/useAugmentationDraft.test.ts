/**
 * Tests for components/augmentation/hooks/useAugmentationDraft.ts
 *
 * The hook is foundational for the RightRev wizard's "skip and resume"
 * behavior. A regression in any of the following silently breaks the
 * wizard for finance users:
 *
 *   - localStorage key shape `cleanflowai:augmentation_draft:{upload_id}`
 *   - 800 ms debounced writes
 *   - 64 KB size guard (silent graceful drop)
 *   - djb2 schema-hash stability + difference
 *   - isStale = (stored hash !== current hash) AND (some content)
 *   - hasDraft / clearDraft round-trip
 *   - corrupted JSON in localStorage → "no draft" (no throw)
 */

import '@testing-library/jest-dom'
import { act, renderHook } from '@testing-library/react'

import {
  computeSchemaHash,
  useAugmentationDraft,
  type AugmentationDraft,
} from '@/components/augmentation/hooks/useAugmentationDraft'
import { EMPTY_PLAN, type Plan } from '@/components/augmentation/hooks/usePlanBuilder'

const KEY_PREFIX = 'cleanflowai:augmentation_draft:'

function key(uploadId: string): string {
  return `${KEY_PREFIX}${uploadId}`
}

describe('useAugmentationDraft', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    window.localStorage.clear()
    jest.restoreAllMocks()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  // ─── T1: key shape ────────────────────────────────────────────────────────
  it('T1 — writes to localStorage key cleanflowai:augmentation_draft:{upload_id}', () => {
    const { result } = renderHook(() =>
      useAugmentationDraft({ uploadId: 'upload-abc-123', currentSchemaHash: 'h1' }),
    )

    act(() => {
      result.current.setDraft({ prompt: 'expand monthly rows' })
    })
    act(() => {
      jest.advanceTimersByTime(900)
    })

    const raw = window.localStorage.getItem(key('upload-abc-123'))
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as AugmentationDraft
    expect(parsed.prompt).toBe('expand monthly rows')
  })

  // ─── T2: null upload_id ───────────────────────────────────────────────────
  it('T2 — never writes to localStorage when uploadId is null', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() =>
      useAugmentationDraft({ uploadId: null, currentSchemaHash: 'h1' }),
    )

    act(() => {
      result.current.setDraft({ prompt: 'should not persist' })
    })
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(setItemSpy).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
  })

  // ─── T3: debounce coalesces 5 rapid saves into 1 write ────────────────────
  it('T3 — 5 rapid setDraft calls within 800ms produce a single localStorage write', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() =>
      useAugmentationDraft({ uploadId: 'u1', currentSchemaHash: 'h1' }),
    )
    setItemSpy.mockClear() // ignore any initial-mount writes

    act(() => {
      result.current.setDraft({ prompt: 'a' })
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    act(() => {
      result.current.setDraft({ prompt: 'ab' })
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    act(() => {
      result.current.setDraft({ prompt: 'abc' })
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    act(() => {
      result.current.setDraft({ prompt: 'abcd' })
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    act(() => {
      result.current.setDraft({ prompt: 'abcde' })
    })

    // Within debounce window — no write yet.
    expect(setItemSpy).not.toHaveBeenCalled()

    // Flush debounce.
    act(() => {
      jest.advanceTimersByTime(900)
    })

    expect(setItemSpy).toHaveBeenCalledTimes(1)
    const stored = JSON.parse(
      window.localStorage.getItem(key('u1')) as string,
    ) as AugmentationDraft
    expect(stored.prompt).toBe('abcde')
  })

  // ─── T4: 64 KB size guard ─────────────────────────────────────────────────
  it('T4 — payloads > 64 KB are silently dropped (no throw, no write)', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() =>
      useAugmentationDraft({ uploadId: 'u-big', currentSchemaHash: 'h1' }),
    )
    setItemSpy.mockClear()

    const huge = 'x'.repeat(70 * 1024) // ~70 KB → exceeds 64 KB guard

    expect(() => {
      act(() => {
        result.current.setDraft({ prompt: huge })
      })
      act(() => {
        jest.advanceTimersByTime(900)
      })
    }).not.toThrow()

    // The 64 KB guard short-circuits BEFORE localStorage.setItem.
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(key('u-big'))).toBeNull()
  })

  // ─── T5: schema hash is stable ────────────────────────────────────────────
  it('T5 — computeSchemaHash returns the same value for the same schema', () => {
    const schema = [
      { name: 'amount', dtype: 'float64' },
      { name: 'period', dtype: 'string' },
      { name: 'gl_code', dtype: 'string' },
    ]
    const h1 = computeSchemaHash(schema)
    const h2 = computeSchemaHash(schema)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{8}$/)
  })

  // ─── T6: schema hash differs for different schemas ────────────────────────
  it('T6 — computeSchemaHash returns different values for different schemas', () => {
    const schemaA = [
      { name: 'amount', dtype: 'float64' },
      { name: 'period', dtype: 'string' },
    ]
    const schemaB = [
      { name: 'amount', dtype: 'float64' },
      { name: 'period', dtype: 'date' }, // dtype change
    ]
    const schemaC = [
      { name: 'amount', dtype: 'float64' },
      { name: 'quarter', dtype: 'string' }, // name change
    ]
    expect(computeSchemaHash(schemaA)).not.toBe(computeSchemaHash(schemaB))
    expect(computeSchemaHash(schemaA)).not.toBe(computeSchemaHash(schemaC))
    expect(computeSchemaHash(schemaB)).not.toBe(computeSchemaHash(schemaC))
  })

  // ─── T7: isStale = true when current schema_hash diverges ─────────────────
  it('T7 — isStale becomes true when current schema differs from saved draft', () => {
    const hashA = computeSchemaHash([{ name: 'a', dtype: 'string' }])
    const hashB = computeSchemaHash([{ name: 'b', dtype: 'string' }])

    // Pre-seed a persisted draft with hashA + non-empty prompt.
    const seeded: AugmentationDraft = {
      mode: 'prose',
      prompt: 'seeded',
      plan: EMPTY_PLAN as Plan,
      cardinality: null,
      templateId: null,
      schema_hash: hashA,
      last_saved_at: 1_000,
    }
    window.localStorage.setItem(key('u7'), JSON.stringify(seeded))

    const { result } = renderHook(() =>
      useAugmentationDraft({ uploadId: 'u7', currentSchemaHash: hashB }),
    )

    expect(result.current.draft.schema_hash).toBe(hashA)
    expect(result.current.isStale).toBe(true)
  })

  // ─── T8: isStale = false when schema is unchanged ─────────────────────────
  it('T8 — isStale is false when current schema matches saved draft', () => {
    const hashA = computeSchemaHash([{ name: 'a', dtype: 'string' }])
    const seeded: AugmentationDraft = {
      mode: 'prose',
      prompt: 'seeded',
      plan: EMPTY_PLAN as Plan,
      cardinality: null,
      templateId: null,
      schema_hash: hashA,
      last_saved_at: 1_000,
    }
    window.localStorage.setItem(key('u8'), JSON.stringify(seeded))

    const { result } = renderHook(() =>
      useAugmentationDraft({ uploadId: 'u8', currentSchemaHash: hashA }),
    )

    expect(result.current.isStale).toBe(false)
  })

  // ─── T9: clearDraft removes the key ───────────────────────────────────────
  it('T9 — clearDraft() removes the localStorage key and hasDraft() returns false', () => {
    const { result } = renderHook(() =>
      useAugmentationDraft({ uploadId: 'u9', currentSchemaHash: 'h1' }),
    )

    act(() => {
      result.current.setDraft({ prompt: 'something' })
    })
    act(() => {
      jest.advanceTimersByTime(900)
    })
    expect(window.localStorage.getItem(key('u9'))).not.toBeNull()
    expect(result.current.hasDraft()).toBe(true)

    act(() => {
      result.current.clearDraft()
    })

    expect(window.localStorage.getItem(key('u9'))).toBeNull()
    expect(result.current.hasDraft()).toBe(false)
  })

  // ─── T10: hasDraft after save ─────────────────────────────────────────────
  it('T10 — hasDraft() returns true after a non-empty save is persisted', () => {
    const { result } = renderHook(() =>
      useAugmentationDraft({ uploadId: 'u10', currentSchemaHash: 'h1' }),
    )
    expect(result.current.hasDraft()).toBe(false)

    act(() => {
      result.current.setDraft({ prompt: 'wizard resume content' })
    })
    act(() => {
      jest.advanceTimersByTime(900)
    })

    expect(result.current.hasDraft()).toBe(true)
  })

  // ─── T11: corrupted localStorage ──────────────────────────────────────────
  it('T11 — corrupted JSON in the draft key is treated as no draft (no throw)', () => {
    window.localStorage.setItem(key('u11'), '{not valid json')

    let hookValue: ReturnType<typeof useAugmentationDraft> | null = null
    expect(() => {
      const { result } = renderHook(() =>
        useAugmentationDraft({ uploadId: 'u11', currentSchemaHash: 'h1' }),
      )
      hookValue = result.current
    }).not.toThrow()

    // Falls back to empty draft seeded with the current schema_hash.
    expect(hookValue).not.toBeNull()
    expect(hookValue!.draft.prompt).toBe('')
    expect(hookValue!.draft.schema_hash).toBe('h1')
    expect(hookValue!.hasDraft()).toBe(false)
  })
})
