"use client"

/**
 * column-mapper.tsx — drag-and-drop source-column → target-schema mapper.
 *
 * Native HTML5 drag/drop (no @dnd-kit dep). Each source column is a draggable
 * chip; each target field is a drop slot. Slots also accept click-to-select
 * (keyboard-friendly fallback) so a11y users can map without a pointer.
 *
 * Mapping is bidirectional: dropping a source on a target sets the binding;
 * clicking the × on a slot clears it.
 */

import * as React from "react"
import { Grip, Hash, X, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SchemaField } from "./scenarios"

/** A source column extracted from the uploaded file (or typed manually). */
export interface SourceColumn {
  name: string
  /** Inferred dtype (best-effort) — purely informational. */
  dtype?: string
}

export type ColumnMapping = Record<string, string | null>

interface ColumnMapperProps {
  sourceColumns: SourceColumn[]
  targetFields: SchemaField[]
  mapping: ColumnMapping
  onMappingChange: (next: ColumnMapping) => void
  /** Allow free-text columns the user types in (for un-uploaded scenarios). */
  onAddSourceColumn?: (name: string) => void
}

function dtypeIcon(dtype: string | undefined) {
  if (!dtype) return Type
  if (/(int|float|decimal|number)/i.test(dtype)) return Hash
  return Type
}

export function ColumnMapper({
  sourceColumns,
  targetFields,
  mapping,
  onMappingChange,
  onAddSourceColumn,
}: ColumnMapperProps) {
  const [draggedCol, setDraggedCol] = React.useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = React.useState<string | null>(null)
  const [newColName, setNewColName] = React.useState("")
  const [pickedSource, setPickedSource] = React.useState<string | null>(null)

  const handleDragStart = (col: string) => (e: React.DragEvent) => {
    setDraggedCol(col)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", col)
  }
  const handleDragEnd = () => {
    setDraggedCol(null)
    setHoverTarget(null)
  }
  const handleDragOver = (target: string) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setHoverTarget(target)
  }
  const handleDragLeave = () => setHoverTarget(null)
  const handleDrop = (target: string) => (e: React.DragEvent) => {
    e.preventDefault()
    const col = e.dataTransfer.getData("text/plain") || draggedCol
    if (!col) return
    onMappingChange({ ...mapping, [target]: col })
    setDraggedCol(null)
    setHoverTarget(null)
  }

  const handleClearSlot = (target: string) => {
    const { [target]: _drop, ...rest } = mapping
    onMappingChange({ ...rest, [target]: null })
  }

  const handleSlotClick = (target: string) => {
    if (pickedSource) {
      onMappingChange({ ...mapping, [target]: pickedSource })
      setPickedSource(null)
    }
  }

  const handleSourcePick = (col: string) => {
    setPickedSource((prev) => (prev === col ? null : col))
  }

  const mappedCols = new Set(
    Object.values(mapping).filter((v): v is string => Boolean(v)),
  )

  const handleAddCol = () => {
    const name = newColName.trim()
    if (!name) return
    if (onAddSourceColumn) onAddSourceColumn(name)
    setNewColName("")
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1.2fr]">
      {/* Source columns */}
      <div className="rounded-xl border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Source columns
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {sourceColumns.length}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sourceColumns.length === 0 ? (
            <div className="w-full rounded-lg border border-dashed bg-background/50 px-3 py-6 text-center text-xs text-muted-foreground">
              No source columns yet — upload a file first, or add them below.
            </div>
          ) : (
            sourceColumns.map((c) => {
              const used = mappedCols.has(c.name)
              const picked = pickedSource === c.name
              const Icon = dtypeIcon(c.dtype)
              return (
                <button
                  key={c.name}
                  type="button"
                  draggable
                  onDragStart={handleDragStart(c.name)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleSourcePick(c.name)}
                  aria-pressed={picked}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-medium transition-all",
                    "hover:border-foreground/30 hover:shadow-sm",
                    "active:cursor-grabbing",
                    used && "opacity-60",
                    picked && "border-primary ring-2 ring-primary/30",
                  )}
                  title={c.dtype ? `${c.name} (${c.dtype})` : c.name}
                >
                  <Grip className="h-3 w-3 cursor-grab text-muted-foreground" />
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span>{c.name}</span>
                  {c.dtype && (
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">
                      {c.dtype}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
        {onAddSourceColumn && (
          <div className="mt-3 flex gap-1.5">
            <input
              type="text"
              value={newColName}
              placeholder="Add column name…"
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddCol()
                }
              }}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/30"
            />
            <Button
              size="sm"
              variant="outline"
              type="button"
              className="h-7 px-2 text-xs"
              onClick={handleAddCol}
              disabled={!newColName.trim()}
            >
              Add
            </Button>
          </div>
        )}
        {pickedSource && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tip: <span className="font-medium text-foreground">{pickedSource}</span> selected — click a target slot to map.
          </p>
        )}
      </div>

      {/* Arrow visual */}
      <div className="hidden items-center justify-center lg:flex">
        <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
          <div className="h-12 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
          <span className="text-[10px] font-mono uppercase tracking-widest">
            map
          </span>
          <div className="h-12 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
        </div>
      </div>

      {/* Target schema slots */}
      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Target schema
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {Object.values(mapping).filter(Boolean).length}/{targetFields.length} mapped
          </Badge>
        </div>
        <div className="space-y-1.5">
          {targetFields.map((f) => {
            const bound = mapping[f.name] ?? null
            const isHover = hoverTarget === f.name
            return (
              <div
                key={f.name}
                onDragOver={handleDragOver(f.name)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop(f.name)}
                onClick={() => handleSlotClick(f.name)}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5 text-xs transition-all",
                  isHover && "border-primary bg-primary/5 ring-1 ring-primary/40",
                  bound ? "border-foreground/15" : "border-dashed",
                  pickedSource && !bound && "cursor-pointer hover:border-primary/50",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="font-medium text-foreground">{f.name}</span>
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    {f.type}
                  </span>
                  {f.required && (
                    <span
                      className="text-[10px] font-semibold text-rose-500"
                      title="Required"
                    >
                      *
                    </span>
                  )}
                </div>
                {bound ? (
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
                      ← {bound}
                    </span>
                    <button
                      type="button"
                      aria-label={`Clear ${f.name} mapping`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleClearSlot(f.name)
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] italic text-muted-foreground">
                    drop or click
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
