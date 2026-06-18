import { create } from 'zustand'
import type { AppState, AppActions, ChatMessage, Expression, SearchStep } from '../data/types'
import { streamChatEvents } from '../api/chat'
import { fetchTopicState, markTopicsRead as markTopicsReadApi } from '../api/topic-state'
import { CHAT_RESPONSES, CHAT_TRIGGERS } from '../data/finance'
import { DEMO_DAYS, buildDemoGenUICard } from '../data/demo-timeline'
import type { MacaronFaceOffsets, MacaronPosition, MacaronLayoutOffsets } from '../data/types'
import savedMacaronFaceOffsets from '../data/macaron-face.json'
import savedMacaronPosition from '../data/macaron-position.json'
import savedMacaronLayout from '../data/macaron-layout.json'

function matchCategory(text: string): string {
  const lower = text.toLowerCase()
  for (const [category, triggers] of Object.entries(CHAT_TRIGGERS)) {
    if (triggers.some((t) => lower.includes(t))) return category
  }
  return 'fallback'
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function revealMessageText(
  set: (partial: Partial<AppState & AppActions> | ((state: AppState & AppActions) => Partial<AppState & AppActions>)) => void,
  msgId: string,
  full: string
) {
  const revealMs = 18
  const charsPerTick = 2
  let p = 0
  if (!full) return

  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      p = Math.min(p + charsPerTick, full.length)
      set((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === msgId ? { ...msg, content: full.slice(0, p) } : msg
        ),
      }))
      if (p >= full.length) {
        clearInterval(timer)
        resolve()
      }
    }, revealMs)
  })
}

const EXPRESSION_AFTER_TALK: Expression[] = ['happy', 'neutral', 'happy']
const GENUI_BUILD_STEPS = ['读取聊天摘要', '合成 7 日上下文', '生成 GenUI 结构', '推送到话题空间']
function getInitialMacaronFaceOffsets(): MacaronFaceOffsets {
  if (typeof window !== 'undefined') {
    const runtimeValue = (window as any).__MACARON_FACE_OFFSETS__
    if (runtimeValue) {
      return runtimeValue as MacaronFaceOffsets
    }
  }

  return savedMacaronFaceOffsets as MacaronFaceOffsets
}

const DEFAULT_MACARON_POSITION: MacaronPosition = savedMacaronPosition as MacaronPosition

function getInitialMacaronPosition(): MacaronPosition {
  if (typeof window !== 'undefined') {
    const runtimeValue = (window as any).__MACARON_POSITION__
    if (runtimeValue) {
      return runtimeValue as MacaronPosition
    }
  }

  return DEFAULT_MACARON_POSITION
}

const DEFAULT_MACARON_LAYOUT: MacaronLayoutOffsets = savedMacaronLayout as MacaronLayoutOffsets

function getInitialMacaronLayout(): MacaronLayoutOffsets {
  if (typeof window !== 'undefined') {
    const runtimeValue = (window as any).__MACARON_LAYOUT__
    if (runtimeValue) {
      return runtimeValue as MacaronLayoutOffsets
    }
  }

  return DEFAULT_MACARON_LAYOUT
}

function buildConversationSummary(messages: ChatMessage[]): { text: string; messageCount: number } | null {
  const recentMessages = messages
    .filter((message) => message.content.trim())
    .slice(-8)

  if (recentMessages.length === 0) return null

  const lines = recentMessages.map((message) => {
    const speaker = message.role === 'user' ? '你' : 'Macaron'
    const content = message.content.replace(/\s+/g, ' ').trim()
    const shortened = content.length > 28 ? `${content.slice(0, 28)}...` : content
    return `${speaker}提到：${shortened}`
  })

  return {
    text: lines.join('；'),
    messageCount: recentMessages.length,
  }
}

