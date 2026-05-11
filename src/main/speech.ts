/**
 * Background speech recognition — cross-platform:
 *   Windows: PowerShell + System.Speech (offline, no API key)
 *   macOS:   Swift + SFSpeechRecognizer (offline, no API key)
 *
 * Each platform runs a child process that writes recognised text to stdout,
 * one line per utterance. We forward those lines to the renderer via IPC.
 */
import { spawn, ChildProcess } from 'child_process'
import { writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getMainWindow } from './window'

// ── Windows: PowerShell + System.Speech ───────────────────────────────────────
const PS_PATH = join(tmpdir(), 'jarvis_speech.ps1')
const PS_SCRIPT = `
Add-Type -AssemblyName System.Speech
try {
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $engine.SetInputToDefaultAudioDevice()
    $grammar = New-Object System.Speech.Recognition.DictationGrammar
    $engine.LoadGrammar($grammar)
    $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(6)
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
        } catch {
            Write-Host "ERROR: $_"; [Console]::Out.Flush(); break
        }
    }
    $engine.Dispose()
} catch {
    Write-Host "INIT_ERROR: $_"; [Console]::Out.Flush(); exit 1
}
`

// ── macOS: Swift + SFSpeechRecognizer ─────────────────────────────────────────
const SWIFT_PATH = join(tmpdir(), 'jarvis_speech.swift')
const SWIFT_SCRIPT = `
import Foundation
import Speech
import AVFoundation

var audioEngine: AVAudioEngine?
var currentTask: SFSpeechRecognitionTask?
var currentRequest: SFSpeechAudioBufferRecognitionRequest?
let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!

func startListening() {
    let engine = AVAudioEngine()
    audioEngine = engine
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = false
    currentRequest = request

    let node = engine.inputNode
    let fmt  = node.outputFormat(forBus: 0)
    node.installTap(onBus: 0, bufferSize: 4096, format: fmt) { buf, _ in
        request.append(buf)
    }

    do { try engine.start() } catch {
        fputs("ERROR starting audio engine\\n", stderr)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { startListening() }
        return
    }

    currentTask = recognizer.recognitionTask(with: request) { result, error in
        let node = engine.inputNode
        if let result = result, result.isFinal {
            let text = result.bestTranscription.formattedString
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty {
                print(text)
                fflush(stdout)
            }
            engine.stop()
            node.removeTap(onBus: 0)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { startListening() }
        } else if error != nil {
            engine.stop()
            node.removeTap(onBus: 0)
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { startListening() }
        }
    }
}

SFSpeechRecognizer.requestAuthorization { status in
    guard status == .authorized else {
        fputs("Speech recognition not authorized\\n", stderr)
        exit(1)
    }
    DispatchQueue.main.async { startListening() }
}

RunLoop.main.run()
`

// ── Shared process management ──────────────────────────────────────────────────
let proc_: { value: ChildProcess | null } = { value: null }
let buffer = ''
let running = false

export function startSpeechRecognition(): void {
  if (running) return
  running = true

  if (process.platform === 'win32') {
    writeFileSync(PS_PATH, PS_SCRIPT, 'utf8')
  } else if (process.platform === 'darwin') {
    writeFileSync(SWIFT_PATH, SWIFT_SCRIPT, 'utf8')
  } else {
    return  // Linux not supported yet
  }

  spawnProc()
}

function spawnProc(): void {
  if (!running) return

  const isWin = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  const child = isWin
    ? spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NonInteractive', '-NoProfile', '-File', PS_PATH], {
        stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
      })
    : isMac
    ? spawn('swift', [SWIFT_PATH], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
    : null

  if (!child) return
  proc_.value = child

  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const text = line.trim()
      if (!text || text.startsWith('ERROR') || text.startsWith('INIT_ERROR')) {
        if (text) console.warn('[Speech]', text)
        continue
      }
      console.log('[Speech recognized]', text)
      getMainWindow()?.webContents.send('speech:result', text)
    }
  })

  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    const msg = chunk.trim()
    if (msg) console.warn('[Speech stderr]', msg)
  })

  child.on('exit', () => {
    proc_.value = null
    if (running) setTimeout(spawnProc, 1500)
  })
}

export function stopSpeechRecognition(): void {
  running = false
  proc_.value?.kill()
  proc_.value = null
  try { if (existsSync(PS_PATH))    unlinkSync(PS_PATH)    } catch {}
  try { if (existsSync(SWIFT_PATH)) unlinkSync(SWIFT_PATH) } catch {}
}
