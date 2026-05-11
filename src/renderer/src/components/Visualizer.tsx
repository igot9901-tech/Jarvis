import React, { useEffect, useRef } from 'react'
import { useStore } from '../store'
import type { AgentState } from '../types'

// ── Sphere geometry ────────────────────────────────────────────────────────────
interface P3 { x: number; y: number; z: number }

const N_POINTS = 180
const CONNECT_DIST = 0.60   // unit-sphere distance threshold for edges

/** Evenly distribute N points on a unit sphere via Fibonacci lattice */
function fibSphere(n: number): P3[] {
  const pts: P3[] = []
  const g = Math.PI * (1 + Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const phi   = Math.acos(1 - 2 * (i + 0.5) / n)
    const theta = g * i
    pts.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.sin(phi) * Math.sin(theta),
      z: Math.cos(phi)
    })
  }
  return pts
}

/** Pre-compute edges once (topology doesn't change — only orientation does) */
function buildEdges(pts: P3[]): [number, number][] {
  const edges: [number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x
      const dy = pts[i].y - pts[j].y
      const dz = pts[i].z - pts[j].z
      if (dx * dx + dy * dy + dz * dz < CONNECT_DIST * CONNECT_DIST) {
        edges.push([i, j])
      }
    }
  }
  return edges
}

const SPHERE_PTS  = fibSphere(N_POINTS)
const SPHERE_EDGES = buildEdges(SPHERE_PTS)   // computed once at module load

// ── Component ──────────────────────────────────────────────────────────────────
export function Visualizer({ onTogglePanel }: { onTogglePanel: () => void }) {
  const { agentState } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const frameRef  = useRef(0)
  const stateRef  = useRef(agentState)
  useEffect(() => { stateRef.current = agentState }, [agentState])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!

    // Projected 2D cache
    const proj = new Array(N_POINTS) as { sx: number; sy: number; sz: number; s: number }[]

    function resize() {
      const size = Math.min(canvas.offsetWidth, canvas.offsetHeight)
      canvas.width  = size * devicePixelRatio
      canvas.height = size * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function draw() {
      const state  = stateRef.current
      const active = state !== 'idle'
      const t      = frameRef.current++ * 0.005   // slow, smooth rotation

      const W  = canvas.offsetWidth
      const H  = canvas.offsetHeight
      const cx = W / 2
      const cy = H / 2
      const R  = Math.min(W, H) * 0.38

      ctx.clearRect(0, 0, W, H)

      // Rotation angles — slow Y spin, gentle X wobble
      const rotY = t * 0.9
      const rotX = Math.sin(t * 0.25) * 0.25

      const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX)

      // Project all sphere points to 2D with soft perspective
      for (let i = 0; i < N_POINTS; i++) {
        const p = SPHERE_PTS[i]
        // rotate Y
        const x1 =  p.x * cosY + p.z * sinY
        const z1 = -p.x * sinY + p.z * cosY
        // rotate X
        const y2 = p.y * cosX - z1 * sinX
        const z2 = p.y * sinX + z1 * cosX
        // perspective
        const fov = 3.2
        const s   = fov / (fov + z2 + 1)
        proj[i] = { sx: cx + x1 * R * s, sy: cy + y2 * R * s, sz: z2, s }
      }

      // Pulse intensity for active states
      let pulseFreq = 0
      if (state === 'speaking')   pulseFreq = 7
      else if (state === 'listening') pulseFreq = 4
      else if (state === 'thinking')  pulseFreq = 2
      const pulse = active ? 1 + Math.sin(t * pulseFreq * 20) * 0.12 : 1

      // ── Background haze ─────────────────────────────────────────────────────
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3)
      bg.addColorStop(0, active ? 'rgba(0,30,70,0.35)' : 'rgba(0,15,40,0.25)')
      bg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2)
      ctx.fillStyle = bg
      ctx.fill()

      // ── Edges ────────────────────────────────────────────────────────────────
      ctx.lineWidth = 0.8
      for (const [i, j] of SPHERE_EDGES) {
        const a = proj[i], b = proj[j]
        const depth = ((a.sz + b.sz) / 2 + 1) / 2   // 0=back, 1=front
        const alpha = depth * depth * (active ? 0.7 : 0.28) * pulse

        // skip very faint edges for performance
        if (alpha < 0.03) continue

        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.strokeStyle = `rgba(80,190,255,${alpha.toFixed(3)})`
        ctx.stroke()
      }

      // ── Nodes ────────────────────────────────────────────────────────────────
      ctx.shadowBlur  = active ? 12 : 6
      ctx.shadowColor = 'rgba(80,200,255,0.9)'
      for (let i = 0; i < N_POINTS; i++) {
        const { sx, sy, sz, s } = proj[i]
        const depth = (sz + 1) / 2
        const r     = s * (active ? 2.8 : 1.8) * pulse
        const alpha = 0.25 + depth * 0.75

        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(160,230,255,${(alpha * (active ? 0.95 : 0.55)).toFixed(3)})`
        ctx.fill()
      }
      ctx.shadowBlur = 0

      // ── Outer glow ring (subtle) ─────────────────────────────────────────────
      if (active) {
        const glowR = R * (1.02 + Math.sin(t * pulseFreq * 20) * 0.02)
        ctx.save()
        ctx.shadowBlur  = 24
        ctx.shadowColor = 'rgba(6,182,212,0.6)'
        ctx.beginPath()
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(6,182,212,${0.15 + Math.sin(t * pulseFreq * 20) * 0.08})`
        ctx.lineWidth   = 1.5
        ctx.stroke()
        ctx.restore()
      }

      // ── Centre text ──────────────────────────────────────────────────────────
      const fontSize = Math.max(11, R * 0.12)
      ctx.save()
      ctx.shadowBlur   = active ? 22 : 10
      ctx.shadowColor  = '#06b6d4'
      ctx.font         = `600 ${fontSize}px 'Segoe UI', system-ui, sans-serif`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle    = active ? '#22d3ee' : 'rgba(6,182,212,0.45)'
      ctx.globalAlpha  = active ? 1 : 0.5
      ctx.fillText('J.A.R.V.I.S', cx, cy)
      ctx.restore()

      // ── State label ──────────────────────────────────────────────────────────
      if (active) {
        const labels: Record<AgentState, string> = {
          idle: '', listening: 'LISTENING', thinking: 'PROCESSING',
          speaking: 'SPEAKING', error: 'ERROR'
        }
        const label = labels[state]
        if (label) {
          ctx.save()
          ctx.shadowBlur   = 10
          ctx.shadowColor  = '#06b6d4'
          ctx.font         = `500 ${Math.max(8, R * 0.072)}px 'Segoe UI', system-ui, sans-serif`
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle    = 'rgba(34,211,238,0.85)'
          ctx.globalAlpha  = 0.9
          ctx.fillText(label, cx, cy + fontSize * 1.5)
          ctx.restore()
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="visualizer" onClick={onTogglePanel}>
      <canvas ref={canvasRef} className="visualizer__canvas" />
    </div>
  )
}
