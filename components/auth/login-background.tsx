"use client"

import { useEffect, useRef } from "react"

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
    }

    const drawMeteorLayer = () => {
      if (!allowMeteor) return
      ctx.save()
      ctx.globalCompositeOperation = "lighter"

      // 1) 鼠标轨迹
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
      // 鼠标头部光点
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

      // 2) 流星
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