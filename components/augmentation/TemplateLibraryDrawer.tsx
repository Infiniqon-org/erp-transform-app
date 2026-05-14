"use client"

/**
 * TemplateLibraryDrawer.tsx
 *
 * Right-edge slide-in drawer listing the user's saved PromptTemplates.
 *
 * Two CTAs per spec §2 + §11:
 *   - "Use this template" → inserts the template's prompt + cardinality into
 *     the active editor (callback-driven; the parent decides whether to
 *     overwrite or append).
 *   - "Save current as template" → asks the user for a name in a single
 *     inline input, then calls createPromptTemplate(). No new modal.
 *
 * Density: 36 px rows, mono name, version pill, mono created_at, hairline
 * dividers. Matches the Linear "My Issues" density target from
 * WIZARD_AND_JOBS_UI_DESIGN_SPEC §B1.
 */

import * as React from "react"
import { BookOpen, Plus, Save, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Cardinality, PromptTemplate } from "@/lib/types/augmentation"
import { createPromptTemplate } from "@/lib/api/augmentation"

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TemplateLibraryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  /** Existing templates loaded by the wizard. */
  templates: ReadonlyArray<PromptTemplate>

  /** The user's current prompt + cardinality, used by "Save as template". */
  currentPrompt: string
  currentCardinality: Cardinality

  /** Cognito access token. When null the save CTA is disabled. */
  accessToken?: string | null

  /**
   * Called when the user activates "Use this template". The parent is
   * responsible for inserting/overwriting the editor content.
   */
  onUse: (template: PromptTemplate) => void

  /**
   * Called after a successful save so the parent can refresh its template
   * list. Receives the newly-active template's id.
   */
  onSaved?: (templateId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardinalityLabel(c: Cardinality): string {
  switch (c) {
    case "ONE_TO_MANY":
      return "1 → N"
    case "MANY_TO_ONE":
      return "N → 1"
    case "MANY_TO_MANY":
      return "N → K"
  }
}

function timeAgo(iso: string | undefined): string {
  if (!iso) return ""
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ""
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplateLibraryDrawer({
  open,
  onOpenChange,
  templates,
  currentPrompt,
  currentCardinality,
  accessToken,
  onUse,
  onSaved,
}: TemplateLibraryDrawerProps) {
  const [filter, setFilter] = React.useState("")
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [saveName, setSaveName] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.template_id.toLowerCase().includes(q)
    )
  }, [filter, templates])

  const canSave = Boolean(accessToken) && currentPrompt.trim().length > 0

  const handleSave = async () => {
    if (!accessToken) return
    const name = saveName.trim()
    if (!name) {
      setSaveError("Give the template a name.")
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const version = await createPromptTemplate(
        {
          name,
          prompt: currentPrompt.trim(),
          expected_cardinality: currentCardinality,
        },
        accessToken
      )
      onSaved?.(version.template_id)
      setSaveOpen(false)
      setSaveName("")
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Save failed — try again."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-wider text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            Template library
          </SheetTitle>
          <SheetDescription className="text-xs">
            Reusable augmentation prompts saved by your org.
          </SheetDescription>

          <div className="pt-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter by name or id…"
              className="h-8 font-mono text-[12px]"
            />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-3 py-2">
            {filtered.length === 0 ? (
              <div className="px-2 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {templates.length === 0
                    ? "No saved templates yet."
                    : "No templates match that filter."}
                </p>
                {templates.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Save the current prompt below to start a library.
                  </p>
                )}
              </div>
            ) : (
              <ul className="space-y-1">
                {filtered.map((t) => (
                  <li key={t.template_id}>
                    <button
                      type="button"
                      onClick={() => onUse(t)}
                      className={cn(
                        "group w-full text-left rounded-md border border-transparent",
                        "px-3 py-2 hover:bg-muted/50 hover:border-border",
                        "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] font-medium truncate">
                          {t.name}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-1.5 py-0.5",
                            "font-mono text-[10px] uppercase tracking-wider",
                            "text-muted-foreground"
                          )}
                          aria-label={`version ${t.active_version}`}
                        >
                          v{t.active_version}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">
                          {cardinalityLabel(t.expected_cardinality)}
                        </span>
                        {t.created_at && (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="font-mono">
                              {timeAgo(t.created_at)}
                            </span>
                          </>
                        )}
                      </div>
                      {t.prompt && (
                        <p className="mt-1 line-clamp-2 font-mono text-[11px] text-foreground/70">
                          {t.prompt}
                        </p>
                      )}
                      <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          click to insert
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Save current as template */}
        <div className="px-5 py-4 space-y-3">
          {!saveOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 gap-1.5"
              disabled={!canSave}
              onClick={() => {
                setSaveOpen(true)
                setSaveError(null)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Save current as template
            </Button>
          ) : (
            <div className="space-y-2">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Template name
              </label>
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. fy26-fold-by-customer"
                  className="h-8 font-mono text-[12px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && saveName.trim() && !saving) {
                      e.preventDefault()
                      handleSave()
                    } else if (e.key === "Escape") {
                      setSaveOpen(false)
                      setSaveName("")
                      setSaveError(null)
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={!saveName.trim() || saving}
                  onClick={handleSave}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setSaveOpen(false)
                    setSaveName("")
                    setSaveError(null)
                  }}
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {saveError && (
                <p className="text-[11px] text-destructive">{saveError}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Cardinality{" "}
                <span className="font-mono">
                  {cardinalityLabel(currentCardinality)}
                </span>{" "}
                · {currentPrompt.trim().length} chars
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="px-5 pb-5">
          <SheetClose asChild>
            <Button variant="ghost" size="sm" className="w-full h-8">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default TemplateLibraryDrawer
