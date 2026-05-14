"use client"

/**
 * /data-tools/augment — Augmentation job history.
 *
 * Lists all AugmentationJobs for the org. Click a row → details page with
 * preview rows fetched from /augmentation/jobs/{id}/output.
 */

import * as React from "react"
import Link from "next/link"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { AuthGuard } from "@/components/auth/auth-guard"
import { MainLayout } from "@/components/layout/main-layout"
import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { listAugmentationJobs } from "@/lib/api/augmentation"
import type { AugmentationJob } from "@/lib/types/augmentation"
import {
  JobStatusBadge,
  ScenarioBadge,
} from "@/components/augmentation/job-status-badge"
import { formatToIST } from "@/lib/utils"

export default function AugmentJobsPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <AugmentJobsContent />
      </MainLayout>
    </AuthGuard>
  )
}

function AugmentJobsContent() {
  const { accessToken } = useAuth()
  const { toast } = useToast()
  const [jobs, setJobs] = React.useState<AugmentationJob[]>([])
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await listAugmentationJobs(accessToken, { limit: 50 })
      setJobs(res.items ?? [])
    } catch (err) {
      toast({
        title: "Could not load jobs",
        description: err instanceof Error ? err.message : "Try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [accessToken, toast])

  React.useEffect(() => {
    load()
  }, [load])

  const counts = React.useMemo(() => {
    const c = { total: jobs.length, running: 0, succeeded: 0, failed: 0 }
    for (const j of jobs) {
      if (j.status === "RUNNING" || j.status === "PENDING") c.running += 1
      else if (j.status === "SUCCEEDED") c.succeeded += 1
      else if (j.status === "FAILED" || j.status === "CANCELLED") c.failed += 1
    }
    return c
  }, [jobs])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-indigo-500/20 text-violet-600 dark:text-violet-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Augmentation</h1>
            <p className="text-sm text-muted-foreground">
              Groq-compiled, Polars-executed augmentation jobs for this org.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total" value={counts.total} />
        <KpiCard label="Running" value={counts.running} tone="blue" />
        <KpiCard label="Succeeded" value={counts.succeeded} tone="emerald" />
        <KpiCard label="Failed" value={counts.failed} tone="rose" />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            Recent jobs
            <Badge variant="secondary" className="font-mono text-[10px]">
              {jobs.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && jobs.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-md bg-muted/40"
                />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
              <Sparkles className="h-8 w-8 text-muted-foreground/50" />
              <p>No augmentation jobs yet.</p>
              <p className="text-xs">
                Upload a file and enable{" "}
                <span className="font-medium text-foreground">Data Augmentation</span>{" "}
                in the advanced config to create one.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Rows in → out</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow
                    key={job.job_id}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell>
                      <Link
                        href={`/data-tools/augment/${encodeURIComponent(job.job_id)}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {job.job_id.slice(0, 10)}…
                      </Link>
                      {job.input_dataset_key && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          src: {shortKey(job.input_dataset_key)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell>
                      <ScenarioBadge scenario={inferScenario(job)} />
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <Progress value={job.percent ?? 0} className="h-1.5" />
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                        {job.percent ?? 0}%
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {job.rows_in ?? "—"} → {job.rows_out ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatToIST(job.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: "blue" | "emerald" | "rose"
}) {
  const palette =
    tone === "blue"
      ? "from-blue-500/10 to-indigo-500/5 border-blue-500/20"
      : tone === "emerald"
      ? "from-emerald-500/10 to-teal-500/5 border-emerald-500/20"
      : tone === "rose"
      ? "from-rose-500/10 to-orange-500/5 border-rose-500/20"
      : "from-muted/40 to-muted/20 border-border"
  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-3 ${palette}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function shortKey(key: string): string {
  if (key.length <= 38) return key
  return `${key.slice(0, 18)}…${key.slice(-16)}`
}

function inferScenario(j: AugmentationJob): string | null {
  // The backend doesn't currently surface scenario_id on the job record;
  // we infer from the prompt_template_id if available, or the output key.
  const fromTpl = (j.prompt_template_id || "").match(/scenario[_-]?([ABC])/i)
  if (fromTpl) return fromTpl[1].toUpperCase()
  return null
}
