"use client"

/**
 * prompt-composer.tsx — NLP prompt textarea + example chips + template picker.
 *
 * Click an example chip to fill the textarea. Save-as-template button POSTs
 * to /augmentation/prompt-templates via the API client. Template picker loads
 * existing templates and lets the user pick a saved prompt.
 */

import * as React from "react"
import { BookmarkPlus, Loader2, Sparkles, Wand2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  createPromptTemplate,
  type PromptTemplate,
} from "@/lib/api/augmentation"
import type { ScenarioDef } from "./scenarios"

interface PromptComposerProps {
  scenario: ScenarioDef | null
  prompt: string
  onPromptChange: (v: string) => void
  /** Optional list of saved templates to pick from. */
  templates?: PromptTemplate[]
  selectedTemplateId?: string | null
  onTemplatePick?: (id: string | null) => void
  /** Cognito access token; if absent the save button is disabled. */
  accessToken?: string | null
  disabled?: boolean
}

export function PromptComposer({
  scenario,
  prompt,
  onPromptChange,
  templates = [],
  selectedTemplateId,
  onTemplatePick,
  accessToken,
  disabled,
}: PromptComposerProps) {
  const { toast } = useToast()
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [tmplName, setTmplName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const examples = scenario?.examplePrompts ?? []

  const handleFillExample = (text: string) => {
    onPromptChange(text)
    if (onTemplatePick) onTemplatePick(null)
  }

  const handleSave = async () => {
    if (!scenario || !accessToken || !tmplName.trim() || !prompt.trim()) return
    setSaving(true)
    try {
      const res = await createPromptTemplate(
        {
          name: tmplName.trim(),
          prompt,
          expected_cardinality: scenario.cardinality,
        },
        accessToken,
      )
      toast({
        title: "Template saved",
        description: `${tmplName.trim()} (v${res.version})`,
      })
      setSaveOpen(false)
      setTmplName("")
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Could not save template",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {templates.length > 0 && onTemplatePick && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Saved templates:
          </span>
          {templates.map((t) => {
            const active = selectedTemplateId === t.template_id
            return (
              <button
                key={t.template_id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (active) {
                    onTemplatePick(null)
                  } else {
                    onTemplatePick(t.template_id)
                    onPromptChange(t.prompt)
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-foreground/30",
                )}
              >
                <Sparkles className="h-3 w-3" />
                {t.name}
                <span className="font-mono text-[10px] text-muted-foreground">
                  v{t.active_version}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="relative rounded-xl border bg-card">
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={disabled}
          rows={4}
          placeholder={
            scenario
              ? `Describe the ${scenario.title.toLowerCase()} transformation in plain English…`
              : "Pick a scenario above, then describe the transformation in plain English…"
          }
          className="min-h-[110px] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Wand2 className="h-3 w-3" />
            Powered by Groq — your prompt is compiled to a Polars expression.
          </span>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            disabled={disabled || !scenario || !prompt.trim() || !accessToken}
            onClick={() => setSaveOpen(true)}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save as template
          </Button>
        </div>
      </div>

      {examples.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Examples — click to fill
          </p>
          <div className="flex flex-col gap-1.5">
            {examples.map((ex, i) => (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => handleFillExample(ex)}
                className={cn(
                  "group flex items-start gap-2 rounded-md border border-dashed bg-background/60 px-3 py-2 text-left text-xs leading-snug transition-all",
                  "hover:border-primary/50 hover:bg-primary/[0.04]",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-[10px] font-semibold text-muted-foreground group-hover:border-primary/50 group-hover:text-primary"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="text-muted-foreground group-hover:text-foreground">
                  {ex}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-4 w-4" />
              Save prompt as template
            </DialogTitle>
            <DialogDescription>
              Reusable in this org. Cardinality is locked to{" "}
              <span className="font-mono">{scenario?.cardinality ?? "—"}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-muted-foreground">
              Template name
            </label>
            <Input
              value={tmplName}
              onChange={(e) => setTmplName(e.target.value)}
              placeholder="e.g. SaaS Annual Fold (ASC 606)"
            />
            <div className="rounded-md border bg-muted/40 p-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Prompt preview:</span>{" "}
              {prompt.slice(0, 240)}
              {prompt.length > 240 && "…"}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!tmplName.trim() || saving}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="h-3.5 w-3.5" />
              )}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
