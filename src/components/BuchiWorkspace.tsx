import { type ReactNode, useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, Clock3, Download, Eraser, Save, Trash2, XCircle } from "lucide-react"

import { BuchiGraph } from "@/components/BuchiGraph"
import { MathText } from "@/components/MathText"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { GraphEdge, GraphNode, layoutBuchiCircular } from "@/lib/buchiLayout"
import { dbaEvaluateOmegaWord } from "@shared/dba"
import { parseBuchiText, sampleBuchiInput, type BuchiSample } from "@shared/buchi"
import { parseOmegaWord, type WordStatus } from "@shared/utils"

function regexToString(node: import("@shared/utils").RegexNode | null): string {
  if (!node) return ""

  const precMap: Record<string, number> = { union: 1, concat: 2, star: 3, plus: 3, omega: 3, literal: 4 }
  const prec = precMap[node.kind] ?? 0

  const wrap = (child: string, childPrec: number) => (childPrec < prec ? `(${child})` : child)

  switch (node.kind) {
    case "literal":
      return node.value
    case "concat": {
      const parts = node.nodes.map((child) => regexToString(child))
      return wrap(parts.join(""), 2)
    }
    case "union": {
      const parts = node.nodes.map((child) => regexToString(child))
      return wrap(parts.join("|"), 1)
    }
    case "star": {
      const inner = regexToString(node.node)
      return wrap(`${inner}*`, prec)
    }
    case "plus": {
      const inner = regexToString(node.node)
      return wrap(`${inner}+`, prec)
    }
    case "omega": {
      const inner = regexToString(node.node)
      return wrap(`${inner}^w`, prec)
    }
    default:
      return ""
  }
}

