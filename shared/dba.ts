import { BuchiAutomaton } from "@/lib/buchi"
import { ParsedOmegaWord, RegexNode } from "./utils"

type StateTransform = { map: number[]; word: string }

export type DbaCycleEvaluation = {
  accepted: boolean
  cycle: string[]
  prefixWord: string
  loopWord: string
  entryState: string
  reason: string
}

export function dbaEvaluateOmegaWord(
  automaton: BuchiAutomaton,
  word: ParsedOmegaWord
): DbaCycleEvaluation {
  const stateToIndex = new Map(automaton.states.map((s, i) => [s, i]))
  const indexToState = automaton.states
  const acceptingSet = new Set(automaton.accepting)

  const step = buildStep(automaton, stateToIndex)
  const letterTransforms = buildLetterTransforms(automaton, stateToIndex)
  const prefixTransforms = evaluateRegex(word.prefix, letterTransforms, automaton.states.length)
  const loopTransforms = evaluateRegex(word.omega, letterTransforms, automaton.states.length)

  const initialIndex = stateToIndex.get(automaton.initial)
  if (initialIndex === undefined) {
    return {
      accepted: false,
      cycle: [],
      prefixWord: "",
      loopWord: "",
      entryState: automaton.initial,
      reason: "Initial state is not part of the automaton.",
    }
  }

  let fallback: DbaCycleEvaluation | null = null

  for (const prefix of prefixTransforms) {
    const prefixRun = runWord(prefix.word, initialIndex, step)
    if (!prefixRun) continue

    for (const loop of loopTransforms) {
      const loopCycle = findPeriodicCycle(prefixRun.state, loop.word, step)
      if (!loopCycle) continue

      const cycleNames = loopCycle.cycleStates.map((idx) => indexToState[idx])
      const hasAccepting = loopCycle.cycleStates.some((idx) => acceptingSet.has(indexToState[idx]))

      const result: DbaCycleEvaluation = {
        accepted: hasAccepting,
        cycle: cycleNames,
        prefixWord: prefix.word,
        loopWord: loop.word,
        entryState: indexToState[prefixRun.state],
        reason: loopCycle.reason,
      }

      if (hasAccepting) {
        return result
      }

      if (!fallback) {
        fallback = result
      }
    }
  }

  return (
    fallback ?? {
      accepted: false,
      cycle: [],
      prefixWord: "",
      loopWord: "",
      entryState: indexToState[initialIndex],
      reason: "No valid run for the given ω-word (stuck on a transition).",
    }
  )
}

function buildLetterTransforms(
  automaton: BuchiAutomaton,
  stateToIndex: Map<string, number>
): Record<string, StateTransform> {
  const size = automaton.states.length
  const transforms: Record<string, StateTransform> = {}

  for (const symbol of automaton.alphabet) {
    const map = Array<number>(size).fill(-1)
    for (const t of automaton.transitions) {
      if (t.symbol !== symbol) continue
      const from = stateToIndex.get(t.from)
      const to = stateToIndex.get(t.to)
      if (from === undefined || to === undefined) continue
      map[from] = to
    }
    transforms[symbol] = { map, word: symbol }
  }

  return transforms
}

function identity(size: number): StateTransform {
  return { map: Array.from({ length: size }, (_, i) => i), word: "" }
}

function compose(a: StateTransform, b: StateTransform): StateTransform {
  const map = a.map.map((target) => (target === -1 ? -1 : b.map[target] ?? -1))
  return { map, word: `${a.word}${b.word}` }
}

function transformKey(t: StateTransform): string {
  return t.map.join(",")
}

function buildStep(
  automaton: BuchiAutomaton,
  stateToIndex: Map<string, number>
): (state: number, symbol: string) => number {
  const table: Array<Record<string, number>> = Array.from({ length: automaton.states.length }, () => ({}))
  for (const t of automaton.transitions) {
    const from = stateToIndex.get(t.from)
    const to = stateToIndex.get(t.to)
    if (from === undefined || to === undefined) continue
    table[from][t.symbol] = to
  }
  return (state, symbol) => table[state]?.[symbol] ?? -1
}

