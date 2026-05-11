import React from 'react'
import { useStore } from '../store'
import type { AgentState } from '../types'

const STATE_COLORS: Record<AgentState, string> = {
  idle: '#7c3aed',
  listening: '#06b6d4',
  thinking: '#f59e0b',
  speaking: '#10b981',
  error: '#ef4444'
}

const STATE_LABELS: Record<AgentState, string> = {
  idle: 'idle',
  listening: '● listening',
  thinking: '⟳ thinking',
  speaking: '◆ speaking',
  error: '✕ error'
}

export function FloatingOrb({ onClick }: { onClick: () => void }) {
  const { agentState, isExpanded } = useStore()
  const color = STATE_COLORS[agentState]
  const isAnimating = agentState !== 'idle'

  return (
    <div className="orb-container" onClick={onClick}>
      <div
        className={`orb ${isAnimating ? 'orb--animated' : ''}`}
        style={{ '--orb-color': color } as React.CSSProperties}
      >
        <div className="orb__inner">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M16 4C9.4 4 4 9.4 4 16s5.4 12 12 12 12-5.4 12-12S22.6 4 16 4z"
              fill={color}
              opacity="0.3"
            />
            <path
              d="M16 8a8 8 0 100 16A8 8 0 0016 8z"
              fill={color}
              opacity="0.6"
            />
            <circle cx="16" cy="16" r="4" fill={color} />
          </svg>
        </div>
      </div>
      {!isExpanded && (
        <div className="orb__state-label" style={{ color }}>
          {STATE_LABELS[agentState]}
        </div>
      )}
    </div>
  )
}
