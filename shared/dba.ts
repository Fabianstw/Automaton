import { BuchiAutomaton } from "./buchi";
import { ParsedOmegaWord, RegexNode } from "./utils";

type StateTransform = { map: number[]; word: string };

export type DbaCycleEvaluation = {
  accepted: boolean;
  cycle: string[];
  prefixWord: string;
  loopWord: string;
  entryState: string;
  reason: string;
};

/**
 * This function evaluates a DBA on a given ω-word (with a prefix and a looping part).
 * Checks if there exists a cycle with a reoccurring accepting state
 *
 * @param automaton
 * @param word
 */
export function dbaEvaluateOmegaWord(
  automaton: BuchiAutomaton,
  word: ParsedOmegaWord,
): DbaCycleEvaluation {
  const stateToIndex = new Map(automaton.states.map((s, i) => [s, i]));
  const indexToState = automaton.states;
  const acceptingSet = new Set(automaton.accepting);

  const step = buildStep(automaton, stateToIndex);
  const letterTransforms = buildLetterTransforms(automaton, stateToIndex);

  // Precompute all possible state transformations for prefix and loop parts
  const prefixTransforms = evaluateRegex(
    word.prefix,
    letterTransforms,
    automaton.states.length,
  );
  const loopTransforms = evaluateRegex(
    word.omega,
    letterTransforms,
    automaton.states.length,
  );

  const initialIndex = stateToIndex.get(automaton.initial);
  // should never happen, we check before calling this function
  if (initialIndex === undefined) {
    return {
      accepted: false,
      cycle: [],
      prefixWord: "",
      loopWord: "",
      entryState: automaton.initial,
      reason: "Initial state is not part of the automaton.",
    };
  }

  let sampleAccept: DbaCycleEvaluation | null = null;

  for (const prefix of prefixTransforms) {
    const prefixRun = runWord(prefix.word, initialIndex, step);
    // If running the prefix word fails, we cannot proceed and return false
    if (!prefixRun) {
      return {
        accepted: false,
        cycle: [],
        prefixWord: prefix.word,
        loopWord: "",
        entryState: automaton.initial,
        reason: "Prefix causes the run to get stuck.",
      };
    }

    let acceptingForPrefix: DbaCycleEvaluation | null = null;
    let firstNonAccepting: DbaCycleEvaluation | null = null;
    let sawLoop = false;

    for (const loop of loopTransforms) {
      const loopCycle = findPeriodicCycle(prefixRun.state, loop.word, step);
      if (!loopCycle) {
        // Couldn't find a cycle for this loop word (got stuck)
        if (!firstNonAccepting) {
          // Record the first non-accepting reason
          firstNonAccepting = {
            accepted: false,
            cycle: [],
            prefixWord: prefix.word,
            loopWord: loop.word,
            entryState: indexToState[prefixRun.state],
            reason: "Loop causes the run to get stuck.",
          };
        }
        continue;
      }

      // Found a cycle for this prefix+loop
      sawLoop = true;
      const cycleNames = loopCycle.cycleStates.map((idx) => indexToState[idx]);
      const hasAccepting = loopCycle.cycleStates.some((idx) =>
        acceptingSet.has(indexToState[idx]),
      );

      // Store the result and if accepting return it
      const result: DbaCycleEvaluation = {
        accepted: hasAccepting,
        cycle: cycleNames,
        prefixWord: prefix.word,
        loopWord: loop.word,
        entryState: indexToState[prefixRun.state],
        reason: loopCycle.reason,
      };

      if (hasAccepting) {
        acceptingForPrefix = result;
        break;
      }

      // if not accepting, store it as a reason if we have none yet
      // continue iterating
      if (!firstNonAccepting) {
        firstNonAccepting = result;
      }
    }

    // If no accepting cycle found for this prefix, return the first non-accepting reason
    if (!acceptingForPrefix) {
      return (
        firstNonAccepting ?? {
          accepted: false,
          cycle: [],
          prefixWord: prefix.word,
          loopWord: "",
          entryState: indexToState[prefixRun.state],
          reason: sawLoop
            ? "All cycles for this prefix avoid accepting states."
            : "No valid loop for this prefix.",
        }
      );
    }

    if (!sampleAccept) {
      sampleAccept = acceptingForPrefix;
    }
  }

  return (
    sampleAccept ?? {
      accepted: false,
      cycle: [],
      prefixWord: "",
      loopWord: "",
      entryState: indexToState[initialIndex],
      reason: "No valid run for the given ω-word (stuck on a transition).",
    }
  );
}

/**
 * Builds state transformations for each letter in the automaton's alphabet.
 * @param automaton
 * @param stateToIndex
 */
function buildLetterTransforms(
  automaton: BuchiAutomaton,
  stateToIndex: Map<string, number>,
): Record<string, StateTransform> {
  const transforms: Record<string, StateTransform> = {};
  /**
   * {
   *   symbol: {
   *     map: {
   *       from state index: to state index,
   *       ...
   *     },
   *     word: string (the symbol itself)
   *   }
   * }
   */
  for (const symbol of automaton.alphabet) {
    const map = Array<number>(automaton.states.length).fill(-1);
    for (const t of automaton.transitions) {
      if (t.symbol !== symbol) continue;
      const from = stateToIndex.get(t.from);
      const to = stateToIndex.get(t.to);
      if (from === undefined || to === undefined) continue;
      map[from] = to;
    }
    transforms[symbol] = { map, word: symbol };
  }

  return transforms;
}

/**
 * Identity state transformation for a given size.
 * @param size
 */
function identity(size: number): StateTransform {
  return { map: Array.from({ length: size }, (_, i) => i), word: "" };
}

