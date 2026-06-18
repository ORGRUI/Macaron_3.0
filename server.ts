import { readFileSync, existsSync, statSync, writeFileSync, readdirSync } from 'fs'
import { join, extname } from 'path'

const ENV_PATH = join(import.meta.dir, '.env')

function loadDotEnv(path: string) {
  if (!existsSync(path)) return

  const content = readFileSync(path, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = line.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

loadDotEnv(ENV_PATH)

const PORT = 3000
const DIST_DIR = join(import.meta.dir, 'dist')
const LIVE2D_MODELS_DIR = join(import.meta.dir, 'public/live2d-models')
const MACARON_FACE_PATH = join(import.meta.dir, 'src/data/macaron-face.json')
const MACARON_POSITION_PATH = join(import.meta.dir, 'src/data/macaron-position.json')
const MACARON_LAYOUT_PATH = join(import.meta.dir, 'src/data/macaron-layout.json')
const TOPIC_STATE_PATH = join(import.meta.dir, 'src/data/topic-state.json')
const DISSECTION_CONFIG_PATH = join(import.meta.dir, 'src/data/dissection-config.json')

// ── Agent 1: gemini-3.5-flash (Router / Default Chat via Vertex AI) ──
const AGENT1_API_KEY = process.env.AGENT1_API_KEY || ''
const AGENT1_MODEL = process.env.AGENT1_MODEL || 'gemini-3.5-flash'

// ── Agent 2: gpt-5.4 (Search Agent via Azure Responses API) ─────
const AZURE_ENDPOINT =
  process.env.AZURE_ENDPOINT ||
  'https://macaron-gpt.cognitiveservices.azure.com/openai/responses?api-version=2025-04-01-preview'
const AZURE_API_KEY = process.env.AZURE_API_KEY || ''
const AZURE_MODEL = process.env.AZURE_MODEL || 'gpt-5.4'

// ── Exa Search API ──────────────────────────────────────────────
const EXA_API_KEY = process.env.EXA_API_KEY || ''
const EXA_ENDPOINT = 'https://api.exa.ai/search'
const AGENT2_MAX_TOOL_ROUNDS = 5

// Gemini config (used for vision; falls back to Agent 1 key)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || AGENT1_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

interface TopicState {
  unreadCount: number
  lastReadAt: string | null
  updatedAt: string | null
}

const DEFAULT_TOPIC_STATE: TopicState = {
  unreadCount: 3,
  lastReadAt: null,
  updatedAt: null,
}

function readTopicState(): TopicState {
  try {
    if (!existsSync(TOPIC_STATE_PATH)) return DEFAULT_TOPIC_STATE
    const parsed = JSON.parse(readFileSync(TOPIC_STATE_PATH, 'utf-8')) as Partial<TopicState>
    return {
      unreadCount: Math.max(0, Math.round(Number(parsed.unreadCount) || 0)),
      lastReadAt: typeof parsed.lastReadAt === 'string' ? parsed.lastReadAt : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    }
  } catch (err) {
    console.error('Topic state read error:', err)
    return DEFAULT_TOPIC_STATE
  }
}

function writeTopicState(state: TopicState) {
  writeFileSync(TOPIC_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf-8')
}

function requireConfig(name: string, value: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function buildHandoffGreeting(
  messages: Array<{ role: string; content: string }>,
  targetAgent: string,
  reason?: string,
  context?: string
): string {
  const latestUserMessage =
    [...messages].reverse().find((msg) => msg.role === 'user' && msg.content.trim())?.content.trim() || ''
  const primarySource = latestUserMessage || context || reason || ''
  const topicBase = primarySource.replace(/\s+/g, ' ').trim()
  const cleanedTopic = topicBase
    .replace(/^(帮我|麻烦你|请|请你|能不能|可以|给我|想问下)\s*/u, '')
    .replace(/^(查一下|查查|搜一下|搜搜|看一下|看看|查询|做一个|画一个|展示一下|来一个)\s*/u, '')
    .replace(/[？?！!。,.，、]+$/u, '')
    .trim()
  const topic = cleanedTopic.slice(0, 24)

  if (targetAgent === 'genui') {
    if (!topic) return '好嘞，让我来给你搭一个~'
    const genuiTemplates = [
      `${topic}——交给我来画！`,
      `${topic}，马上给你安排上~`,
      `收到，${topic}这就开工！`,
      `${topic}来咯，等我一下~`,
    ]
    return genuiTemplates[Math.floor(Math.random() * genuiTemplates.length)]
  }

  // search fallback
  if (!topic) return '让我去翻翻最新消息~'

  const searchTemplates = [
    `${topic}，我去看看最新的~`,
    `${topic}，等我一下~`,
    `${topic}，马上去瞄一眼~`,
    `让我看看${topic}~`,
  ]
  return searchTemplates[Math.floor(Math.random() * searchTemplates.length)]
}

// ── System Prompts ──────────────────────────────────────────────
const AGENT1_SYSTEM_PROMPT = `你是 Macaron，一个可爱、聪明的 AI 虚拟助手。你的外形是一个紫发动漫少女。
你的特长是金融投资分析，尤其是股票和基金。你说话简洁友好，偶尔带一点俏皮。
回复尽量简短（1-3句话），除非用户要求详细解释。用中文回答。

你有一个工具叫 handoff，用来把对话交给更强的专业模块处理。

调用 handoff 的场景：
1. 需要实时数据（天气、股价、新闻、比分等）→ target_agent: “search”
2. 用户有搜索意图（”查一下””最新的”等）→ target_agent: “search”
3. 你不确定是否是最新事实 → target_agent: “search”
4. 用户要求制作卡片、图表、可视化、小工具 → target_agent: “genui”
5. 用户说”做一个””画一个””展示””可视化”等 → target_agent: “genui”
6. 回答适合用视觉化展示（对比表、数据卡片等）→ target_agent: “genui”

调用 handoff 时，在 greeting 参数中写一句简短的过渡语。要求：
- 像朋友聊天一样自然地接话
- 绝对不要复述用户的问题（比如用户问天气，不要说”天气，我去查查”）
- 不要用固定句式（禁止”我去查查””我去瞄一眼””让我搜一下””等我一下”这类套路）
- 可以表达你自己的好奇、兴趣、期待，比如：
  · “诶这个我也好奇，稍等~”
  · “好问题！让我翻翻看”
  · “哦？我正好想了解一下”
  · “嗯嗯，我去瞅瞅最新的消息”
  · “来来来，我给你整一个~”（genui场景）
- 每次都要不一样，简短就好，一句话

不调用 handoff 的场景：纯闲聊、常识、概念解释等不需要实时数据或可视化的问题。
绝对不要编造实时数据。`

const AGENT2_SYSTEM_PROMPT = `你是 Macaron 的搜索模块。用 web_search 工具搜索后回答用户。

回复规则：
- 用中文，简洁直接，不要客套废话
- 用要点/列表呈现核心信息，不要写长段落
- 末尾一行注明数据来源（如"来源：中国天气网"）
- 保持 Macaron 的风格：友好，偶尔俏皮，但信息优先
- 不要问用户"还需要什么"，不要列出后续选项`

// ── GenUI Agent Config ─────────────────────────────────────────
const GENUI_SYSTEM_PROMPT = `你是 Macaron 的可视化卡片生成模块。你的任务是用 display_tsx 工具生成紧凑、美观的 React TSX 卡片组件，嵌入在聊天中展示给用户。

TSX 规则：
- 必须有 export default function App()
- 只能 import from "react"（如 useState, useEffect, useMemo, useCallback）
- 禁止使用 React.use()、useFormStatus 等实验性 API
- 用 Tailwind CSS 类名做样式（如 "flex items-center gap-2 p-4 rounded-xl bg-white"）
- 保持紧凑，适合嵌入聊天（不要做全页面布局）
- 组件宽度 100%，高度自适应
- 不要超过 150 行
- 用中文标签，保持友好风格
- 每个按钮/控件必须有实际功能（用 useState 管理交互状态）
- 使用柔和的颜色搭配，避免大面积鲜艳色块
- 可以用 emoji 作为图标

代码结构要求（严格遵守，否则会导致渲染崩溃）：
- 数据直接写在 return 的 JSX 里，或者用 const 数组在 App 函数内最顶部声明
- 禁止用 const { a, b } = obj 解构对象，一律用 obj.a、obj.b 点号访问
- 禁止把对象/数组直接放在 JSX 中渲染，如 {item} 或 {data}。必须访问具体属性，如 {item.name}
- .map() 回调必须返回 JSX 元素，且必须有 key，回调体内直接用参数点属性（如 item.temp），不要再解构
- 错误示例：items.map(({name, temp}) => ...)  ← 流式渲染中会崩溃
- 正确示例：items.map((item) => <div key={item.name}>{item.temp}°C</div>)

你会收到用户的对话上下文，根据对话内容生成合适的卡片。如果用户要求的内容不适合卡片展示，你也可以在 display_tsx 之外回复文本解释。`

const DISPLAY_TSX_TOOL = {
  type: 'function' as const,
  name: 'display_tsx',
  description: '生成一个内嵌卡片 React 组件。输出完整 TSX 模块，必须 export default function App。',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: '完整的 TSX 模块代码。必须 export default function App()。',
      },
    },
    required: ['code'],
  },
}

// ── Tool Definitions ────────────────────────────────────────────
const HANDOFF_FUNCTION = {
  name: 'handoff',
  description: '将对话转交给指定的专业 Agent 继续处理。',
  parameters: {
    type: 'object',
    properties: {
      target_agent: {
        type: 'string',
        enum: ['search', 'genui'],
        description: '目标 Agent。search = 联网搜索 Agent, genui = 可视化卡片生成 Agent',
      },
      greeting: {
        type: 'string',
        description: '给用户的过渡语（一句话）。要求自然、不重复用户原话。',
      },
      reason: {
        type: 'string',
        description: '转交原因',
      },
      context: {
        type: 'string',
        description: '传递给目标 Agent 的补充上下文或搜索方向',
      },
    },
    required: ['target_agent', 'greeting', 'reason'],
  },
}

const WEB_SEARCH_TOOL = {
  type: 'function' as const,
  name: 'web_search',
  description: '联网搜索，返回相关网页内容。用于查找实时信息、新闻、数据等。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询词',
      },
    },
    required: ['query'],
  },
}

