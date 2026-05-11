/**
 * Wake word detection — cross-platform:
 *  • Windows: IPC 'speech:result' from PowerShell System.Speech (speech.ts)
 *  • macOS:   IPC 'speech:result' from Swift SFSpeechRecognizer (speech.ts)
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store'

const WAKE_PHRASES = [
  'hey jarvis',
  'jarvis',
  'yo jarvis',
  'ok jarvis',
  'okay jarvis',
  'hey travis',   // common mishearing
  'hey gyros',    // common mishearing
]

function containsWakeWord(text: string): boolean {
  const lower = text.toLowerCase()
  return WAKE_PHRASES.some((p) => lower.includes(p))
}

function stripWakeWord(text: string): string {
  let result = text.toLowerCase().trim()
  for (const phrase of WAKE_PHRASES) {
    const idx = result.indexOf(phrase)
    if (idx !== -1) {
      result = result.slice(idx + phrase.length).replace(/^[,.\s]+/, '').trim()
      break
    }
  }
  return result
}

// ── macOS: Web Speech API loop ────────────────────────────────────────────────
function startWebSpeechLoop(
  onText: (text: string) => void,
  activeRef: React.MutableRefObject<boolean>
) {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) return

  function launch() {
    if (!activeRef.current) return
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 3

    rec.onresult = (e: any) => {
      const transcripts: string[] = []
      for (let i = 0; i < e.results.length; i++)
        for (let j = 0; j < e.results[i].length; j++)
          transcripts.push(e.results[i][j].transcript.trim())
      const best = transcripts[0]
      if (best) onText(best)
    }

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted')
        console.warn('[WakeWord macOS]', e.error)
    }

    rec.onend = () => {
      if (activeRef.current) setTimeout(launch, 150)
    }

    try { rec.start() } catch {}
  }

  launch()
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useWakeWord(onCommand: (text: string) => void) {
  const { agentState, setAgentState, settings } = useStore()
  const agentStateRef = useRef(agentState)
  const onCommandRef  = useRef(onCommand)
  const activeRef     = useRef(false)

  useEffect(() => { agentStateRef.current = agentState }, [agentState])
  useEffect(() => { onCommandRef.current  = onCommand  }, [onCommand])

  function handleText(text: string) {
    const state = agentStateRef.current
    if (state === 'thinking' || state === 'speaking') return

    if (!containsWakeWord(text)) {
      // Already in listening mode → treat anything as a command
      if (state === 'listening') {
        setAgentState('idle')
        onCommandRef.current(text)
      }
      return
    }

    const command = stripWakeWord(text)
    if (command.length > 2) {
      onCommandRef.current(command)
    } else {
      setAgentState('listening')
    }
  }

  useEffect(() => {
    if (!settings?.voiceEnabled) return
    activeRef.current = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jarvis = (window as any).jarvis

    if (jarvis?.onSpeechResult) {
      // ── Windows: IPC stream from PowerShell speech engine ──────────────────
      const unsub = jarvis.onSpeechResult((text: string) => handleText(text))
      return () => {
        activeRef.current = false
        unsub?.()
      }
    } else {
      // ── macOS (or any non-Windows): Web Speech API loop ────────────────────
      startWebSpeechLoop(handleText, activeRef)
      return () => { activeRef.current = false }
    }
  }, [settings?.voiceEnabled, setAgentState])
}
