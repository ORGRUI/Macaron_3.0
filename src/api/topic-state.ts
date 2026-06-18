export interface TopicStateResponse {
  unreadCount: number
  lastReadAt: string | null
  updatedAt: string | null
}

export async function fetchTopicState(): Promise<TopicStateResponse> {
  const res = await fetch('/api/topic-state', { cache: 'no-store' })
  const data = await res.json() as TopicStateResponse & { error?: string }

  if (!res.ok || data.error) {
    throw new Error(data.error || `API error: ${res.status}`)
  }

  return data
}

export async function markTopicsRead(): Promise<TopicStateResponse> {
  const res = await fetch('/api/topic-state/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json() as TopicStateResponse & { error?: string }

  if (!res.ok || data.error) {
    throw new Error(data.error || `API error: ${res.status}`)
  }

  return data
}
