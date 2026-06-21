"use client"

import { useEffect, useRef } from "react"

interface Node {
  x: number
  y: number
  r: number
  phase: number
  speed: number
  isHub: boolean
  hubLabel: string | null
}

interface Edge {
  a: number
  b: number
  hub: boolean
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

const HUB_LABELS = ["SH01", "BJ02", "GZ03"]

function buildGraph(width: number, height: number): { nodes: Node[]; edges: Edge[] } {
  // r5: 增加节点密度 (12-20 → 25-35)
  const target = Math.max(14, Math.min(35, Math.round(width / 55)))
  const nodes: Node[] = []

  // 3 个枢纽节点: 左上、右上、中下
  const hubPositions: Array<{ x: number; y: number }> = [
    { x: width * 0.15, y: height * 0.22 },
    { x: width * 0.82, y: height * 0.32 },
    { x: width * 0.5, y: height * 0.78 },
  ]

  for (let i = 0; i < target; i++) {
    if (i < 3) {
      const pos = hubPositions[i]
      nodes.push({
        x: pos.x,
        y: pos.y,
        r: 4,
        phase: (i * 1.1) % (Math.PI * 2),
        speed: 0.0006 + (i % 3) * 0.0001,
        isHub: true,
        hubLabel: HUB_LABELS[i] ?? null,
      })
    } else {
      nodes.push({
        x: ((i * 73 + 41) % width),
        y: ((i * 131 + 17) % height),
        r: 1.6 + ((i * 7) % 3) * 0.6,
        phase: (i * 0.7) % (Math.PI * 2),
        speed: 0.0008 + ((i * 13) % 7) * 0.0001,
        isHub: false,
        hubLabel: null,
      })
    }
  }

  const edges: Edge[] = []
  // 普通节点: 每个连 1-2 个邻居
  for (let i = 3; i < target; i++) {
    const j1 = 3 + ((i + 1) % (target - 3))
    const j2 = 3 + ((i + 3) % (target - 3))
    edges.push({ a: i, b: j1, hub: false })
    if (i % 2 === 0) edges.push({ a: i, b: j2, hub: false })
  }
  // 枢纽连接 5 个普通节点 (形成放射)
  for (let h = 0; h < 3; h++) {
    for (let k = 0; k < 5; k++) {
      const t = 3 + ((h * 7 + k * 11) % (target - 3))
      edges.push({ a: h, b: t, hub: true })
    }
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
      // 1) edges: hub 连线用更亮的色 + 略粗, 普通连线保持
      for (const e of edges) {
        const a = nodes[e.a]
        const b = nodes[e.b]
        if (e.hub) {
          ctx.strokeStyle = "rgba(147,197,253,0.55)"
          ctx.lineWidth = 1.2
        } else {
          ctx.strokeStyle = "rgba(96,165,250,0.35)"
          ctx.lineWidth = 1
        }
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      // 2) 普通节点
      for (const n of nodes) {
        if (n.isHub) continue
        const s = animate ? 0.6 + 0.4 * Math.sin(t * n.speed + n.phase) : 0.85
        const r = n.r * (animate ? 1 + 0.2 * Math.sin(t * n.speed + n.phase) : 1)
        const alpha = 0.6 * s
        ctx.fillStyle = `rgba(147,197,253,${alpha})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4)
        halo.addColorStop(0, `rgba(96,165,250,${alpha * 0.4})`)
        halo.addColorStop(1, "rgba(96,165,250,0)")
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2)
        ctx.fill()
      }

      // 3) 枢纽节点: 大半径 + 强光晕 + label
      for (const n of nodes) {
        if (!n.isHub) continue
        const s = animate ? 0.7 + 0.3 * Math.sin(t * n.speed + n.phase) : 0.9
        const r = n.r * (animate ? 1 + 0.15 * Math.sin(t * n.speed + n.phase) : 1)
        // 外圈大光晕
        const outerHalo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 8)
        outerHalo.addColorStop(0, `rgba(96,165,250,${0.5 * s})`)
        outerHalo.addColorStop(0.5, `rgba(96,165,250,${0.15 * s})`)
        outerHalo.addColorStop(1, "rgba(96,165,250,0)")
        ctx.fillStyle = outerHalo
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 8, 0, Math.PI * 2)
        ctx.fill()
        // 核心圆点 (亮蓝白)
        ctx.fillStyle = `rgba(224,242,254,${0.95 * s})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()
        // 描边 (深蓝, 增强对比)
        ctx.strokeStyle = `rgba(59,130,246,${0.8 * s})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(n.x, n.y, r + 1, 0, Math.PI * 2)
        ctx.stroke()
        // label
        if (n.hubLabel) {
          ctx.fillStyle = `rgba(224,242,254,${0.75 * s})`
          ctx.font = "10px ui-sans-serif, system-ui, sans-serif"
          ctx.textBaseline = "middle"
          ctx.fillText(n.hubLabel, n.x + r + 6, n.y)
        }
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