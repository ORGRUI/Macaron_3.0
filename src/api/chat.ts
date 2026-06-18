import type { ChatMessage, StreamEvent } from '../data/types'

interface ChatResponse {
  reply: string
  error?: string
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  const data: ChatResponse = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error || `API error: ${res.status}`)
  }

  return data.reply
}

export async function streamChatEvents(
  message: string,
  history: ChatMessage[],
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    let message = `API error: ${res.status}`
    try {
      const data: ChatResponse = await res.json()
      message = data.error || message
    } catch {}
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })

    // SSE format: events separated by double newline, each line prefixed with "data: "
    const blocks = buf.split('\n\n')
    buf = blocks.pop() || ''

    for (const block of blocks) {
      const dataLine = block
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('')
      if (!dataLine.trim()) continue
      try {
        onEvent(JSON.parse(dataLine) as StreamEvent)
      } catch {}
    }
  }

  // Flush remaining buffer
  if (buf.trim()) {
    const dataLine = buf
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6))
      .join('')
    if (dataLine.trim()) {
      try {
        onEvent(JSON.parse(dataLine) as StreamEvent)
      } catch {}
    }
  }
}

export async function analyzeVideoFrame(imageBase64: string): Promise<string> {
  const res = await fetch('/api/video-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64 }),
  })

  const data = await res.json() as { reply?: string; error?: string }

  if (!res.ok || data.error) {
    throw new Error(data.error || `API error: ${res.status}`)
  }

  return data.reply || ''
}
