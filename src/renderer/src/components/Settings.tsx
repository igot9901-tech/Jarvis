import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { AppSettings } from '../types'

declare global {
  interface Window {
    jarvis: {
      getSettings: () => Promise<AppSettings>
      saveSettings: (s: Partial<AppSettings>) => Promise<{ ok: boolean }>
      googleAuth: () => Promise<{ ok: boolean; message: string }>
      googleDisconnect: () => Promise<{ ok: boolean }>
      googleIsConnected: () => Promise<boolean>
      getHomeDir: () => Promise<string>
      collapse: () => void
      expand: () => void
      sendMessage: (msg: string) => void
      onAgentEvent: (cb: (event: unknown) => void) => () => void
      getMobileURL: () => Promise<string>
      getVersion: () => Promise<string>
    }
  }
}

export function Settings() {
  const { settings, setSettings } = useStore()
  const [local, setLocal] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [mobileURL, setMobileURL] = useState('')

  useEffect(() => {
    if (settings) setLocal({ ...settings })
    window.jarvis.googleIsConnected().then(setGoogleConnected)
    window.jarvis.getMobileURL().then(setMobileURL)
  }, [settings])

  async function handleSave() {
    if (!local) return
    await window.jarvis.saveSettings(local as unknown as Record<string, unknown>)
    setSettings(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleGoogleConnect() {
    setGoogleLoading(true)
    const result = await window.jarvis.googleAuth()
    if (result.ok) {
      setGoogleConnected(true)
    } else {
      alert(`Google auth failed: ${result.message}`)
    }
    setGoogleLoading(false)
  }

  async function handleGoogleDisconnect() {
    await window.jarvis.googleDisconnect()
    setGoogleConnected(false)
  }

  if (!local) return <div className="settings-loading">Loading…</div>

  return (
    <div className="settings">
      {mobileURL && (
        <div className="settings__section">
          <div className="settings__section-title">📱 Connect Your Phone</div>
          <div className="mobile-connect-card">
            <div className="mobile-connect-card__label">Open this URL on your phone's browser<br/>(must be on the same WiFi)</div>
            <div className="mobile-connect-card__url">{mobileURL}</div>
            <div className="mobile-connect-card__hint">Works in Chrome or Safari. Say "Hey Jarvis" on your phone too.</div>
          </div>
        </div>
      )}

      <div className="settings__section">
        <div className="settings__section-title">Your Name</div>
        <input
          className="input"
          value={local.userName}
          onChange={(e) => setLocal({ ...local, userName: e.target.value })}
          placeholder="Gary"
        />
      </div>

      <div className="settings__section">
        <div className="settings__section-title">Anthropic API Key</div>
        <input
          className="input"
          type="password"
          value={local.anthropicApiKey}
          onChange={(e) => setLocal({ ...local, anthropicApiKey: e.target.value })}
          placeholder="sk-ant-..."
        />
        <div className="settings__hint">
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            Get your key →
          </a>
        </div>
      </div>

      <div className="settings__section">
        <div className="settings__section-title">Integrations</div>

        {/* Google */}
        <div className="integration-card">
          <div className="integration-card__header">
            <span className="integration-card__name">📅 Google (Calendar + Gmail)</span>
            <span className={`integration-card__status ${googleConnected ? 'status--ok' : 'status--off'}`}>
              {googleConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          {!googleConnected ? (
            <div>
              <div className="settings__row">
                <input
                  className="input"
                  value={local.googleClientId}
                  onChange={(e) => setLocal({ ...local, googleClientId: e.target.value })}
                  placeholder="Google Client ID"
                />
              </div>
              <div className="settings__row">
                <input
                  className="input"
                  type="password"
                  value={local.googleClientSecret}
                  onChange={(e) => setLocal({ ...local, googleClientSecret: e.target.value })}
                  placeholder="Google Client Secret"
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleGoogleConnect}
                disabled={googleLoading || !local.googleClientId || !local.googleClientSecret}
              >
                {googleLoading ? 'Connecting…' : 'Connect Google Account'}
              </button>
            </div>
          ) : (
            <button className="btn-ghost btn-danger" onClick={handleGoogleDisconnect}>
              Disconnect
            </button>
          )}
        </div>

        {/* Stripe */}
        <div className="integration-card">
          <div className="integration-card__header">
            <span className="integration-card__name">💳 Stripe</span>
            <span className={`integration-card__status ${local.stripeApiKey ? 'status--ok' : 'status--off'}`}>
              {local.stripeApiKey ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <input
            className="input"
            type="password"
            value={local.stripeApiKey}
            onChange={(e) => setLocal({ ...local, stripeApiKey: e.target.value })}
            placeholder="sk_live_..."
          />
        </div>

        {/* File system */}
        <div className="integration-card">
          <div className="integration-card__header">
            <span className="integration-card__name">📁 File System</span>
            <span className="integration-card__status status--ok">Active</span>
          </div>
          <div className="settings__hint">Scope paths (one per line):</div>
          <textarea
            className="input input--textarea"
            value={local.fileScopePaths.join('\n')}
            onChange={(e) =>
              setLocal({
                ...local,
                fileScopePaths: e.target.value.split('\n').filter(Boolean)
              })
            }
            rows={3}
          />
        </div>
      </div>

      <div className="settings__section">
        <div className="settings__section-title">Voice</div>
        <label className="toggle-row">
          <span>Voice input (microphone)</span>
          <input
            type="checkbox"
            checked={local.voiceEnabled}
            onChange={(e) => setLocal({ ...local, voiceEnabled: e.target.checked })}
          />
        </label>
        <label className="toggle-row">
          <span>Text-to-speech responses</span>
          <input
            type="checkbox"
            checked={local.ttsEnabled}
            onChange={(e) => setLocal({ ...local, ttsEnabled: e.target.checked })}
          />
        </label>

        <div className="integration-card" style={{ marginTop: 10 }}>
          <div className="integration-card__header">
            <span className="integration-card__name">🎙 ElevenLabs Voice</span>
            <span className={`integration-card__status ${local.elevenLabsApiKey ? 'status--ok' : 'status--off'}`}>
              {local.elevenLabsApiKey ? 'Configured' : 'Using system voice'}
            </span>
          </div>
          <input
            className="input"
            type="password"
            value={local.elevenLabsApiKey}
            onChange={(e) => setLocal({ ...local, elevenLabsApiKey: e.target.value })}
            placeholder="ElevenLabs API key (xi-api-key)"
          />
          <div className="settings__section-title" style={{ marginTop: 4 }}>Voice</div>
          <select
            className="input"
            value={local.elevenLabsVoiceId}
            onChange={(e) => setLocal({ ...local, elevenLabsVoiceId: e.target.value })}
          >
            <option value="21m00Tcm4TlvDq8ikWAM">Rachel — calm, professional (recommended)</option>
            <option value="EXAVITQu4vr4xnSDxMaL">Bella — warm, friendly</option>
            <option value="MF3mGyEYCl7XYWbV9V6O">Elli — bright, energetic</option>
            <option value="pNInz6obpgDQGcFmaJgB">Adam — deep male voice</option>
            <option value="onwK4e9ZLuTAKqWW03F9">Daniel — British male</option>
            <option value="custom">Custom voice ID…</option>
          </select>
          {local.elevenLabsVoiceId === 'custom' && (
            <input
              className="input"
              placeholder="Paste your custom ElevenLabs voice ID"
              onChange={(e) => setLocal({ ...local, elevenLabsVoiceId: e.target.value })}
            />
          )}
          <div className="settings__hint">
            Without a key, Jarvis uses your system's built-in voice.{' '}
            <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">Get a key →</a>
          </div>
        </div>
        <label className="toggle-row">
          <span>Confirm destructive actions</span>
          <input
            type="checkbox"
            checked={local.confirmDestructiveActions}
            onChange={(e) => setLocal({ ...local, confirmDestructiveActions: e.target.checked })}
          />
        </label>
      </div>

      <button className={`btn-primary btn-save ${saved ? 'btn-save--done' : ''}`} onClick={handleSave}>
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  )
}
