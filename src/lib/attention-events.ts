// ── Lightweight attention event log (localStorage) ──────────

export type AttentionEventType =
  | 'task_completed'
  | 'task_skipped'
  | 'task_deferred'
  | 'habit_missed'
  | 'app_open'

export interface AttentionEvent {
  id: string
  type: AttentionEventType
  atISO: string
  taskId?: string
  meta?: Record<string, unknown>
}

const STORAGE_KEY = 'guidely.attention.v1'
const MAX_EVENTS = 500

let _cache: AttentionEvent[] | null = null

export function loadEvents(): AttentionEvent[] {
  if (_cache) return _cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    _cache = raw ? (JSON.parse(raw) as AttentionEvent[]) : []
  } catch {
    _cache = []
  }
  return _cache
}

export function appendEvent(
  type: AttentionEventType,
  taskId?: string,
  meta?: Record<string, unknown>,
): AttentionEvent {
  const events = loadEvents()
  const evt: AttentionEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    atISO: new Date().toISOString(),
    taskId,
    meta,
  }
  events.push(evt)
  // Trim to cap
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
  _cache = events
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)) } catch { /* quota */ }
  return evt
}

/** Count events of a type for a given taskId within the last N days */
export function countEventsForTask(
  taskId: string,
  type: AttentionEventType,
  withinDays = 30,
): number {
  const cutoff = Date.now() - withinDays * 86_400_000
  return loadEvents().filter(
    (e) => e.taskId === taskId && e.type === type && new Date(e.atISO).getTime() > cutoff,
  ).length
}

/** Count all events of a type within the last N days */
export function countEvents(type: AttentionEventType, withinDays = 1): number {
  const cutoff = Date.now() - withinDays * 86_400_000
  return loadEvents().filter(
    (e) => e.type === type && new Date(e.atISO).getTime() > cutoff,
  ).length
}
