import { useCallback, useEffect } from 'react'
import { useStore } from '../store'

let audioCtx: AudioContext | null = null
function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

// Returns true on success, throws on failure so caller can fall back
async function elevenLabsSpeak(
  text: string,
  apiKey: string,
  voiceId: string,
  onStart: () => void,
  onEnd: () => void
): Promise<void> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.48,
          similarity_boost: 0.78,
          style: 0.12,
          use_speaker_boost: true
        }
      })
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs ${res.status}: ${err}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const ctx = getAudioContext()
  const decoded = await ctx.decodeAudioData(arrayBuffer)
  const source = ctx.createBufferSource()
  source.buffer = decoded
  source.connect(ctx.destination)
  onStart()
  source.onended = onEnd
  source.start(0)
}

function browserSpeak(text: string, onStart: () => void, onEnd: () => void): void {
  window.speechSynthesis.cancel()

  function doSpeak() {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.05
    utterance.pitch = 1.0
    utterance.volume = 1.0

    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith('en') && (
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('david') ||
          v.name.toLowerCase().includes('mark') ||
          v.name.toLowerCase().includes('natural')
        )
    )
    if (preferred) utterance.voice = preferred

    utterance.onstart = onStart
    utterance.onend = onEnd
    utterance.onerror = (e) => { console.warn('[TTS] browser error:', e.error); onEnd() }
    window.speechSynthesis.speak(utterance)
    console.log('[TTS] browser speak started, voice:', preferred?.name ?? 'default')
  }

  // Voices may not be loaded yet on first call — wait for them
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    doSpeak()
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null
      doSpeak()
    }
    // Safety fallback: speak anyway after 300ms if event never fires
    setTimeout(doSpeak, 300)
  }
}

export function useVoice(_onTranscript: (text: string) => void) {
  const { agentState, setAgentState, settings } = useStore()

  const speak = useCallback(
    (text: string) => {
      if (!settings?.ttsEnabled) {
        console.log('[TTS] skipped — ttsEnabled is off')
        return
      }

      const onStart = () => setAgentState('speaking')
      const onEnd = () => setAgentState('idle')

      if (settings.elevenLabsApiKey && settings.elevenLabsVoiceId) {
        console.log('[TTS] trying ElevenLabs…')
        elevenLabsSpeak(text, settings.elevenLabsApiKey, settings.elevenLabsVoiceId, onStart, onEnd)
          .catch((err) => {
            console.warn('[TTS] ElevenLabs failed, falling back to browser TTS:', err.message)
            browserSpeak(text, onStart, onEnd)
          })
      } else {
        console.log('[TTS] using browser TTS')
        browserSpeak(text, onStart, onEnd)
      }
    },
    [settings, setAgentState]
  )

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    try { getAudioContext().suspend() } catch {}
    setAgentState('idle')
  }, [setAgentState])

  // Mic button: flip into listening mode.
  // The background Windows speech engine (speech.ts) handles the actual capture —
  // useWakeWord forwards the next utterance as a command when state === 'listening'.
  const startListening = useCallback(() => {
    if (agentState !== 'idle') return
    if (!settings?.voiceEnabled) return
    setAgentState('listening')
  }, [agentState, settings?.voiceEnabled, setAgentState])

  const stopListening = useCallback(() => {
    setAgentState('idle')
  }, [setAgentState])

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  return { speak, startListening, stopListening, stopSpeaking }
}
