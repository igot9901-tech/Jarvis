import React from 'react'
import { useStore } from '../store'
import type { Action } from '../types'

const TOOL_ICONS: Record<string, string> = {
  list_directory: '📁',
  read_file: '📄',
  write_file: '✏️',
  append_to_file: '➕',
  create_directory: '📂',
  move_file: '↔️',
  delete_file: '🗑️',
  search_files: '🔍',
  list_calendar_events: '📅',
  create_calendar_event: '📅',
  update_calendar_event: '📅',
  delete_calendar_event: '📅',
  list_recent_emails: '📧',
  search_emails: '📧',
  get_email: '📧',
  send_email: '📤',
  draft_email: '📝',
  get_unread_count: '📬',
  stripe_get_balance: '💰',
  stripe_revenue_summary: '📊',
  stripe_list_customers: '👥',
  stripe_get_customer: '👤',
  stripe_list_invoices: '🧾',
  stripe_create_invoice: '🧾',
  stripe_send_invoice: '📤',
  stripe_issue_refund: '↩️',
  stripe_list_subscriptions: '🔄',
  stripe_cancel_subscription: '🚫',
  save_memory: '🧠',
  search_memory: '🧠',
  list_memories: '🧠',
  delete_memory: '🧠'
}

function ActionRow({ action }: { action: Action }) {
  const icon = TOOL_ICONS[action.tool] || '⚙️'
  const statusClass = `action__status--${action.status}`

  return (
    <div className={`action ${action.status === 'error' ? 'action--error' : ''}`}>
      <div className="action__header">
        <span className="action__icon">{icon}</span>
        <span className="action__label">{action.label}</span>
        <span className={`action__status ${statusClass}`}>
          {action.status === 'running' && '⟳'}
          {action.status === 'success' && '✓'}
          {action.status === 'error' && '✕'}
          {action.status === 'pending' && '…'}
        </span>
      </div>
      {action.output && action.status !== 'running' && (
        <div className="action__output">{action.output.slice(0, 200)}{action.output.length > 200 ? '…' : ''}</div>
      )}
      <div className="action__time">
        {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        {action.duration && ` · ${action.duration}ms`}
      </div>
    </div>
  )
}

export function ActionFeed() {
  const { actions, clearActions } = useStore()

  if (actions.length === 0) {
    return (
      <div className="feed-empty">
        <div className="feed-empty__icon">⚡</div>
        <div className="feed-empty__text">Actions will appear here as Jarvis works.</div>
      </div>
    )
  }

  return (
    <div className="action-feed">
      <div className="action-feed__header">
        <span>{actions.length} action{actions.length !== 1 ? 's' : ''}</span>
        <button className="btn-ghost" onClick={clearActions}>Clear</button>
      </div>
      <div className="action-feed__list">
        {actions.map((a) => <ActionRow key={a.id} action={a} />)}
      </div>
    </div>
  )
}
