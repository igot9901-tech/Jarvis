import { google } from 'googleapis'
import { getOAuthClient } from './calendar'

function getGmail() {
  const auth = getOAuthClient()
  return google.gmail({ version: 'v1', auth })
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractBody(payload: any): string {
  if (!payload) return ''
  if (payload.body?.data) return decodeBase64(payload.body.data)
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data)
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64(part.body.data)
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      }
    }
  }
  return ''
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

export async function listRecentEmails(maxResults = 10): Promise<string> {
  const gmail = getGmail()
  const list = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'in:inbox'
  })
  const messages = list.data.messages || []
  if (messages.length === 0) return 'No emails found.'

  const summaries = await Promise.all(
    messages.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      })
      const h = msg.data.payload?.headers || []
      return `[${m.id}] From: ${getHeader(h, 'From')}\n  Subject: ${getHeader(h, 'Subject')}\n  Date: ${getHeader(h, 'Date')}`
    })
  )
  return summaries.join('\n\n')
}

export async function searchEmails(query: string, maxResults = 10): Promise<string> {
  const gmail = getGmail()
  const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults })
  const messages = list.data.messages || []
  if (messages.length === 0) return `No emails found matching "${query}".`

  const summaries = await Promise.all(
    messages.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      })
      const h = msg.data.payload?.headers || []
      return `[${m.id}] From: ${getHeader(h, 'From')}\n  Subject: ${getHeader(h, 'Subject')}\n  Date: ${getHeader(h, 'Date')}`
    })
  )
  return `${messages.length} result(s):\n\n${summaries.join('\n\n')}`
}

export async function getEmail(messageId: string): Promise<string> {
  const gmail = getGmail()
  const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' })
  const h = msg.data.payload?.headers || []
  const from = getHeader(h, 'From')
  const subject = getHeader(h, 'Subject')
  const date = getHeader(h, 'Date')
  const body = extractBody(msg.data.payload)
  return `From: ${from}\nSubject: ${subject}\nDate: ${date}\n\n${body.slice(0, 3000)}${body.length > 3000 ? '\n[truncated]' : ''}`
}

function buildMimeMessage(params: {
  to: string
  subject: string
  body: string
  fromEmail: string
  replyToMessageId?: string
  threadId?: string
}): string {
  const lines = [
    `To: ${params.to}`,
    `From: ${params.fromEmail}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    ''
  ]
  if (params.replyToMessageId) lines.splice(3, 0, `In-Reply-To: ${params.replyToMessageId}`)
  lines.push(params.body)
  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  replyToMessageId?: string,
  threadId?: string
): Promise<string> {
  const gmail = getGmail()
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const fromEmail = profile.data.emailAddress!

  const raw = buildMimeMessage({ to, subject, body, fromEmail, replyToMessageId, threadId })
  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId }
  })
  return `Email sent to ${to} with subject "${subject}" (ID: ${result.data.id})`
}

export async function draftEmail(
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const gmail = getGmail()
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const fromEmail = profile.data.emailAddress!
  const raw = buildMimeMessage({ to, subject, body, fromEmail })
  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } }
  })
  return `Draft created (ID: ${draft.data.id}) — ready to review and send.`
}

export async function markAsRead(messageId: string): Promise<string> {
  const gmail = getGmail()
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] }
  })
  return `Marked message ${messageId} as read.`
}

export async function getUnreadCount(): Promise<string> {
  const gmail = getGmail()
  const result = await gmail.users.labels.get({ userId: 'me', id: 'INBOX' })
  const unread = result.data.messagesUnread || 0
  return `You have ${unread} unread email${unread !== 1 ? 's' : ''} in your inbox.`
}
