"use client"

/**
 * PromptTemplateEditor.tsx
 *
 * Primary NLP surface for the Augmentation wizard step. Per design spec
 * §1–§9 this is a *document*, not a chat:
 *
 *   • Linear-density layout — 12 px gutters, rounded-md, hairline borders.
 *   • Causal-style inline pills — {{column}} + {param:value}.
 *   • Hex-style CardinalityChip with auto-detect + click-override.
 *   • Slash-command palette (cmdk) for /column, /param, /template, /cardinality.
 *   • Keyboard: ⌘↵ run, ⌘S save, Esc, /, ?
 *
 * What this component DOES NOT do:
 *   • No DnD source/target wiring (sibling DragDropRuleBuilder handles that;
 *     this component only ACCEPTS drops onto the textarea, inserting a pill).
 *   • No backend round-trip per keystroke — preview synthesis is client-side
 *     (delegated to LivePreviewPanel).
 *   • No "Magic / Smart / Powered by AI" copy. The product nouns are
 *     "Augmentation", "fold/expand/derive". The engine is Polars.
 */

import * as React from "react"
import {
  Keyboard,
  Play,
  Save,
  ChevronDown,
  BookOpen,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type {
  Cardinality,
  PromptTemplate,
} from "@/lib/types/augmentation"

import { CardinalityChip } from "./CardinalityChip"
import { ModeToggle, type EditorMode } from "./ModeToggle"
import { ParameterPill, type PillType } from "./ParameterPill"
import { usePromptParser } from "./hooks/usePromptParser"
import { useCardinalityDetect } from "./hooks/useCardinalityDetect"

// ─── Public column shape (matches the wizard's schema-preview payload) ───────

export interface EditorColumn {
  name: string
  type?: PillType
  /** Example value shown in the pill hover tooltip. */
  sampleValue?: string
}

export interface PromptTemplateEditorProps {
  value: string
  onChange: (next: string) => void

  availableColumns?: EditorColumn[]
  templates?: PromptTemplate[]
  selectedTemplateId?: string | null
  onSelectTemplate?: (templateId: string | null) => void

  /** Cardinality override; null/undefined means "use auto-detect". */
  cardinalityOverride?: Cardinality | null
  onCardinalityOverride?: (value: Cardinality | null) => void

  mode?: EditorMode
  onModeChange?: (mode: EditorMode) => void

  onRun?: () => void
  onSave?: () => void

  validationError?: string | null
  isRunning?: boolean

  className?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function indexColumns(cols: EditorColumn[] = []): Record<string, EditorColumn> {
  const out: Record<string, EditorColumn> = {}
  for (const c of cols) out[c.name] = c
  return out
}

function isMac() {
  if (typeof navigator === "undefined") return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
}

// Replace the textarea selection with `text`; returns the next caret index.
function spliceTextarea(
  el: HTMLTextAreaElement,
  text: string
): { next: string; caret: number } {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const next = el.value.slice(0, start) + text + el.value.slice(end)
  return { next, caret: start + text.length }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PromptTemplateEditor(props: PromptTemplateEditorProps) {
  const {
    value,
    onChange,
    availableColumns = [],
    templates = [],
    selectedTemplateId = null,
    onSelectTemplate,
    cardinalityOverride = null,
    onCardinalityOverride,
    mode = "prose",
    onModeChange,
    onRun,
    onSave,
    validationError,
    isRunning = false,
    className,
  } = props

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [slashOpen, setSlashOpen] = React.useState(false)
  const [slashAnchor, setSlashAnchor] = React.useState<{ top: number; left: number } | null>(null)
  const [cheatsheetOpen, setCheatsheetOpen] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)

  const columnNames = React.useMemo(
    () => availableColumns.map((c) => c.name),
    [availableColumns]
  )
  const columnIndex = React.useMemo(() => indexColumns(availableColumns), [availableColumns])

  const parsed = usePromptParser(value, columnNames)
  const detection = useCardinalityDetect(parsed)
  const effectiveCardinality: Cardinality = cardinalityOverride ?? detection.cardinality
  const isManualOverride = cardinalityOverride != null

  // Validation messages (auto + caller-supplied).
  const autoError =
    parsed.unknownColumns.length > 0
      ? `Prompt references unknown column \`${parsed.unknownColumns[0]}\`.`
      : null
  const visibleError = validationError ?? autoError
  const isValid = !visibleError && value.trim().length > 0

  const insertAtCaret = React.useCallback(
    (insertion: string) => {
      const el = textareaRef.current
      if (!el) {
        onChange(value + insertion)
        return
      }
      const { next, caret } = spliceTextarea(el, insertion)
      onChange(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(caret, caret)
      })
    },
    [onChange, value]
  )

  // Compute slash anchor by measuring the caret-line top within the textarea.
  const openSlashAtCaret = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setSlashAnchor({ top: rect.bottom + 4, left: rect.left + 12 })
    setSlashOpen(true)
  }, [])

  // ─── Global key handlers ──────────────────────────────────────────────────
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey
      // ⌘↵
      if (cmd && e.key === "Enter") {
        e.preventDefault()
        if (isValid && !isRunning) onRun?.()
        return
      }
      // ⌘S
      if (cmd && (e.key === "s" || e.key === "S")) {
        e.preventDefault()
        onSave?.()
        return
      }
      // Esc — cascading (slash → cheatsheet → blur). Drag/drawer handled by callers.
      if (e.key === "Escape") {
        if (slashOpen) {
          e.preventDefault()
          setSlashOpen(false)
          return
        }
        if (cheatsheetOpen) {
          e.preventDefault()
          setCheatsheetOpen(false)
          return
        }
        if (document.activeElement === textareaRef.current) {
          ;(textareaRef.current as HTMLTextAreaElement).blur()
        }
        return
      }
      // ? — only fires when the textarea is NOT focused (avoids interference)
      if (e.key === "?" && document.activeElement !== textareaRef.current) {
        e.preventDefault()
        setCheatsheetOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isValid, isRunning, slashOpen, cheatsheetOpen, onRun, onSave])

  // ─── Textarea-level key handler ───────────────────────────────────────────
  const onTextareaKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "/" && !slashOpen) {
      // Open palette but ALSO let "/" enter the textarea — the palette can be
      // used as a filter and dismissed without leaving a stray character.
      openSlashAtCaret()
    }
  }

  // ─── Drop target (accept pill drops from sibling DragDropRuleBuilder) ─────
  const onTextareaDrop: React.DragEventHandler<HTMLTextAreaElement> = (e) => {
    const raw = e.dataTransfer.getData("application/x-augmentation-pill")
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as {
        kind: "column" | "param"
        name: string
        value?: string
      }
      e.preventDefault()
      const insertion =
        payload.kind === "column"
          ? `{{${payload.name}}}`
          : `{${payload.name}:${payload.value ?? ""}}`
      insertAtCaret(insertion)
    } catch {
      /* ignore malformed drag payload */
    }
  }
  const onTextareaDragOver: React.DragEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.dataTransfer.types.includes("application/x-augmentation-pill")) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    }
  }

  // ─── Rendered token strip (live tokenisation under the textarea) ──────────
  const tokenStrip = (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 rounded-md border bg-muted/30 px-2 py-1.5",
        "font-mono text-[12px] leading-relaxed"
      )}
      aria-label="Parsed prompt tokens"
    >
      {parsed.tokens.length === 0 ? (
        <span className="text-muted-foreground">No tokens yet — start typing.</span>
      ) : (
        parsed.tokens.map((t, i) => {
          if (t.kind === "text") {
            return (
              <span key={i} className="whitespace-pre-wrap text-foreground/85">
                {t.value}
              </span>
            )
          }
          if (t.kind === "column") {
            const col = columnIndex[t.name]
            const invalid = columnNames.length > 0 && !columnIndex[t.name]
            return (
              <ParameterPill
                key={i}
                kind="column"
                name={t.name}
                type={col?.type}
                value={col?.sampleValue}
                invalid={invalid}
                draggable={false}
                tabIndex={-1}
              />
            )
          }
          return (
            <ParameterPill
              key={i}
              kind="param"
              name={t.name}
              value={t.value}
              type="param"
              draggable={false}
              tabIndex={0}
            />
          )
        })
      )}
    </div>
  )

  // ─── Slash palette items ──────────────────────────────────────────────────
  const slashItems = React.useMemo(() => {
    const items: Array<{
      label: string
      hint: string
      onSelect: () => void
      group: string
    }> = []
    for (const c of availableColumns) {
      items.push({
        group: "Columns",
        label: c.name,
        hint: c.type ?? "text",
        onSelect: () => {
          insertAtCaret(`{{${c.name}}}`)
          setSlashOpen(false)
        },
      })
    }
    items.push(
      {
        group: "Parameters",
        label: "currency",
        hint: "{currency:USD}",
        onSelect: () => {
          insertAtCaret("{currency:USD}")
          setSlashOpen(false)
        },
      },
      {
        group: "Parameters",
        label: "period",
        hint: "{period:FY26}",
        onSelect: () => {
          insertAtCaret("{period:FY26}")
          setSlashOpen(false)
        },
      }
    )
    for (const c of (["ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"] as Cardinality[])) {
      items.push({
        group: "Cardinality",
        label: `Set ${c}`,
        hint: "manual override",
        onSelect: () => {
          onCardinalityOverride?.(c)
          setSlashOpen(false)
        },
      })
    }
    for (const t of templates) {
      items.push({
        group: "Templates",
        label: t.name,
        hint: `v${t.active_version}`,
        onSelect: () => {
          onSelectTemplate?.(t.template_id)
          onChange(t.prompt)
          setSlashOpen(false)
        },
      })
    }
    return items
  }, [availableColumns, templates, insertAtCaret, onCardinalityOverride, onSelectTemplate, onChange])

  // ─── Render ───────────────────────────────────────────────────────────────
  const cmdLabel = isMac() ? "⌘" : "Ctrl"

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      {/* Header strip — ModeToggle + Template picker + Cardinality + cheatsheet */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {onModeChange && (
            <ModeToggle
              value={mode}
              onChange={onModeChange}
              proseToBuilderLossy={parsed.hasFreeFormImperative}
              lossyReason="Free-form instructions (e.g. 'flag rows where…') cannot be modelled by the structured builder. Simplify the prompt to switch to Builder mode."
            />
          )}
          {onSelectTemplate && (
            <Select
              value={selectedTemplateId ?? "__none__"}
              onValueChange={(v) => onSelectTemplate(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="h-8 w-[200px] font-mono text-[12px]">
                <BookOpen className="h-3.5 w-3.5 opacity-70" />
                <SelectValue placeholder="Templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="font-mono text-[12px]">
                  — no template —
                </SelectItem>
                {templates.map((t) => (
                  <SelectItem
                    key={t.template_id}
                    value={t.template_id}
                    className="font-mono text-[12px]"
                  >
                    {t.name}{" "}
                    <span className="text-muted-foreground">v{t.active_version}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CardinalityChip
            value={effectiveCardinality}
            inferred={detection.cardinality}
            confidence={detection.confidence}
            isManualOverride={isManualOverride}
            onChange={onCardinalityOverride}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setCheatsheetOpen(true)}
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Textarea — the prose surface */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onTextareaKeyDown}
          onDrop={onTextareaDrop}
          onDragOver={onTextareaDragOver}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Describe how to fold or expand these columns. Drag a column in, or type /"
          spellCheck={false}
          className={cn(
            "min-h-[160px] resize-y rounded-md border bg-background px-3 py-2",
            "font-sans text-[14px] leading-relaxed",
            isFocused && "ring-2 ring-ring",
            visibleError && "border-destructive/60"
          )}
        />
        {/* Validation indicator dot */}
        <span
          className={cn(
            "absolute right-3 top-3 inline-flex h-2 w-2 rounded-full",
            !value.trim() && "bg-muted",
            value.trim() && !visibleError && "bg-emerald-500",
            visibleError && "bg-destructive"
          )}
          aria-label={
            !value.trim()
              ? "empty"
              : visibleError
                ? `error: ${visibleError}`
                : "valid"
          }
        />
      </div>

      {/* Inline validation caption */}
      {visibleError && (
        <div className="text-xs text-destructive" role="alert">
          {visibleError}
        </div>
      )}

      {/* Token strip — Causal-style inline pill rendering of the current prompt */}
      {tokenStrip}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono">
            {parsed.columns.length} col · {Object.keys(parsed.params).length} param ·{" "}
            {parsed.verbs.length} verb
          </span>
          {parsed.groupBy.length > 0 && (
            <span className="font-mono">
              · group by {parsed.groupBy.join(", ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                Insert <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search columns, params, templates…" />
                <CommandList>
                  <CommandEmpty>No matches.</CommandEmpty>
                  {groupItems(slashItems).map(([group, items]) => (
                    <CommandGroup key={group} heading={group}>
                      {items.map((it) => (
                        <CommandItem key={`${group}:${it.label}`} onSelect={it.onSelect}>
                          <span className="flex-1 font-mono text-[12px]">{it.label}</span>
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {it.hint}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => onSave?.()}
            disabled={!isValid}
          >
            <Save className="h-3.5 w-3.5" /> Save as template
            <kbd className="ml-1 font-mono text-[10px] text-muted-foreground">
              {cmdLabel}S
            </kbd>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1"
            onClick={() => onRun?.()}
            disabled={!isValid || isRunning}
          >
            <Play className="h-3.5 w-3.5" /> {isRunning ? "Running…" : "Run"}
            <kbd className="ml-1 font-mono text-[10px] opacity-70">{cmdLabel}↵</kbd>
          </Button>
        </div>
      </div>

      {/* Slash command palette — anchored below the textarea */}
      {slashOpen && slashAnchor && (
        <div
          className="fixed z-50 w-80"
          style={{ top: slashAnchor.top, left: slashAnchor.left }}
        >
          <Command className="rounded-md border bg-popover text-popover-foreground shadow-md">
            <CommandInput placeholder="Type to filter (column / param / template)" />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              {groupItems(slashItems).map(([group, items]) => (
                <CommandGroup key={group} heading={group}>
                  {items.map((it) => (
                    <CommandItem
                      key={`${group}:${it.label}`}
                      onSelect={it.onSelect}
                    >
                      <span className="flex-1 font-mono text-[12px]">{it.label}</span>
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {it.hint}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </div>
      )}

      {/* Keyboard cheatsheet dialog */}
      <Dialog open={cheatsheetOpen} onOpenChange={setCheatsheetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-[13px] uppercase tracking-wider text-muted-foreground">
              Keyboard shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-[12px]">
            <kbd>{cmdLabel} ↵</kbd>
            <span>Run / re-run live preview</span>
            <kbd>{cmdLabel} S</kbd>
            <span>Save current prompt as a template</span>
            <kbd>Esc</kbd>
            <span>Cancel drag → close palette → blur editor</span>
            <kbd>/</kbd>
            <span>Open slash-command palette</span>
            <kbd>?</kbd>
            <span>Toggle this cheatsheet</span>
            <kbd>Tab</kbd>
            <span>Cycle through pills / slots</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupItems<T extends { group: string }>(items: T[]): Array<[string, T[]]> {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const arr = map.get(it.group) ?? []
    arr.push(it)
    map.set(it.group, arr)
  }
  return Array.from(map.entries())
}
