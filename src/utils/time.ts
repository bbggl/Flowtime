export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function getProgress(remaining: number, total: number): number {
  if (total <= 0) return 0
  return 1 - remaining / total
}

export type PomodoroMode = 'work' | 'short_break' | 'long_break'

/**
 * Check if we've crossed into a new day based on day_start_hour.
 * When hour is 0, new day starts at midnight.
 * When hour is 3, times before 3:00 AM still belong to the previous day.
 */
export function isNewDay(dayStartHour: number, lastDate: string, now?: Date): boolean {
  const d = now || new Date()
  const currentHour = d.getHours()
  // If currentHour < dayStartHour, we're still in "yesterday"
  const effectiveDate = currentHour < dayStartHour
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
    : d
  const y = effectiveDate.getFullYear()
  const m = String(effectiveDate.getMonth() + 1).padStart(2, '0')
  const day = String(effectiveDate.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${day}`
  return todayStr > lastDate
}

export function getNextMode(
  currentMode: PomodoroMode,
  completedCount: number,
  longBreakInterval: number,
): PomodoroMode {
  if (currentMode === 'work') {
    if (completedCount % longBreakInterval === 0) {
      return 'long_break'
    }
    return 'short_break'
  }
  return 'work'
}
