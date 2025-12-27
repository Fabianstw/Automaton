import { BuchiAutomaton } from "@shared/buchi";

export type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  isInitial: boolean;
  isAccepting: boolean;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export function layoutBuchiCircular(automaton: BuchiAutomaton): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const count = Math.max(automaton.states.length, 1);
  const radius = Math.max(160, count * 28);

  const nodes: GraphNode[] = automaton.states.map((state, idx) => {
    const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    return {
      id: state,
      label: state,
      x,
      y,
      isInitial: automaton.initial === state,
      isAccepting: automaton.accepting.includes(state),
    };
  });

  const edges: GraphEdge[] = automaton.transitions.map((t, idx) => ({
    id: `e-${idx}-${t.from}-${t.to}-${t.symbol}`,
    source: t.from,
    target: t.to,
    label: t.symbol,
  }));

  return { nodes, edges };
}
