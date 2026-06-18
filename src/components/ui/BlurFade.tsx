'use client'

import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import type { ReactNode } from 'react'

interface BlurFadeProps {
  children: ReactNode
  className?: string
  duration?: number
  delay?: number
  offset?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  blur?: string
}

export default function BlurFade({
  children,
  className,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = 'up',
  blur = '6px',
}: BlurFadeProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-30px' })

  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y'
  const sign = direction === 'right' || direction === 'down' ? -1 : 1

  return (
    <motion.div
      ref={ref}
      initial={{ [axis]: sign * offset, opacity: 0, filter: `blur(${blur})` }}
      animate={
        isInView
          ? { [axis]: 0, opacity: 1, filter: 'blur(0px)' }
          : undefined
      }
      transition={{
        delay: 0.04 + delay,
        duration,
        ease: 'easeOut',
        filter: { duration },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
