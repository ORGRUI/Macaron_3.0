'use client'

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppStore } from '../../store/app-store'
import { analyzeVideoFrame } from '../../api/chat'
import MacaronAvatar from './MacaronAvatar'
import Live2DAvatar from './Live2DAvatar'
import type { MacaronLayoutOffsets } from '../../data/types'

const GenUICard = lazy(() => import('../chat/GenUICard'))

export default function AvatarScreen() {
  const expression = useAppStore((s) => s.expression)
  const isTalking = useAppStore((s) => s.isTalking)
  const chatMessages = useAppStore((s) => s.chatMessages)
  const searchSteps = useAppStore((s) => s.searchSteps)
  const sendMessage = useAppStore((s) => s.sendMessage)
  const setExpression = useAppStore((s) => s.setExpression)
  const showFeedback = useAppStore((s) => s.showFeedback)
  const developerMode = useAppStore((s) => s.developerMode)
  const macaronPosition = useAppStore((s) => s.macaronPosition)
  const setMacaronPosition = useAppStore((s) => s.setMacaronPosition)
  const macaronLayout = useAppStore((s) => s.macaronLayout)
  const setMacaronLayout = useAppStore((s) => s.setMacaronLayout)
  const live2dModelPath = useAppStore((s) => s.live2dModelPath)

  const [inputText, setInputText] = useState('')
  const [showTextBar, setShowTextBar] = useState(false)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [pokeShake, setPokeShake] = useState(false)
  const [pokeAnim, setPokeAnim] = useState('')
  const [pokeMsg, setPokeMsg] = useState<string | null>(null)
  const [isVideoActive, setIsVideoActive] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [captureFlash, setCaptureFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const expandedInputRef = useRef<HTMLInputElement>(null)
  const dragState = useRef<{ startY: number; expanded: boolean } | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const avatarDragState = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const layoutDragState = useRef<{
    part: keyof MacaronLayoutOffsets
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  // Get the latest assistant bubble to display
  const latestAssistant = chatMessages
    .filter((m) => m.role === 'assistant')
    .slice(-1)[0]

  // When text bar becomes visible, auto-focus
  useEffect(() => {
    if (showTextBar) {
      setTimeout(() => inputRef.current?.focus(), 180)
    }
  }, [showTextBar])

  // When input becomes visible in expanded mode, auto-focus
  useEffect(() => {
    if (sheetExpanded) {
      setTimeout(() => expandedInputRef.current?.focus(), 300)
    }
  }, [sheetExpanded])

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (sheetExpanded && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, searchSteps, sheetExpanded])

  // Avatar position dragging (dev mode only)
  const handleAvatarPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!developerMode) return
    event.preventDefault()
    event.stopPropagation()
    const pos = macaronPosition[sheetExpanded ? 'peek' : 'home']
    avatarDragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }, [developerMode, macaronPosition, sheetExpanded])

  useEffect(() => {
    if (!developerMode) return

    const handlePointerMoveAvatar = (event: PointerEvent) => {
      const drag = avatarDragState.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        drag.moved = true
      }
      setMacaronPosition(sheetExpanded ? 'peek' : 'home', {
        x: Math.round(drag.originX + dx),
        y: Math.round(drag.originY + dy),
      })
    }

    const handlePointerEndAvatar = (event: PointerEvent) => {
      const drag = avatarDragState.current
      if (!drag || drag.pointerId !== event.pointerId) return
      avatarDragState.current = null
    }

    window.addEventListener('pointermove', handlePointerMoveAvatar)
    window.addEventListener('pointerup', handlePointerEndAvatar)
    window.addEventListener('pointercancel', handlePointerEndAvatar)
    return () => {
      window.removeEventListener('pointermove', handlePointerMoveAvatar)
      window.removeEventListener('pointerup', handlePointerEndAvatar)
      window.removeEventListener('pointercancel', handlePointerEndAvatar)
    }
  }, [developerMode, setMacaronPosition, sheetExpanded])

  // Layout element dragging (dev mode only)
  const handleLayoutPointerDown = useCallback((part: keyof MacaronLayoutOffsets) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (!developerMode) return
    event.preventDefault()
    event.stopPropagation()
    const pos = macaronLayout[part]
    layoutDragState.current = {
      part,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }, [developerMode, macaronLayout])

  useEffect(() => {
    if (!developerMode) return

    const handlePointerMoveLayout = (event: PointerEvent) => {
      const drag = layoutDragState.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      setMacaronLayout(drag.part, {
        x: Math.round(drag.originX + dx),
        y: Math.round(drag.originY + dy),
      })
    }

    const handlePointerEndLayout = (event: PointerEvent) => {
      const drag = layoutDragState.current
      if (!drag || drag.pointerId !== event.pointerId) return
      layoutDragState.current = null
    }

    window.addEventListener('pointermove', handlePointerMoveLayout)
    window.addEventListener('pointerup', handlePointerEndLayout)
    window.addEventListener('pointercancel', handlePointerEndLayout)
    return () => {
      window.removeEventListener('pointermove', handlePointerMoveLayout)
      window.removeEventListener('pointerup', handlePointerEndLayout)
      window.removeEventListener('pointercancel', handlePointerEndLayout)
    }
  }, [developerMode, setMacaronLayout])

  const handleSend = () => {
    if (!inputText.trim()) return
    const text = inputText.trim()

    sendMessage(text)
    setInputText('')

    if (!sheetExpanded) setShowTextBar(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setShowTextBar(false)
    }
  }

  const handleAvatarClick = useCallback(() => {
    if (developerMode && avatarDragState.current?.moved) return
    if (pokeShake) return

    const POKE_MESSAGES = [
      '别戳我啦！你是不是闲得慌～',
      '哎呀！轻一点嘛…',
      '你再戳我就要生气了哦！',
      '嗯？怎么了，想我了吗？',
      '今天大盘好像有点绿呢…别戳了快去看看！',
      '我可是专业的金融助手，不是按钮！',
      '痒痒的…你够了哈！',
      '戳我一下涨一个点就好了呢～',
      '你知道吗，巴菲特从不戳他的 AI 助手的。',
      '好啦好啦，有什么需要帮忙的嘛？',
      '再戳就要收咨询费了哦！',
      '我的头发都被你戳乱了…',
    ]

    const ANIMS_FULL = ['shake', 'bounce', 'spin', 'jelly', 'swing', 'rubberBand', 'jumpShake', 'spin']
    const ANIMS_GENTLE = ['shake-g', 'bounce-g', 'spin-g', 'jelly-g', 'swing-g', 'rubberBand-g', 'jumpShake-g', 'spin-g']

    const msg = POKE_MESSAGES[Math.floor(Math.random() * POKE_MESSAGES.length)]
    const anims = live2dModelPath ? ANIMS_GENTLE : ANIMS_FULL
    const anim = anims[Math.floor(Math.random() * anims.length)]

    setPokeAnim(anim)
    setPokeShake(true)
    setExpression('surprised')
    setTimeout(() => {
      setPokeShake(false)
      setPokeAnim('')
      setExpression('happy')
      setPokeMsg(msg)
      setTimeout(() => {
        setPokeMsg(null)
        setExpression('neutral')
      }, 4000)
    }, 600)
  }, [developerMode, pokeShake, setExpression, live2dModelPath])

  // Video camera toggle
  const handleVideoToggle = async () => {
    if (isVideoActive) {
      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setIsVideoActive(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        streamRef.current = stream
        setIsVideoActive(true)
        // Attach to video element after state update
        setTimeout(() => {
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current
          }
        }, 50)
      } catch {
        showFeedback('无法访问摄像头，请检查权限设置')
      }
    }
  }

  // Capture frame and analyze
  const handleCaptureAnalyze = async () => {
    if (isAnalyzing || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85)

    setCaptureFlash(true)
    setTimeout(() => setCaptureFlash(false), 300)

    setIsAnalyzing(true)

    // Close the video overlay
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setIsVideoActive(false)

    // Add user message indicating video capture
    const userMsg = {
      id: 'u' + Date.now(),
      role: 'user' as const,
      content: '📷 [拍摄了一张画面]',
      timestamp: Date.now(),
    }
    const assistantId = 'a' + Date.now()
    const assistantMsg = {
      id: assistantId,
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now(),
    }

    useAppStore.setState((state) => ({
      chatMessages: [...state.chatMessages, userMsg, assistantMsg],
      expression: 'thinking' as const,
      isTalking: false,
    }))

    try {
      const reply = await analyzeVideoFrame(imageBase64)

      useAppStore.setState((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === assistantId ? { ...msg, content: reply || '抱歉，我无法识别这个画面。' } : msg
        ),
        expression: 'talking' as const,
        isTalking: true,
      }))

      setTimeout(() => {
        useAppStore.setState({
          expression: 'happy',
          isTalking: false,
        })
      }, 1500 + (reply?.length || 0) * 60)
    } catch (err) {
      console.error('Video analyze error:', err)
      useAppStore.setState((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === assistantId ? { ...msg, content: '抱歉，画面分析失败了，请再试一次。' } : msg
        ),
        expression: 'neutral' as const,
        isTalking: false,
      }))
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = {
      startY: event.clientY,
      expanded: sheetExpanded,
    }
  }

  useEffect(() => {
    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragState.current
      if (!drag) return
      const delta = event.clientY - drag.startY

      if (!drag.expanded && delta < -48) {
        setSheetExpanded(true)
      } else if (drag.expanded && delta > 48) {
        setSheetExpanded(false)
      }

      dragState.current = null
    }

    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [sheetExpanded])

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (showTextBar) return
      if (event.deltaY < -18) {
        setSheetExpanded(true)
      } else if (event.deltaY > 18) {
        setSheetExpanded(false)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleWheel)
    }
  }, [showTextBar])

  const hasConversation = chatMessages.length > 0

  return (
    <div className={`avatar-screen ${sheetExpanded ? 'sheet-expanded' : ''}`}>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Video preview overlay */}
      <AnimatePresence>
        {isVideoActive && (
          <motion.div
            className="av-video-overlay"
            initial={{ opacity: 0, scale: 0.9, borderRadius: '50%' }}
            animate={{ opacity: 1, scale: 1, borderRadius: '16px' }}
            exit={{ opacity: 0, scale: 0.9, borderRadius: '50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <video ref={videoRef} autoPlay playsInline muted className="av-video-feed" />
            {captureFlash && <div className="av-video-flash" />}
            <div className="av-video-controls">
              <button className="av-video-close" onClick={handleVideoToggle}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <button className="av-video-capture" onClick={handleCaptureAnalyze} disabled={isAnalyzing}>
                <div className="av-capture-ring">
                  <div className="av-capture-dot" />
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {!sheetExpanded ? (
          <motion.div
            key="home"
            className="av-home-stage"
            initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.94, y: -30, filter: 'blur(6px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onPointerDown={handleSheetPointerDown}
          >
          <div className="avatar-bg-glow" />

          <div
            className={`speech-zone ${developerMode ? 'is-dev-draggable' : ''}`}
            style={{ transform: `translate(${macaronLayout.speechZone.x}px, ${macaronLayout.speechZone.y}px)` }}
            onPointerDown={handleLayoutPointerDown('speechZone')}
          >
            {developerMode && <div className="av-dev-label">聊天气泡区</div>}

            {pokeMsg && (
              <div key="poke-bubble" className="speech-bubble poke-bubble">
                <div className="speech-bubble-content">{pokeMsg}</div>
                <div className="speech-bubble-tail" />
              </div>
            )}

            {!pokeMsg && expression === 'thinking' && (
              <div className="thinking-status" aria-live="polite">
                <span className="thinking-status-text">Macaron 正在想</span>
                <span className="thinking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}

            {!pokeMsg && latestAssistant?.content.trim() && expression !== 'thinking' && (
              <div key={latestAssistant.id} className="speech-bubble">
                <div className="speech-bubble-content">
                  {latestAssistant.content}
                </div>
                <div className="speech-bubble-tail" />
              </div>
            )}
          </div>

          <div
            className={`av-home-avatar ${developerMode ? 'is-dev-draggable' : ''}`}
            style={{ transform: `translateX(-50%) translate(${macaronPosition.home.x}px, ${macaronPosition.home.y}px)` }}
            onClick={handleAvatarClick}
            onPointerDown={handleAvatarPointerDown}
          >
            <div className={`${pokeAnim ? `av-poke av-poke-${pokeAnim}` : ''} ${expression === 'thinking' ? 'av-thinking-loop' : ''}`}>
            {live2dModelPath ? (
              <Live2DAvatar
                modelPath={live2dModelPath}
                expression={expression}
                isTalking={isTalking}
                onExpressionChange={setExpression}
              />
            ) : (
              <MacaronAvatar
                expression={expression}
                isTalking={isTalking}
                onExpressionChange={setExpression}
              />
            )}
            </div>
          </div>

          {/* Bottom dock: video button + expandable text bar */}
          <div
            className={`av-bottom-dock av-bottom-dock-home ${developerMode ? 'is-dev-draggable' : ''}`}
            style={{ transform: `translate(${macaronLayout.bottomDock.x}px, ${macaronLayout.bottomDock.y}px)` }}
            onPointerDown={handleLayoutPointerDown('bottomDock')}
          >
            {developerMode && !showTextBar && <div className="av-dev-label">底部按钮</div>}
            <AnimatePresence mode="wait">
              {showTextBar ? (
                <motion.div
                  key="text-bar"
                  className="av-input-bar"
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                >
                  <div className="av-input-bar-inner">
                    <input
                      ref={inputRef}
                      type="text"
                      className="av-input-field"
                      placeholder="输入消息..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <div className="av-input-actions">
                      <button
                        className="av-input-action-btn"
                        onClick={() => { setShowTextBar(false); setInputText('') }}
                        aria-label="收起"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                      <button className="av-input-send-btn" onClick={handleSend} aria-label="发送" disabled={!inputText.trim()}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="action-btns"
                  className="av-dock-actions"
                  initial={{ opacity: 0, y: 14, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                >
                  <button
                    className="av-dock-item av-dock-expand-btn"
                    onClick={() => setShowTextBar(true)}
                    aria-label="文字输入"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <button
                    className="av-dock-item av-dock-video-btn"
                    onClick={handleVideoToggle}
                    aria-label="视频聊天"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="expanded"
          className="av-expanded-stage"
          initial={{ opacity: 0, y: 60, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 60, filter: 'blur(4px)' }}
          transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        >
          <div className="av-living-zone">
            <div className="avatar-bg-glow avatar-bg-glow-peek" />
            <div
              className={`av-home-avatar av-home-avatar-peek ${developerMode ? 'is-dev-draggable' : ''}`}
              style={{ transform: `scale(.58) translate(${macaronPosition.peek.x}px, ${macaronPosition.peek.y}px)` }}
              onClick={handleAvatarClick}
              onPointerDown={handleAvatarPointerDown}
            >
              <div className={pokeAnim ? `av-poke av-poke-${pokeAnim}` : ''}>
              {live2dModelPath ? (
                <Live2DAvatar
                  modelPath={live2dModelPath}
                  expression={expression}
                  isTalking={isTalking}
                  onExpressionChange={setExpression}
                />
              ) : (
                <MacaronAvatar
                  expression={expression}
                  isTalking={isTalking}
                  onExpressionChange={setExpression}
                />
              )}
              </div>
            </div>
          </div>

          <div className="av-chat-sheet is-expanded" onPointerDown={handleSheetPointerDown}>
            <div className="av-wave-divider" />

            <div className="av-chat-scroll" ref={chatScrollRef}>
              {hasConversation ? (
                chatMessages
                  .filter((message) => message.content.trim() || message.genui)
                  .map((message, index) => (
                    <div key={message.id}>
                      {message.content.trim() && (
                        <div
                          className={`av-chat-row ${message.role === 'user' ? 'is-user' : 'is-assistant'} ${index === 0 ? 'is-first' : ''}`}
                        >
                          <div
                            className={`av-chat-bubble ${index === 0 && message.role === 'assistant' ? 'is-wave-bubble' : ''}`}
                          >
                            {message.content}
                          </div>
                        </div>
                      )}
                      {message.genui && (
                        <div className="av-genui-row">
                          <Suspense fallback={
                            <div className="genui-card-wrapper">
                              <div className="genui-loading">
                                <svg className="genui-loading-spinner" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                                </svg>
                                <span>加载渲染器...</span>
                              </div>
                            </div>
                          }>
                            <GenUICard code={message.genui.code} streaming={message.genui.streaming} />
                          </Suspense>
                        </div>
                      )}
                    </div>
                  ))
              ) : null}

              {searchSteps.length > 0 && (
                <div className="av-search-steps">
                  {searchSteps.map((step) => (
                    <div key={step.id} className={`av-search-step ${step.status === 'done' ? 'is-done' : ''}`}>
                      <span className="av-search-icon">
                        {step.status === 'searching' ? (
                          <svg className="av-search-spinner" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3.5 8.5 6.5 11.5 12.5 5" />
                          </svg>
                        )}
                      </span>
                      <span className="av-search-query">
                        {step.status === 'searching' ? '搜索' : '已搜索'}「{step.query}」
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom dock: input bar always visible in expanded mode */}
          <div
            className={`av-bottom-dock av-bottom-dock-home ${developerMode ? 'is-dev-draggable' : ''}`}
            style={{ transform: `translate(${macaronLayout.bottomDock.x}px, ${macaronLayout.bottomDock.y}px)` }}
            onPointerDown={handleLayoutPointerDown('bottomDock')}
          >
            <div className="av-input-bar">
              <div className="av-input-bar-inner">
                <input
                  ref={expandedInputRef}
                  type="text"
                  className="av-input-field"
                  placeholder="输入消息..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="av-input-actions">
                  <button
                    className="av-input-action-btn"
                    onClick={handleVideoToggle}
                    aria-label="视频聊天"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </button>
                  <button className="av-input-send-btn" onClick={handleSend} aria-label="发送" disabled={!inputText.trim()}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