function runWord(
  word: string,
  start: number,
  step: (state: number, symbol: string) => number
): { state: number } | null {
  let current = start
  for (const ch of word) {
    current = step(current, ch)
    if (current === -1) return null
  }
  return { state: current }
}

function findPeriodicCycle(
  entryState: number,
  loopWord: string,
  step: (state: number, symbol: string) => number
): { cycleStates: number[]; reason: string } | null {
  if (loopWord.length === 0) {
    return { cycleStates: [entryState], reason: "Empty loop word; stay in the entry state." }
  }

  const seen = new Map<string, number>()
  const path: number[] = [entryState]
  let state = entryState
  let pos = 0

  while (true) {
    const key = `${state}|${pos}`
    if (seen.has(key)) {
      const start = seen.get(key) ?? 0
      const cycleStates = path.slice(start)
      const reason = cycleStates.length > 0
        ? "Cycle detected while repeating the loop word."
        : "No cycle detected."
      return { cycleStates, reason }
    }
    seen.set(key, path.length - 1)

    const symbol = loopWord[pos]
    const next = step(state, symbol)
    if (next === -1) return null

    state = next
    path.push(state)
    pos = (pos + 1) % loopWord.length
  }
}

function evaluateRegex(
  node: RegexNode | null,
  letterTransforms: Record<string, StateTransform>,
  size: number
): StateTransform[] {
  if (!node) return [identity(size)]

  switch (node.kind) {
    case "literal":
      return [buildLiteralTransform(node.value, letterTransforms, size)]
    case "concat":
      return node.nodes.reduce<StateTransform[]>(
        (acc, child) => combine(acc, evaluateRegex(child, letterTransforms, size)),
        [identity(size)]
      )
    case "union":
      return dedupe(
        node.nodes.flatMap((child) => evaluateRegex(child, letterTransforms, size))
      )
    case "star":
      return starClosure(evaluateRegex(node.node, letterTransforms, size), size)
    case "plus":
      return combine(
        evaluateRegex(node.node, letterTransforms, size),
        starClosure(evaluateRegex(node.node, letterTransforms, size), size)
      )
    case "omega":
      return evaluateRegex(node.node, letterTransforms, size)
    default:
      return [identity(size)]
  }
}

function buildLiteralTransform(
  literal: string,
  letterTransforms: Record<string, StateTransform>,
  size: number
): StateTransform {
  let current = identity(size)
  for (const symbol of literal) {
    const letter = letterTransforms[symbol]
    if (!letter) {
      current = {
        map: Array<number>(size).fill(-1),
        word: `${current.word}${symbol}`,
      }
      break
    }
    current = compose(current, letter)
  }
  return current
}

function combine(a: StateTransform[], b: StateTransform[]): StateTransform[] {
  const out: StateTransform[] = []
  const seen = new Set<string>()

  for (const left of a) {
    for (const right of b) {
      const composed = compose(left, right)
      const key = transformKey(composed)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(composed)
    }
  }

  return out
}

function dedupe(items: StateTransform[]): StateTransform[] {
  const seen = new Set<string>()
  const out: StateTransform[] = []
  for (const item of items) {
    const key = transformKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function starClosure(base: StateTransform[], size: number): StateTransform[] {
  const closure = dedupe([identity(size), ...base])
  const queue = [...closure]
  const seen = new Set(closure.map(transformKey))

  while (queue.length > 0) {
    const current = queue.pop() as StateTransform
    for (const step of base) {
      const composed = compose(current, step)
      const key = transformKey(composed)
      if (seen.has(key)) continue
      seen.add(key)
      closure.push(composed)
      queue.push(composed)
    }
  }

  return closure
}