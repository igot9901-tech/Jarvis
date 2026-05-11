import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '../store'

// ── Audio context (shared) ────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext()
  return audioCtx
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function elevenLabsSpeak(
  text: string, apiKey: string, voiceId: string,
  onStart: () => void, onEnd: () => void
): Promise<void> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.30,          // expressive, not flat
          similarity_boost: 0.85,
          style: 0.45,              // natural cadence & emotion
          use_speaker_boost: true
        }
      })
    }
  )
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`)
  const buf     = await res.arrayBuffer()
  const ctx     = getAudioCtx()
  const decoded = await ctx.decodeAudioData(buf)
  const src     = ctx.createBufferSource()
  src.buffer    = decoded
  src.connect(ctx.destination)
  onStart()
  src.onended = onEnd
  src.start(0)
}

// ── macOS native `say` TTS ────────────────────────────────────────────────────
// Sounds far more human than browser TTS — uses Apple's neural voices
async function macSay(
  text: string, onStart: () => void, onEnd: () => void
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jarvis = (window as any).jarvis
  if (!jarvis?.ttsSay) throw new Error('ttsSay not available')
  onStart()
  // Best macOS voices: 'Samantha' (US), 'Daniel' (UK), 'Karen' (AU)
  await jarvis.ttsSay(text, 'Samantha')
  onEnd()
}

// ── Browser TTS fallback ──────────────────────────────────────────────────────
function browserSpeak(text: string, onStart: () => void, onEnd: () => void): void {
  window.speechSynthesis.cancel()
  function go() {
    const utt    = new SpeechSynthesisUtterance(text)
    utt.rate     = 1.0
    utt.pitch    = 1.0
    utt.volume   = 1.0
    const voices = window.speechSynthesis.getVoices()
    const pick   = voices.find(v =>
      v.lang.startsWith('en') && (
        v.name.includes('Samantha') || v.name.includes('Daniel') ||
        v.name.includes('Zira')    || v.name.includes('David')   ||
        v.name.includes('Natural')
      )
    )
    if (pick) utt.voice = pick
    utt.onstart = onStart
    utt.onend   = onEnd
    utt.onerror = () => onEnd()
    window.speechSynthesis.speak(utt)
  }
  if (window.speechSynthesis.getVoices().length > 0) {
    go()
  } else {
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go() }
    setTimeout(go, 400)
  }
}

// ── ElevenLabs STT (Speech-to-Text) ──────────────────────────────────────────
async function elevenLabsSTT(blob: Blob, apiKey: string): Promise<string> {
  const form = new FormData()
  form.append('file', blob, 'audio.webm')
  form.append('model_id', 'scribe_v1')
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form
  })
  if (!res.ok) throw new Error(`ElevenLabs STT ${res.status}`)
  const data = await res.json()
  return data.text?.trim() ?? ''
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useVoice(onTranscript: (text: string) => void) {
  const { agentState, setAgentState, settings } = useStore()
  const mediaRecRef  = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const platformRef  = useRef<string>('unknown')

  // Detect platform once
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jarvis = (window as any).jarvis
    jarvis?.getPlatform?.().then((p: string) => { platformRef.current = p })
  }, [])

  // ── speak ───────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!settings?.ttsEnabled) return

    const onStart = () => setAgentState('speaking')
    const onEnd   = () => setAgentState('idle')

    // 1. Try ElevenLabs first (best quality)
    if (settings.elevenLabsApiKey && settings.elevenLabsVoiceId) {
      elevenLabsSpeak(text, settings.elevenLabsApiKey, settings.elevenLabsVoiceId, onStart, onEnd)
        .catch(() => {
          // 2. macOS: use `say` command (very natural)
          if (platformRef.current === 'darwin') {
            macSay(text, onStart, onEnd).catch(() => browserSpeak(text, onStart, onEnd))
          } else {
            browserSpeak(text, onStart, onEnd)
          }
        })
      return
    }

    // No ElevenLabs key
    if (platformRef.current === 'darwin') {
      macSay(text, onStart, onEnd).catch(() => browserSpeak(text, onStart, onEnd))
    } else {
      browserSpeak(text, onStart, onEnd)
    }
  }, [settings, setAgentState])

  // ── stopSpeaking ────────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).jarvis?.ttsSayStop?.()
    try { getAudioCtx().suspend() } catch {}
    setAgentState('idle')
  }, [setAgentState])

  // ── startListening (mic button) ─────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (agentState !== 'idle') return
    if (!settings?.voiceEnabled) return

    setAgentState('listening')

    // Record audio with MediaRecorder, then transcribe via ElevenLabs STT
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec    = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mediaRecRef.current = rec

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        if (settings.elevenLabsApiKey && blob.size > 1000) {
          try {
            const text = await elevenLabsSTT(blob, settings.elevenLabsApiKey)
            if (text) onTranscript(text)
          } catch (err) {
            console.warn('[STT] ElevenLabs STT failed:', err)
          }
        }
        setAgentState('idle')
      }

      rec.start()
      // Auto-stop after 8 seconds of silence or when stopListening is called
    } catch (err) {
      console.error('[Mic] getUserMedia failed:', err)
      setAgentState('idle')
    }
  }, [agentState, settings, onTranscript, setAgentState])

  // ── stopListening ────────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop()
    }
    setAgentState('idle')
  }, [setAgentState])

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
      if (mediaRecRef.current?.state === 'recording') mediaRecRef.current.stop()
    }
  }, [])

  return { speak, startListening, stopListening, stopSpeaking }
}
