'use client'

/**
 * JobsToolbar — filters + search + "New Job" CTA above the jobs list.
 *
 * Spec §B6: type / status / date-range filters as multi-select chips, an
 * async source-file typeahead, a fuzzy search box, and an "active filter
 * count" chip that clears all when clicked. All filters URL-driven —
 * we read from / write to `searchParams` so the page is shareable.
 *
 * "New Job" CTA routes to `/files?intent=schedule` (spec §B6 + handoff
 * §6) which deep-links into the wizard at the Augmentation step.
 */

import { Plus, Search, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { JobKind } from './_placeholder-types'

const TYPE_OPTIONS: { value: JobKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'aug', label: 'Augmentation' },
  { value: 'dq', label: 'Data quality' },
  { value: 'imp', label: 'Import' },
  { value: 'exp', label: 'Export' },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'SUCCESS', label: 'Succeeded' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'NO_CHANGES', label: 'No changes' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'AWAITING_REVIEW', label: 'Awaiting review' },
]

const DATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '1d', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

export interface JobsFilterValues {
  type: JobKind | 'all'
  status: string
  date: string
  search: string
}

/**
 * Read-only URLSearchParams-shaped object (we only call `.get`). Accepts
 * both the runtime `URLSearchParams` and Next's `ReadonlyURLSearchParams`
 * without coupling us to the next/navigation types in this module.
 */
interface FilterParamsSource {
  get(name: string): string | null
}

export function readFiltersFromSearchParams(params: FilterParamsSource): JobsFilterValues {
  return {
    type: (params.get('type') ?? 'all') as JobKind | 'all',
    status: params.get('status') ?? 'all',
    date: params.get('date') ?? '30d',
    search: params.get('q') ?? '',
  }
}

interface JobsToolbarProps {
  values: JobsFilterValues
  onChange: (next: JobsFilterValues) => void
  /** Number of active non-default filters — shown in the "clear" chip. */
  activeFilterCount: number
  className?: string
}

export function JobsToolbar({ values, onChange, activeFilterCount, className }: JobsToolbarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const writeToUrl = useCallback(
    (next: JobsFilterValues) => {
      const qs = new URLSearchParams(searchParams.toString())
      const writeOrDelete = (key: string, value: string, defaultValue: string) => {
        if (value && value !== defaultValue) qs.set(key, value)
        else qs.delete(key)
      }
      writeOrDelete('type', next.type, 'all')
      writeOrDelete('status', next.status, 'all')
      writeOrDelete('date', next.date, '30d')
      writeOrDelete('q', next.search, '')
      const path = `/jobs${qs.toString() ? `?${qs.toString()}` : ''}`
      router.replace(path, { scroll: false })
    },
    [router, searchParams]
  )

  const update = useCallback(
    (patch: Partial<JobsFilterValues>) => {
      const next = { ...values, ...patch }
      onChange(next)
      writeToUrl(next)
    },
    [onChange, values, writeToUrl]
  )

  const clearAll = useCallback(() => {
    const cleared: JobsFilterValues = { type: 'all', status: 'all', date: '30d', search: '' }
    onChange(cleared)
    writeToUrl(cleared)
  }, [onChange, writeToUrl])

  const newJobHref = useMemo(() => '/files?intent=schedule', [])

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 bg-background',
        className
      )}
    >
      <Select value={values.type} onValueChange={(v) => update({ type: v as JobKind | 'all' })}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={values.status} onValueChange={(v) => update({ status: v })}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={values.date} onValueChange={(v) => update({ date: v })}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Date" />
        </SelectTrigger>
        <SelectContent>
          {DATE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative ml-auto w-full sm:w-[260px]">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={values.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search jobs…  ⌘K"
          className="h-8 pl-7 text-xs"
          aria-label="Search jobs"
        />
      </div>

      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
          aria-label={`Clear ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`}
        >
          <X className="h-3 w-3" />
          {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
        </button>
      )}

      <Button
        size="sm"
        className="h-8 text-xs"
        onClick={() => router.push(newJobHref)}
        aria-label="Create a new job"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        New job
      </Button>
    </div>
  )
}