const VISION_PROMPT = `你是 Macaron，一个可爱的 AI 助手。用户通过摄像头让你看了一些东西。
请仔细观察画面内容，用友好、简洁的方式描述你看到的，并给出有趣的评论。
回复用中文，控制在2-4句话。`

function extractResponseText(data: any): string {
  let reply = ''

  if (data.output) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const c of item.content) {
          if (c.type === 'output_text') {
            reply += c.text
          }
        }
      }
    }
  }

  if (!reply && data.output_text) {
    reply = data.output_text
  }

  return reply
}

function parseSseEvent(block: string): any | null {
  const eventType = block
    .split('\n')
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim()

  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim()

  if (!data || data === '[DONE]') return null
  const parsed = JSON.parse(data)
  if (eventType && !parsed.type) {
    parsed.type = eventType
  }
  return parsed
}

// ── Handoff Helper Functions ────────────────────────────────────

function createTextStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chars = [...text]
  let idx = 0
  const chunkLen = 4

  return new ReadableStream({
    async pull(controller) {
      if (idx >= chars.length) {
        controller.close()
        return
      }
      const end = Math.min(idx + chunkLen, chars.length)
      controller.enqueue(encoder.encode(chars.slice(idx, end).join('')))
      idx = end
      await new Promise((r) => setTimeout(r, 28))
    },
  })
}

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const

