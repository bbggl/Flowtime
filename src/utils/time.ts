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
