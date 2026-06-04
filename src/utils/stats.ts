import type { PomodoroRecord } from '../types'

export const Granularity = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
  Year: 'year',
} as const

export type Granularity = (typeof Granularity)[keyof typeof Granularity]

/** Filter records to only the given time range for the specified granularity.
 *  When `referenceDate` is provided (YYYY-MM-DD), uses it as the reference point;
 *  otherwise defaults to "now". */
export function filterByGranularity(
  records: PomodoroRecord[],
  granularity: Granularity,
  referenceDate?: string | null,
): PomodoroRecord[] {
  const now = referenceDate
    ? (([y, m, d]) => new Date(y, m - 1, d))(referenceDate.split('-').map(Number))
    : new Date()
  let start: Date
  let end: Date

  switch (granularity) {
    case Granularity.Day:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      break
    case Granularity.Week: {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
      start = new Date(now.getFullYear(), now.getMonth(), diff)
      end = new Date(now.getFullYear(), now.getMonth(), diff + 7) // Next Monday
      break
    }
    case Granularity.Month:
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      break
    case Granularity.Year:
      start = new Date(now.getFullYear(), 0, 1)
      end = new Date(now.getFullYear() + 1, 0, 1)
      break
  }

  return records.filter((r) => {
    const d = new Date(r.started_at)
    d.setHours(0, 0, 0, 0)
    return d >= start && d < end
  })
}

export function calculateTotalFocusTime(records: PomodoroRecord[]): number {
  return records
    .filter((r) => r.mode === 'work' && r.status === 'completed')
    .reduce((sum, r) => sum + r.actual_duration, 0)
}

export function calculateCompletionRate(records: PomodoroRecord[]): number {
  const workRecords = records.filter((r) => r.mode === 'work')
  if (workRecords.length === 0) return 0
  const completed = workRecords.filter((r) => r.status === 'completed').length
  return completed / workRecords.length
}

function getWeekKey(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return `${monday.getFullYear()}-W${String(Math.ceil(monday.getDate() / 7)).padStart(2, '0')}`
}

function getDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getYearKey(date: Date): string {
  return `${date.getFullYear()}`
}

function getKeyForGranularity(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case Granularity.Day:
      return getDayKey(date)
    case Granularity.Week:
      return getWeekKey(date)
    case Granularity.Month:
      return getMonthKey(date)
    case Granularity.Year:
      return getYearKey(date)
  }
}

export interface GroupedRecords {
  label: string
  totalDuration: number
}

export function groupRecordsByGranularity(
  records: PomodoroRecord[],
  granularity: Granularity,
): GroupedRecords[] {
  const scoped = filterByGranularity(records, granularity)
  const workRecords = scoped.filter((r) => r.mode === 'work' && r.status === 'completed')
  const groups = new Map<string, number>()

  for (const record of workRecords) {
    const date = new Date(record.started_at)
    const key = getKeyForGranularity(date, granularity)
    groups.set(key, (groups.get(key) ?? 0) + record.actual_duration)
  }

  return Array.from(groups.entries())
    .map(([label, totalDuration]) => ({ label, totalDuration }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export interface TaskStat {
  taskId: string | null
  totalDuration: number
}

export function getTopTasks(records: PomodoroRecord[], limit: number = 5): TaskStat[] {
  const workRecords = records.filter((r) => r.mode === 'work' && r.status === 'completed')
  const taskMap = new Map<string | null, number>()

  for (const record of workRecords) {
    const key = record.task_id ?? null
    taskMap.set(key, (taskMap.get(key) ?? 0) + record.actual_duration)
  }

  return Array.from(taskMap.entries())
    .map(([taskId, totalDuration]) => ({ taskId, totalDuration }))
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, limit)
}