type EventEmitter = (event: Record<string, unknown>) => void

async function handleStreamingChat(
  messages: Array<{ role: string; content: string }>
): Promise<Response> {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // Phase 1: Stream Agent 1 (gpt-4o) to determine routing
        // Content deltas are forwarded immediately as text-delta.
        // If handoff is detected, those text-deltas were actually greeting text.
        let directDeltasSent = false
        const result = await callAgent1Streaming(messages, (delta) => {
          directDeltasSent = true
          send({ type: 'text-delta', content: delta })
        })

        if (result.type === 'text') {
          // Direct text already sent via text-delta callback
          send({ type: 'done' })
          controller.close()
          return
        }

        // Phase 2: Handoff detected
        if (directDeltasSent) {
          // Some content was already sent as text-delta (it was the greeting).
          // Tell frontend to convert accumulated text into greeting.
          send({ type: 'greeting-fixup', content: result.greeting || '' })
        } else if (result.greeting) {
          send({ type: 'greeting', content: result.greeting })
        }

        if (result.targetAgent === 'genui') {
          console.log(`[Handoff] GenUI generation starting`)
          await callGenUIAgent(messages, send)
        } else {
          // search or unknown → Agent 2 streaming search
          await callAgent2Streaming(messages, result.reason || '', result.context, send)
        }

        send({ type: 'done' })
        controller.close()
      } catch (err: any) {
        console.error('Streaming chat error:', err)
        send({ type: 'text-delta', content: '抱歉，处理请求时出了点问题。' })
        send({ type: 'done' })
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: STREAM_HEADERS })
}

