'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/app-store'
import type { Expression, MacaronFaceOffsets } from '../../data/types'

interface MacaronAvatarProps {
  expression: Expression
  isTalking: boolean
  onExpressionChange?: (exp: Expression) => void
}


export default function MacaronAvatar({ expression, isTalking, onExpressionChange }: MacaronAvatarProps) {
  const expressionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const microTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })
  const [microExpr, setMicroExpr] = useState<{ type: 'none' | 'eye-dart' | 'brow-twitch'; dir?: number }>({ type: 'none' })
  const avatarRef = useRef<HTMLDivElement>(null)
  const developerMode = useAppStore((s) => s.developerMode)
  const offsets = useAppStore((s) => s.macaronFaceOffsets)
  const setMacaronFaceOffset = useAppStore((s) => s.setMacaronFaceOffset)
  const setMacaronFaceOffsets = useAppStore((s) => s.setMacaronFaceOffsets)
  const dragState = useRef<{
    part: keyof MacaronFaceOffsets
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  // --- Idle expression rotation ---
  const scheduleExpression = useCallback(() => {
    const delay = 7000 + Math.random() * 9000
    expressionTimer.current = setTimeout(() => {
      if (!isTalking && onExpressionChange) {
        const idle: Expression[] = ['neutral', 'happy', 'neutral', 'happy']
        onExpressionChange(idle[Math.floor(Math.random() * idle.length)])
      }
      scheduleExpression()
    }, delay)
  }, [isTalking, onExpressionChange])

  // --- Micro-expressions: eye darts and brow twitches ---
  const scheduleMicro = useCallback(() => {
    const delay = 3000 + Math.random() * 4000
    microTimer.current = setTimeout(() => {
      const roll = Math.random()
      if (roll < 0.45) {
        // Eye dart: pupils shift quickly to a direction then return
        const dir = Math.random() < 0.5 ? -1 : 1
        setMicroExpr({ type: 'eye-dart', dir })
        setTimeout(() => setMicroExpr({ type: 'none' }), 200 + Math.random() * 150)
      } else if (roll < 0.7) {
        // Brow twitch: one brow lifts slightly
        const dir = Math.random() < 0.5 ? -1 : 1
        setMicroExpr({ type: 'brow-twitch', dir })
        setTimeout(() => setMicroExpr({ type: 'none' }), 250 + Math.random() * 200)
      }
      // else: no micro-expression this cycle
      scheduleMicro()
    }, delay)
  }, [])

  // --- Pupil tracking: follow pointer position ---
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!avatarRef.current) return
      const rect = avatarRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height * 0.42 // eye center approximate
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const maxShift = 3.5
      const factor = Math.min(dist / 200, 1) * maxShift
      const angle = Math.atan2(dy, dx)
      setPupilOffset({
        x: Math.cos(angle) * factor,
        y: Math.sin(angle) * factor,
      })
    }
    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [])

  // --- Sync face offsets from server ---
  useEffect(() => {
    let cancelled = false
    const syncOffsets = async () => {
      try {
        const res = await fetch('/api/macaron-face', { cache: 'no-store' })
        if (!res.ok) return
        const saved = await res.json() as MacaronFaceOffsets
        if (!cancelled) {
          setMacaronFaceOffsets(saved)
        }
      } catch {
        // Ignore and keep current local state.
      }
    }
    void syncOffsets()
    return () => {
      cancelled = true
    }
  }, [setMacaronFaceOffsets])

  // --- Start timers ---
  useEffect(() => {
    scheduleExpression()
    scheduleMicro()
    return () => {
      if (expressionTimer.current) clearTimeout(expressionTimer.current)
      if (microTimer.current) clearTimeout(microTimer.current)
    }
  }, [scheduleExpression, scheduleMicro])

  // --- Build final states ---
  const eye = getEyeState(expression, isTalking, pupilOffset, microExpr)
  const brow = getBrowState(expression, microExpr)
  const avatarClass = getAvatarClass(expression, isTalking)
  const leftBrowStyle = mergeOffsetStyle(brow.left, offsets.leftBrow)
  const rightBrowStyle = mergeOffsetStyle(brow.right, offsets.rightBrow)
  const leftEyeStyle = mergeOffsetStyle(eye.left, offsets.leftEye)
  const rightEyeStyle = mergeOffsetStyle(eye.right, offsets.rightEye)

  const handlePointerDown = (part: keyof MacaronFaceOffsets) => (event: React.PointerEvent<HTMLElement | SVGSVGElement>) => {
    if (!developerMode) return
    event.preventDefault()
    event.stopPropagation()
    dragState.current = {
      part,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offsets[part].x,
      originY: offsets[part].y,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  useEffect(() => {
    if (!developerMode) return

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragState.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      setMacaronFaceOffset(drag.part, {
        x: Math.round(drag.originX + dx),
        y: Math.round(drag.originY + dy),
      })
    }

    const handlePointerEnd = (event: PointerEvent) => {
      const drag = dragState.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragState.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [developerMode, setMacaronFaceOffset])

  return (
    <div className={`macaron-avatar ${avatarClass}`} ref={avatarRef}>
      <div className="macaron-shadow" />
      <div className="macaron-sprite-wrap">
        <img
          src="/macaron-avatar/body-blank-tight.png"
          alt="Macaron avatar"
          className="macaron-base-image"
          draggable={false}
        />

        <div className="macaron-face-layer">
          <div className="macaron-brow brow-left" style={leftBrowStyle} onPointerDown={handlePointerDown('leftBrow')} />
          <div className="macaron-brow brow-right" style={rightBrowStyle} onPointerDown={handlePointerDown('rightBrow')} />

          <div className="macaron-eye eye-left" style={leftEyeStyle} onPointerDown={handlePointerDown('leftEye')}>
            <div className="macaron-pupil" style={eye.pupilLeft}>
              <div className="macaron-eye-highlight" />
            </div>
          </div>
          <div className="macaron-eye eye-right" style={rightEyeStyle} onPointerDown={handlePointerDown('rightEye')}>
            <div className="macaron-pupil" style={eye.pupilRight}>
              <div className="macaron-eye-highlight" />
            </div>
          </div>

          {developerMode && (
            <>
              <div className="macaron-handle brow-left-handle" style={getHandleStyle(leftBrowStyle)} />
              <div className="macaron-handle brow-right-handle" style={getHandleStyle(rightBrowStyle)} />
              <div className="macaron-handle eye-left-handle" style={getHandleStyle(leftEyeStyle)} />
              <div className="macaron-handle eye-right-handle" style={getHandleStyle(rightEyeStyle)} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function mergeOffsetStyle(base: React.CSSProperties, offset: { x: number; y: number }): React.CSSProperties {
  const baseTransform = typeof base.transform === 'string' ? `${base.transform} ` : ''
  return {
    ...base,
    transform: `${baseTransform}translate(${offset.x}px, ${offset.y}px)`.trim(),
  }
}

function getHandleStyle(style: React.CSSProperties): React.CSSProperties {
  return {
    transform: style.transform,
  }
}

function getAvatarClass(expression: Expression, isTalking: boolean): string {
  if (isTalking) return 'is-talking'
  switch (expression) {
    case 'happy':
      return 'is-happy'
    case 'surprised':
      return 'is-surprised'
    case 'thinking':
      return 'is-thinking'
    case 'wink':
      return 'is-wink'
    default:
      return 'is-neutral'
  }
}

type MicroExpr = { type: 'none' | 'eye-dart' | 'brow-twitch'; dir?: number }

function getEyeState(
  expression: Expression,
  isTalking: boolean,
  pupilOffset: { x: number; y: number },
  micro: MicroExpr,
): {
  left: React.CSSProperties
  right: React.CSSProperties
  pupilLeft: React.CSSProperties
  pupilRight: React.CSSProperties
} {
  // Base pupil position with pointer tracking
  const px = pupilOffset.x
  const py = pupilOffset.y
  // Add micro eye-dart offset
  const dartX = micro.type === 'eye-dart' ? (micro.dir ?? 0) * 2.5 : 0
  const dartY = micro.type === 'eye-dart' ? -0.8 : 0

  const basePupilLeft: React.CSSProperties = {
    transform: `translate(calc(-50% + ${px + dartX}px), calc(-40% + ${py + dartY}px))`,
  }
  const basePupilRight: React.CSSProperties = {
    transform: `translate(calc(-50% + ${px + dartX}px), calc(-40% + ${py + dartY}px))`,
  }

  const base = {
    left: {} as React.CSSProperties,
    right: {} as React.CSSProperties,
    pupilLeft: basePupilLeft,
    pupilRight: basePupilRight,
  }

  if (expression === 'wink') {
    return {
      ...base,
      right: { transform: 'scaleY(0.08)' },
    }
  }

  if (expression === 'happy') {
    return {
      ...base,
      left: { transform: 'scale(0.98)' },
      right: { transform: 'scale(0.98)' },
      pupilLeft: { transform: `translate(calc(-50% + ${px + dartX}px), calc(-46% + ${py + dartY}px)) scale(0.92)` },
      pupilRight: { transform: `translate(calc(-50% + ${px + dartX}px), calc(-46% + ${py + dartY}px)) scale(0.92)` },
    }
  }

  if (expression === 'surprised') {
    return {
      ...base,
      left: { transform: 'scale(1.08)' },
      right: { transform: 'scale(1.08)' },
      pupilLeft: { transform: `translate(calc(-50% + ${px + dartX}px), calc(-42% + ${py + dartY}px)) scale(0.9)` },
      pupilRight: { transform: `translate(calc(-50% + ${px + dartX}px), calc(-42% + ${py + dartY}px)) scale(0.9)` },
    }
  }

  if (expression === 'thinking') {
    return {
      ...base,
      left: { transform: 'scaleY(0.94)' },
      right: { transform: 'scaleY(0.94)' },
      pupilLeft: { transform: `translate(calc(-42% + ${px + dartX}px), calc(-46% + ${py + dartY}px)) scale(0.96)` },
      pupilRight: { transform: `translate(calc(-58% + ${px + dartX}px), calc(-46% + ${py + dartY}px)) scale(0.96)` },
    }
  }

  if (isTalking) {
    return {
      ...base,
      pupilLeft: { transform: `translate(calc(-50% + ${px + dartX}px), calc(-43% + ${py + dartY}px)) scale(0.97)` },
      pupilRight: { transform: `translate(calc(-50% + ${px + dartX}px), calc(-43% + ${py + dartY}px)) scale(0.97)` },
    }
  }

  return base
}

function getBrowState(expression: Expression, micro: MicroExpr): { left: React.CSSProperties; right: React.CSSProperties } {
  // Micro brow-twitch adds a small lift to one brow
  const twitchLeft = micro.type === 'brow-twitch' && (micro.dir ?? 0) < 0 ? 'translateY(-2px)' : ''
  const twitchRight = micro.type === 'brow-twitch' && (micro.dir ?? 0) > 0 ? 'translateY(-2px)' : ''

  switch (expression) {
    case 'happy':
      return {
        left: { transform: `rotate(-8deg) translateY(1px) ${twitchLeft}`.trim() },
        right: { transform: `rotate(8deg) translateY(1px) ${twitchRight}`.trim() },
      }
    case 'surprised':
      return {
        left: { transform: `rotate(-4deg) translateY(-2px) ${twitchLeft}`.trim() },
        right: { transform: `rotate(4deg) translateY(-2px) ${twitchRight}`.trim() },
      }
    case 'thinking':
      return {
        left: { transform: `rotate(-14deg) translate(-1px, -1px) ${twitchLeft}`.trim() },
        right: { transform: `rotate(6deg) translate(1px, -2px) ${twitchRight}`.trim() },
      }
    default:
      return {
        left: { transform: twitchLeft || undefined } as React.CSSProperties,
        right: { transform: twitchRight || undefined } as React.CSSProperties,
      }
  }
}
