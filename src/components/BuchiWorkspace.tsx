import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Eraser, Sparkles, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BuchiGraph } from "@/components/BuchiGraph"
import { parseBuchiText, sampleBuchiInput, BuchiAutomaton } from "@/lib/buchi"
import { GraphEdge, GraphNode, layoutBuchiCircular } from "@/lib/buchiLayout"
import { Input } from "@/components/ui/input"
import { parseOmegaWord, WordStatus } from "../../shared/utils"
import { dbaEvaluateOmegaWord } from "../../shared/dba"

export function BuchiWorkspace() {
  const [source, setSource] = useState(sampleBuchiInput)
  const [wordInput, setWordInput] = useState("")
  const [wordStatus, setWordStatus] = useState<WordStatus>({ kind: "idle" })

  const parsed = useMemo(() => parseBuchiText(source), [source])
  const graph = useMemo(() => {
    if (!parsed.automaton) {
      return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] }
    }
    return layoutBuchiCircular(parsed.automaton)
  }, [parsed.automaton])

  useEffect(() => {
    const trimmed = wordInput.trim()

    if (!trimmed) {
      setWordStatus({ kind: "idle" })
      return
    }

    if (!parsed.automaton) {
      setWordStatus({ kind: "warning", message: "Define an automaton before testing a word." })
      return
    }

    const parseResult = parseOmegaWord(trimmed)
    if (!parseResult.ok) {
      setWordStatus({ kind: "warning", message: parseResult.error })
      return
    }

    const evaluation = dbaEvaluateOmegaWord(parsed.automaton, parseResult.word)
    const cyclePretty =
      evaluation.cycle.length > 0 ? evaluation.cycle.join(" -> ") : "no reachable cycle"
    const prefixWord = evaluation.prefixWord || "ε"
    const loopWord = evaluation.loopWord || "ε"

    setWordStatus(
      evaluation.accepted
        ? {
            kind: "accepted",
            message: `"${trimmed}" is accepted. Cycle: ${cyclePretty}. Prefix "${prefixWord}", loop "${loopWord}". ${evaluation.reason}`,
          }
        : {
            kind: "rejected",
            message: `"${trimmed}" is rejected. Cycle: ${cyclePretty}. Prefix "${prefixWord}", loop "${loopWord}". ${evaluation.reason}`,
          }
    )
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
          <Button size="sm" onClick={() => setSource(sampleBuchiInput)}>
            <Sparkles className="size-4" />
            Load sample
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
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
        </div>
      </div>
    </div>
    <section className="mt-8 space-y-4 rounded-2xl border border-slate-800/60 bg-slate-950/60 p-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-50">Check an ω-word</h3>
        <p className="text-sm text-slate-400">
          Enter a regex that ends with <code>^w</code> (supports <code>|</code>, <code>*</code>, <code>+</code>, parentheses). Example:
          <code> ab(ba)^w</code>. Results appear instantly using a dummy evaluator.
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



function WordStatusBanner({ status }: { status: Exclude<WordStatus, { kind: "idle" }> }) {
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
    <div className={`rounded-xl border px-3 py-3 text-sm ${toneClass}`}>
      <div className="flex items-center gap-2 font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-xs text-white/80">{status.message}</p>
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