async function executeExaSearch(query: string): Promise<string> {
  try {
    const exaApiKey = requireConfig('EXA_API_KEY', EXA_API_KEY)
    const res = await fetch(EXA_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': exaApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        type: 'neural',
        numResults: 5,
        contents: { text: true },
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown Exa error')
      console.error('[Exa] Search error:', res.status, errText)
      return `搜索失败 (${res.status})`
    }

    const data = await res.json() as {
      results: Array<{ title: string; url: string; text: string }>
    }

    if (!data.results || data.results.length === 0) {
      return '没有找到相关搜索结果。'
    }

    return data.results
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.text?.slice(0, 800) || '(无内容)'}`)
      .join('\n\n')
  } catch (err: any) {
    console.error('[Exa] Search exception:', err.message)
    return `搜索出错: ${err.message}`
  }
}

// ── Shared SSE stream reader ─────────────────────────────────
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (parsed: any) => void | 'break'
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let sseBuffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    sseBuffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
    const blocks = sseBuffer.split('\n\n')
    sseBuffer = blocks.pop() || ''

    for (const block of blocks) {
      let parsed: any
      try { parsed = parseSseEvent(block) } catch { continue }
      if (!parsed) continue
      if (onEvent(parsed) === 'break') return
    }
  }
}

interface Agent1Result {
  type: 'text' | 'handoff'
  text?: string
  greeting?: string
  targetAgent?: string
  reason?: string
  context?: string
}

async function callAgent1Streaming(
  messages: Array<{ role: string; content: string }>,
  onDirectTextDelta: (delta: string) => void
): Promise<Agent1Result> {
  const apiKey = requireConfig('AGENT1_API_KEY', AGENT1_API_KEY)
  const endpoint = `https://aiplatform.googleapis.com/v1/publishers/google/models/${AGENT1_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`

  // Convert OpenAI message format → Gemini contents format
  let systemPrompt = ''
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (systemPrompt ? '\n' : '') + msg.content
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }
  }

  const body: any = {
    contents,
    tools: [{ functionDeclarations: [HANDOFF_FUNCTION] }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  }
  if (systemPrompt) {
    body.system_instruction = { parts: [{ text: systemPrompt }] }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Agent 1 error (${res.status}): ${errText}`)
  }

  let content = ''
  let mode: 'pending' | 'direct' | 'handoff' = 'pending'
  let handoffArgs: any = null

  await readSseStream(res.body, (parsed) => {
    const candidate = parsed.candidates?.[0]
    if (!candidate) return

    for (const part of candidate.content?.parts || []) {
      if (part.thought) continue // skip thinking parts

      if (part.functionCall) {
        mode = 'handoff'
        handoffArgs = part.functionCall.args || {}
      }

      if (part.text) {
        content += part.text
        if (mode !== 'handoff') {
          mode = 'direct'
          onDirectTextDelta(part.text)
        }
      }
    }
  })

  // Stream ended — finalize
  if (mode === 'handoff' && handoffArgs) {
    const rawGreeting = (handoffArgs.greeting || content).trim()
    const targetAgent = handoffArgs.target_agent || 'search'
    const greeting = rawGreeting || buildHandoffGreeting(messages, targetAgent, handoffArgs.reason, handoffArgs.context)
    console.log(`[Agent 1] "${greeting}" → handoff to ${targetAgent}`)
    console.log(`[Handoff] Reason: ${handoffArgs.reason || 'N/A'}, Context: ${handoffArgs.context || 'none'}`)
    return {
      type: 'handoff',
      greeting,
      targetAgent,
      reason: handoffArgs.reason || '',
      context: handoffArgs.context,
    }
  }

  // Direct reply — content already forwarded during stream
  console.log(`[Agent 1] Direct reply (${content.length} chars)`)
  return { type: 'text', text: content }
}

// ── Shared Agent 2 tool call processor ───────────────────────
async function processAgent2ToolCalls(
  functionCalls: any[],
  input: any[],
  onSearch?: (query: string, status: 'start' | 'done') => void
): Promise<void> {
  for (const fc of functionCalls) {
    const query = fc.name === 'web_search' ? ((() => { try { return JSON.parse(fc.arguments) } catch { return { query: '' } } })().query || '') : null
    if (query !== null) {
      console.log(`[Agent 2] web_search: "${query}"`)
      onSearch?.(query, 'start')
      const searchResult = await executeExaSearch(query)
      console.log(`[Agent 2] Search returned ${searchResult.length} chars`)
      onSearch?.(query, 'done')
      input.push(fc, { type: 'function_call_output', call_id: fc.call_id, output: searchResult })
    } else {
      console.warn(`[Agent 2] Unknown tool: ${fc.name}`)
      input.push(fc, { type: 'function_call_output', call_id: fc.call_id, output: `Unknown tool: ${fc.name}` })
    }
  }
}

function buildAgent2Input(
  userMessages: Array<{ role: string; content: string }>,
  handoffReason: string,
  handoffContext?: string
): any[] {
  return [
    { role: 'system', content: AGENT2_SYSTEM_PROMPT },
    ...userMessages.filter((m) => m.role !== 'system'),
    {
      role: 'developer',
      content: `[Handoff] 原因: ${handoffReason}${handoffContext ? `\n补充上下文: ${handoffContext}` : ''}`,
    },
  ]
}

async function callAgent2Round(apiKey: string, input: any[], withTools = true): Promise<any> {
  const res = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AZURE_MODEL,
      input,
      ...(withTools ? { tools: [WEB_SEARCH_TOOL] } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as any
    throw new Error(`Agent 2 error (${res.status}): ${errData.error?.message || 'Unknown'}`)
  }
  return res.json()
}

async function callAgent2Loop(
  userMessages: Array<{ role: string; content: string }>,
  handoffReason: string,
  handoffContext?: string,
  onSearch?: (query: string, status: 'start' | 'done') => void
): Promise<string> {
  const azureApiKey = requireConfig('AZURE_API_KEY', AZURE_API_KEY)
  const input = buildAgent2Input(userMessages, handoffReason, handoffContext)

  for (let round = 0; round < AGENT2_MAX_TOOL_ROUNDS; round++) {
    console.log(`[Agent 2] Round ${round + 1}`)
    const data = await callAgent2Round(azureApiKey, input)
    const functionCalls = (data.output || []).filter((item: any) => item.type === 'function_call')

    if (functionCalls.length === 0) {
      const text = extractResponseText(data)
      console.log(`[Agent 2] Final response (${text.length} chars)`)
      return text
    }

    await processAgent2ToolCalls(functionCalls, input, onSearch)
  }

  console.warn(`[Agent 2] Max rounds (${AGENT2_MAX_TOOL_ROUNDS}) reached, forcing final`)
  input.push({ role: 'developer', content: '请根据已有的搜索结果直接给出最终回答，不要再搜索了。' })
  const finalData = await callAgent2Round(azureApiKey, input, false)
  return extractResponseText(finalData)
}

// ── Agent 2: Streaming search (tool rounds non-streaming, final answer streaming) ──

async function callAgent2Streaming(
  userMessages: Array<{ role: string; content: string }>,
  handoffReason: string,
  handoffContext: string | undefined,
  onEvent: EventEmitter
): Promise<void> {
  const azureApiKey = requireConfig('AZURE_API_KEY', AZURE_API_KEY)
  const input = buildAgent2Input(userMessages, handoffReason, handoffContext)

  for (let round = 0; round < AGENT2_MAX_TOOL_ROUNDS; round++) {
    console.log(`[Agent 2] Round ${round + 1}`)
    const data = await callAgent2Round(azureApiKey, input)
    const functionCalls = (data.output || []).filter((item: any) => item.type === 'function_call')

    if (functionCalls.length === 0) {
      const text = extractResponseText(data)
      console.log(`[Agent 2] Final response (${text.length} chars) — no tools called`)
      onEvent({ type: 'text-delta', content: text || '抱歉，搜索后我仍无法回答这个问题。' })
      return
    }

    await processAgent2ToolCalls(functionCalls, input, (query, status) => {
      onEvent({ type: 'tool', name: 'web_search', query, status })
    })
  }

  console.log(`[Agent 2] Tool rounds done, streaming final answer...`)
  await streamAgent2FinalAnswer(azureApiKey, input, onEvent)
}

async function streamAgent2FinalAnswer(
  apiKey: string,
  input: any[],
  onEvent: EventEmitter
): Promise<void> {
  const res = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AZURE_MODEL,
      input,
      stream: true,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Agent 2 stream error (${res.status}): ${errText}`)
  }

  await readSseStream(res.body, (parsed) => {
    if (parsed.type === 'response.output_text.delta' && parsed.delta) {
      onEvent({ type: 'text-delta', content: parsed.delta })
    }
    if (parsed.type === 'response.failed' || parsed.type === 'error') {
      const errMsg = parsed.response?.error?.message || parsed.error?.message || 'Stream failed'
      console.error(`[Agent 2] Stream error: ${errMsg}`)
      throw new Error(errMsg)
    }
  })
}

