import { create } from 'zustand'
import type { Message, Action, AgentState, AppSettings } from '../types'

interface Store {
  // state
  agentState: AgentState
  messages: Message[]
  actions: Action[]
  isExpanded: boolean
  activeTab: 'chat' | 'actions' | 'settings'
  streamingMessageId: string | null
  settings: AppSettings | null

  // setters
  setAgentState: (s: AgentState) => void
  setExpanded: (v: boolean) => void
  setActiveTab: (t: 'chat' | 'actions' | 'settings') => void
  setSettings: (s: AppSettings) => void

  // message ops
  addMessage: (msg: Message) => void
  appendToLastAssistantMessage: (text: string) => void
  finalizeStreamingMessage: () => void
  beginStreamingMessage: (id: string) => void

  // action ops
  addAction: (action: Action) => void
  updateAction: (id: string, patch: Partial<Action>) => void
  clearActions: () => void
}

export const useStore = create<Store>((set, get) => ({
  agentState: 'idle',
  messages: [],
  actions: [],
  isExpanded: true,
  activeTab: 'chat',
  streamingMessageId: null,
  settings: null,

  setAgentState: (agentState) => set({ agentState }),
  setExpanded: (isExpanded) => set({ isExpanded }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSettings: (settings) => set({ settings }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  beginStreamingMessage: (id) => {
    set((s) => ({
      streamingMessageId: id,
      messages: [
        ...s.messages,
        { id, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }
      ]
    }))
  },

  appendToLastAssistantMessage: (text) => {
    const { streamingMessageId } = get()
    if (!streamingMessageId) return
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === streamingMessageId ? { ...m, content: m.content + text } : m
      )
    }))
  },

  finalizeStreamingMessage: () => {
    const { streamingMessageId } = get()
    set((s) => ({
      streamingMessageId: null,
      messages: s.messages.map((m) =>
        m.id === streamingMessageId ? { ...m, isStreaming: false } : m
      )
    }))
  },

  addAction: (action) => set((s) => ({ actions: [action, ...s.actions] })),

  updateAction: (id, patch) =>
    set((s) => ({
      actions: s.actions.map((a) => (a.id === id ? { ...a, ...patch } : a))
    })),

  clearActions: () => set({ actions: [] })
}))
