import type { WeeklyTask } from './types'
import { countEventsForTask } from './attention-events'
import type { BriefingPersonaId } from './briefing-personas'
import { getPersona, pickDailyFromList } from './briefing-personas'

export interface BriefingCard {
  label: string
  value: string
  tone?: 'neutral' | 'good' | 'warning'
}

export interface MovedUpItem {
  taskId: string
  title: string
  reason: string
}

export interface DailyBriefing {
  title: string
  headline: string
  oneLiner: string
  vibeTag: string
  narrationText: string
  signatureLine: string
  cards: BriefingCard[]
  movedUp?: MovedUpItem
}

interface BriefingInput {
  greeting: string
  streak: number
  todayProgress: number
  agendaCount: number
  completedToday: number
  totalHabits: number
  remainingHabits: string[]
  weekTasks: WeeklyTask[]
  todayDayIdx: number
  personaId?: BriefingPersonaId
  dateISO?: string
}

function avoidanceScore(task: WeeklyTask, todayDayIdx: number): number {
  const skips = countEventsForTask(task.id, 'task_skipped', 30)
  const defers = countEventsForTask(task.id, 'task_deferred', 30)
  const ageDays = Math.max(0, todayDayIdx - task.dayIndex)
  return (skips + defers) * 2.2 + Math.min(ageDays, 14) * 0.35
}

/** Pick one catchphrase deterministically from the persona */
function pickCatchphrase(phrases: string[], seed: number): string {
  return phrases[Math.abs(seed) % phrases.length]
}

export function generateDailyBriefing(input: BriefingInput): DailyBriefing {
  const { greeting, streak, todayProgress, agendaCount, completedToday, totalHabits, remainingHabits, weekTasks, todayDayIdx, personaId } = input
  const hour = new Date().getHours()
  const dateISO = input.dateISO || new Date().toISOString().slice(0, 10)
  const persona = getPersona(personaId || 'ceo')
  const { bluntness, humor, warmth, urgency } = persona.style
  const catchphrase = pickCatchphrase(persona.catchphrases, todayProgress + streak + agendaCount)

  // ── Signature line (stable per day) ──
  const signatureLine = pickDailyFromList(dateISO, `sig:${persona.id}`, persona.signatureLines)

  // ── Cards (unchanged) ──
  const cards: BriefingCard[] = [
    { label: 'Today', value: `${todayProgress}%`, tone: todayProgress >= 70 ? 'good' : todayProgress >= 30 ? 'neutral' : 'warning' },
    { label: 'Agenda', value: `${agendaCount}`, tone: 'neutral' },
    { label: 'Streak', value: streak > 0 ? `${streak}d` : '0', tone: streak >= 7 ? 'good' : streak > 0 ? 'neutral' : 'warning' },
  ]

  // ── Move-up target (unchanged logic) ──
  const incomplete = weekTasks.filter((t) => !t.completed && t.dayIndex <= todayDayIdx)
  let movedUp: MovedUpItem | undefined
  if (incomplete.length > 0) {
    const scored = incomplete.map((t) => ({ task: t, score: avoidanceScore(t, todayDayIdx) })).sort((a, b) => b.score - a.score)
    const top = scored[0]
    const skips = countEventsForTask(top.task.id, 'task_skipped', 30)
    const defers = countEventsForTask(top.task.id, 'task_deferred', 30)
    const age = Math.max(0, todayDayIdx - top.task.dayIndex)
    let reason: string
    if (bluntness > 0.7) {
      reason = skips + defers > 0 ? `Deferred ${skips + defers}x. No more.` : `${age} day${age !== 1 ? 's' : ''} old. Move.`
    } else if (warmth > 0.7) {
      reason = skips + defers > 0 ? `You've pushed this ${skips + defers} time${skips + defers > 1 ? 's' : ''}. Just ten minutes.` : "It's been waiting. Give it ten minutes."
    } else {
      reason = skips + defers > 0 ? `Deferred ${skips + defers}x. Ten minutes. No negotiation.` : `Open ${age} day${age !== 1 ? 's' : ''}. Ten minutes.`
    }
    movedUp = { taskId: top.task.id, title: top.task.text, reason }
  }

  // ── Vibe tag ──
  const vibeTag = streak >= 7 ? 'Momentum: \u{1F525}' : todayProgress >= 70 ? 'Locked in: \u{1F3AF}' : agendaCount > 5 ? 'Loaded: \u26A1' : todayProgress > 0 ? 'Building: \u{1F9E0}' : 'Fresh start: \u2728'

  // ── Headline ──
  const headline = 'Your Attention Report \u{1F3AC}'

  // ── One-liner ──
  let oneLiner: string
  if (movedUp && streak > 0) {
    oneLiner = bluntness > 0.7
      ? `${streak}-day streak. "${movedUp.title}" is the weak link. Fix it.`
      : warmth > 0.7
        ? `${streak} days strong, and "${movedUp.title}" could use some love.`
        : `${streak}-day streak, but "${movedUp.title}" is still dodging me.`
  } else if (streak >= 7) {
    oneLiner = urgency > 0.7 ? `${streak} days. Do not break this chain.` : `${streak} days straight. Beautiful consistency.`
  } else if (todayProgress >= 80) {
    oneLiner = humor > 0.5 ? `${todayProgress}% done. Are you even human today?` : `${todayProgress}% done. Strong execution.`
  } else if (movedUp) {
    oneLiner = bluntness > 0.7 ? `"${movedUp.title}" has been hiding. Not anymore.` : `"${movedUp.title}" keeps sliding. Today it moves.`
  } else if (agendaCount > 0) {
    oneLiner = `${agendaCount} things on deck. Pick one. Start with ten minutes.`
  } else {
    oneLiner = warmth > 0.7 ? "Fresh day. No pressure. Just start." : "Nothing on the board yet. First move wins."
  }

  // ── Narration (4 beats: hook, stats, coach, signature, close) ──
  const hook = buildHook(greeting, hour, persona.style)
  const stats = buildStats(completedToday, remainingHabits.length, totalHabits, todayProgress, agendaCount, persona.style)
  const coach = buildCoach(movedUp, streak, remainingHabits, persona.style)
  const close = urgency > 0.7 ? 'Ten minutes. Go.' : warmth > 0.7 ? 'Start with ten gentle minutes.' : 'Start with ten minutes.'

  const narrationText = `${hook} ${stats} ${coach} ${catchphrase} ${signatureLine} ${close}`

  return { title: `${greeting}.`, headline, oneLiner, vibeTag, narrationText, signatureLine, cards, movedUp }
}

