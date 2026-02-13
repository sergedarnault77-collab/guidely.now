import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface CinematicContextValue {
  cinematic: boolean
  setCinematic: (on: boolean) => void
  toggleCinematic: () => void
}

const CinematicContext = createContext<CinematicContextValue>({
  cinematic: false,
  setCinematic: () => {},
  toggleCinematic: () => {},
})

const STORAGE_KEY = 'guidely-cinematic'

export function CinematicProvider({ children }: { children: ReactNode }) {
  const [cinematic, setCinematicState] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    const root = document.documentElement
    if (cinematic) {
      root.classList.add('cinematic', 'dark')
    } else {
      root.classList.remove('cinematic')
      // Restore previous theme preference
      const saved = localStorage.getItem('theme')
      if (saved === 'light') root.classList.remove('dark')
    }
  }, [cinematic])

  const setCinematic = (on: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(on))
    setCinematicState(on)
  }

  const toggleCinematic = () => setCinematic(!cinematic)

  return (
    <CinematicContext.Provider value={{ cinematic, setCinematic, toggleCinematic }}>
      {children}
    </CinematicContext.Provider>
  )
}

export function useCinematic() {
  return useContext(CinematicContext)
}
