/**
 * Background speech recognition using Windows' built-in System.Speech assembly.
 * Runs a PowerShell process, reads recognized text from stdout, and forwards
 * it to the renderer via IPC as 'speech:result' events.
 *
 * This bypasses the Web Speech API entirely — no Google key, no internet needed.
 */
import { spawn, ChildProcess } from 'child_process'
import { writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getMainWindow } from './window'

const SCRIPT_PATH = join(tmpdir(), 'jarvis_speech.ps1')

// PowerShell script: loops Recognize() calls so we get one result per line on stdout
const PS_SCRIPT = `
Add-Type -AssemblyName System.Speech

try {
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $engine.SetInputToDefaultAudioDevice()

    $grammar = New-Object System.Speech.Recognition.DictationGrammar
    $engine.LoadGrammar($grammar)

    # How long to wait for speech to start before looping
    $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(6)
    # How long of silence ends an utterance
    $engine.EndSilenceTimeout     = [TimeSpan]::FromMilliseconds(600)
    $engine.BabbleTimeout         = [TimeSpan]::FromSeconds(0)

    while ($true) {
        try {
            $result = $engine.Recognize()
            if ($result -ne $null -and $result.Text.Trim().Length -gt 0) {
                Write-Host $result.Text.Trim()
                [Console]::Out.Flush()
            }
        } catch [System.TimeoutException] {
            # normal — no speech in the window, loop again
        } catch {
            Write-Host "ERROR: $_"
            [Console]::Out.Flush()
            break
        }
    }
    $engine.Dispose()
} catch {
    Write-Host "INIT_ERROR: $_"
    [Console]::Out.Flush()
    exit 1
}
`

let proc: ChildProcess | null = null
let buffer = ''
let running = false

export function startSpeechRecognition(): void {
  // Windows only — macOS uses Web Speech API in the renderer instead
  if (process.platform !== 'win32') return
  if (running) return
  running = true
  writeFileSync(SCRIPT_PATH, PS_SCRIPT, 'utf8')
  spawnProc()
}

function spawnProc(): void {
  if (!running) return

  proc = spawn('powershell.exe', [
    '-ExecutionPolicy', 'Bypass',
    '-NonInteractive',
    '-NoProfile',
    '-File', SCRIPT_PATH
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })

  proc.stdout?.setEncoding('utf8')
  proc.stdout?.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const text = line.trim()
      if (!text) continue
      if (text.startsWith('ERROR:') || text.startsWith('INIT_ERROR:')) {
        console.warn('[Speech]', text)
        continue
      }
      console.log('[Speech recognized]', text)
      getMainWindow()?.webContents.send('speech:result', text)
    }
  })

  proc.stderr?.setEncoding('utf8')
  proc.stderr?.on('data', (chunk: string) => {
    const msg = chunk.trim()
    if (msg) console.warn('[Speech stderr]', msg)
  })

  proc.on('exit', (code) => {
    proc = null
    if (running) {
      // restart after brief pause
      setTimeout(spawnProc, 1500)
    }
  })
}

export function stopSpeechRecognition(): void {
  running = false
  proc?.kill('SIGTERM')
  proc = null
  try { if (existsSync(SCRIPT_PATH)) unlinkSync(SCRIPT_PATH) } catch {}
}
