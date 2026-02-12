/**
 * App Settings
 * Manages user preferences and app configuration
 */

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  notifications: boolean
  cloudSync: boolean
  autoBackup: boolean
  language: string
}

const SETTINGS_KEY = 'guidely_app_settings'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  notifications: true,
  cloudSync: false,
  autoBackup: true,
  language: 'en',
}

/**
 * Load app settings from storage
 */
export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  
  return DEFAULT_SETTINGS
}

/**
 * Save app settings to storage
 */
export function saveSettings(settings: Partial<AppSettings>): void {
  if (typeof window === 'undefined') return
  
  try {
    const current = loadSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Error saving settings:', error)
  }
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(SETTINGS_KEY)
  } catch (error) {
    console.error('Error resetting settings:', error)
  }
}

/**
 * Create a settings hook for React
 */
export function useAppSettings() {
  const [settings, setSettings] = React.useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = React.useState(false)

  React.useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    setIsLoaded(true)
  }, [])

  const updateSettings = (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings)
    saveSettings(updates)
  }

  return { settings, updateSettings, isLoaded }
}

// Import React for the hook
import React from 'react'
