import { ipcMain, app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { store } from './settings'
import { agent } from './agent/index'
import { initiateGoogleAuth } from './agent/tools/calendar'
import { getMainWindow, setWindowSize } from './window'
import { getMobileServerURL } from './server'
import os from 'os'
import path from 'path'

export function registerIpcHandlers(): void {
  // ── Window control ──────────────────────────────────────────────────────────
  ipcMain.on('window:collapse', () => setWindowSize(true))
  ipcMain.on('window:expand', () => setWindowSize(false))

  // ── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => {
    return {
      anthropicApiKey: store.get('anthropicApiKey') || '',
      stripeApiKey: store.get('stripeApiKey') || '',
      googleClientId: store.get('googleClientId') || '',
      googleClientSecret: store.get('googleClientSecret') || '',
      googleRefreshToken: store.get('googleRefreshToken') || '',
      fileScopePaths: store.get('fileScopePaths') || [
        path.join(os.homedir(), 'Documents'),
        path.join(os.homedir(), 'Desktop'),
        path.join(os.homedir(), 'Downloads')
      ],
      userName: store.get('userName') || '',
      voiceEnabled: store.get('voiceEnabled') !== false,
      ttsEnabled: store.get('ttsEnabled') !== false,
      elevenLabsApiKey: store.get('elevenLabsApiKey') || '',
      elevenLabsVoiceId: store.get('elevenLabsVoiceId') || '21m00Tcm4TlvDq8ikWAM',
      confirmDestructiveActions: store.get('confirmDestructiveActions') !== false
    }
  })

  ipcMain.handle('settings:save', (_, settings: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key, value)
    }
    // invalidate agent client so it picks up new API key
    agent.invalidateClient()
    return { ok: true }
  })

  ipcMain.handle('settings:get-home-dir', () => os.homedir())

  // ── Google OAuth ────────────────────────────────────────────────────────────
  ipcMain.handle('google:auth', async () => {
    try {
      const result = await initiateGoogleAuth()
      return { ok: true, message: result }
    } catch (err: any) {
      return { ok: false, message: err.message }
    }
  })

  ipcMain.handle('google:disconnect', () => {
    store.delete('googleRefreshToken')
    return { ok: true }
  })

  ipcMain.handle('google:is-connected', () => {
    return !!store.get('googleRefreshToken')
  })

  // ── Agent chat ──────────────────────────────────────────────────────────────
  ipcMain.on('agent:chat', async (event, userMessage: string) => {
    const win = getMainWindow()
    if (!win) return

    await agent.chat(userMessage, (agentEvent) => {
      win.webContents.send('agent:event', agentEvent)
    })
  })

  // ── macOS native TTS via `say` command (sounds way more human) ───────────────
  let sayProc: ChildProcess | null = null
  ipcMain.handle('tts:say', async (_, text: string, voice: string) => {
    if (process.platform !== 'darwin') return false
    sayProc?.kill()
    return new Promise<void>((resolve) => {
      sayProc = spawn('say', ['-v', voice, text])
      sayProc.on('exit', () => { sayProc = null; resolve() })
    })
  })
  ipcMain.on('tts:say-stop', () => { sayProc?.kill(); sayProc = null })

  // ── Platform info ─────────────────────────────────────────────────────────────
  ipcMain.handle('app:platform', () => process.platform)

  // ── Mobile server ────────────────────────────────────────────────────────────
  ipcMain.handle('mobile:url', () => getMobileServerURL())

  // ── App info ────────────────────────────────────────────────────────────────
  ipcMain.handle('app:version', () => app.getVersion())
}
