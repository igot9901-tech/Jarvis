import { google } from 'googleapis'
import { store } from '../../settings'
import { OAuth2Client } from 'google-auth-library'
import { BrowserWindow, shell } from 'electron'
import http from 'http'
import url from 'url'

const OAUTH_REDIRECT_PORT = 3947
const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_REDIRECT_PORT}/oauth/google`
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.modify'
]

export function getOAuthClient(): OAuth2Client {
  const clientId = store.get('googleClientId') as string
  const clientSecret = store.get('googleClientSecret') as string
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth credentials not configured. ' +
        'Go to Settings → Integrations and add your Google Client ID and Secret.'
    )
  }
  const client = new google.auth.OAuth2(clientId, clientSecret, OAUTH_REDIRECT_URI)
  const refreshToken = store.get('googleRefreshToken') as string
  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken })
  }
  return client
}

export async function initiateGoogleAuth(): Promise<string> {
  const client = getOAuthClient()
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  })

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsed = url.parse(req.url!, true)
        if (!parsed.pathname?.includes('/oauth/google')) return
        const code = parsed.query.code as string
        if (!code) {
          res.end('<h1>Authorization failed</h1>')
          server.close()
          reject(new Error('No authorization code received'))
          return
        }
        const { tokens } = await client.getToken(code)
        if (tokens.refresh_token) {
          store.set('googleRefreshToken', tokens.refresh_token)
        }
        res.end(
          '<h1 style="font-family:sans-serif;text-align:center;margin-top:80px">✅ Jarvis connected to Google! You can close this window.</h1>'
        )
        server.close()
        resolve('Google account connected successfully.')
      } catch (err) {
        res.end('<h1>Error</h1>')
        server.close()
        reject(err)
      }
    })
    server.listen(OAUTH_REDIRECT_PORT, () => {
      shell.openExternal(authUrl)
    })
    setTimeout(() => {
      server.close()
      reject(new Error('Google auth timed out after 5 minutes'))
    }, 5 * 60 * 1000)
  })
}

function getCalendar() {
  const auth = getOAuthClient()
  return google.calendar({ version: 'v3', auth })
}

export async function listCalendarEvents(
  timeMin?: string,
  timeMax?: string,
  maxResults = 10
): Promise<string> {
  const calendar = getCalendar()
  const now = new Date()
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin || now.toISOString(),
    timeMax:
      timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime'
  })
  const events = response.data.items || []
  if (events.length === 0) return 'No upcoming events found.'
  return events
    .map((e) => {
      const start = e.start?.dateTime || e.start?.date
      const end = e.end?.dateTime || e.end?.date
      const attendees = e.attendees?.map((a) => a.email).join(', ') || 'no attendees'
      return `[${e.id}] ${e.summary}\n  When: ${start} → ${end}\n  Attendees: ${attendees}\n  Location: ${e.location || 'none'}`
    })
    .join('\n\n')
}

export async function createCalendarEvent(
  summary: string,
  startDateTime: string,
  endDateTime: string,
  description?: string,
  attendeeEmails?: string[]
): Promise<string> {
  const calendar = getCalendar()
  const event = await calendar.events.insert({
    calendarId: 'primary',
    sendUpdates: attendeeEmails && attendeeEmails.length > 0 ? 'all' : 'none',
    requestBody: {
      summary,
      description,
      start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      attendees: attendeeEmails?.map((email) => ({ email }))
    }
  })
  return `Created event "${summary}" (ID: ${event.data.id}). Link: ${event.data.htmlLink}`
}

export async function updateCalendarEvent(
  eventId: string,
  updates: { summary?: string; startDateTime?: string; endDateTime?: string; description?: string }
): Promise<string> {
  const calendar = getCalendar()
  const existing = await calendar.events.get({ calendarId: 'primary', eventId })
  const patch: Record<string, unknown> = {}
  if (updates.summary) patch.summary = updates.summary
  if (updates.description) patch.description = updates.description
  if (updates.startDateTime) {
    patch.start = {
      dateTime: updates.startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }
  if (updates.endDateTime) {
    patch.end = {
      dateTime: updates.endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }
  await calendar.events.patch({ calendarId: 'primary', eventId, requestBody: patch })
  return `Updated event "${existing.data.summary}" (ID: ${eventId})`
}

export async function deleteCalendarEvent(eventId: string): Promise<string> {
  const calendar = getCalendar()
  const event = await calendar.events.get({ calendarId: 'primary', eventId })
  await calendar.events.delete({ calendarId: 'primary', eventId })
  return `Deleted event "${event.data.summary}"`
}
