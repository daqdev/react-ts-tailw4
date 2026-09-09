export type DeadlineStatus = 'none' | 'overdue' | 'today' | 'soon' | 'later'

/** Days from today a deadline is still called "soon". */
export const SOON_WINDOW_DAYS = 7

/** Today as yyyy-mm-dd in the viewer's own timezone (not UTC). */
export function todayISO(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Whole days between two yyyy-mm-dd dates, ignoring time and timezone. */
export function daysUntil(deadline: string, today = todayISO()): number {
  const a = Date.parse(`${deadline}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  return Math.round((a - b) / 86_400_000)
}

export function deadlineStatus(deadline: string | null, today = todayISO()): DeadlineStatus {
  if (!deadline) return 'none'
  const days = daysUntil(deadline, today)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= SOON_WINDOW_DAYS) return 'soon'
  return 'later'
}

export function formatDeadline(deadline: string | null, today = todayISO()): string {
  if (!deadline) return 'No deadline'
  const days = daysUntil(deadline, today)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days === -1) return '1 day overdue'
  if (days < 0) return `${Math.abs(days)} days overdue`
  return `Due in ${days} days`
}