function extractPartialJsonString(input: string, key: string): { value: string; complete: boolean } | null {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"`)
  const match = pattern.exec(input)
  if (!match) return null
  let value = ''
  let i = match.index + match[0].length
  while (i < input.length) {
    const ch = input[i]
    if (ch === '\\') {
      const next = input[i + 1]
      if (next === undefined) return { value, complete: false }
      if (next === 'n') value += '\n'
      else if (next === 't') value += '\t'
      else if (next === 'r') value += '\r'
      else if (next === '"') value += '"'
      else if (next === '\\') value += '\\'
      else if (next === 'u') {
        const hex = input.slice(i + 2, i + 6)
        if (hex.length < 4) return { value, complete: false }
        value += String.fromCharCode(parseInt(hex, 16))
        i += 6
        continue
      } else value += next
      i += 2
    } else if (ch === '"') return { value, complete: true }
    else { value += ch; i += 1 }
  }
  return { value, complete: false }
}

async function callGenUIAgent(
  messages: Array<{ role: string; content: string }>,
  onEvent: (event: Record<string, unknown>) => void
): Promise<void> {
  const azureApiKey = requireConfig('AZURE_API_KEY', AZURE_API_KEY)

  const input: any[] = [
    { role: 'system', content: GENUI_SYSTEM_PROMPT },
    ...messages.filter((m) => m.role !== 'system'),
  ]

  const res = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': azureApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AZURE_MODEL,
      input,
      tools: [DISPLAY_TSX_TOOL],
      stream: true,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`GenUI Agent error (${res.status}): ${errText}`)
  }

  let argsBuffer = ''
  let callId = ''
  let lastEmittedCode = ''
  let textContent = ''

  await readSseStream(res.body, (parsed) => {
    if (parsed.type === 'response.output_text.delta') {
      textContent += parsed.delta || ''
    }

    if (parsed.type === 'response.output_item.added' && parsed.item?.type === 'function_call') {
      callId = parsed.item.call_id || parsed.item.id || ''
      console.log(`[GenUI] function_call started, call_id: ${callId}, name: ${parsed.item.name || ''}`)
    }

    if (parsed.type === 'response.function_call_arguments.delta') {
      argsBuffer += parsed.delta || ''
      const extracted = extractPartialJsonString(argsBuffer, 'code')
      if (extracted?.value.trim() && extracted.value !== lastEmittedCode) {
        if (extracted.complete || extracted.value.length - lastEmittedCode.length >= 80) {
          lastEmittedCode = extracted.value
          onEvent({
            type: 'tsx-preview',
            toolCallId: callId || parsed.item_id || 'genui',
            output: { ok: true, code: extracted.value, streaming: !extracted.complete },
          })
        }
      }
    }

    if (parsed.type === 'response.function_call_arguments.done') {
      const finalArgs = parsed.arguments || argsBuffer
      const extracted = extractPartialJsonString(finalArgs, 'code')
      if (extracted?.value.trim()) {
        lastEmittedCode = extracted.value
        onEvent({
          type: 'tsx-preview',
          toolCallId: callId || parsed.item_id || 'genui',
          output: { ok: true, code: extracted.value, streaming: false },
        })
      }
    }

    if (parsed.type === 'response.failed' || parsed.type === 'error') {
      const errMsg = parsed.response?.error?.message || parsed.error?.message || 'GenUI stream failed'
      console.error(`[GenUI] Stream error: ${errMsg}`)
      throw new Error(errMsg)
    }
  })

  if (textContent.trim()) {
    onEvent({ type: 'text', content: textContent.trim() })
  }

  console.log(`[GenUI] TSX generated (${lastEmittedCode.length} chars), text: ${textContent.length} chars`)
  if (lastEmittedCode) {
    console.log(`[GenUI] === Generated TSX Code ===\n${lastEmittedCode}\n[GenUI] === End TSX Code ===`)
  }
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.moc3': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
}

