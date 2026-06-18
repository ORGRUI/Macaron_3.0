'use client'

import { useEffect, useState, Component } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Music,
  Newspaper,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import { DEMO_DAYS } from '../data/demo-timeline'
import { useAppStore } from '../store/app-store'
import AvatarScreen from './avatar/AvatarScreen'
import TopicSpace from './topics/TopicSpace'
import CardEngine from './topics/CardEngine'
import FeedbackToast from './ui/FeedbackToast'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>😵</div>
          <p style={{ color: '#E8607A', fontWeight: 700, fontSize: '16px' }}>Something went wrong</p>
          <p style={{ color: '#8B8088', fontSize: '13px', lineHeight: 1.5 }}>{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', padding: '12px 24px', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function EnvironmentPanel() {
  const developerMode = useAppStore((s) => s.developerMode)
  const toggleDeveloperMode = useAppStore((s) => s.toggleDeveloperMode)
  const demoDayIndex = useAppStore((s) => s.demoDayIndex)
  const isGeneratingGenUI = useAppStore((s) => s.isGeneratingGenUI)
  const genuiBuildStep = useAppStore((s) => s.genuiBuildStep)
  const chatMessages = useAppStore((s) => s.chatMessages)
  const setDemoDay = useAppStore((s) => s.setDemoDay)
  const generateGenUITopic = useAppStore((s) => s.generateGenUITopic)
  const clearGenUITopics = useAppStore((s) => s.clearGenUITopics)
  const resetMacaronFaceOffsets = useAppStore((s) => s.resetMacaronFaceOffsets)
  const macaronFaceOffsets = useAppStore((s) => s.macaronFaceOffsets)
  const macaronPosition = useAppStore((s) => s.macaronPosition)
  const macaronLayout = useAppStore((s) => s.macaronLayout)
  const resetMacaronPosition = useAppStore((s) => s.resetMacaronPosition)
  const showFeedback = useAppStore((s) => s.showFeedback)
  const live2dModelPath = useAppStore((s) => s.live2dModelPath)
  const setLive2dModelPath = useAppStore((s) => s.setLive2dModelPath)

  const [live2dModels, setLive2dModels] = useState<{ name: string; modelPath: string; icon: string | null }[]>([])
  const [showCardEngine, setShowCardEngine] = useState(false)
  useEffect(() => {
    fetch('/api/live2d-models')
      .then((res) => res.json())
      .then((data) => setLive2dModels(data))
      .catch(() => {})
  }, [])

  const day = DEMO_DAYS[demoDayIndex]
  const recentSummary = chatMessages
    .filter((message) => message.content.trim())
    .slice(-4)
    .map((message) => `${message.role === 'user' ? '你' : 'Macaron'}：${message.content.trim()}`)
    .join(' | ')

  const saveMacaronFaceOffsets = async () => {
    try {
      const [faceRes, posRes, layoutRes] = await Promise.all([
        fetch('/api/macaron-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(macaronFaceOffsets),
        }),
        fetch('/api/macaron-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(macaronPosition),
        }),
        fetch('/api/macaron-layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(macaronLayout),
        }),
      ])
      const faceData = await faceRes.json().catch(() => ({}))
      const posData = await posRes.json().catch(() => ({}))
      const layoutData = await layoutRes.json().catch(() => ({}))
      if (!faceRes.ok) {
        throw new Error(faceData.error || '五官保存失败')
      }
      if (!posRes.ok) {
        throw new Error(posData.error || '位置保存失败')
      }
      if (!layoutRes.ok) {
        throw new Error(layoutData.error || '布局保存失败')
      }
      showFeedback('五官、位置与布局已保存到项目配置')
    } catch (err: any) {
      showFeedback(err.message || '保存失败')
    }
  }

  return (
    <div className={`env-panel ${developerMode ? 'open' : ''}`}>
      <button className={`env-toggle ${developerMode ? 'active' : ''}`} onClick={toggleDeveloperMode}>
        <Code2 size={14} />
        DEV
      </button>

      {developerMode && (
        <div className="env-body">
          <div className="env-head">
            <div>
              <div className="env-kicker">环境模拟</div>
              <div className="env-date">{day.dateLabel} · {day.weekday}</div>
            </div>
            <div className="env-step">{isGeneratingGenUI ? genuiBuildStep : '待触发'}</div>
          </div>

          <div className="env-slider-row">
            <button className="env-icon-btn" disabled={demoDayIndex === 0} onClick={() => setDemoDay(demoDayIndex - 1)} aria-label="前一天">
              <ChevronLeft size={16} />
            </button>
            <input
              type="range"
              min="0"
              max={DEMO_DAYS.length - 1}
              value={demoDayIndex}
              onChange={(event) => setDemoDay(Number(event.target.value))}
              className="env-range"
              aria-label="模拟日期"
            />
            <button className="env-icon-btn" disabled={demoDayIndex === DEMO_DAYS.length - 1} onClick={() => setDemoDay(demoDayIndex + 1)} aria-label="后一天">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="env-days">
            {DEMO_DAYS.map((item) => (
              <button
                key={item.id}
                className={`env-day ${item.dayIndex === demoDayIndex ? 'active' : ''}`}
                onClick={() => setDemoDay(item.dayIndex)}
              >
                <span>{item.dateLabel}</span>
                <small>{item.weekday}</small>
              </button>
            ))}
          </div>

          <div className="env-context">
            <div className="env-context-row">
              <Newspaper size={14} />
              <span>{day.headline}</span>
            </div>
            <div className="env-context-row">
              <Music size={14} />
              <span>{day.fun[0]} · {day.fun[1]}</span>
            </div>
            <div className="env-context-row">
              <Sparkles size={14} />
              <span>{recentSummary || day.chatSeed}</span>
            </div>
          </div>

          <div className="env-actions">
            <button className="env-generate-btn" disabled={isGeneratingGenUI} onClick={() => void generateGenUITopic()}>
              <WandSparkles size={16} />
              {isGeneratingGenUI ? '生成中' : '触发 GenUI 推送'}
            </button>
            <button className="env-clear-btn" onClick={clearGenUITopics} aria-label="清空推送">
              <Trash2 size={15} />
            </button>
            <button className="env-clear-btn" onClick={() => void saveMacaronFaceOffsets()} aria-label="保存五官、位置与布局">
              <span style={{ fontWeight: 900, fontSize: 14 }}>↧</span>
            </button>
          </div>

          {live2dModels.length > 0 && (
            <div className="env-model-picker">
              <div className="env-kicker">虚拟形象</div>
              <div className="env-model-list">
                <button
                  className={`env-model-btn ${!live2dModelPath ? 'active' : ''}`}
                  onClick={() => setLive2dModelPath(null)}
                >
                  <span className="env-model-icon">🎨</span>
                  <span>Sprite</span>
                </button>
                {live2dModels.map((m) => (
                  <button
                    key={m.modelPath}
                    className={`env-model-btn ${live2dModelPath === m.modelPath ? 'active' : ''}`}
                    onClick={() => setLive2dModelPath(m.modelPath)}
                  >
                    {m.icon ? (
                      <img src={m.icon} className="env-model-icon-img" alt={m.name} />
                    ) : (
                      <span className="env-model-icon">🧸</span>
                    )}
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="env-card-engine-section">
            <button
              className={`env-card-engine-toggle ${showCardEngine ? 'active' : ''}`}
              onClick={() => setShowCardEngine(!showCardEngine)}
            >
              <span>🧠</span>
              <span>卡片生成引擎</span>
              <ChevronRight size={13} className={`env-ce-chevron ${showCardEngine ? 'open' : ''}`} />
            </button>
            {showCardEngine && (
              <div className="env-card-engine-body">
                <CardEngine />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AppInner() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setTab = useAppStore((s) => s.setTab)
  const unreadTopicCount = useAppStore((s) => s.unreadTopicCount)
  const loadTopicState = useAppStore((s) => s.loadTopicState)

  const [clock, setClock] = useState('')
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null)
  const hasUnreadTopics = unreadTopicCount > 0

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      setClock(`${h}:${m}`)
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    void loadTopicState()
  }, [loadTopicState])

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setSwipeStart({ x: event.clientX, y: event.clientY })
  }

  const handleStagePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeStart) return
    const dx = event.clientX - swipeStart.x
    const dy = event.clientY - swipeStart.y
    setSwipeStart(null)

    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return

    if (dx < 0 && activeTab === 'avatar') {
      setTab('topics')
    } else if (dx > 0 && activeTab === 'topics') {
      setTab('avatar')
    }
  }

  return (
    <div className="app-shell">
      <EnvironmentPanel />

      <div className="phone">
        <div className="notch" />
        <div className="statusbar">
          <span>{clock}</span>
          <span className="statusbar-icons">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 6l4 4 4-4M5 6l4 4 4-4M9 6l4 4 4-4M17 6l4 4 4-4" /><path d="M5 10v10M12 6v14" /></svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="6" width="18" height="12" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="4" y="9" width="12" height="6" rx="1" fill="currentColor" opacity="0.7" /><rect x="20" y="10" width="3" height="4" rx="1" fill="currentColor" /></svg>
          </span>
        </div>

        <div className="stage" onPointerDown={handleStagePointerDown} onPointerUp={handleStagePointerUp}>
          {/* Avatar Screen */}
          <motion.div
            className="screen"
            style={{ display: 'flex' }}
            animate={{
              x: activeTab === 'avatar' ? '0%' : '-35%',
              scale: activeTab === 'avatar' ? 1 : 0.88,
              filter: activeTab === 'avatar' ? 'blur(0px)' : 'blur(6px)',
              opacity: activeTab === 'avatar' ? 1 : 0.3,
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            <div style={{ pointerEvents: activeTab === 'avatar' ? 'auto' : 'none', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <AvatarScreen />
            </div>
          </motion.div>

          {/* Topics Screen */}
          <motion.div
            className="screen"
            style={{ display: 'flex' }}
            animate={{
              x: activeTab === 'topics' ? '0%' : '100%',
              scale: activeTab === 'topics' ? 1 : 1.04,
              opacity: activeTab === 'topics' ? 1 : 0,
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            <div style={{ pointerEvents: activeTab === 'topics' ? 'auto' : 'none', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <TopicSpace />
            </div>
          </motion.div>

          {/* Shimmer Peek Strip */}
          <AnimatePresence>
            {activeTab === 'avatar' && (
              <div key="peek-anchor" className="peek-strip-anchor">
                <motion.div
                  className={`peek-strip ${hasUnreadTopics ? 'has-unread' : 'is-read'}`}
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 60, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.4 }}
                  onClick={() => setTab('topics')}
                  aria-label={hasUnreadTopics ? `打开话题，${unreadTopicCount} 条未读` : '打开话题'}
                >
                  <div className="peek-shimmer-wrap">
                    <div className="peek-shimmer-glow" />
                  </div>
                  <div className="peek-strip-body">
                    {hasUnreadTopics ? (
                      <>
                        <span className="peek-card-stack" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                        <span className="peek-orbit-dot" aria-hidden="true" />
                        <span className="peek-strip-text">
                          <span>话题</span>
                          <small>{unreadTopicCount}</small>
                        </span>
                        <ChevronLeft size={12} strokeWidth={2.6} className="peek-strip-chevron" />
                      </>
                    ) : (
                      <span className="peek-resting-mark" aria-hidden="true">
                        <span />
                      </span>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <FeedbackToast />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
