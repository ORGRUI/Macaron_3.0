'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { Expression } from '../../data/types'

interface VirtualAvatarProps {
  expression: Expression
  isTalking: boolean
  onExpressionChange?: (exp: Expression) => void
}

export default function VirtualAvatar({ expression, isTalking, onExpressionChange }: VirtualAvatarProps) {
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expressionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blinkRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Autonomous blinking
  const scheduleBlink = useCallback(() => {
    const delay = 2500 + Math.random() * 4000 // 2.5-6.5s
    blinkTimer.current = setTimeout(() => {
      blinkRef.current = true
      const eyes = containerRef.current?.querySelectorAll('.av-eye-inner')
      eyes?.forEach((el) => (el as HTMLElement).classList.add('blink'))
      setTimeout(() => {
        eyes?.forEach((el) => (el as HTMLElement).classList.remove('blink'))
        blinkRef.current = false
        scheduleBlink()
      }, 150 + Math.random() * 100)
    }, delay)
  }, [])

  // Autonomous expression changes (only when not talking)
  const scheduleExpression = useCallback(() => {
    const delay = 8000 + Math.random() * 12000
    expressionTimer.current = setTimeout(() => {
      if (!isTalking && onExpressionChange) {
        const idle: Expression[] = ['neutral', 'happy', 'wink', 'neutral', 'neutral']
        onExpressionChange(idle[Math.floor(Math.random() * idle.length)])
      }
      scheduleExpression()
    }, delay)
  }, [isTalking, onExpressionChange])

  useEffect(() => {
    scheduleBlink()
    scheduleExpression()
    return () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current)
      if (expressionTimer.current) clearTimeout(expressionTimer.current)
    }
  }, [scheduleBlink, scheduleExpression])

  const mouthPath = getMouthPath(expression, isTalking)
  const eyeStyle = getEyeStyle(expression)
  const eyebrowStyle = getEyebrowStyle(expression)

  return (
    <div className="av-container" ref={containerRef}>
      <div className="av-breathing">
        {/* Hair back layer */}
        <div className="av-hair-back">
          <div className="av-hair-strand strand-l" />
          <div className="av-hair-strand strand-r" />
        </div>

        {/* Head */}
        <div className="av-head">
          {/* Face */}
          <div className="av-face">
            {/* Eyebrows */}
            <div className="av-eyebrow av-eyebrow-l" style={eyebrowStyle.left} />
            <div className="av-eyebrow av-eyebrow-r" style={eyebrowStyle.right} />

            {/* Eyes */}
            <div className="av-eye av-eye-l">
              <div className="av-eye-inner" style={eyeStyle}>
                <div className="av-eye-white" />
                <div className="av-eye-iris">
                  <div className="av-eye-pupil" />
                  <div className="av-eye-highlight" />
                  <div className="av-eye-highlight-sm" />
                </div>
              </div>
            </div>
            <div className="av-eye av-eye-r">
              <div className={`av-eye-inner ${expression === 'wink' ? 'wink-right' : ''}`} style={expression === 'wink' ? {} : eyeStyle}>
                <div className="av-eye-white" />
                <div className="av-eye-iris">
                  <div className="av-eye-pupil" />
                  <div className="av-eye-highlight" />
                  <div className="av-eye-highlight-sm" />
                </div>
              </div>
            </div>

            {/* Blush */}
            <div className="av-blush av-blush-l" />
            <div className="av-blush av-blush-r" />

            {/* Nose */}
            <div className="av-nose" />

            {/* Mouth */}
            <svg className="av-mouth" viewBox="0 0 40 20" width="40" height="20">
              <path d={mouthPath} fill={isTalking || expression === 'happy' ? '#E88B9E' : 'none'} stroke="#D4748A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Hair front layer */}
          <div className="av-hair-front">
            <div className="av-bangs" />
            <div className="av-bangs-side-l" />
            <div className="av-bangs-side-r" />
          </div>

          {/* Hair accessory */}
          <div className="av-accessory">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M12 2L14.5 8.5L21 9.5L16.5 14L17.5 21L12 17.5L6.5 21L7.5 14L3 9.5L9.5 8.5Z" fill="#FFD700" stroke="#E8B830" strokeWidth="0.5" />
            </svg>
          </div>
        </div>

        {/* Body */}
        <div className="av-body">
          <div className="av-neck" />
          <div className="av-shoulders">
            <div className="av-clothing" />
          </div>
        </div>
      </div>

      {/* Ambient particles */}
      <div className="av-particles">
        <div className="av-particle p1" />
        <div className="av-particle p2" />
        <div className="av-particle p3" />
        <div className="av-particle p4" />
        <div className="av-particle p5" />
      </div>
    </div>
  )
}

function getMouthPath(expression: Expression, isTalking: boolean): string {
  if (isTalking) return 'M8 6 Q20 6 32 6 Q25 18 20 18 Q15 18 8 6 Z'
  switch (expression) {
    case 'happy': return 'M8 4 Q20 18 32 4'
    case 'surprised': return 'M14 4 Q14 16 20 16 Q26 16 26 4 Z'
    case 'thinking': return 'M10 10 Q18 8 30 12'
    case 'talking': return 'M10 6 Q20 16 30 6'
    case 'wink': return 'M10 6 Q20 14 30 6'
    default: return 'M10 8 Q20 14 30 8'
  }
}

function getEyeStyle(expression: Expression): React.CSSProperties {
  switch (expression) {
    case 'happy': return { transform: 'scaleY(0.6)', borderRadius: '50%' }
    case 'surprised': return { transform: 'scaleY(1.15) scaleX(1.1)' }
    case 'thinking': return { transform: 'scaleY(0.85)' }
    default: return {}
  }
}

function getEyebrowStyle(expression: Expression): { left: React.CSSProperties; right: React.CSSProperties } {
  switch (expression) {
    case 'surprised':
      return {
        left: { transform: 'translateY(-4px) rotate(-8deg)' },
        right: { transform: 'translateY(-4px) rotate(8deg)' },
      }
    case 'thinking':
      return {
        left: { transform: 'rotate(-5deg)' },
        right: { transform: 'translateY(-2px) rotate(12deg)' },
      }
    case 'happy':
      return {
        left: { transform: 'translateY(2px) rotate(5deg)' },
        right: { transform: 'translateY(2px) rotate(-5deg)' },
      }
    default:
      return { left: {}, right: {} }
  }
}
