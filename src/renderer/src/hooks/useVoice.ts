import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '../store'

// ── Audio context ─────────────────────────────────────────────────────────────
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
        voice_settings: { stability: 0.30, similarity_boost: 0.85, style: 0.45, use_speaker_boost: true }
      })
    }
  )
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)
  const decoded = await getAudioCtx().decodeAudioData(await res.arrayBuffer())
  const src = getAudioCtx().createBufferSource()
  src.buffer = decoded
  src.connect(getAudioCtx().destination)
  onStart()
  src.onended = onEnd
  src.start(0)
}

// ── macOS `say` TTS ───────────────────────────────────────────────────────────
async function macSay(text: string, onStart: () => void, onEnd: () => void): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (window as any).jarvis
  if (!j?.ttsSay) throw new Error('no ttsSay')
  onStart()
  await j.ttsSay(text, 'Samantha')
  onEnd()
}

// ── Browser TTS fallback ──────────────────────────────────────────────────────
function browserSpeak(text: string, onStart: () => void, onEnd: () => void): void {
  window.speechSynthesis.cancel()
  function go() {
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.0; utt.pitch = 1.0; utt.volume = 1.0
    const v = window.speechSynthesis.getVoices()
    const pick = v.find(x => x.lang.startsWith('en') &&
      (x.name.includes('Samantha') || x.name.includes('Daniel') ||
       x.name.includes('Zira') || x.name.includes('David')))
    if (pick) utt.voice = pick
    utt.onstart = onStart; utt.onend = onEnd; utt.onerror = () => onEnd()
    window.speechSynthesis.speak(utt)
  }
  window.speechSynthesis.getVoices().length > 0
    ? go()
    : (window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go() },
       setTimeout(go, 400))
}

// ── ElevenLabs STT ────────────────────────────────────────────────────────────
async function elevenLabsSTT(blob: Blob, apiKey: string): Promise<string> {
  const form = new FormData()
  form.append('file', blob, 'audio.webm')
  form.append('model_id', 'scribe_v1')
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST', headers: { 'xi-api-key': apiKey }, body: form
  })
  if (!res.ok) throw new Error(`STT ${res.status}`)
  return ((await res.json()).text ?? '').trim()
}

// ── Best supported audio format ───────────────────────────────────────────────
function bestMimeType(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useVoice(onTranscript: (text: string) => void) {
  const { agentState, setAgentState, settings } = useStore()
  const agentStateRef = useRef(agentState)
  const mediaRecRef   = useRef<MediaRecorder | null>(null)
  const chunksRef     = useRef<Blob[]>([])
  const autoStopRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const platformRef   = useRef<string>('unknown')
  const onTranscriptRef = useRef(onTranscript)

  useEffect(() => { agentStateRef.current = agentState }, [agentState])
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).jarvis?.getPlatform?.().then((p: string) => { platformRef.current = p })
  }, [])

  // ── speak ───────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!settings?.ttsEnabled) return
    const onStart = () => setAgentState('speaking')
    const onEnd   = () => setAgentState('idle')

    if (settings.elevenLabsApiKey && settings.elevenLabsVoiceId) {
      elevenLabsSpeak(text, settings.elevenLabsApiKey, settings.elevenLabsVoiceId, onStart, onEnd)
        .catch(() => {
          platformRef.current === 'darwin'
            ? macSay(text, onStart, onEnd).catch(() => browserSpeak(text, onStart, onEnd))
            : browserSpeak(text, onStart, onEnd)
        })
    } else if (platformRef.current === 'darwin') {
      macSay(text, onStart, onEnd).catch(() => browserSpeak(text, onStart, onEnd))
    } else {
      browserSpeak(text, onStart, onEnd)
    }
  }, [settings, setAgentState])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).jarvis?.ttsSayStop?.()
    try { getAudioCtx().suspend() } catch {}
    setAgentState('idle')
  }, [setAgentState])

  // ── stopListening ────────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop()
    } else {
      setAgentState('idle')
    }
  }, [setAgentState])

  // ── startListening ───────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (agentState !== 'idle') return
    if (!settings?.voiceEnabled) return
    setAgentState('listening')

    // ── Try Web Speech API first (works on macOS 12+ natively) ───────────────
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.lang = 'en-US'
      rec.continuous = false
      rec.interimResults = false
      rec.maxAlternatives = 1

      let usedFallback = false

      rec.onresult = (e: any) => {
        const text = e.results[0]?.[0]?.transcript?.trim()
        if (text) { setAgentState('idle'); onTranscriptRef.current(text) }
      }
      rec.onerror = async (e: any) => {
        if (!usedFallback && (e.error === 'network' || e.error === 'service-not-allowed')) {
          usedFallback = true
          recordAndTranscribe()
        } else if (e.error !== 'aborted') {
          setAgentState('idle')
        }
      }
      rec.onend = () => {
        if (agentStateRef.current === 'listening' && !usedFallback) setAgentState('idle')
      }

      try { rec.start(); return } catch {}
    }

    // ── Fallback: MediaRecorder + ElevenLabs STT ──────────────────────────────
    recordAndTranscribe()

    async function recordAndTranscribe() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mime   = bestMimeType()
        const rec    = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
        chunksRef.current = []
        mediaRecRef.current = rec

        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          mediaRecRef.current = null
          const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
          if (settings?.elevenLabsApiKey && blob.size > 500) {
            try {
              const text = await elevenLabsSTT(blob, settings.elevenLabsApiKey)
              if (text) { onTranscriptRef.current(text) }
              else console.warn('[STT] empty transcript')
            } catch (err) { console.warn('[STT] failed:', err) }
          } else if (!settings?.elevenLabsApiKey) {
            console.warn('[STT] No ElevenLabs key — add one in Settings to use the mic button')
          }
          setAgentState('idle')
        }

        rec.start()
        // Auto-stop after 8 seconds
        autoStopRef.current = setTimeout(() => {
          if (rec.state === 'recording') rec.stop()
        }, 8000)

      } catch (err) {
        console.error('[Mic] failed:', err)
        setAgentState('idle')
      }
    }
  }, [agentState, settings, setAgentState])

  useEffect(() => () => {
    window.speechSynthesis.cancel()
    if (mediaRecRef.current?.state === 'recording') mediaRecRef.current.stop()
  }, [])

  return { speak, startListening, stopListening, stopSpeaking }
}
