import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { startMobileServer } from './server'
import { createTray } from './tray'
import { startSpeechRecognition, stopSpeechRecognition } from './speech'

// keep app running when all windows are hidden (tray app)
app.on('before-quit', () => {
  stopSpeechRecognition()
  const wins = BrowserWindow.getAllWindows()
  wins.forEach((w) => w.removeAllListeners('close'))
})

app.whenReady().then(() => {
  app.setAppUserModelId('com.jarvis.app')

  registerIpcHandlers()
  startMobileServer()
  createMainWindow()
  createTray()
  // Start Windows speech recognition background process
  startSpeechRecognition()

  app.on('activate', () => {
    // macOS: re-show when clicking dock icon
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.show()
  })
})

// prevent default quit-on-all-windows-closed so tray keeps app alive
app.on('window-all-closed', () => {
  // intentionally empty — app lives in tray
})
