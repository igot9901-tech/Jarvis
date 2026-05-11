import { BrowserWindow, screen, session, systemPreferences } from 'electron'
import { join } from 'path'

const isDev = process.env['NODE_ENV'] === 'development' || !!process.env['ELECTRON_RENDERER_URL']

let mainWindow: BrowserWindow | null = null

export function createMainWindow(): BrowserWindow {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: sw,
    height: sh,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false,
    skipTaskbar: true,       // never shows in taskbar
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Grant microphone permission so SpeechRecognition works
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'speech-recognition']
    callback(allowed.includes(permission))
  })

  mainWindow.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'speech-recognition']
    return allowed.includes(permission)
  })

  // On macOS ask the OS for microphone access (required for Web Speech API)
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess?.('microphone').catch(() => {})
  }

  // hide to tray instead of closing
  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function setWindowSize(collapsed: boolean): void {
  if (!mainWindow) return
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  if (collapsed) {
    mainWindow.setSize(96, 96)
    mainWindow.setPosition(sw - 116, sh - 116)
    mainWindow.setAlwaysOnTop(true)
  } else {
    mainWindow.setSize(sw, sh)
    mainWindow.setPosition(0, 0)
    mainWindow.setAlwaysOnTop(false)
  }
}
