import { useState, useCallback, useRef, useEffect } from 'react'

interface TTSState {
  supported: boolean
  speaking: boolean
  speak: (text: string) => void
  stop: () => void
}

/**
 * Browser TTS hook with cinematic-calm voice settings.
 * Falls back gracefully: `supported` is false if unavailable.
 */
export function useTTS(): TTSState {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      // Cancel any in-flight speech
      window.speechSynthesis.cancel()

      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.02
      utter.pitch = 0.95
      utter.volume = 1

      // Prefer a calm, natural voice if available
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Google UK')),
      )
      if (preferred) utter.voice = preferred

      utter.onstart = () => setSpeaking(true)
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)

      utterRef.current = utter
      window.speechSynthesis.speak(utter)
    },
    [supported],
  )

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  return { supported, speaking, speak, stop }
}