function getMime(filePath: string): string {
  // Check compound extensions first
  for (const [ext, mime] of Object.entries(MIME_TYPES)) {
    if (ext.includes('.') && ext !== extname(filePath) && filePath.endsWith(ext)) {
      return mime
    }
  }
  return MIME_TYPES[extname(filePath)] || 'application/octet-stream'
}

function serveStatic(pathname: string): Response | null {
  let filePath = join(DIST_DIR, pathname)

  // Directory → index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html')
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    return null
  }

  const rawContent = readFileSync(filePath)
  const isHtml = extname(filePath) === '.html'
  const shouldDisableCache = isHtml || ['.js', '.css', '.json'].includes(extname(filePath))
  let content: string | Uint8Array = rawContent

  if (isHtml) {
    const html = rawContent.toString('utf-8')
    const readJsonOr = (p: string, fallback: string) => { try { return readFileSync(p, 'utf-8').trim() } catch { return fallback } }
    const faceOffsets = readJsonOr(MACARON_FACE_PATH, '{}')
    const positionData = readJsonOr(MACARON_POSITION_PATH, '{"home":{"x":0,"y":0},"peek":{"x":0,"y":0}}')
    const layoutData = readJsonOr(MACARON_LAYOUT_PATH, '{"speechZone":{"x":0,"y":0},"bottomDock":{"x":0,"y":0}}')
    const dissectionConfig = readJsonOr(DISSECTION_CONFIG_PATH, '{"nodeCount":42,"radius":80}')

    content = html.replace(
      '</head>',
      `<script>window.__MACARON_FACE_OFFSETS__=${faceOffsets};window.__MACARON_POSITION__=${positionData};window.__MACARON_LAYOUT__=${layoutData};window.__DISSECTION_CONFIG__=${dissectionConfig};</script></head>`
    )
  }

  return new Response(content, {
    headers: {
      'Content-Type': getMime(filePath),
      'Cache-Control': shouldDisableCache ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600, immutable',
    },
  })
}

