import cytoscape from "cytoscape"
import { useEffect, useRef } from "react"

import { GraphEdge, GraphNode } from "@/lib/buchiLayout"

type BuchiGraphProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  hasData: boolean
}

export function BuchiGraph({ nodes, edges, hasData }: BuchiGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const elements = [
      ...nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          isAccepting: n.isAccepting ? "true" : "false",
          isInitial: n.isInitial ? "true" : "false",
        },
        position: { x: n.x, y: n.y },
      })),
      ...edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        },
      })),
    ]

    const cy = cytoscape({
      container,
      elements,
      layout: { name: "preset" },
      wheelSensitivity: 0.2,
      autoungrabify: false,
      style: [
        {
          selector: "node",
          style: {
            width: 36,
            height: 36,
            "background-color": "#0f172a",
            "border-color": "#1f2937",
            "border-width": 1.2,
            label: "data(label)",
            color: "#e2e8f0",
            "font-size": 12,
            "font-weight": 600,
            "text-valign": "center",
            "text-halign": "center",
            "text-outline-color": "#0f172a",
            "text-outline-width": 3,
          },
        },
        {
          selector: 'node[isAccepting = "true"]',
          style: {
            "border-color": "#22d3ee",
            "border-width": 4,
            "border-style": "double",
          },
        },
        {
          selector: 'node[isInitial = "true"]',
          style: {
            "border-color": "#e2e8f0",
            "border-width": 2,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#0ea5e9",
            "target-arrow-color": "#0ea5e9",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "control-point-step-size": 30,
            label: "data(label)",
            color: "#e2e8f0",
            "font-size": 11,
            "font-weight": 600,
            "text-outline-width": 3,
            "text-outline-color": "#0f172a",
            "text-background-color": "#0f172a",
            "text-background-opacity": 0.8,
            "text-border-opacity": 0,
            "text-margin-y": -6,
          },
        },
      ],
    })

    return () => {
      cy.destroy()
    }
  }, [nodes, edges])

  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      {!hasData ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
          Paste a deterministic Buchi automaton on the left to see its graph.
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
