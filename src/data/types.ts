export type Expression = 'neutral' | 'happy' | 'surprised' | 'thinking' | 'talking' | 'wink'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  genui?: { code: string; streaming: boolean }
}

export interface SearchStep {
  id: string
  query: string
  status: 'searching' | 'done'
}

export interface TsxPreviewOutput {
  ok: boolean
  code: string
  error?: string
  streaming?: boolean
}

export interface StreamEvent {
  type: 'greeting' | 'greeting-fixup' | 'text' | 'text-delta' | 'tool' | 'tsx-preview' | 'done'
  content?: string
  name?: string
  query?: string
  status?: 'start' | 'done'
  toolCallId?: string
  output?: TsxPreviewOutput
}

export type ActiveTab = 'avatar' | 'topics'
export type TopicSection = 'market' | 'portfolio' | 'calendar' | 'genui' | 'engine'
export type GenUITopicKind = 'market-brief' | 'concert-plan' | 'weekend-pulse' | 'portfolio-check' | 'city-life'
export type TopicTone = 'positive' | 'negative' | 'neutral'

export interface StockIndex {
  name: string
  code: string
  value: number
  change: number
  changePercent: number
  sparkline: number[]
}

export interface PortfolioItem {
  name: string
  symbol: string
  shares: number
  price: number
  change: number
  changePercent: number
  color: string
}

export interface FinancialEvent {
  date: string
  title: string
  tag: string
  impact: 'positive' | 'negative' | 'neutral'
  description: string
}

export interface MarketSector {
  name: string
  change: number
  volume: string
}

export interface DemoDay {
  id: string
  dayIndex: number
  isoDate: string
  dateLabel: string
  weekday: string
  headline: string
  marketCue: string
  chatSeed: string
  news: string[]
  fun: string[]
  signalLabel: string
  signalValue: string
  signalTone: TopicTone
  genuiKind: GenUITopicKind
  accent: 'sage' | 'slate' | 'rose' | 'amber' | 'cyan'
}

export interface GenUIStat {
  id: string
  label: string
  value: string
  caption: string
  tone: TopicTone
}

export interface GenUIAction {
  id: string
  label: string
  activeLabel: string
}

export interface GenUITopicCard {
  id: string
  dayId: string
  createdAt: number
  dateLabel: string
  title: string
  eyebrow: string
  summary: string
  kind: GenUITopicKind
  accent: DemoDay['accent']
  sourceNote: string
  insight: string
  chips: string[]
  timeline: string[]
  stats: GenUIStat[]
  primaryAction: GenUIAction
  secondaryAction: GenUIAction
}

export interface MacaronFaceHandleOffset {
  x: number
  y: number
}

export interface MacaronFaceOffsets {
  leftBrow: MacaronFaceHandleOffset
  rightBrow: MacaronFaceHandleOffset
  leftEye: MacaronFaceHandleOffset
  rightEye: MacaronFaceHandleOffset
  mouth: MacaronFaceHandleOffset
}

export interface MacaronPosition {
  home: { x: number; y: number }
  peek: { x: number; y: number }
}

export interface MacaronLayoutOffsets {
  speechZone: { x: number; y: number }
  bottomDock: { x: number; y: number }
}

// Card Engine: depth-based card generation system
export type AssetDepth = 'shallow' | 'medium' | 'deep'

export interface BehaviorSignal {
  type: 'view' | 'click' | 'linger' | 'dismiss' | 'save'
  description: string
  timestamp: string
}

export interface ConversationSignal {
  quote: string
  inferredIntent: string
  depthContribution: AssetDepth
}

export interface UserEntry {
  id: string
  name: string
  source: 'behavior' | 'conversation' | 'both'
  depth: AssetDepth
  behaviorSignals: BehaviorSignal[]
  conversationSignals: ConversationSignal[]
  depthReason: string
  lastUpdated: string
  associations: string[]
}

export interface ExternalSignal {
  id: string
  source: string
  category: 'news' | 'data' | 'event' | 'sentiment'
  title: string
  relevantEntries: string[]
  timestamp: string
  impact: TopicTone
}

export type DepthCardType =
  | 'news' | 'concept' | 'data-detail' | 'news-impact'
  | 'calendar-event' | 'portfolio-impact' | 'timing-reminder'

export interface DepthCard {
  id: string
  entryName: string
  depth: AssetDepth
  cardType: DepthCardType
  title: string
  body: string
  generationRationale: string
  boundaryCheck: string
  allowed: boolean
  tags: string[]
  accent: 'sage' | 'slate' | 'rose' | 'amber' | 'cyan'
  dataPoints?: { label: string; value: string; tone: TopicTone }[]
}

export type FeedCategory = 'news' | 'data' | 'calendar' | 'learn' | 'portfolio' | 'sectors'

export interface AppState {
  activeTab: ActiveTab
  topicSection: TopicSection

  // Avatar
  expression: Expression
  isTalking: boolean
  chatMessages: ChatMessage[]
  searchSteps: SearchStep[]
  macaronFaceOffsets: MacaronFaceOffsets
  macaronPosition: MacaronPosition
  macaronLayout: MacaronLayoutOffsets
  live2dModelPath: string | null

  // Demo developer mode
  developerMode: boolean
  demoDayIndex: number
  genuiCards: GenUITopicCard[]
  isGeneratingGenUI: boolean
  genuiBuildStep: string | null
  unreadTopicCount: number

  // UI
  feedbackMessage: string | null
}

export interface AppActions {
  setTab: (tab: ActiveTab) => void
  setTopicSection: (section: TopicSection) => void
  setExpression: (exp: Expression) => void
  setTalking: (talking: boolean) => void
  setMacaronFaceOffset: (part: keyof MacaronFaceOffsets, next: MacaronFaceHandleOffset) => void
  setMacaronFaceOffsets: (next: MacaronFaceOffsets) => void
  resetMacaronFaceOffsets: () => void
  setMacaronPosition: (mode: keyof MacaronPosition, pos: { x: number; y: number }) => void
  setMacaronPositions: (next: MacaronPosition) => void
  resetMacaronPosition: () => void
  setMacaronLayout: (part: keyof MacaronLayoutOffsets, pos: { x: number; y: number }) => void
  setMacaronLayoutOffsets: (next: MacaronLayoutOffsets) => void
  resetMacaronLayout: () => void
  setLive2dModelPath: (path: string | null) => void
  sendMessage: (text: string) => void
  loadTopicState: () => Promise<void>
  markTopicsRead: () => Promise<void>
  setDeveloperMode: (enabled: boolean) => void
  toggleDeveloperMode: () => void
  setDemoDay: (dayIndex: number) => void
  generateGenUITopic: () => Promise<void>
  clearGenUITopics: () => void
  showFeedback: (msg: string) => void
}