// ── Generic JSON file endpoint handler ───────────────────────
const JSON_FILE_ENDPOINTS: Record<string, { path: string; keys: readonly string[] }> = {
  '/api/macaron-face': { path: MACARON_FACE_PATH, keys: ['leftBrow', 'rightBrow', 'leftEye', 'rightEye', 'mouth'] },
  '/api/macaron-position': { path: MACARON_POSITION_PATH, keys: ['home', 'peek'] },
  '/api/macaron-layout': { path: MACARON_LAYOUT_PATH, keys: ['speechZone', 'bottomDock'] },
}

const NO_CACHE_HEADERS = { 'Cache-Control': 'no-cache, no-store, must-revalidate' }

function handleJsonFileGet(filePath: string): Response {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    return new Response(raw, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_CACHE_HEADERS },
    })
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to read' }, { status: 500 })
  }
}

async function handleJsonFilePost(req: Request, filePath: string, keys: readonly string[]): Promise<Response> {
  try {
    const body = await req.json() as Record<string, { x: number; y: number }>
    const next: Record<string, { x: number; y: number }> = {}
    for (const key of keys) {
      const value = body[key]
      if (!value || typeof value.x !== 'number' || typeof value.y !== 'number') {
        return Response.json({ error: `Invalid payload for ${key}` }, { status: 400 })
      }
      next[key] = { x: Math.round(value.x), y: Math.round(value.y) }
    }
    writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8')
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to save' }, { status: 500 })
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  idleTimeout: 120,

  async fetch(req) {
    const url = new URL(req.url)

    // API: chat proxy with Agent handoff
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      try {
        const body = await req.json()
        const userMessage = body.message || ''
        const history = body.history || []
        const shouldStream = body.stream === true

        const messages: Array<{ role: string; content: string }> = [
          { role: 'system', content: AGENT1_SYSTEM_PROMPT },
        ]
        for (const msg of history.slice(-10)) {
          messages.push({ role: msg.role, content: msg.content })
        }
        messages.push({ role: 'user', content: userMessage })

        console.log(`[Chat] "${userMessage.slice(0, 60)}…"`)

        if (shouldStream) {
          return await handleStreamingChat(messages)
        }

        // Non-streaming fallback — still use streaming internally, collect result
        let resultText = ''
        const agent1Result = await callAgent1Streaming(messages, (delta) => { resultText += delta })
        let finalText: string

        if (agent1Result.type === 'text') {
          finalText = resultText || '抱歉，我暂时无法回答。'
        } else {
          const agent2Text = await callAgent2Loop(
            messages,
            agent1Result.reason || '',
            agent1Result.context
          )
          const greeting = agent1Result.greeting || ''
          finalText = greeting
            ? `${greeting}\n\n${agent2Text || '抱歉，搜索后我仍无法回答这个问题。'}`
            : (agent2Text || '抱歉，搜索后我仍无法回答这个问题。')
        }

        return Response.json({ reply: finalText })
      } catch (err: any) {
        console.error('Chat API error:', err)
        return Response.json({ error: err.message || 'Internal error' }, { status: 500 })
      }
    }

    if (url.pathname === '/api/topic-state' && req.method === 'GET') {
      try {
        return Response.json(readTopicState(), { headers: NO_CACHE_HEADERS })
      } catch (err: any) {
        return Response.json({ error: err.message || 'Failed to read topic state' }, { status: 500 })
      }
    }

    if (url.pathname === '/api/topic-state/read' && req.method === 'POST') {
      try {
        const now = new Date().toISOString()
        const current = readTopicState()
        const next: TopicState = { ...current, unreadCount: 0, lastReadAt: now, updatedAt: now }
        writeTopicState(next)
        return Response.json(next, { headers: NO_CACHE_HEADERS })
      } catch (err: any) {
        return Response.json({ error: err.message || 'Failed to mark topics as read' }, { status: 500 })
      }
    }

    // JSON file endpoints (face, position, layout)
    const jsonEndpoint = JSON_FILE_ENDPOINTS[url.pathname]
    if (jsonEndpoint) {
      if (req.method === 'GET') return handleJsonFileGet(jsonEndpoint.path)
      if (req.method === 'POST') return await handleJsonFilePost(req, jsonEndpoint.path, jsonEndpoint.keys)
    }

    // Dissection config endpoint
    if (url.pathname === '/api/dissection-config') {
      if (req.method === 'GET') return handleJsonFileGet(DISSECTION_CONFIG_PATH)
      if (req.method === 'POST') {
        try {
          const body = await req.json() as Record<string, unknown>
          const nodeCount = Number(body.nodeCount)
          const radius = Number(body.radius)
          if (!Number.isFinite(nodeCount) || nodeCount < 12 || nodeCount > 120) {
            return Response.json({ error: 'nodeCount must be 12-120' }, { status: 400 })
          }
          if (!Number.isFinite(radius) || radius < 30 || radius > 200) {
            return Response.json({ error: 'radius must be 30-200' }, { status: 400 })
          }
          const config = { nodeCount: Math.round(nodeCount), radius: Math.round(radius) }
          writeFileSync(DISSECTION_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
          return Response.json({ ok: true })
        } catch (err: any) {
          return Response.json({ error: err.message || 'Failed to save' }, { status: 500 })
        }
      }
    }

    if (url.pathname === '/api/live2d-models' && req.method === 'GET') {
      try {
        const models: { name: string; modelPath: string; icon: string | null }[] = []

        if (existsSync(LIVE2D_MODELS_DIR)) {
          for (const dir of readdirSync(LIVE2D_MODELS_DIR)) {
            const dirPath = join(LIVE2D_MODELS_DIR, dir)
            if (!statSync(dirPath).isDirectory()) continue

            for (const file of readdirSync(dirPath)) {
              if (file.endsWith('.model3.json')) {
                const iconPath = join(dirPath, 'icon.png')
                models.push({
                  name: dir,
                  modelPath: `/live2d-models/${dir}/${file}`,
                  icon: existsSync(iconPath) ? `/live2d-models/${dir}/icon.png` : null,
                })
                break
              }
            }
          }
        }

        return Response.json(models)
      } catch (err: any) {
        console.error('Live2D models scan error:', err)
        return Response.json({ error: err.message || 'Failed to scan models' }, { status: 500 })
      }
    }

    // API: video frame analysis
    if (url.pathname === '/api/video-analyze' && req.method === 'POST') {
      try {
        const body = await req.json() as { image: string; prompt?: string }
        const imageData = body.image
        if (!imageData) {
          return Response.json({ error: 'Missing image data' }, { status: 400 })
        }

        const userPrompt = body.prompt || '请描述你看到的画面'

        // Try Gemini first if key is configured
        if (GEMINI_API_KEY) {
          try {
            const geminiUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
            const base64 = imageData.replace(/^data:image\/\w+;base64,/, '')
            const mimeType = imageData.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg'

            const geminiRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: VISION_PROMPT }] },
                contents: [{
                  parts: [
                    { inline_data: { mime_type: mimeType, data: base64 } },
                    { text: userPrompt },
                  ],
                }],
                generationConfig: { maxOutputTokens: 512 },
              }),
            })

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json() as any
              const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                return Response.json({ reply: text })
              }
            }
            console.error('Gemini vision failed, falling back to Azure')
          } catch (err) {
            console.error('Gemini vision error:', err)
          }
        }

        // Fallback: Azure OpenAI with vision input
        const azureApiKey = requireConfig('AZURE_API_KEY', AZURE_API_KEY)
        const azureRes = await fetch(AZURE_ENDPOINT, {
          method: 'POST',
          headers: {
            'api-key': azureApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: AZURE_MODEL,
            input: [
              { role: 'system', content: VISION_PROMPT },
              {
                role: 'user',
                content: [
                  { type: 'input_image', image_url: imageData },
                  { type: 'input_text', text: userPrompt },
                ],
              },
            ],
          }),
        })

        const azureData = await azureRes.json() as any

        if (!azureRes.ok) {
          console.error('Azure vision error:', JSON.stringify(azureData))
          return Response.json(
            { error: azureData.error?.message || 'Vision analysis failed' },
            { status: azureRes.status }
          )
        }

        const reply = extractResponseText(azureData)
        return Response.json({ reply: reply || '抱歉，我无法识别这个画面。' })
      } catch (err: any) {
        console.error('Video analyze error:', err)
        return Response.json({ error: err.message || 'Internal error' }, { status: 500 })
      }
    }

    // Static files
    const staticRes = serveStatic(url.pathname)
    if (staticRes) return staticRes

    // SPA fallback → index.html
    const fallback = serveStatic('/index.html')
    if (fallback) return fallback

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`Macaron server running on http://0.0.0.0:${PORT}`)
