"use client"

/**
 * GeneratedPromptPreview.tsx — bottom strip of the DragDropRuleBuilder.
 *
 * Top row    : natural-language sentence assembled from the plan
 *              ("Fold by contract_id, computing sum(invoice_amount) as
 *               sum_invoice_amount.")
 * Bottom row : monospace Polars expression with simple keyword colouring.
 *
 * The two design-spec tokens (--aug-prompt-keyword, --aug-prompt-literal)
 * are NOT yet in globals.css — we use Tailwind palette equivalents that
 * map closely (blue-700 keyword, emerald-700 literal) so the look is
 * correct out-of-the-box and can be swapped to the tokens later without
 * touching this file.
 */

import * as React from "react"
import { Copy, FileText, FunctionSquare } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Polars keyword highlighter ───────────────────────────────────────────────

const POLARS_KEYWORDS = new Set([
  "pl",
  "col",
  "len",
  "filter",
  "group_by",
  "agg",
  "select",
  "alias",
  "sort",
  "sum",
  "mean",
  "min",
  "max",
  "last",
  "first",
  "count",
  "True",
  "False",
  "df",
  "descending",
  "str",
  "contains",
])

interface Token {
  text: string
  kind: "keyword" | "literal" | "punct" | "text"
}

/** Tokenise a single line of Polars code for syntax colouring. */
function tokenizePolars(line: string): Token[] {
  const out: Token[] = []
  // Pattern order matters — strings first so they swallow keywords inside.
  const re = /("[^"]*"|\b\d+(?:\.\d+)?\b|[A-Za-z_][A-Za-z0-9_]*|[^\sA-Za-z0-9_]+|\s+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const t = m[0]
    if (/^\s+$/.test(t)) {
      out.push({ text: t, kind: "text" })
    } else if (/^".*"$/.test(t) || /^\d/.test(t)) {
      out.push({ text: t, kind: "literal" })
    } else if (/^[A-Za-z_]/.test(t)) {
      out.push({ text: t, kind: POLARS_KEYWORDS.has(t) ? "keyword" : "text" })
    } else {
      out.push({ text: t, kind: "punct" })
    }
  }
  return out
}

function PolarsLine({ line }: { line: string }) {
  const tokens = tokenizePolars(line)
  return (
    <span>
      {tokens.map((tok, i) => {
        if (tok.kind === "keyword") {
          return (
            <span key={i} className="text-blue-700 dark:text-blue-300 font-medium">
              {tok.text}
            </span>
          )
        }
        if (tok.kind === "literal") {
          return (
            <span key={i} className="text-emerald-700 dark:text-emerald-300">
              {tok.text}
            </span>
          )
        }
        if (tok.kind === "punct") {
          return (
            <span key={i} className="text-muted-foreground">
              {tok.text}
            </span>
          )
        }
        return <span key={i}>{tok.text}</span>
      })}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface GeneratedPromptPreviewProps {
  prompt: string
  polarsExpression: string
  className?: string
}

export function GeneratedPromptPreview({
  prompt,
  polarsExpression,
  className,
}: GeneratedPromptPreviewProps) {
  const [copied, setCopied] = React.useState<"prompt" | "polars" | null>(null)

  const copy = async (text: string, which: "prompt" | "polars") => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      window.setTimeout(() => setCopied(null), 1200)
    } catch {
      // silently ignore — clipboard blocked in test runners
    }
  }

  const isEmpty = !prompt && !polarsExpression

  if (isEmpty) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed border-border bg-muted/30 px-3 py-4",
          "font-mono text-[12px] text-muted-foreground/70 italic",
          className,
        )}
      >
        Drag a column into a slot to compose your augmentation rule. The
        equivalent prompt and Polars expression will render here.
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card overflow-hidden",
        className,
      )}
    >
      {/* Natural-language row */}
      <div className="flex items-start gap-2 px-3 py-2 border-b border-border/60">
        <FileText
          aria-hidden
          className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground"
        />
        <p className="flex-1 text-[13px] leading-relaxed">
          {prompt || (
            <span className="text-muted-foreground italic">
              No operations placed yet.
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => copy(prompt, "prompt")}
          disabled={!prompt}
          className={cn(
            "shrink-0 inline-flex items-center gap-1 text-[11px] font-mono",
            "text-muted-foreground hover:text-foreground disabled:opacity-40",
            "transition-colors",
          )}
          aria-label="Copy prompt"
        >
          <Copy className="h-3 w-3" />
          {copied === "prompt" ? "copied" : "copy"}
        </button>
      </div>

      {/* Polars expression row */}
      <div className="flex items-start gap-2 px-3 py-2 bg-muted/20">
        <FunctionSquare
          aria-hidden
          className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground"
        />
        <pre
          className={cn(
            "flex-1 font-mono text-[12px] leading-relaxed",
            "whitespace-pre overflow-x-auto",
          )}
        >
          {polarsExpression ? (
            polarsExpression.split("\n").map((line, i) => (
              <div key={i}>
                <PolarsLine line={line} />
              </div>
            ))
          ) : (
            <span className="text-muted-foreground italic">
              # Polars expression appears here
            </span>
          )}
        </pre>
        <button
          type="button"
          onClick={() => copy(polarsExpression, "polars")}
          disabled={!polarsExpression}
          className={cn(
            "shrink-0 inline-flex items-center gap-1 text-[11px] font-mono",
            "text-muted-foreground hover:text-foreground disabled:opacity-40",
            "transition-colors",
          )}
          aria-label="Copy Polars expression"
        >
          <Copy className="h-3 w-3" />
          {copied === "polars" ? "copied" : "copy"}
        </button>
      </div>
    </div>
  )
}
