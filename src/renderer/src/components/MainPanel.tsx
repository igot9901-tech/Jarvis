import React, { useState, useCallback } from 'react'
import { ChatThread } from './ChatThread'
import { ActionFeed } from './ActionFeed'
import { Settings } from './Settings'
import { useStore } from '../store'
import { useVoice } from '../hooks/useVoice'

export function MainPanel({ onClose, onSend }: { onClose?: () => void; onSend?: (text: string) => void }) {
  const { activeTab, setActiveTab, agentState, setAgentState } = useStore()
  const [inputText, setInputText] = useState('')

  // mic button inside panel still works for non-wake-word use
  const { startListening, stopListening } = useVoice(
    useCallback((text: string) => { onSend?.(text) }, [onSend])
  )

  const handleSend = (text: string) => {
    if (!text.trim()) return
    setInputText('')
    onSend?.(text)
  }

  // register agent event listener is now handled in App.tsx
  // panel only needs to track thinking state for the UI indicator
  const isThinking = agentState === 'thinking'

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(inputText)
    }
  }

  const handleMicClick = () => {
    if (agentState === 'listening') {
      stopListening()
    } else if (agentState === 'idle') {
      startListening()
    }
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">
          <span className="panel__logo">◈</span>
          <span>Jarvis</span>
        </div>
        <div className="panel__tabs">
          <button className={`tab ${activeTab === 'chat' ? 'tab--active' : ''}`} onClick={() => setActiveTab('chat')}>Chat</button>
          <button className={`tab ${activeTab === 'actions' ? 'tab--active' : ''}`} onClick={() => setActiveTab('actions')}>Actions</button>
          <button className={`tab ${activeTab === 'settings' ? 'tab--active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
        </div>
        <button className="panel__close" onClick={onClose}>✕</button>
      </div>

      <div className="panel__body">
        {activeTab === 'chat' && <ChatThread />}
        {activeTab === 'actions' && <ActionFeed />}
        {activeTab === 'settings' && <Settings />}
      </div>

      {activeTab === 'chat' && (
        <div className="panel__input-area">
          {isThinking && (
            <div className="thinking-bar">
              <span className="thinking-dots"><span>●</span><span>●</span><span>●</span></span>
              Jarvis is thinking…
            </div>
          )}
          <div className="input-row">
            <button
              className={`mic-btn ${agentState === 'listening' ? 'mic-btn--active' : ''}`}
              onClick={handleMicClick}
              title={agentState === 'listening' ? 'Stop' : 'Voice input'}
            >
              {agentState === 'listening' ? '⏹' : '🎤'}
            </button>
            <textarea
              className="chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Jarvis… (Enter to send)"
              rows={1}
              disabled={agentState === 'thinking'}
            />
            <button
              className="send-btn"
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim() || agentState === 'thinking'}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
