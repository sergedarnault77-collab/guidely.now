import type { BriefingPersonaId } from './briefing-personas'
import { pickDailyPersonaId } from './briefing-personas'

export type PersonaMode = 'fixed' | 'randomDaily'

export interface BriefingSettings {
  personaMode: PersonaMode
  personaId: BriefingPersonaId
}

const SETTINGS_KEY = 'guidely.briefing.settings.v1'
const DAILY_KEY_PREFIX = 'guidely.briefing.persona.'

const DEFAULT_SETTINGS: BriefingSettings = {
  personaMode: 'fixed',
  personaId: 'ceo',
}

export function loadBriefingSettings(): BriefingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveBriefingSettings(s: BriefingSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function resolvePersonaForToday(
  settings: BriefingSettings,
  dateISO: string,
): BriefingPersonaId {
  if (settings.personaMode === 'fixed') return settings.personaId

  // Random daily: check if already picked for today
  const dailyKey = DAILY_KEY_PREFIX + dateISO
  const cached = localStorage.getItem(dailyKey) as BriefingPersonaId | null
  if (cached) return cached

  const picked = pickDailyPersonaId(dateISO)
  localStorage.setItem(dailyKey, picked)
  return picked
}
