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

interface TrailPoint {
  x: number
  y: number
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  lifeMs: number
}

const TRAIL_MAX = 20
const METEOR_MAX = 5
const METEOR_COOLDOWN_MS = 1000
const METEOR_LIFE_MS = 800

function buildGraph(width: number, height: number): { nodes: Node[]; edges: Edge[] } {
  const target = Math.max(8, Math.min(20, Math.round(width / 90)))
  const nodes: Node[] = []
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
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false
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
    let allowMeteor = true
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const trail: TrailPoint[] = []
    const meteors: Meteor[] = []
    let lastMeteorAt = 0
    let lastT = performance.now()

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

    const drawTopology = (t: number) => {
      ctx.lineWidth = 1
      for (const e of edges) {
        const a = nodes[e.a]
        const b = nodes[e.b]
        ctx.strokeStyle = "rgba(96,165,250,0.35)"
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      for (const n of nodes) {
        const s = animate ? 0.6 + 0.4 * Math.sin(t * n.speed + n.phase) : 0.85
        const r = n.r * (animate ? 1 + 0.2 * Math.sin(t * n.speed + n.phase) : 1)
        const alpha = 0.6 * s
        ctx.fillStyle = `rgba(147,197,253,${alpha})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()
        // inner glow halo so nodes read clearly on dark bg
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4)
        halo.addColorStop(0, `rgba(96,165,250,${alpha * 0.4})`)
        halo.addColorStop(1, "rgba(96,165,250,0)")
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawMeteorLayer = () => {
      if (!allowMeteor) return
      ctx.save()
      ctx.globalCompositeOperation = "lighter"

      // 1) trail
      if (trail.length >= 2) {
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1]
          const b = trail[i]
          const alpha = (i / trail.length) * 0.5
          ctx.strokeStyle = `rgba(96,165,250,${alpha})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
      // head dot (only when trail has content)
      if (trail.length > 0) {
        const head = trail[trail.length - 1]
        const grad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 12)
        grad.addColorStop(0, "rgba(147,197,253,0.7)")
        grad.addColorStop(1, "rgba(147,197,253,0)")
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(head.x, head.y, 12, 0, Math.PI * 2)
        ctx.fill()
      }

      // 2) meteors
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        const progress = m.age / m.lifeMs
        const alpha = (1 - progress) * 0.9
        const tailLen = 8
        ctx.strokeStyle = `rgba(34,211,238,${alpha})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(m.x - m.vx * tailLen, m.y - m.vy * tailLen)
        ctx.stroke()
        const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 10)
        grad.addColorStop(0, `rgba(224,242,254,${alpha})`)
        grad.addColorStop(1, "rgba(224,242,254,0)")
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(m.x, m.y, 10, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    const step = (t: number) => {
      const dt = Math.min(32, t - lastT)
      lastT = t
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      drawTopology(t)

      for (let i = meteors.length - 1; i >= 0; i--) {
        meteors[i].age += dt
        meteors[i].x += meteors[i].vx
        meteors[i].y += meteors[i].vy
        if (meteors[i].age > meteors[i].lifeMs) meteors.splice(i, 1)
      }

      drawMeteorLayer()

      raf = window.requestAnimationFrame(step)
    }

    const onMouseMove = (e: MouseEvent) => {
      trail.push({ x: e.clientX, y: e.clientY })
      if (trail.length > TRAIL_MAX) trail.shift()
      if (!allowMeteor) return
      const now = performance.now()
      if (now - lastMeteorAt < METEOR_COOLDOWN_MS) return
      if (meteors.length >= METEOR_MAX) return
      const angle = Math.random() * Math.PI * 2
      const speed = 1.4 + Math.random() * 1.0
      meteors.push({
        x: e.clientX,
        y: e.clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        lifeMs: METEOR_LIFE_MS,
      })
      lastMeteorAt = now
    }

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        raf = window.requestAnimationFrame(step)
      }
    }

    const onResize = () => {
      resize()
    }

    resize()
    animate = shouldAnimate()
    allowMeteor = animate
    lastT = performance.now()
    raf = window.requestAnimationFrame(step)

    if (allowMeteor) {
      window.addEventListener("mousemove", onMouseMove, { passive: true })
    }
    window.addEventListener("resize", onResize)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onMouseMove)
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