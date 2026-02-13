import { useState, useCallback, useRef, useEffect } from 'react'

// ── Public types ────────────────────────────────────────────

export interface SpeakOptions {
  voiceId?: string
  rate?: number
  pitch?: number
  mode?: string // "serious" | "casual" | "demanding" | "funny"
}

export interface VoiceInfo {
  id: string   // voice.voiceURI (browser) or voice name (openai)
  name: string
  lang: string
}

export type TTSProvider = 'openai' | 'browser'

interface TTSState {
  supported: boolean
  speaking: boolean
  speak: (text: string, opts?: SpeakOptions) => void
  stop: () => void
  provider: TTSProvider
  cloudAvailable: boolean
  setProvider: (p: TTSProvider) => void
  cloudError: boolean
}

// ── OpenAI voices (curated subset) ──────────────────────────

export const OPENAI_VOICES: VoiceInfo[] = [
  { id: 'alloy', name: 'Alloy', lang: 'en' },
  { id: 'ash', name: 'Ash', lang: 'en' },
  { id: 'coral', name: 'Coral', lang: 'en' },
  { id: 'nova', name: 'Nova', lang: 'en' },
  { id: 'onyx', name: 'Onyx', lang: 'en' },
  { id: 'sage', name: 'Sage', lang: 'en' },
  { id: 'shimmer', name: 'Shimmer', lang: 'en' },
  { id: 'verse', name: 'Verse', lang: 'en' },
]

// ── Browser voice blacklist ─────────────────────────────────

const BLOCK_NAMES = ['Compact', 'Novelty', 'Eloquence', 'Whisper']
const isBlocked = (v: SpeechSynthesisVoice) =>
  BLOCK_NAMES.some((b) => v.name.includes(b))
const isEnglish = (v: SpeechSynthesisVoice) => v.lang.startsWith('en')

// ── Browser voice helpers (exported for the dropdown) ───────

let _voices: SpeechSynthesisVoice[] = []
function refreshVoices() { _voices = speechSynthesis.getVoices() }

export function getAvailableVoices(): VoiceInfo[] {
  if (_voices.length === 0) refreshVoices()
  return _voices
    .filter((v) => isEnglish(v) && !isBlocked(v))
    .slice(0, 12)
    .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }))
}

export function getDefaultVoiceId(): string | null {
  return pickVoice(_voices)?.voiceURI ?? null
}

// ── Browser voice ranking ───────────────────────────────────

const PREFERRED = [
  'Samantha', 'Ava', 'Daniel',
  'Google US English', 'Google UK English Female',
  'Microsoft Aria Online (Natural)', 'Microsoft Jenny Online (Natural)',
]

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const navLang = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
  const good = voices.filter((v) => isEnglish(v) && !isBlocked(v))
  for (const name of PREFERRED) {
    const v = good.find((v) => v.name.includes(name))
    if (v) return v
  }
  const exact = good.find((v) => v.lang === navLang)
  if (exact) return exact
  const us = good.find((v) => v.lang === 'en-US')
  if (us) return us
  return good[0] || voices.find((v) => isEnglish(v)) || null
}

function findVoiceById(id: string): SpeechSynthesisVoice | null {
  return _voices.find((v) => v.voiceURI === id) ?? null
}

// ── Text chunking (browser TTS only) ────────────────────────

function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks: string[] = []
  let buf = ''
  for (const s of sentences) {
    buf += s
    if (buf.length >= 120) { chunks.push(buf.trim()); buf = '' }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks
}

function makePause(): SpeechSynthesisUtterance {
  const p = new SpeechSynthesisUtterance(' ')
  p.rate = 1; p.volume = 0
  return p
}

// ── Warm start: ensure browser voices are loaded ────────────

async function ensureVoices(): Promise<void> {
  if (_voices.length > 0) return
  refreshVoices()
  if (_voices.length > 0) return
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 50))
    refreshVoices()
    if (_voices.length > 0) return
  }
}

// ── Hook ────────────────────────────────────────────────────

