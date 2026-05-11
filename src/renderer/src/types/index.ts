export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface Action {
  id: string
  tool: string
  label: string
  input: Record<string, unknown>
  output?: string
  status: 'pending' | 'running' | 'success' | 'error'
  timestamp: number
  duration?: number
}

export interface Integration {
  id: 'google' | 'stripe' | 'filesystem'
  name: string
  connected: boolean
  lastSync?: number
  error?: string
}

export interface AppSettings {
  anthropicApiKey: string
  stripeApiKey: string
  googleClientId: string
  googleClientSecret: string
  googleRefreshToken: string
  fileScopePaths: string[]
  userName: string
  voiceEnabled: boolean
  ttsEnabled: boolean
  elevenLabsApiKey: string
  elevenLabsVoiceId: string
  confirmDestructiveActions: boolean
}

export interface ToolResult {
  tool: string
  label: string
  input: Record<string, unknown>
  output: string
  error?: boolean
}