export function BuchiWorkspace() {
  const samples: BuchiSample[] = sampleBuchiInput

  const [source, setSource] = useState(samples[0]?.source ?? "")
  const [autoName, setAutoName] = useState("My automaton")
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [savedAutomata, setSavedAutomata] = useState<{
    id: string
    name: string
    source: string
    savedAt: string
  }[]>([])
  const [selectedSavedId, setSelectedSavedId] = useState<string>("")
  const [wordInput, setWordInput] = useState("")
  const [selectedSampleId, setSelectedSampleId] = useState<string>(samples[0]?.id ?? "")

  const STORAGE_KEY = "buchi-automaton-saved"

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const list = JSON.parse(raw) as typeof savedAutomata
      if (Array.isArray(list)) {
        setSavedAutomata(list)
        if (list[0]) {
          setSelectedSavedId(list[0].id)
          setLastSavedAt(list[0].savedAt)
        }
      }
    } catch (error) {
      console.error("Failed to read saved automata", error)
    }
  }, [])

  const persistSaved = (list: typeof savedAutomata) => {
    setSavedAutomata(list)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  const deleteAutomaton = (id: string, name: string) => {
    const confirmed = window.confirm(`Delete saved automaton "${name}"?`)
    if (!confirmed) return
    const confirmedTwice = window.confirm("Are you sure? This cannot be undone.")
    if (!confirmedTwice) return
    const updated = savedAutomata.filter((item) => item.id !== id)
    persistSaved(updated)
    if (selectedSavedId === id) {
      setSelectedSavedId(updated[0]?.id ?? "")
      setLastSavedAt(updated[0]?.savedAt ?? null)
    }
  }

  const saveAutomaton = () => {
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `auto-${Date.now()}`,
      name: autoName || "Untitled automaton",
      source,
      savedAt: new Date().toISOString(),
    }
    const updated = [entry, ...savedAutomata].slice(0, 50)
    persistSaved(updated)
    setSelectedSavedId(entry.id)
    setLastSavedAt(entry.savedAt)
  }

  const loadAutomaton = (id?: string) => {
    const targetId = id ?? selectedSavedId
    const entry = savedAutomata.find((item) => item.id === targetId)
    if (!entry) return
    setSource(entry.source)
    setAutoName(entry.name)
    setLastSavedAt(entry.savedAt)
    setSelectedSavedId(entry.id)
  }

  const applySample = (id: string) => {
    const picked = samples.find((s) => s.id === id)
    if (!picked) return
    setSelectedSampleId(id)
    setSource(picked.source)
    // keep current ω-word untouched
  }

  const parsed = useMemo(() => parseBuchiText(source), [source])
  const graph = useMemo(() => {
    if (!parsed.automaton) {
      return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] }
    }
    return layoutBuchiCircular(parsed.automaton)
  }, [parsed.automaton])

  const wordStatus = useMemo<WordStatus & {
    details?: {
      inputLatex: string
      prefixLatex: string
      loopLatex: string
      cycle: string[]
      reason: string
    }
  }>(() => {
    const trimmed = wordInput.trim()

    if (!trimmed) {
      return { kind: "idle" }
    }

    if (!parsed.automaton) {
      return { kind: "warning", message: "Define an automaton before testing a word." }
    }

    const parseResult = parseOmegaWord(trimmed)
    if (!parseResult.ok) {
      return { kind: "warning", message: parseResult.error }
    }

    const formattedPrefix = regexToString(parseResult.word.prefix) || "ε"
    const formattedLoop = regexToString(parseResult.word.omega) || "ε"

    const evaluation = dbaEvaluateOmegaWord(parsed.automaton, parseResult.word)
    const toLatex = (word: string) => {
      if (!word) return "\\varepsilon"
      return word
        .replace(/\^(w|ω)/gi, "^{\\omega}")
        .replace(/\+/g, "^{+}")
        .replace(/\*/g, "^{*}")
    }

    return evaluation.accepted
      ? {
          kind: "accepted",
          message: `"${trimmed}" is accepted.`,
          details: {
            inputLatex: toLatex(trimmed),
            prefixLatex: toLatex(formattedPrefix),
            loopLatex: toLatex(`${formattedLoop}^{\\omega}`),
            cycle: evaluation.cycle,
            reason: evaluation.reason,
          },
        }
      : {
          kind: "rejected",
          message: `"${trimmed}" is rejected.`,
          details: {
            inputLatex: toLatex(trimmed),
            prefixLatex: toLatex(formattedPrefix),
            loopLatex: toLatex(`${formattedLoop}^{\\omega}`),
            cycle: evaluation.cycle,
            reason: evaluation.reason,
          },
        }
  }, [wordInput, parsed.automaton])

  const wordToneClass =
    wordStatus.kind === "accepted"
      ? "border-emerald-500/70 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/40"
      : wordStatus.kind === "rejected"
        ? "border-rose-500/70 focus-visible:border-rose-400 focus-visible:ring-rose-400/40"
        : wordStatus.kind === "warning"
          ? "border-amber-500/70 focus-visible:border-amber-400 focus-visible:ring-amber-400/40"
          : ""

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-50">Deterministic Buchi Automaton</h2>
            <p className="text-sm text-slate-300">Enter the DSL on the left; the graph updates on the right.</p>
          </div>
          <div className="flex gap-2 self-start lg:self-auto">
            <Button variant="secondary" size="sm" onClick={() => setSource("")}>
              <Eraser className="size-4" />
              Clear
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="border-cyan-500/40 text-slate-100">
                  <span>{selectedSampleId ? "Examples" : "Pick example"}</span>
                  <ChevronDown className="ml-1.5 size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[260px] bg-slate-900 text-slate-50">
                <DropdownMenuLabel className="text-xs uppercase tracking-wide text-slate-400">
                  DBA examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                {samples.map((sample) => (
                  <DropdownMenuItem
                    key={sample.id}
                    className="flex flex-col items-start gap-1 text-left"
                    onSelect={() => applySample(sample.id)}
                  >
                    <span className="text-sm font-semibold text-white">{sample.title}</span>
                    {sample.languageLatex ? (
                      <span className="text-[11px] text-slate-300"><MathText expression={sample.languageLatex} /></span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-100" htmlFor="automaton-name">
                Name
              </label>
              <Input
                id="automaton-name"
                value={autoName}
                onChange={(e) => setAutoName(e.target.value)}
                placeholder="My automaton"
              />
              {lastSavedAt ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock3 className="size-3.5" />
                  <span>Saved: {new Date(lastSavedAt).toLocaleString()}</span>
                </div>
              ) : null}
            </div>

            <label className="text-sm font-medium text-slate-100" htmlFor="buchi-input">
              Automaton definition
            </label>
            <textarea
              id="buchi-input"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              className="h-64 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-sm text-slate-100 focus:border-cyan-400/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
              placeholder="states: q0,q1\nalphabet: a,b\nstart: q0\naccept: q1\ntransitions:\nq0,a->q1\nq1,a->q1"
            />
            {parsed.errors.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-100">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="size-4" /> Issues detected
                </div>
                <ul className="list-disc space-y-1 pl-5 text-orange-100/90">
                  {parsed.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {parsed.automaton ? (
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
                <InfoPill label="States" value={parsed.automaton.states.join(", ")} />
                <InfoPill label="Alphabet" value={parsed.automaton.alphabet.join(", ")} />
                <InfoPill label="Start" value={parsed.automaton.initial} />
                <InfoPill label="Accepting" value={parsed.automaton.accepting.join(", ")} />
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-7">
            <BuchiGraph nodes={graph.nodes} edges={graph.edges} hasData={Boolean(parsed.automaton)} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={saveAutomaton}>
                <Save className="mr-2 size-4" />
                Store automaton
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={savedAutomata.length === 0}>
                    <Download className="mr-2 size-4" />
                    {selectedSavedId ? "Load saved" : "No saves yet"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[260px] bg-slate-900 text-slate-50">
                  <DropdownMenuLabel className="text-xs uppercase tracking-wide text-slate-400">
                    Saved automata
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  {savedAutomata.length === 0 ? (
                    <DropdownMenuItem disabled className="text-slate-500">
                      Nothing saved yet
                    </DropdownMenuItem>
                  ) : null}
                  {savedAutomata.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-left hover:bg-slate-800/80 focus:bg-slate-800"
                      onSelect={() => loadAutomaton(item.id)}
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-sm font-semibold text-white">{item.name}</span>
                        <span className="text-[11px] text-slate-300">{new Date(item.savedAt).toLocaleString()}</span>
                      </div>
                      <button
                        type="button"
                        className="ml-3 rounded-md border border-slate-800/0 p-1 text-slate-400 transition hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-200"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          deleteAutomaton(item.id, item.name)
                        }}
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
      <section className="mt-8 space-y-4 rounded-2xl border border-slate-800/60 bg-slate-950/60 p-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">Check an ω-word</h3>
          <p className="text-sm text-slate-400">
            Enter a regex that ends with <MathText expression="{}^{\omega}" /> (supports <MathText expression="|" />, <MathText expression="*" />, <MathText expression="+" />, parentheses).
            Example: <MathText expression="ab(ba)^{\omega}" />.
          </p>
        </div>

        <div>
          <Input
            value={wordInput}
            onChange={(event) => setWordInput(event.target.value)}
            placeholder="ab(ba)^w"
            aria-label="ω-word to test"
            className={`${wordToneClass}`.trim()}
          />
        </div>

        {wordStatus.kind !== "idle" ? (
          <WordStatusBanner status={wordStatus} />
        ) : null}
      </section>
    </>
  )
}

function WordStatusBanner({
  status,
}: {
  status: Exclude<WordStatus, { kind: "idle" }> & {
    details?: {
      inputLatex: string
      prefixLatex: string
      loopLatex: string
      cycle: string[]
      reason: string
    }
  }
}) {
  let toneClass = "border-amber-500/30 bg-amber-500/10 text-amber-100"
  let icon = <AlertCircle className="size-4" />
  let label = "Format issue"

  if (status.kind === "accepted") {
    toneClass = "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
    icon = <CheckCircle2 className="size-4" />
    label = "Word accepted"
  } else if (status.kind === "rejected") {
    toneClass = "border-rose-500/30 bg-rose-500/10 text-rose-100"
    icon = <XCircle className="size-4" />
    label = "Word rejected"
  }

  return (
    <div className={`rounded-xl border px-3 py-3 text-sm shadow-lg shadow-black/10 backdrop-blur ${toneClass}`}>
      <div className="flex items-center gap-2 font-semibold">
        {icon}
        <span>{label}</span>
        {status.kind !== "warning" ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white/80">
            ω-word
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-white/85">{status.message}</p>

      {status.details ? (
        <div className="mt-3 grid gap-2 text-xs text-white/90 sm:grid-cols-2">
          <DetailRow label="Input" value={<MathText expression={status.details.inputLatex} />} />
          <DetailRow label="Prefix" value={<MathText expression={status.details.prefixLatex} />} />
          <DetailRow label="Loop" value={<MathText expression={status.details.loopLatex} />} />
          <DetailRow
            label="Cycle"
            value={
              status.details.cycle.length > 0 ? (
                <span className="font-semibold text-white">{status.details.cycle.join(" → ")}</span>
              ) : (
                <span className="text-white/70">no reachable cycle</span>
              )
            }
          />
          <DetailRow
            className="sm:col-span-2"
            label="Reason"
            value={<span className="text-white/80">{status.details.reason}</span>}
          />
        </div>
      ) : null}
    </div>
  )
}

function DetailRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-start justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 ${className || ""}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-900/50 px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-medium text-slate-100">{value || "-"}</span>
    </div>
  )
}
