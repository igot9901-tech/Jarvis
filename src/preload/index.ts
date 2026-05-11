import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('jarvis', {
  // window
  collapse: () => ipcRenderer.send('window:collapse'),
  expand: () => ipcRenderer.send('window:expand'),

  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: Record<string, unknown>) => ipcRenderer.invoke('settings:save', s),
  getHomeDir: () => ipcRenderer.invoke('settings:get-home-dir'),

  // google
  googleAuth: () => ipcRenderer.invoke('google:auth'),
  googleDisconnect: () => ipcRenderer.invoke('google:disconnect'),
  googleIsConnected: () => ipcRenderer.invoke('google:is-connected'),

  // agent
  sendMessage: (msg: string) => ipcRenderer.send('agent:chat', msg),
  onAgentEvent: (cb: (event: unknown) => void) => {
    const handler = (_: unknown, event: unknown) => cb(event)
    ipcRenderer.on('agent:event', handler)
    return () => ipcRenderer.removeListener('agent:event', handler)
  },

  // speech recognition (Windows System.Speech, fires for every utterance)
  onSpeechResult: (cb: (text: string) => void) => {
    const handler = (_: unknown, text: string) => cb(text)
    ipcRenderer.on('speech:result', handler)
    return () => ipcRenderer.removeListener('speech:result', handler)
  },

  // mobile
  getMobileURL: () => ipcRenderer.invoke('mobile:url'),

  // macOS native TTS
  ttsSay: (text: string, voice: string) => ipcRenderer.invoke('tts:say', text, voice),
  ttsSayStop: () => ipcRenderer.send('tts:say-stop'),

  // platform
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // app
  getVersion: () => ipcRenderer.invoke('app:version')
})
