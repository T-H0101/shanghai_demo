"use client"

import { useEffect, useRef } from "react"

interface Node {
  x: number
  y: number
  r: number
  phase: number
  speed: number
}

interface Edge {
  a: number
  b: number
}

function buildGraph(width: number, height: number): { nodes: Node[]; edges: Edge[] } {
  // node count scales with width; reduced-motion / mobile path overrides at call site
  const target = Math.max(8, Math.min(20, Math.round(width / 90)))
  const nodes: Node[] = []
  // deterministic-ish seed via index so SSR/CSR don't disagree
  for (let i = 0; i < target; i++) {
    nodes.push({
      x: ((i * 73 + 41) % width),
      y: ((i * 131 + 17) % height),
      r: 1.6 + ((i * 7) % 3) * 0.6,
      phase: (i * 0.7) % (Math.PI * 2),
      speed: 0.0008 + ((i * 13) % 7) * 0.0001,
    })
  }
  const edges: Edge[] = []
  for (let i = 0; i < target; i++) {
    const j = (i + 1 + (i % 3)) % target
    if (i !== j) edges.push({ a: i, b: j })
  }
  return { nodes, edges }
}

function shouldAnimate(): boolean {
  if (typeof window === "undefined") return false
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
  if (mql.matches) return false
  if (window.matchMedia("(pointer: coarse)").matches) return false
  return true
}

export function LoginBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let nodes: Node[] = []
    let edges: Edge[] = []
    let animate = true
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const g = buildGraph(w, h)
      nodes = g.nodes
      edges = g.edges
    }

    const draw = (t: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      // edges first
      ctx.lineWidth = 1
      for (const e of edges) {
        const a = nodes[e.a]
        const b = nodes[e.b]
        ctx.strokeStyle = "rgba(59,130,246,0.15)"
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      // nodes
      for (const n of nodes) {
        const s = animate ? 0.6 + 0.4 * Math.sin(t * n.speed + n.phase) : 0.8
        const r = n.r * (animate ? 1 + 0.2 * Math.sin(t * n.speed + n.phase) : 1)
        ctx.fillStyle = `rgba(59,130,246,${0.35 * s})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (t: number) => {
      draw(t)
      raf = window.requestAnimationFrame(loop)
    }

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        raf = window.requestAnimationFrame(loop)
      }
    }

    resize()
    animate = shouldAnimate()
    // draw one frame immediately even if static
    draw(performance.now())
    if (animate) raf = window.requestAnimationFrame(loop)

    const onResize = () => {
      resize()
      draw(performance.now())
    }
    window.addEventListener("resize", onResize)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-testid="login-background"
      className="fixed inset-0 h-full w-full"
    />
  )
}