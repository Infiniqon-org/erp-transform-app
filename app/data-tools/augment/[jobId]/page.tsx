"use client"

/**
 * /data-tools/augment/[jobId] — Single augmentation job detail.
 *
 * Polls the job status until terminal, fetches /output for preview rows when
 * the job succeeded, and renders a clean two-pane layout: meta + preview.
 */

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { AuthGuard } from "@/components/auth/auth-guard"
import { MainLayout } from "@/components/layout/main-layout"
import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getAugmentationJob,
  getAugmentationJobOutput,
} from "@/lib/api/augmentation"
import type {
  AugmentationJob,
  JobOutputResponse,
} from "@/lib/types/augmentation"
import { TERMINAL_JOB_STATUSES } from "@/lib/types/augmentation"
import {
  JobStatusBadge,
  ScenarioBadge,
} from "@/components/augmentation/job-status-badge"
import { formatToIST } from "@/lib/utils"

export default function JobDetailPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <JobDetailContent />
      </MainLayout>
    </AuthGuard>
  )
}

function JobDetailContent() {
  const { jobId } = useParams() as { jobId: string }
  const decodedJobId = React.useMemo(
    () => decodeURIComponent(jobId),
    [jobId],
  )
  const { accessToken } = useAuth()
  const { toast } = useToast()
  const [job, setJob] = React.useState<AugmentationJob | null>(null)
  const [output, setOutput] = React.useState<JobOutputResponse | null>(null)
  const [loading, setLoading] = React.useState(false)

  const fetchAll = React.useCallback(async () => {
    if (!accessToken || !decodedJobId) return
    setLoading(true)
    try {
      const j = await getAugmentationJob(decodedJobId, accessToken)
      setJob(j)
      if (j.status === "SUCCEEDED") {
        try {
          const out = await getAugmentationJobOutput(decodedJobId, accessToken, {
            offset: 0,
            limit: 50,
          })
          setOutput(out)
        } catch {
          /* preview optional */
        }
      }
    } catch (err) {
      toast({
        title: "Could not load job",
        description: err instanceof Error ? err.message : "Try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [accessToken, decodedJobId, toast])

  React.useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Poll while non-terminal.
  React.useEffect(() => {
    if (!job) return
    if (TERMINAL_JOB_STATUSES.includes(job.status)) return
    const t = setInterval(fetchAll, 5000)
    return () => clearInterval(t)
  }, [job, fetchAll])

  const copyId = () => {
    if (!decodedJobId) return
    navigator.clipboard?.writeText(decodedJobId)
    toast({ title: "Job ID copied" })
  }

  const previewRows = output?.rows ?? []
  const previewCols = React.useMemo<string[]>(() => {
    const cols = new Set<string>()
    for (const r of previewRows) {
      for (const k of Object.keys(r.values ?? {})) cols.add(k)
    }
    return Array.from(cols)
  }, [previewRows])

  return (
    <div className="space-y-6">
      {/* Breadcrumb / back */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/data-tools/augment"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All jobs
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
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

      {!job ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading job…
            </span>
          ) : (
            "Job not found."
          )}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="font-mono text-base">
                    {job.job_id.slice(0, 12)}…
                  </CardTitle>
                  <button
                    type="button"
                    onClick={copyId}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Copy job ID"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <ScenarioBadge scenario={null} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <JobStatusBadge status={job.status} />
                  {typeof job.percent === "number" && (
                    <span className="text-xs text-muted-foreground">
                      {job.percent}% complete
                    </span>
                  )}
                </div>
              </div>
              {output?.presigned_url && (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a
                    href={output.presigned_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download output
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Progress value={job.percent ?? 0} className="h-2" />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Meta label="Created" value={formatToIST(job.created_at)} />
                <Meta
                  label="Updated"
                  value={formatToIST(job.updated_at ?? job.created_at)}
                />
                <Meta
                  label="Rows in"
                  value={job.rows_in?.toLocaleString() ?? "—"}
                />
                <Meta
                  label="Rows out"
                  value={job.rows_out?.toLocaleString() ?? "—"}
                />
              </div>
              {job.input_dataset_key && (
                <Meta
                  className="mt-3"
                  label="Input"
                  value={job.input_dataset_key}
                  mono
                />
              )}
              {job.output_dataset_key && (
                <Meta
                  className="mt-2"
                  label="Output"
                  value={job.output_dataset_key}
                  mono
                />
              )}
              {job.error_message && (
                <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
                  <span className="font-medium">Error:</span>{" "}
                  {job.error_message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview rows */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Preview rows</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {previewRows.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {job.status === "SUCCEEDED"
                    ? "No inline preview available — download the parquet output above."
                    : "Preview will appear once the job succeeds."}
                </div>
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="w-12 text-right font-mono text-[10px] uppercase tracking-wider">
                          #
                        </TableHead>
                        {previewCols.map((c) => (
                          <TableHead
                            key={c}
                            className="font-mono text-[10px] uppercase tracking-wider"
                          >
                            {c}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((r) => (
                        <TableRow key={r.row_index}>
                          <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                            {r.row_index}
                          </TableCell>
                          {previewCols.map((c) => {
                            const v = r.values?.[c]
                            return (
                              <TableCell
                                key={c}
                                className="max-w-[260px] truncate font-mono text-xs"
                              >
                                {v === null || v === undefined ? (
                                  <span className="italic text-muted-foreground">
                                    null
                                  </span>
                                ) : (
                                  String(v)
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Meta({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={`rounded-md border bg-muted/30 p-2.5 ${className ?? ""}`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-sm ${mono ? "font-mono text-xs break-all" : ""}`}
      >
        {value}
      </div>
    </div>
  )
}
