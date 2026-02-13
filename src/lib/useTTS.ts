import { useState, useCallback, useRef, useEffect } from 'react'

// ── Public types ────────────────────────────────────────────

export interface SpeakOptions {
  voiceId?: string
  rate?: number
  pitch?: number
}

export interface VoiceInfo {
  id: string   // voice.voiceURI
  name: string
  lang: string
}

interface TTSState {
  supported: boolean
  speaking: boolean
  speak: (text: string, opts?: SpeakOptions) => void
  stop: () => void
}

// ── Blacklist filters ───────────────────────────────────────

const BLOCK_NAMES = ['Compact', 'Novelty', 'Eloquence', 'Whisper']
const isBlocked = (v: SpeechSynthesisVoice) =>
  BLOCK_NAMES.some((b) => v.name.includes(b))
const isEnglish = (v: SpeechSynthesisVoice) => v.lang.startsWith('en')

// ── Voice helpers (exported for the dropdown) ───────────────

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

// ── Voice ranking ───────────────────────────────────────────

const PREFERRED = [
  'Samantha', 'Ava', 'Daniel',
  'Google US English', 'Google UK English Female',
  'Microsoft Aria Online (Natural)', 'Microsoft Jenny Online (Natural)',
]

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const navLang = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
  const good = voices.filter((v) => isEnglish(v) && !isBlocked(v))

  // Try preferred names
  for (const name of PREFERRED) {
    const v = good.find((v) => v.name.includes(name))
    if (v) return v
  }
  // Prefer exact lang match (e.g. en-GB)
  const exact = good.find((v) => v.lang === navLang)
  if (exact) return exact
  // en-US fallback
  const us = good.find((v) => v.lang === 'en-US')
  if (us) return us
  // Any English
  return good[0] || voices.find((v) => isEnglish(v)) || null
}

function findVoiceById(id: string): SpeechSynthesisVoice | null {
  return _voices.find((v) => v.voiceURI === id) ?? null
}

// ── Chunking ────────────────────────────────────────────────

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

// ── Warm start: ensure voices are loaded ────────────────────

async function ensureVoices(): Promise<void> {
  if (_voices.length > 0) return
  refreshVoices()
  if (_voices.length > 0) return
  // Poll up to 300ms
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 50))
    refreshVoices()
    if (_voices.length > 0) return
  }
}

// ── Hook ────────────────────────────────────────────────────

export function useTTS(): TTSState {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)

  // Resolve voices on mount + change
  useEffect(() => {
    if (!supported) return
    refreshVoices()
    const handler = () => refreshVoices()
    speechSynthesis.addEventListener('voiceschanged', handler)
    return () => speechSynthesis.removeEventListener('voiceschanged', handler)
  }, [supported])

  // Cleanup on unmount
  useEffect(() => () => { if (supported) speechSynthesis.cancel() }, [supported])

  const speak = useCallback(async (text: string, opts?: SpeakOptions) => {
    if (!supported) return
    speechSynthesis.cancel()
    await ensureVoices()

    const voice = opts?.voiceId ? findVoiceById(opts.voiceId) : pickVoice(_voices)
    const rate = opts?.rate ?? 0.98
    const pitch = opts?.pitch ?? 1.02

    const chunks = chunkText(text)
    setSpeaking(true)

    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk)
      u.rate = rate
      u.pitch = pitch
      u.volume = 1.0
      if (voice) u.voice = voice

      if (i === chunks.length - 1) {
        u.onend = () => setSpeaking(false)
        u.onerror = () => setSpeaking(false)
      }

      speechSynthesis.speak(u)
      // Insert micro-pause between chunks
      if (i < chunks.length - 1) speechSynthesis.speak(makePause())
    })
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  return { supported, speaking, speak, stop }
}
