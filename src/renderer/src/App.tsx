import React, { useEffect, useState, useCallback } from 'react'
import { Visualizer } from './components/Visualizer'
import { MainPanel } from './components/MainPanel'
import { useStore } from './store'
import { useWakeWord } from './hooks/useWakeWord'
import { useVoice } from './hooks/useVoice'
import type { Message } from './types'

export default function App() {
  const { setSettings, agentState, setAgentState, addMessage, beginStreamingMessage,
    appendToLastAssistantMessage, finalizeStreamingMessage, addAction, updateAction } = useStore()
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    window.jarvis.getSettings().then((s) => setSettings(s))
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return
    if (agentState === 'thinking') return

    setAgentState('thinking')
    setPanelOpen(true)

    addMessage({ id: `msg_${Date.now()}`, role: 'user', content: text, timestamp: Date.now() })
    beginStreamingMessage(`stream_${Date.now()}`)
    window.jarvis.sendMessage(text)
  }, [agentState, addMessage, beginStreamingMessage, setAgentState])

  const { speak } = useVoice(sendMessage)

  useWakeWord(sendMessage)

  // agent event listener
  useEffect(() => {
    const cleanup = window.jarvis.onAgentEvent((raw: unknown) => {
      const event = raw as any
      switch (event.type) {
        case 'text_delta':
          appendToLastAssistantMessage(event.text)
          break
        case 'tool_start':
          addAction({ id: event.id, tool: event.tool, label: event.label, input: event.input, status: 'running', timestamp: Date.now() })
          break
        case 'tool_done':
          updateAction(event.id, { status: event.error ? 'error' : 'success', output: event.output })
          break
        case 'done':
          finalizeStreamingMessage()
          setAgentState('idle')
          if (event.fullText) speak(event.fullText)
          break
        case 'error':
          finalizeStreamingMessage()
          setAgentState('error')
          addMessage({ id: `err_${Date.now()}`, role: 'system', content: `⚠️ ${event.message}`, timestamp: Date.now() })
          setTimeout(() => setAgentState('idle'), 3000)
          break
      }
    })
    return cleanup
  }, [speak])

  return (
    <div className="app">
      <div className="app__bg" />
      <div className="app__wake-hint">
        {agentState === 'idle' && <span>say <em>"Hey Jarvis"</em> to start</span>}
      </div>
      <Visualizer onTogglePanel={() => setPanelOpen((v) => !v)} />
      <div className={`app__panel-wrapper ${panelOpen ? 'app__panel-wrapper--open' : ''}`}>
        <MainPanel onClose={() => setPanelOpen(false)} onSend={sendMessage} />
      </div>
    </div>
  )
}