// ── Narration builders (persona-aware) ──────────────────────

function buildHook(greeting: string, hour: number, style: { bluntness: number; humor: number; warmth: number }): string {
  if (style.warmth > 0.7) {
    return hour < 12 ? `${greeting}. Hope you slept well.` : hour < 18 ? `${greeting}. How's your day going?` : `${greeting}. Almost there.`
  }
  if (style.bluntness > 0.7) {
    return hour < 12 ? `${greeting}. Time to earn it.` : hour < 18 ? `${greeting}. Halfway. No coasting.` : `${greeting}. Final push.`
  }
  if (style.humor > 0.5) {
    return hour < 12 ? `${greeting}. Your attention's already trying to escape.` : hour < 18 ? `${greeting}. Afternoon energy check.` : `${greeting}. The evening audit. No judgment.`
  }
  return hour < 12 ? `${greeting}. Here's your briefing.` : hour < 18 ? `${greeting}. Midday check-in.` : `${greeting}. End of day review.`
}

function buildStats(done: number, remaining: number, total: number, progress: number, agenda: number, style: { bluntness: number; warmth: number }): string {
  if (done > 0 && remaining > 0) {
    return style.bluntness > 0.7
      ? `${done} done. ${remaining} still waiting. ${progress}%.`
      : style.warmth > 0.7
        ? `Nice work on ${done} so far. ${remaining} more to go. ${progress}% today.`
        : `${done} done, ${remaining} remaining. ${progress}% through today.`
  }
  if (done > 0) {
    return style.warmth > 0.7 ? `${done} of ${total} habits done. Well played.` : `${done} of ${total} checked off. ${progress}% today.`
  }
  return style.bluntness > 0.7 ? `${agenda} items. Nothing done yet. Clock's ticking.` : `${agenda} item${agenda !== 1 ? 's' : ''} waiting. Nothing checked yet.`
}

function buildCoach(movedUp: MovedUpItem | undefined, streak: number, remaining: string[], style: { bluntness: number; warmth: number; urgency: number }): string {
  if (movedUp) {
    return style.bluntness > 0.7 ? `I moved up "${movedUp.title}". Deal with it.` : style.warmth > 0.7 ? `I gently moved up "${movedUp.title}". You can handle this.` : `I moved up "${movedUp.title}". You know why.`
  }
  if (streak >= 7) {
    return style.urgency > 0.7 ? `${streak}-day streak. Protect it at all costs.` : `${streak}-day streak. Keep it going.`
  }
  if (remaining.length === 1) {
    return style.warmth > 0.7 ? `Just one habit left: ${remaining[0]}. You're so close.` : `One habit left: ${remaining[0]}. Finish it.`
  }
  if (remaining.length > 0) {
    return style.bluntness > 0.7 ? `${remaining.length} habits to go. Hardest one first.` : `${remaining.length} habits remaining. Pick one.`
  }
  return style.warmth > 0.7 ? 'All done. You earned your rest.' : 'All clear. Use the space wisely.'
}
