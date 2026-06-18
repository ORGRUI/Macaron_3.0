'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/app-store'

export default function FeedbackToast() {
  const feedbackMessage = useAppStore((s) => s.feedbackMessage)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (feedbackMessage) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        useAppStore.setState({ feedbackMessage: null })
      }, 2400)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [feedbackMessage])

  if (!feedbackMessage) return null

  return (
    <div className="feedback-toast">
      {feedbackMessage}
    </div>
  )
}
