import Anthropic from '@anthropic-ai/sdk'
import { store } from '../settings'
import { TOOL_DEFINITIONS, executeTool, getToolLabel, ToolName, ImageResult } from './tools/index'
import { appendConversation, getRecentConversations, searchMemory } from './memory'

const SYSTEM_PROMPT = `You are Jarvis, a voice-first AI executive assistant. You are brilliant, direct, and proactively helpful. You live on the user's computer and have access to their calendar, email, files, and finances.

Personality:
- Get to the point immediately. No filler phrases like "Certainly!" or "Of course!" or "Great question!"
- Surface relevant context before being asked
- Tell the user when you're uncertain rather than guessing
- Be warm but professional
- Refer to yourself as "I"
- Keep responses concise — brief is better than verbose
- Address the user by their name when you know it

When taking actions:
- Be specific about what you did ("Created event 'Team standup' on Thursday at 10am") not vague ("Done")
- Execute multi-step tasks sequentially, reporting progress
- If a step fails, continue with remaining steps and report failures at the end
- For sensitive actions (sending emails, charging customers, deleting files), describe what you're about to do before doing it
- Use the save_memory tool to remember important facts about the user's clients, projects, and preferences
- Use search_memory at the start of relevant queries to check for useful context

Current date and time: {{DATETIME}}
User name: {{USERNAME}}`

function buildSystemPrompt(): string {
  const userName = store.get('userName') as string || 'there'
  return SYSTEM_PROMPT
    .replace('{{DATETIME}}', new Date().toLocaleString())
    .replace('{{USERNAME}}', userName)
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolEvent {
  type: 'tool_start'
  id: string
  tool: string
  label: string
  input: Record<string, unknown>
}

export interface ToolDoneEvent {
  type: 'tool_done'
  id: string
  output: string
  error: boolean
}

export interface TextDeltaEvent {
  type: 'text_delta'
  text: string
}

export interface DoneEvent {
  type: 'done'
  fullText: string
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type AgentEvent = ToolEvent | ToolDoneEvent | TextDeltaEvent | DoneEvent | ErrorEvent

class JarvisAgent {
  private client: Anthropic | null = null

  private getClient(): Anthropic {
    if (this.client) return this.client
    const apiKey = store.get('anthropicApiKey') as string
    if (!apiKey) {
      throw new Error(
        'Anthropic API key not configured. Go to Settings and add your API key.'
      )
    }
    this.client = new Anthropic({ apiKey })
    return this.client
  }

  invalidateClient(): void {
    this.client = null
  }

  async chat(
    userMessage: string,
    onEvent: (event: AgentEvent) => void
  ): Promise<void> {
    try {
      const client = this.getClient()
      appendConversation('user', userMessage)

      // build message history from recent conversations
      const history = getRecentConversations(30)
      const messages: Anthropic.MessageParam[] = []
      for (const entry of history.slice(0, -1)) {
        messages.push({ role: entry.role, content: entry.content })
      }
      messages.push({ role: 'user', content: userMessage })

      let fullText = ''
      let continueLoop = true

      while (continueLoop) {
        let currentText = ''
        let toolUses: Anthropic.ToolUseBlock[] = []

        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: buildSystemPrompt(),
          tools: TOOL_DEFINITIONS,
          messages
        })

        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              currentText += event.delta.text
              fullText += event.delta.text
              onEvent({ type: 'text_delta', text: event.delta.text })
            }
          }
        }

        const finalMessage = await stream.finalMessage()
        toolUses = finalMessage.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        )

        // push assistant turn
        messages.push({ role: 'assistant', content: finalMessage.content })

        if (finalMessage.stop_reason === 'tool_use' && toolUses.length > 0) {
          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const toolUse of toolUses) {
            const toolId = `action_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
            const label = getToolLabel(toolUse.name, toolUse.input as Record<string, unknown>)

            onEvent({
              type: 'tool_start',
              id: toolId,
              tool: toolUse.name,
              label,
              input: toolUse.input as Record<string, unknown>
            })

            const output = await executeTool(
              toolUse.name as ToolName,
              toolUse.input as Record<string, unknown>
            )

            // screenshot returns an ImageResult — pass it to Claude as a vision block
            if (output && typeof output === 'object' && (output as ImageResult).__type === 'image') {
              const img = output as ImageResult
              onEvent({ type: 'tool_done', id: toolId, output: img.description, error: false })
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: img.mediaType, data: img.base64 }
                  },
                  { type: 'text', text: img.description }
                ] as any
              })
            } else {
              const strOutput = output as string
              const isError = strOutput.startsWith('Error:')
              onEvent({ type: 'tool_done', id: toolId, output: strOutput, error: isError })
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: strOutput
              })
            }
          }

          messages.push({ role: 'user', content: toolResults })
        } else {
          continueLoop = false
        }
      }

      if (fullText) appendConversation('assistant', fullText)
      onEvent({ type: 'done', fullText })
    } catch (err: any) {
      onEvent({ type: 'error', message: err.message })
    }
  }
}

export const agent = new JarvisAgent()
