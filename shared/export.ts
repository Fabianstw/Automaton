import { type BuchiAutomaton } from "./buchi";

export type ExportGraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  isAccepting: boolean;
  isInitial: boolean;
};

export type ExportGraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export function buildTikzExport(
  automaton: BuchiAutomaton,
  nodes: ExportGraphNode[],
  edges: ExportGraphEdge[],
  options?: { scale?: number; maxWidthCm?: number },
): string {
  const baseScale = options?.scale ?? 0.06;
  const maxWidth = options?.maxWidthCm ?? 10;

  const width =
    nodes.length > 0
      ? (Math.max(...nodes.map((n) => n.x)) -
          Math.min(...nodes.map((n) => n.x))) *
        baseScale
      : 0;

  const scale = width > maxWidth ? (maxWidth / width) * baseScale : baseScale;

  const lines: string[] = [];
  lines.push("% TikZ export for Büchi automaton");
  lines.push("% Requires: \\usepackage{tikz}");
  lines.push("% Optional: \\usetikzlibrary{arrows.meta,positioning}");
  lines.push("\\begin{tikzpicture}[>=Stealth, node distance=2cm]");

  nodes.forEach((n) => {
    const x = (n.x * scale).toFixed(2);
    const y = (-n.y * scale).toFixed(2);
    const double = n.isAccepting ? ",double" : "";
    lines.push(
      `  \\node[circle,draw,minimum size=10mm${double}] (${n.id}) at (${x},${y}) {${n.label}};`,
    );
  });

  const initialNode = nodes.find((n) => n.isInitial);
  if (initialNode) {
    lines.push(
      `  \\draw[->] (${(initialNode.x * scale - 1).toFixed(2)},${(-initialNode.y * scale).toFixed(2)}) -- (${initialNode.id});`,
    );
  }

  edges.forEach((e) => {
    if (e.source === e.target) {
      lines.push(
        `  \\draw[->] (${e.source}) .. controls +(0.8,0.8) and +(-0.8,0.8) .. node[above]{${e.label}} (${e.target});`,
      );
    } else {
      lines.push(
        `  \\draw[->] (${e.source}) -- node[sloped,above]{${e.label}} (${e.target});`,
      );
    }
  });

  lines.push("\\end{tikzpicture}");

  const def = automaton;
  const formal = [
    "% Formal definition:",
    `Q = \\{${def.states.join(", ")}\\}`,
    `\\Sigma = \\{${def.alphabet.join(", ")}\\}`,
    `q_0 = ${def.initial}`,
    `F = \\{${def.accepting.join(", ")}\\}`,
    `\\Delta = \\{${def.transitions.map((t) => `(${t.from}, ${t.symbol}, ${t.to})`).join("; ")}\\}`,
  ].join("\\n");

  return `${formal}\n\n${lines.join("\n")}`;
}

export function buildFormalDefinitionLatex(automaton: BuchiAutomaton): string {
  const transitionsByState = automaton.transitions.reduce<
    Record<string, typeof automaton.transitions>
  >((acc, t) => {
    if (!acc[t.from]) acc[t.from] = [];
    acc[t.from].push(t);
    return acc;
  }, {});

  const transitionLines = Object.entries(transitionsByState).map(
    ([from, list], index, arr) => {
      const entries = list
        .map((t) => `${t.symbol} \\mapsto ${t.to}`)
        .join("; \\; ");
      const lineEnding = index === arr.length - 1 ? "" : " \\\\";
      return `  ${from} &\\mapsto& \\{${entries}\\}${lineEnding}`;
    },
  );

  const lines = [
    "% Formal (non-TikZ) definition for a deterministic Büchi automaton",
    "% Requires: \\usepackage{amsmath}",
    "\\begin{align*}",
    `\\mathcal{A} &= (Q, \\Sigma, q_0, \\delta, F) \\\\`,
    `Q &= \\{${automaton.states.join(", ")}\\} \\\\`,
    `\\Sigma &= \\{${automaton.alphabet.join(", ")}\\} \\\\`,
    `q_0 &= ${automaton.initial} \\\\`,
    `F &= \\{${automaton.accepting.join(", ")}\\} \\\\`,
    "\\end{align*}",
  ];

  if (transitionLines.length > 0) {
    lines.push(
      "",
      "% Transition function by origin state",
      "\\[ \\begin{array}{rcl}",
    );
    lines.push(...transitionLines);
    lines.push("\\end{array} \\]");
  }

  return lines.join("\n");
}
