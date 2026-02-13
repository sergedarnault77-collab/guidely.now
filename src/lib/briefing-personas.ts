// ── Briefing character personas ─────────────────────────────

export type BriefingPersonaId =
  | 'tough_coach'
  | 'zen'
  | 'ceo'
  | 'best_friend'
  | 'chaos'
  | 'drill'
  | 'warm_parent'

export interface BriefingPersona {
  id: BriefingPersonaId
  name: string
  emoji: string
  colorClass: string
  style: { bluntness: number; humor: number; warmth: number; urgency: number }
  catchphrases: string[]
  signatureLines: string[]
}

/** Deterministic daily pick from any string list, seeded by dateISO + key */
export function pickDailyFromList(dateISO: string, key: string, list: string[]): string {
  if (list.length === 0) return ''
  const seed = dateISO + ':' + key
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return list[Math.abs(hash) % list.length]
}

export const BRIEFING_PERSONAS: BriefingPersona[] = [
  {
    id: 'tough_coach',
    name: 'Tough Coach',
    emoji: '\u{1F3CB}',
    colorClass: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300',
    style: { bluntness: 0.9, humor: 0.2, warmth: 0.3, urgency: 0.8 },
    catchphrases: [
      'Pain is temporary. Regret is forever.',
      'Nobody cares. Work harder.',
      "You didn't come this far to only come this far.",
      'Excuses build nothing.',
    ],
    signatureLines: [
      'Discipline is choosing between what you want now and what you want most.',
      'The scoreboard never lies.',
      'Champions train. Everyone else complains.',
      'Results talk. Everything else walks.',
      'Show up or shut up.',
    ],
  },
  {
    id: 'zen',
    name: 'Zen Guide',
    emoji: '\u{1F9D8}',
    colorClass: 'bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300',
    style: { bluntness: 0.2, humor: 0.1, warmth: 0.9, urgency: 0.1 },
    catchphrases: [
      'Breathe. Begin.',
      'The river does not rush, yet it arrives.',
      'One thing at a time. That is the whole secret.',
      'Progress, not perfection.',
    ],
    signatureLines: [
      'A calm mind sees clearly.',
      'Where attention goes, energy flows.',
      'Stillness is not inaction. It is readiness.',
      'Do less, but do it fully.',
      'The present moment is enough.',
    ],
  },
  {
    id: 'ceo',
    name: 'The Strategist',
    emoji: '\u{1F4BC}',
    colorClass: 'bg-slate-100 dark:bg-slate-900/30 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300',
    style: { bluntness: 0.6, humor: 0.1, warmth: 0.3, urgency: 0.6 },
    catchphrases: [
      'Execution over intention.',
      'What gets measured gets managed.',
      'Prioritize ruthlessly.',
      'Ship it.',
    ],
    signatureLines: [
      'Strategy without execution is a daydream.',
      'Your calendar shows your real priorities.',
      'Compound interest works on habits too.',
      'The bottleneck is always you.',
      'Optimize the system, not the task.',
    ],
  },
  {
    id: 'best_friend',
    name: 'Best Friend',
    emoji: '\u{1F91D}',
    colorClass: 'bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-800 text-pink-700 dark:text-pink-300',
    style: { bluntness: 0.3, humor: 0.7, warmth: 0.9, urgency: 0.3 },
    catchphrases: [
      "You've got this, seriously.",
      "I believe in you more than you do right now.",
      "Let's go, we're doing this together.",
      "One step. That's all it takes.",
    ],
    signatureLines: [
      "Hey, showing up is half the battle. You're here.",
      "Bad days don't erase good streaks.",
      "You're allowed to be a work in progress and a masterpiece.",
      "Progress looks different every day. That's okay.",
      "I'd high-five you if I could.",
    ],
  },
  {
    id: 'chaos',
    name: 'Chaos Agent',
    emoji: '\u{1F525}',
    colorClass: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300',
    style: { bluntness: 0.7, humor: 0.9, warmth: 0.4, urgency: 0.7 },
    catchphrases: [
      'Burn the to-do list. Do the scary thing first.',
      "Rules? We don't need rules. We need momentum.",
      'Overthinking is just procrastination in a suit.',
      'Speed over perfection. Always.',
    ],
    signatureLines: [
      'Your comfort zone called. I hung up.',
      "Plans are cute. Let's cause some progress.",
      'The universe rewards the recklessly productive.',
      'Boring tasks need chaotic energy.',
      "Productivity hack: just start. That's it. That's the hack.",
    ],
  },
  {
    id: 'drill',
    name: 'Drill Instructor',
    emoji: '\u{1FAE1}',
    colorClass: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    style: { bluntness: 1.0, humor: 0.3, warmth: 0.1, urgency: 1.0 },
    catchphrases: [
      'Move. Now.',
      'No one is coming to save you.',
      'You signed up for this. Execute.',
      'Ten minutes. No excuses. Go.',
    ],
    signatureLines: [
      'Zero tolerance for zero progress.',
      'Your potential is not your performance. Close the gap.',
      'Every minute you waste is a minute you owe yourself.',
      'Fall in line or fall behind.',
      'Mission first. Feelings later.',
    ],
  },
  {
    id: 'warm_parent',
    name: 'Wise Mentor',
    emoji: '\u{1F9D3}',
    colorClass: 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300',
    style: { bluntness: 0.3, humor: 0.3, warmth: 1.0, urgency: 0.2 },
    catchphrases: [
      "I'm proud of you for showing up.",
      'Small steps still move you forward.',
      "You're doing better than you think.",
      'Rest if you must, but do not quit.',
    ],
    signatureLines: [
      'Kindness to yourself is not laziness.',
      'Every garden grows at its own pace.',
      'The fact that you care means you are already ahead.',
      "Tomorrow is a fresh page. Today's ink still matters.",
      'Wisdom is knowing when to push and when to pause.',
    ],
  },
]

export function getPersona(id: BriefingPersonaId): BriefingPersona {
  return BRIEFING_PERSONAS.find((p) => p.id === id) || BRIEFING_PERSONAS[2] // default: ceo
}

/** Deterministic daily persona pick, seeded by date string */
export function pickDailyPersonaId(dateISO: string): BriefingPersonaId {
  let hash = 0
  for (let i = 0; i < dateISO.length; i++) {
    hash = ((hash << 5) - hash + dateISO.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % BRIEFING_PERSONAS.length
  return BRIEFING_PERSONAS[idx].id
}