/**
 * Composes two state transformations a and b (a followed by b).
 * The words are concatenated.
 * The resulting transformation maps each state through a then b.
 * @param a
 * @param b
 */
function compose(a: StateTransform, b: StateTransform): StateTransform {
  const map = a.map.map((target) =>
    target === -1 ? -1 : (b.map[target] ?? -1),
  );
  return { map, word: `${a.word}${b.word}` };
}

/**
 * Generates a unique key for a state transformation based on its mapping.
 * @param t
 */
function transformKey(t: StateTransform): string {
  return t.map.join(",");
}

/**
 * Builds a step function for the automaton.
 * Enter a state index and a symbol, get the next state index or -1 if no transition exists.
 * @param automaton
 * @param stateToIndex
 */
function buildStep(
  automaton: BuchiAutomaton,
  stateToIndex: Map<string, number>,
): (state: number, symbol: string) => number {
  const table: Array<Record<string, number>> = Array.from(
    { length: automaton.states.length },
    () => ({}),
  );
  for (const t of automaton.transitions) {
    const from = stateToIndex.get(t.from);
    const to = stateToIndex.get(t.to);
    if (from === undefined || to === undefined) continue;
    table[from][t.symbol] = to;
  }
  return (state, symbol) => table[state]?.[symbol] ?? -1;
}

/**
 * Runs a word from
 * - a starting state index,
 * - using a step function that maps (state index, symbol)
 * - to next state index or -1 if stuck.
 * Till the word ends or gets stuck.
 *
 * Returns the final state index or null if stuck.
 *
 * @param word
 * @param start
 * @param step
 */
function runWord(
  word: string,
  start: number,
  step: (state: number, symbol: string) => number,
): { state: number } | null {
  let current = start;
  for (const ch of word) {
    current = step(current, ch);
    if (current === -1) return null;
  }
  return { state: current };
}

/**
 * Finds a periodic cycle starting from an entry state,
 * by repeatedly applying the loop word.
 *
 * Different from lecture, here we find a cycle in the combined state+position space,
 * to account for the fact that the loop word may not align with cycles in the automaton.
 *
 * @param entryState
 * @param loopWord
 * @param step
 */
function findPeriodicCycle(
  entryState: number,
  loopWord: string,
  step: (state: number, symbol: string) => number,
): { cycleStates: number[]; reason: string } | null {
  if (loopWord.length === 0) {
    return {
      cycleStates: [entryState],
      reason: "Empty loop word; stay in the entry state.",
    };
  }

  const seen = new Map<string, number>();
  const path: number[] = [entryState];
  let state = entryState;
  let pos = 0;

  while (true) {
    const key = `${state}|${pos}`;
    if (seen.has(key)) {
      const start = seen.get(key) ?? 0;
      const cycleStates = path.slice(start);
      const reason =
        cycleStates.length > 0
          ? "Cycle detected while repeating the loop word."
          : "No cycle detected.";
      return { cycleStates, reason };
    }
    seen.set(key, path.length - 1);

    const symbol = loopWord[pos];
    const next = step(state, symbol);
    if (next === -1) return null;

    state = next;
    path.push(state);
    pos = (pos + 1) % loopWord.length;
  }
}

/**
 * By GPT again
 * @param node
 * @param letterTransforms
 * @param size
 */
function evaluateRegex(
  node: RegexNode | null,
  letterTransforms: Record<string, StateTransform>,
  size: number,
): StateTransform[] {
  if (!node) return [identity(size)];

  switch (node.kind) {
    case "literal":
      return [buildLiteralTransform(node.value, letterTransforms, size)];
    case "concat":
      return node.nodes.reduce<StateTransform[]>(
        (acc, child) =>
          combine(acc, evaluateRegex(child, letterTransforms, size)),
        [identity(size)],
      );
    case "union":
      return dedupe(
        node.nodes.flatMap((child) =>
          evaluateRegex(child, letterTransforms, size),
        ),
      );
    case "star":
      return starClosure(
        evaluateRegex(node.node, letterTransforms, size),
        size,
      );
    case "plus":
      return combine(
        evaluateRegex(node.node, letterTransforms, size),
        starClosure(evaluateRegex(node.node, letterTransforms, size), size),
      );
    case "omega":
      return evaluateRegex(node.node, letterTransforms, size);
    default:
      return [identity(size)];
  }
}

function buildLiteralTransform(
  literal: string,
  letterTransforms: Record<string, StateTransform>,
  size: number,
): StateTransform {
  let current = identity(size);
  for (const symbol of literal) {
    const letter = letterTransforms[symbol];
    if (!letter) {
      current = {
        map: Array<number>(size).fill(-1),
        word: `${current.word}${symbol}`,
      };
      break;
    }
    current = compose(current, letter);
  }
  return current;
}

function combine(a: StateTransform[], b: StateTransform[]): StateTransform[] {
  const out: StateTransform[] = [];
  const seen = new Set<string>();

  for (const left of a) {
    for (const right of b) {
      const composed = compose(left, right);
      const key = transformKey(composed);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(composed);
    }
  }

  return out;
}

function dedupe(items: StateTransform[]): StateTransform[] {
  const seen = new Set<string>();
  const out: StateTransform[] = [];
  for (const item of items) {
    const key = transformKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function starClosure(base: StateTransform[], size: number): StateTransform[] {
  const closure = dedupe([identity(size), ...base]);
  const queue = [...closure];
  const seen = new Set(closure.map(transformKey));

  while (queue.length > 0) {
    const current = queue.pop() as StateTransform;
    for (const step of base) {
      const composed = compose(current, step);
      const key = transformKey(composed);
      if (seen.has(key)) continue;
      seen.add(key);
      closure.push(composed);
      queue.push(composed);
    }
  }

  return closure;
}
