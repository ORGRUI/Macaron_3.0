'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { generateGeodesicGraph } from './geodesic-data'
import type { GeoNode, GeoLink } from './geodesic-data'
import { useAppStore } from '../../store/app-store'

interface Projected {
  id: string
  group: 'core' | 'secondary'
  sx: number  // screen x
  sy: number  // screen y
}

function project(
  nodes: GeoNode[],
  angle: number,
  cx: number,
  cy: number,
  scale: number,
): Projected[] {
  const cosA = Math.cos(angle)
  const sinA = Math.sin(angle)
  // Slow tilt on second axis for depth feel
  const tilt = angle * 0.3
  const cosT = Math.cos(tilt)
  const sinT = Math.sin(tilt)

  return nodes.map((n) => {
    // Rotate around Y axis
    const rx = n.x * cosA + n.z * sinA
    const rz = -n.x * sinA + n.z * cosA
    // Rotate around X axis (tilt)
    const ry = n.y * cosT - rz * sinT

    return {
      id: n.id,
      group: n.group,
      sx: cx + rx * scale,
      sy: cy + ry * scale,
    }
  })
}

export default function GeodesicNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const angleRef = useRef(0)
  const hoveredRef = useRef<string | null>(null)

  const selectNode = useAppStore((s) => s.selectDissectionNode)
  const selectedNodeId = useAppStore((s) => s.dissectionSelectedNode)
  const nodeCount = useAppStore((s) => s.dissectionNodeCount)
  const radius = useAppStore((s) => s.dissectionRadius)
  const selectedRef = useRef(selectedNodeId)
  selectedRef.current = selectedNodeId

  const [size, setSize] = useState({ w: 600, h: 600 })
  const [hovered, setHovered] = useState<string | null>(null)

  const graph = useMemo(
    () => generateGeodesicGraph(radius, 0.25, 42, nodeCount),
    [radius, nodeCount],
  )

  // Build adjacency lookup for quick neighbor access
  const nodeMap = useMemo(() => {
    const m = new Map<string, GeoNode>()
    graph.nodes.forEach((n) => m.set(n.id, n))
    return m
  }, [graph])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const e = entries[0]
      if (e) {
        const w = Math.floor(e.contentRect.width)
        const h = Math.floor(e.contentRect.height)
        setSize({ w, h })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const { w, h } = size
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Clear
      ctx.clearRect(0, 0, w, h)

      // Projection — scale to fill the container
      const cx = w / 2
      const cy = h / 2
      const scale = Math.min(w, h) * 0.0046
      angleRef.current += 0.002
      const pts = project(graph.nodes, angleRef.current, cx, cy, scale)
      const ptMap = new Map<string, Projected>()
      pts.forEach((p) => ptMap.set(p.id, p))

      const sel = selectedRef.current
      const hov = hoveredRef.current

      // Draw links
      ctx.lineWidth = 1
      for (const link of graph.links) {
        const a = ptMap.get(link.source)
        const b = ptMap.get(link.target)
        if (!a || !b) continue

        const isHighlighted =
          sel && (link.source === sel || link.target === sel)
        ctx.strokeStyle = isHighlighted
          ? 'rgba(201, 169, 76, 0.9)'
          : 'rgba(201, 169, 76, 0.35)'
        ctx.lineWidth = isHighlighted ? 1.5 : 0.8
        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.stroke()
      }

      // Draw nodes
      for (const p of pts) {
        const isCore = p.group === 'core'
        const isSel = p.id === sel
        const isHov = p.id === hov

        const baseR = isCore ? 4 : 2.5
        const r = isSel ? baseR * 1.6 : isHov ? baseR * 1.3 : baseR

        // Glow
        if (isSel || isHov || isCore) {
          const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 3)
          if (isSel) {
            glow.addColorStop(0, 'rgba(139, 92, 246, 0.4)')
            glow.addColorStop(1, 'rgba(139, 92, 246, 0)')
          } else if (isHov) {
            glow.addColorStop(0, 'rgba(232, 234, 246, 0.3)')
            glow.addColorStop(1, 'rgba(232, 234, 246, 0)')
          } else {
            glow.addColorStop(0, 'rgba(255, 255, 255, 0.15)')
            glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
          }
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, r * 3, 0, Math.PI * 2)
          ctx.fill()
        }

        // Dot
        ctx.fillStyle = isSel
          ? '#8B5CF6'
          : isHov
            ? '#F0F0FF'
            : '#E8EAF6'
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [size, graph])

  // Hit-test for mouse events
  const hitTest = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): string | null => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return null
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const cx = size.w / 2
      const cy = size.h / 2
      const scale = Math.min(size.w, size.h) * 0.0046
      const pts = project(graph.nodes, angleRef.current, cx, cy, scale)

      let closest: string | null = null
      let closestDist = 18 // max hit distance in px
      for (const p of pts) {
        const dx = mx - p.sx
        const dy = my - p.sy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < closestDist) {
          closestDist = dist
          closest = p.id
        }
      }
      return closest
    },
    [size, graph],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const id = hitTest(e)
      hoveredRef.current = id
      setHovered(id)
      if (canvasRef.current) {
        canvasRef.current.style.cursor = id ? 'pointer' : 'default'
      }
    },
    [hitTest],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const id = hitTest(e)
      selectNode(id)
    },
    [hitTest, selectNode],
  )

  return (
    <div ref={containerRef} className="dissect-graph-container">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => {
          hoveredRef.current = null
          setHovered(null)
        }}
      />
    </div>
  )
}
