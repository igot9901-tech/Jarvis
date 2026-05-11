import React, { useEffect, useRef } from 'react'
import { useStore } from '../store'

export function ChatThread() {
  const { messages } = useStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="chat-empty">
        <div className="chat-empty__icon">◈</div>
        <div className="chat-empty__title">Hey, I'm Jarvis.</div>
        <div className="chat-empty__subtitle">
          Tap the mic, press Enter, or just start typing.
        </div>
        <div className="chat-empty__hints">
          <span>"What does my week look like?"</span>
          <span>"How's revenue this month?"</span>
          <span>"Find my notes on Acme Corp"</span>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-thread">
      {messages.map((msg) => (
        <div key={msg.id} className={`message message--${msg.role}`}>
          <div className="message__bubble">
            {msg.content || (msg.isStreaming ? <span className="cursor-blink">▋</span> : '')}
            {msg.isStreaming && msg.content && <span className="cursor-blink">▋</span>}
          </div>
          <div className="message__time">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
