export type BuchiTransition = {
  from: string
  symbol: string
  to: string
}

export type BuchiAutomaton = {
  states: string[]
  alphabet: string[]
  initial: string
  accepting: string[]
  transitions: BuchiTransition[]
}

export const sampleBuchiInput = `states: q0,q1,q2
alphabet: a,b
start: q0
accept: q2
transitions:
q0,a->q1
q0,b->q0
q1,a->q2
q1,b->q0
q2,a->q2
q2,b->q0`

function readList(line: string): string[] | null {
  const [, value] = line.split(":")
  if (!value) return null
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function parseBuchiText(input: string): {
  automaton?: BuchiAutomaton
  errors: string[]
} {
  const errors: string[] = []
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const headerMap: Record<string, string[]> = {
    states: [],
    alphabet: [],
    start: [],
    initial: [],
    accept: [],
    accepting: [],
  }

  const transitions: BuchiTransition[] = []
  let inTransitions = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const lower = line.toLowerCase()

    if (lower.startsWith("transitions")) {
      inTransitions = true
      continue
    }

    if (!inTransitions) {
      const key = Object.keys(headerMap).find((k) => lower.startsWith(`${k}:`))
      if (key) {
        const parsed = readList(line)
        if (!parsed || parsed.length === 0) {
          errors.push(`No entries found for ${key}`)
        } else {
          headerMap[key].push(...parsed)
        }
      }
      continue
    }

    const [left, right] = line.split("->")
    if (!left || !right) {
      errors.push(`Could not parse transition line: "${line}"`)
      continue
    }

    const [fromPart, symbolPart] = left.split(",")
    const from = fromPart?.trim()
    const symbol = symbolPart?.trim()
    const to = right.trim()

    if (!from || !symbol || !to) {
      errors.push(`Incomplete transition: "${line}"`)
      continue
    }

    transitions.push({ from, symbol, to })
  }

  const states = headerMap.states
  const alphabet = headerMap.alphabet
  const initial = headerMap.start[0] || headerMap.initial[0] || ""
  const accepting = headerMap.accept.length > 0 ? headerMap.accept : headerMap.accepting

  if (states.length === 0) errors.push("No states declared")
  if (alphabet.length === 0) errors.push("No alphabet declared")
  if (!initial) errors.push("No start state declared")
  if (accepting.length === 0) errors.push("No accepting states declared")

  if (initial && !states.includes(initial)) {
    errors.push(`Start state "${initial}" not in states set`)
  }

  for (const acc of accepting) {
    if (!states.includes(acc)) errors.push(`Accepting state "${acc}" not in states set`)
  }

  transitions.forEach((t) => {
    if (!states.includes(t.from)) errors.push(`Transition source ${t.from} not in states set`)
    if (!states.includes(t.to)) errors.push(`Transition target ${t.to} not in states set`)
    if (alphabet.length > 0 && !alphabet.includes(t.symbol)) {
      errors.push(`Transition symbol "${t.symbol}" not in alphabet`)
    }
  })

  if (errors.length > 0) {
    return { errors }
  }

  return {
    automaton: {
      states,
      alphabet,
      initial,
      accepting,
      transitions,
    },
    errors,
  }
}
