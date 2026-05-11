/**
 * Single shared settings store for the entire main process.
 * Import this everywhere instead of creating new Store() instances.
 */
import Store from 'electron-store'
import os from 'os'
import path from 'path'

export const store = new Store({
  name: 'jarvis-settings',
  defaults: {
    anthropicApiKey: '',
    stripeApiKey: '',
    googleClientId: '',
    googleClientSecret: '',
    googleRefreshToken: '',
    fileScopePaths: [
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Downloads')
    ],
    userName: '',
    voiceEnabled: true,
    ttsEnabled: true,
    elevenLabsApiKey: '',
    elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
    confirmDestructiveActions: true
  }
})

export function getSetting<T>(key: string): T {
  return store.get(key) as T
}

export function setSetting(key: string, value: unknown): void {
  store.set(key, value)
}

export function getAllSettings(): Record<string, unknown> {
  return store.store
}
