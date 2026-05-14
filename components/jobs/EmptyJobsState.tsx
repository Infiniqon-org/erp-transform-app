'use client'

/**
 * EmptyJobsState — calm empty state for the Jobs list.
 *
 * Spec §B4: NO illustration, NO mascot, NO "🚀". Single muted icon in a
 * 40 px circle, two CTAs (deep-link to wizard at Advanced Configuration,
 * and a soft secondary link to start a plain upload).
 *
 * Filtered-zero state delegates to a tiny inline `<FilteredZero>`
 * variant that the list view passes `onClearFilters` to.
 */

import { LayoutList } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyJobsStateProps {
  className?: string
}

export function EmptyJobsState({ className }: EmptyJobsStateProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <LayoutList className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="text-base font-semibold text-foreground">No jobs yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Kick off your first augmentation to see runs land here.
      </p>
      <div className="mt-5 flex flex-col items-center gap-2">
        <Button asChild size="sm" className="h-8 text-xs">
          <Link href="/files?intent=schedule">Start an augmentation →</Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          or{' '}
          <Link href="/files" className="underline-offset-2 hover:underline">
            upload a file
          </Link>{' '}
          to run DQ only.
        </p>
      </div>
    </div>
  )
}

interface FilteredZeroProps {
  onClearFilters: () => void
  className?: string
}

export function FilteredZero({ onClearFilters, className }: FilteredZeroProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <p className="text-sm text-muted-foreground">No jobs match these filters.</p>
      <Button variant="link" className="mt-2 h-auto p-0 text-xs" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  )
}