export const useAppStore = create<AppState & AppActions>()((set, get) => ({
  activeTab: 'avatar',
  topicSection: 'market',
  expression: 'neutral',
  isTalking: false,
  chatMessages: [],
  searchSteps: [],
  macaronFaceOffsets: getInitialMacaronFaceOffsets(),
  macaronPosition: getInitialMacaronPosition(),
  macaronLayout: getInitialMacaronLayout(),
  live2dModelPath: null,
  developerMode: false,
  demoDayIndex: 0,
  genuiCards: [],
  isGeneratingGenUI: false,
  genuiBuildStep: null,
  unreadTopicCount: 3,
  feedbackMessage: null,

  setTab: (tab) => {
    set((state) => ({
      activeTab: tab,
      unreadTopicCount: tab === 'topics' ? 0 : state.unreadTopicCount,
    }))
    if (tab === 'topics') {
      void get().markTopicsRead()
    }
  },

  setTopicSection: (section) => set({ topicSection: section }),

  setExpression: (exp) => set({ expression: exp }),

  setTalking: (talking) => set({ isTalking: talking }),

  loadTopicState: async () => {
    try {
      const topicState = await fetchTopicState()
      set({ unreadTopicCount: topicState.unreadCount })
    } catch (err) {
      console.error('Failed to load topic state:', err)
    }
  },

  markTopicsRead: async () => {
    set({ unreadTopicCount: 0 })
    try {
      const topicState = await markTopicsReadApi()
      set({ unreadTopicCount: topicState.unreadCount })
    } catch (err) {
      console.error('Failed to mark topics as read:', err)
    }
  },

  setMacaronFaceOffset: (part, next) => set((state) => ({
    macaronFaceOffsets: {
      ...state.macaronFaceOffsets,
      [part]: next,
    },
  })),

  setMacaronFaceOffsets: (next) => set({
    macaronFaceOffsets: next,
  }),

  resetMacaronFaceOffsets: () => set({
    macaronFaceOffsets: savedMacaronFaceOffsets as MacaronFaceOffsets,
    feedbackMessage: '五官位置已重置',
  }),

  setMacaronPosition: (mode, pos) => set((state) => ({
    macaronPosition: {
      ...state.macaronPosition,
      [mode]: pos,
    },
  })),

  setMacaronPositions: (next) => set({
    macaronPosition: next,
  }),

  resetMacaronPosition: () => set({
    macaronPosition: DEFAULT_MACARON_POSITION,
    feedbackMessage: 'Macaron 位置已重置',
  }),

  setMacaronLayout: (part, pos) => set((state) => ({
    macaronLayout: {
      ...state.macaronLayout,
      [part]: pos,
    },
  })),

  setMacaronLayoutOffsets: (next) => set({
    macaronLayout: next,
  }),

  resetMacaronLayout: () => set({
    macaronLayout: DEFAULT_MACARON_LAYOUT,
    feedbackMessage: '布局位置已重置',
  }),

  setLive2dModelPath: (path) => set({
    live2dModelPath: path,
    feedbackMessage: path ? `已切换到 Live2D 模型` : '已切换到 Sprite 形象',
  }),

  sendMessage: async (text) => {
    if (!text.trim()) return

    const userMsg: ChatMessage = {
      id: 'u' + Date.now(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }

    const history = get().chatMessages
    const greetingId = 'a' + Date.now()
    const replyId = 'r' + Date.now()

    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg],
      searchSteps: [],
      expression: 'thinking',
      isTalking: false,
    }))

    try {
      let greetingText = ''
      let replyText = ''
      let hasGreeting = false
      let hasReply = false
      let hasGenui = false

      await streamChatEvents(text.trim(), history, (event) => {
        switch (event.type) {
          case 'greeting': {
            greetingText = event.content || ''
            hasGreeting = true
            set((state) => ({
              chatMessages: [...state.chatMessages, {
                id: greetingId,
                role: 'assistant' as const,
                content: greetingText,
                timestamp: Date.now(),
              }],
              expression: 'talking',
              isTalking: true,
            }))
            break
          }
          case 'greeting-fixup': {
            // Agent 1 initially streamed content as text-delta (thought it was direct reply),
            // but then detected handoff. Convert the in-progress reply into a greeting.
            const greetingContent = event.content || ''
            greetingText = greetingContent
            hasGreeting = true

            set((state) => ({
              chatMessages: state.chatMessages.map((msg) =>
                msg.id === replyId
                  ? { ...msg, id: greetingId, content: greetingContent }
                  : msg
              ),
              expression: 'talking',
              isTalking: true,
            }))
            // Reset reply state so Agent 2 response creates a new message
            hasReply = false
            replyText = ''
            break
          }
          case 'tool': {
            if (event.status === 'start') {
              set((state) => ({
                expression: 'thinking',
                isTalking: false,
                searchSteps: [...state.searchSteps, {
                  id: 's' + Date.now() + Math.random(),
                  query: event.query || '',
                  status: 'searching',
                }],
              }))
            } else if (event.status === 'done') {
              set((state) => ({
                searchSteps: state.searchSteps.map((step) =>
                  step.query === event.query ? { ...step, status: 'done' as const } : step
                ),
              }))
            }
            break
          }
          case 'text-delta': {
            const delta = event.content || ''
            if (!delta) break
            replyText += delta

            // Create reply message on first delta, then append
            if (!hasReply) {
              hasReply = true
              set((state) => ({
                chatMessages: [...state.chatMessages, {
                  id: replyId,
                  role: 'assistant' as const,
                  content: delta,
                  timestamp: Date.now(),
                }],
                expression: 'talking',
                isTalking: true,
                searchSteps: [],
              }))
            } else {
              set((state) => ({
                chatMessages: state.chatMessages.map((msg) =>
                  msg.id === replyId ? { ...msg, content: msg.content + delta } : msg
                ),
              }))
            }
            break
          }
          case 'text': {
            // Full text (legacy/fallback) — used when server sends complete text at once
            const fullText = event.content || ''
            if (!fullText) break
            replyText = fullText

            if (!hasReply) {
              hasReply = true
              set((state) => ({
                chatMessages: [...state.chatMessages, {
                  id: replyId,
                  role: 'assistant' as const,
                  content: fullText,
                  timestamp: Date.now(),
                }],
                expression: 'talking',
                isTalking: true,
                searchSteps: [],
              }))
            } else {
              set((state) => ({
                chatMessages: state.chatMessages.map((msg) =>
                  msg.id === replyId ? { ...msg, content: fullText } : msg
                ),
              }))
            }
            break
          }
          case 'tsx-preview': {
            if (event.output?.ok && event.output.code) {
              hasGenui = true
              set((state) => {
                const replyExists = state.chatMessages.some((msg) => msg.id === replyId)
                if (!replyExists) {
                  hasReply = true
                  return {
                    chatMessages: [...state.chatMessages, {
                      id: replyId,
                      role: 'assistant' as const,
                      content: '',
                      timestamp: Date.now(),
                      genui: { code: event.output!.code, streaming: event.output!.streaming ?? false },
                    }],
                    expression: 'thinking',
                    isTalking: false,
                  }
                }
                return {
                  chatMessages: state.chatMessages.map((msg) =>
                    msg.id === replyId
                      ? { ...msg, genui: { code: event.output!.code, streaming: event.output!.streaming ?? false } }
                      : msg
                  ),
                }
              })
            }
            break
          }
          case 'done': {
            break
          }
        }
      })

      if (!replyText && !greetingText && !hasGenui) {
        throw new Error('Empty reply')
      }

      // Reset expression after stream finishes
      const totalLen = greetingText.length + replyText.length
      setTimeout(() => {
        set({
          searchSteps: [],
          expression: pickRandom(EXPRESSION_AFTER_TALK),
          isTalking: false,
        })
      }, Math.min(1500 + totalLen * 20, 5000))
    } catch (err) {
      console.error('Chat error:', err)

      const category = matchCategory(text)
      const responses = CHAT_RESPONSES[category] || CHAT_RESPONSES.fallback
      const fallbackReply = pickRandom(responses)

      set((state) => ({
        searchSteps: [],
        chatMessages: [...state.chatMessages, {
          id: replyId,
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
        }],
        expression: 'talking',
        isTalking: true,
      }))
      await revealMessageText(set, replyId, fallbackReply)

      setTimeout(() => {
        set({
          expression: pickRandom(EXPRESSION_AFTER_TALK),
          isTalking: false,
        })
      }, 1500 + fallbackReply.length * 60)
    }
  },

  setDeveloperMode: (enabled) => set({ developerMode: enabled }),

  toggleDeveloperMode: () => set((state) => ({
    developerMode: !state.developerMode,
    feedbackMessage: !state.developerMode ? '开发者模式已开启' : '开发者模式已关闭',
  })),

  setDemoDay: (dayIndex) => {
    const boundedDay = Math.max(0, Math.min(DEMO_DAYS.length - 1, dayIndex))
    const day = DEMO_DAYS[boundedDay]
    set({
      demoDayIndex: boundedDay,
      feedbackMessage: `已切换到 ${day.dateLabel} ${day.weekday}`,
    })
  },

  generateGenUITopic: async () => {
    const { demoDayIndex, isGeneratingGenUI, chatMessages } = get()
    if (isGeneratingGenUI) return

    const day = DEMO_DAYS[demoDayIndex]
    const conversationSummary = buildConversationSummary(chatMessages)
    set({
      isGeneratingGenUI: true,
      genuiBuildStep: GENUI_BUILD_STEPS[0],
      activeTab: 'topics',
      topicSection: 'genui',
      unreadTopicCount: 0,
      feedbackMessage: '开始生成 GenUI 话题',
    })

    for (let i = 1; i < GENUI_BUILD_STEPS.length; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 380))
      set({ genuiBuildStep: GENUI_BUILD_STEPS[i] })
    }

    const card = buildDemoGenUICard(day, conversationSummary || undefined)
    set((state) => ({
      genuiCards: [card, ...state.genuiCards.filter((item) => item.dayId !== day.id)].slice(0, 7),
      isGeneratingGenUI: false,
      genuiBuildStep: null,
      activeTab: 'topics',
      topicSection: 'genui',
      unreadTopicCount: 0,
      feedbackMessage: 'GenUI 已推送到话题空间',
    }))
  },

  clearGenUITopics: () => set({
    genuiCards: [],
    unreadTopicCount: 0,
    feedbackMessage: '已清空 GenUI 推送',
  }),

  showFeedback: (msg) => set({ feedbackMessage: msg }),
}))
