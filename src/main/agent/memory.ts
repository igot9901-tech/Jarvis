import Store from 'electron-store'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

interface MemoryEntry {
  id: string
  key: string
  value: string
  type: 'fact' | 'preference' | 'client' | 'project' | 'note'
  timestamp: number
  tags: string[]
}

interface ConversationEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const store = new Store<{
  memories: MemoryEntry[]
  conversations: ConversationEntry[]
}>({
  name: 'jarvis-memory',
  defaults: { memories: [], conversations: [] }
})

export function saveMemory(
  key: string,
  value: string,
  type: MemoryEntry['type'] = 'fact',
  tags: string[] = []
): MemoryEntry {
  const memories = store.get('memories') as MemoryEntry[]
  const existing = memories.findIndex((m) => m.key.toLowerCase() === key.toLowerCase())
  const entry: MemoryEntry = {
    id: existing >= 0 ? memories[existing].id : `mem_${Date.now()}`,
    key,
    value,
    type,
    timestamp: Date.now(),
    tags
  }
  if (existing >= 0) {
    memories[existing] = entry
  } else {
    memories.push(entry)
  }
  store.set('memories', memories)
  return entry
}

export function searchMemory(query: string): MemoryEntry[] {
  const memories = store.get('memories') as MemoryEntry[]
  const q = query.toLowerCase()
  return memories.filter(
    (m) =>
      m.key.toLowerCase().includes(q) ||
      m.value.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
  )
}

export function listMemories(type?: MemoryEntry['type']): MemoryEntry[] {
  const memories = store.get('memories') as MemoryEntry[]
  return type ? memories.filter((m) => m.type === type) : memories
}

export function deleteMemory(key: string): boolean {
  const memories = store.get('memories') as MemoryEntry[]
  const filtered = memories.filter((m) => m.key.toLowerCase() !== key.toLowerCase())
  if (filtered.length === memories.length) return false
  store.set('memories', filtered)
  return true
}

export function appendConversation(role: 'user' | 'assistant', content: string): void {
  const conversations = store.get('conversations') as ConversationEntry[]
  conversations.push({ id: `conv_${Date.now()}`, role, content, timestamp: Date.now() })
  // keep last 200 turns
  if (conversations.length > 200) conversations.splice(0, conversations.length - 200)
  store.set('conversations', conversations)
}

export function getRecentConversations(limit = 20): ConversationEntry[] {
  const conversations = store.get('conversations') as ConversationEntry[]
  return conversations.slice(-limit)
}

export function exportMemoryToFile(): string {
  const outDir = app.getPath('userData')
  const outPath = path.join(outDir, `jarvis-memory-export-${Date.now()}.json`)
  const data = {
    memories: store.get('memories'),
    exportedAt: new Date().toISOString()
  }
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8')
  return outPath
}
