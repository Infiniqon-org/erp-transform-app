'use client'

/**
 * /jobs — Jobs UI route (Linear "My Issues" density + GitHub-Actions-style
 * detail drawer, per `docs/WIZARD_AND_JOBS_UI_DESIGN_SPEC_2026-05-14.md`).
 *
 * REPLACEMENT NOTE: this file used to host a 470-line "scheduled jobs"
 * dialog/grid surface. That surface predates the W+5 Jobs context and
 * stored rules in localStorage. We replace it wholesale with the new
 * design-spec'd surface, which talks to the real `/jobs` API via the
 * sibling foundation in `lib/api/jobs-api.ts` + `lib/features/jobsSlice.ts`.
 *
 * The page itself is a thin client island:
 *   1. AuthGuard + MainLayout shell (matches /files, /dashboard, etc.)
 *   2. Reads initial filter values from the URL so refreshes / shared
 *      links land on the same filter set (spec §B6).
 *   3. Renders `<JobsListView>` full-bleed inside the layout's content
 *      area; the list itself owns selection, drawer, and WS connection.
 *
 * The route is `"use client"` because the list is interactive top to
 * bottom (J/K nav, WebSocket subscription, redux store reads). A server
 * component wrapper would add a boundary for zero benefit.
 */

import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo } from 'react'

import { AuthGuard } from '@/components/auth/auth-guard'
import { JobsListView } from '@/components/jobs/JobsListView'
import { readFiltersFromSearchParams } from '@/components/jobs/JobsToolbar'
import { MainLayout } from '@/components/layout/main-layout'

export default function JobsPage() {
  return (
    <AuthGuard>
      <MainLayout>
        {/*
          MainLayout wraps its children in a max-w-7xl padded box. The jobs
          surface is a dense ledger we want to bleed to the page edges; the
          negative-margin trick neutralizes the wrapper padding so the list
          can scroll independently inside its own border.
        */}
        <div className="-m-3 sm:-m-4 lg:-m-6 xl:-m-8 h-[calc(100vh-0px)]">
          <div className="flex h-full flex-col overflow-hidden border border-border bg-background">
            <Suspense fallback={null}>
              <JobsPageBody />
            </Suspense>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}

function JobsPageBody() {
  // `useSearchParams` must run inside <Suspense> in Next 15 app router.
  const searchParams = useSearchParams()
  const initialFilters = useMemo(
    () => readFiltersFromSearchParams(searchParams),
    [searchParams]
  )
  return <JobsListView initialFilters={initialFilters} orgId={null} />
}
