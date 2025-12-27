export type WordStatus =
  | { kind: "idle" }
  | { kind: "warning"; message: string }
  | { kind: "accepted"; message: string }
  | { kind: "rejected"; message: string }

export type RegexNode =
  | { kind: "literal"; value: string }
  | { kind: "concat"; nodes: RegexNode[] }
  | { kind: "union"; nodes: RegexNode[] }
  | { kind: "star"; node: RegexNode }
  | { kind: "plus"; node: RegexNode }
  | { kind: "omega"; node: RegexNode }

export interface ParsedOmegaWord {
  prefix: RegexNode | null
  omega: RegexNode
  ast: RegexNode
}

export type OmegaParseResult =
  | { ok: true; word: ParsedOmegaWord }
  | { ok: false; error: string }

export function parseOmegaWord(raw: string): OmegaParseResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: "Enter a non-empty ω-word (e.g., ab(ba)^w)." }
  }

  try {
    const parser = new RegexParser(trimmed)
    const ast = parser.parse()
    const omegaCount = countOmegaNodes(ast)

    if (omegaCount === 0) {
      return { ok: false, error: "Add a ^w suffix to mark the infinite loop (e.g., ab(ba)^w)." }
    }

    if (omegaCount > 1) {
      return { ok: false, error: "Only one ^w (or ^ω) suffix is allowed." }
    }

    const components = extractOmegaComponents(ast)
    if (!components) {
      return { ok: false, error: "Place the ^w suffix at the end so the word looks like αβ^w." }
    }

    return { ok: true, word: { ...components, ast } }
  } catch (error) {
    const message =
      error instanceof RegexParseError ? error.message : "Failed to parse the expression."
    return { ok: false, error: message }
  }
}

export function estimateRegexComplexity(node: RegexNode | null): number {
  if (!node) return 0

  switch (node.kind) {
    case "literal":
      return node.value.length
    case "concat":
      return node.nodes.reduce((sum, child) => sum + estimateRegexComplexity(child), 0)
    case "union":
      return node.nodes.reduce((max, child) => Math.max(max, estimateRegexComplexity(child)), 0)
    case "star":
    case "plus":
      return 1 + estimateRegexComplexity(node.node)
    case "omega":
      return 2 + estimateRegexComplexity(node.node)
    default:
      return 0
  }
}

class RegexParseError extends Error {}

class RegexParser {
  private index = 0

  constructor(private readonly input: string) {}

  parse(): RegexNode {
    this.skipWhitespace()
    const expression = this.parseUnion()
    this.skipWhitespace()

    if (!this.isAtEnd()) {
      throw new RegexParseError(`Unexpected character "${this.peek()}" at position ${this.index}.`)
    }

    return expression
  }

  private parseUnion(): RegexNode {
    const branches: RegexNode[] = [this.parseConcat()]
    this.skipWhitespace()

    while (this.match("|")) {
      branches.push(this.parseConcat())
      this.skipWhitespace()
    }

    return branches.length === 1 ? branches[0] : { kind: "union", nodes: branches }
  }

  private parseConcat(): RegexNode {
    const nodes: RegexNode[] = []
    this.skipWhitespace()

    while (!this.isAtEnd()) {
      const char = this.peek()
      if (char === ")" || char === "|") break
      nodes.push(this.parseRepeat())
      this.skipWhitespace()
    }

    if (nodes.length === 0) {
      throw new RegexParseError("Missing expression before operator.")
    }

    return nodes.length === 1 ? nodes[0] : { kind: "concat", nodes }
  }

  private parseRepeat(): RegexNode {
    let node = this.parsePrimary()
    let omegaApplied = false

    while (true) {
      this.skipWhitespace()
      if (omegaApplied) break

      const char = this.peek()
      if (char === "*" || char === "+") {
        this.advance()
        node = { kind: char === "*" ? "star" : "plus", node }
        continue
      }

      if (char === "^") {
        const next = this.peekAhead(1)
        if (next === "w" || next === "ω") {
          this.advance()
          this.advance()
          node = { kind: "omega", node }
          omegaApplied = true
          continue
        }

        throw new RegexParseError('Expected "w" or "ω" right after "^".')
      }

      break
    }

    return node
  }

  private parsePrimary(): RegexNode {
    this.skipWhitespace()
    const char = this.peek()

    if (char === "(") {
      this.advance()
      const node = this.parseUnion()
      this.skipWhitespace()
      if (this.peek() !== ")") {
        throw new RegexParseError("Missing closing parenthesis.")
      }
      this.advance()
      return node
    }

    if (this.isLiteralChar(char)) {
      return this.parseLiteral()
    }

    throw new RegexParseError(`Unexpected character "${char}" at position ${this.index}.`)
  }

  private parseLiteral(): RegexNode {
    const char = this.peek()
    if (!this.isLiteralChar(char)) {
      throw new RegexParseError("Expected literal.")
    }

    this.advance()
    return { kind: "literal", value: char }
  }

  private isLiteralChar(char: string): boolean {
    return Boolean(char) && !"()|*+^".includes(char) && !/\s/.test(char)
  }

  private peek(): string {
    return this.input[this.index] ?? ""
  }

  private peekAhead(offset: number): string {
    return this.input[this.index + offset] ?? ""
  }

  private advance(): string {
    const char = this.peek()
    this.index += 1
    return char
  }

  private match(expected: string): boolean {
    if (this.peek() !== expected) return false
    this.advance()
    return true
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd() && /\s/.test(this.peek())) {
      this.advance()
    }
  }

  private isAtEnd(): boolean {
    return this.index >= this.input.length
  }
}

function countOmegaNodes(node: RegexNode | null): number {
  if (!node) return 0

  if (node.kind === "omega") {
    return 1 + countOmegaNodes(node.node)
  }

  if ("node" in node && node.node) {
    return countOmegaNodes(node.node)
  }

  if ("nodes" in node && node.nodes) {
    return node.nodes.reduce((sum, child) => sum + countOmegaNodes(child), 0)
  }

  return 0
}

function extractOmegaComponents(
  ast: RegexNode
): { prefix: RegexNode | null; omega: RegexNode } | null {
  if (ast.kind === "omega") {
    return { prefix: null, omega: ast.node }
  }

  if (ast.kind === "concat" && ast.nodes.length > 0) {
    const nodes = ast.nodes
    const last = nodes[nodes.length - 1]

    if (last.kind !== "omega") {
      return null
    }

    const prefixNodes = nodes.slice(0, -1)
    const prefix =
      prefixNodes.length === 0
        ? null
        : prefixNodes.length === 1
          ? prefixNodes[0]
          : { kind: "concat", nodes: prefixNodes }

    return { prefix, omega: last.node }
  }

  return null
}