export function useTTS(): TTSState {
  const browserSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const [cloudAvailable, setCloudAvailable] = useState(false)
  const [cloudError, setCloudError] = useState(false)
  const [provider, setProviderRaw] = useState<TTSProvider>(() => {
    if (typeof window === 'undefined') return 'browser'
    return (localStorage.getItem('guidely.tts.provider.v1') as TTSProvider) || 'browser'
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const supported = browserSupported || cloudAvailable

  // ── Probe cloud endpoint on mount ──
  useEffect(() => {
    fetch('/api/tts')
      .then((r) => { if (r.ok) setCloudAvailable(true) })
      .catch(() => {})
  }, [])

  // ── Browser voice loading ──
  useEffect(() => {
    if (!browserSupported) return
    refreshVoices()
    const handler = () => refreshVoices()
    speechSynthesis.addEventListener('voiceschanged', handler)
    return () => speechSynthesis.removeEventListener('voiceschanged', handler)
  }, [browserSupported])

  // ── Cleanup on unmount ──
  useEffect(() => () => {
    if (browserSupported) speechSynthesis.cancel()
    if (audioRef.current) audioRef.current.pause()
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    if (abortRef.current) abortRef.current.abort()
  }, [browserSupported])

  // ── Cloud error auto-reset after 3s ──
  useEffect(() => {
    if (!cloudError) return
    const t = setTimeout(() => setCloudError(false), 3000)
    return () => clearTimeout(t)
  }, [cloudError])

  // ── Provider toggle (persisted) ──
  const setProvider = useCallback((p: TTSProvider) => {
    setProviderRaw(p)
    localStorage.setItem('guidely.tts.provider.v1', p)
  }, [])

  // ── Browser speak (kept as inner fn for fallback use) ──
  const speakBrowserRef = useRef<(text: string, opts?: SpeakOptions) => Promise<void>>(null as any)
  speakBrowserRef.current = async (text: string, opts?: SpeakOptions) => {
    if (!browserSupported) return
    speechSynthesis.cancel()
    await ensureVoices()
    const voice = opts?.voiceId ? findVoiceById(opts.voiceId) : pickVoice(_voices)
    const rate = opts?.rate ?? 0.98
    const pitch = opts?.pitch ?? 1.02
    const chunks = chunkText(text)
    setSpeaking(true)
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk)
      u.rate = rate; u.pitch = pitch; u.volume = 1.0
      if (voice) u.voice = voice
      if (i === chunks.length - 1) {
        u.onend = () => setSpeaking(false)
        u.onerror = () => setSpeaking(false)
      }
      speechSynthesis.speak(u)
      if (i < chunks.length - 1) speechSynthesis.speak(makePause())
    })
  }

  // ── Unified speak ──
  const speak = useCallback(async (text: string, opts?: SpeakOptions) => {
    const useCloud = provider === 'openai' && cloudAvailable

    if (useCloud) {
      setSpeaking(true)
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            text: text.slice(0, 4000),
            mode: opts?.mode,
            voice: opts?.voiceId || undefined,
          }),
        })
        if (!res.ok) throw new Error(`API ${res.status}`)

        const blob = await res.blob()
        if (controller.signal.aborted) return

        // Cleanup previous audio
        if (audioRef.current) audioRef.current.pause()
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)

        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        audioUrlRef.current = url

        audio.onended = () => { setSpeaking(false); audioRef.current = null }
        audio.onerror = () => { setSpeaking(false); audioRef.current = null }
        await audio.play()
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') { setSpeaking(false); return }
        setSpeaking(false)
        setCloudError(true)
        // Auto-fallback to browser TTS
        speakBrowserRef.current?.(text, opts)
      }
    } else {
      speakBrowserRef.current?.(text, opts)
    }
  }, [provider, cloudAvailable])

  // ── Stop (handles both providers) ──
  const stop = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null }
    if (browserSupported) speechSynthesis.cancel()
    setSpeaking(false)
  }, [browserSupported])

  return { supported, speaking, speak, stop, provider, cloudAvailable, setProvider, cloudError }
}
