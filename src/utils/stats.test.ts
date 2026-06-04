import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateTotalFocusTime,
  calculateCompletionRate,
  groupRecordsByGranularity,
  getTopTasks,
  filterByGranularity,
  Granularity,
} from './stats'
import type { PomodoroRecord } from '../types'

// ── helpers ──

function makeRecord(overrides: Partial<PomodoroRecord> = {}): PomodoroRecord {
  return {
    id: '1',
    user_id: 'test',
    mode: 'work',
    duration: 1500,
    actual_duration: 1500,
    status: 'completed',
    started_at: '2026-06-04T10:00:00.000Z',
    completed_at: '2026-06-04T10:25:00.000Z',
    ...overrides,
  }
}

// Freeze "now" to 2026-06-04 (Thursday) so date-based tests are deterministic
const MOCK_NOW = new Date(2026, 5, 4, 12, 0, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(MOCK_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

// ================================================================
describe('calculateTotalFocusTime', () => {
  it('returns 0 for empty records', () => {
    expect(calculateTotalFocusTime([])).toBe(0)
  })

  it('sums actual_duration of completed work records only', () => {
    const records = [
      makeRecord({ actual_duration: 1500, status: 'completed', mode: 'work' }),
      makeRecord({ id: '2', actual_duration: 600, status: 'completed', mode: 'work' }),
    ]
    expect(calculateTotalFocusTime(records)).toBe(2100)
  })

  it('ignores interrupted records', () => {
    const records = [
      makeRecord({ actual_duration: 1500, status: 'completed', mode: 'work' }),
      makeRecord({ id: '2', actual_duration: 300, status: 'interrupted', mode: 'work' }),
    ]
    expect(calculateTotalFocusTime(records)).toBe(1500)
  })

  it('ignores break records', () => {
    const records = [
      makeRecord({ actual_duration: 1500, status: 'completed', mode: 'work' }),
      makeRecord({ id: '2', actual_duration: 300, status: 'completed', mode: 'short_break' }),
    ]
    expect(calculateTotalFocusTime(records)).toBe(1500)
  })
})

// ================================================================
describe('calculateCompletionRate', () => {
  it('returns 0 for empty records', () => {
    expect(calculateCompletionRate([])).toBe(0)
  })

  it('returns 1 when all work records completed', () => {
    const records = [
      makeRecord({ status: 'completed', mode: 'work' }),
      makeRecord({ id: '2', status: 'completed', mode: 'work' }),
    ]
    expect(calculateCompletionRate(records)).toBe(1)
  })

  it('returns 0.5 when half work records completed', () => {
    const records = [
      makeRecord({ status: 'completed', mode: 'work' }),
      makeRecord({ id: '2', status: 'interrupted', mode: 'work' }),
    ]
    expect(calculateCompletionRate(records)).toBe(0.5)
  })

  it('ignores break records in rate calculation', () => {
    const records = [
      makeRecord({ status: 'completed', mode: 'work' }),
      makeRecord({ id: '2', status: 'completed', mode: 'short_break' }),
      makeRecord({ id: '3', status: 'interrupted', mode: 'work' }),
    ]
    expect(calculateCompletionRate(records)).toBe(0.5)
  })
})

// ================================================================
// groupRecordsByGranularity  now filters by current time range
// "today" = mock June 4, 2026
// ================================================================
describe('groupRecordsByGranularity', () => {
  // Dates relative to mock "now" (June 4, 2026)
  const today1 = makeRecord({ id: 'a', started_at: '2026-06-04T09:00:00.000Z' })
  const today2 = makeRecord({ id: 'b', started_at: '2026-06-04T14:00:00.000Z' })
  const thisWeek = makeRecord({ id: 'c', started_at: '2026-06-01T10:00:00.000Z' }) // Mon
  const laterThisMonth = makeRecord({ id: 'd', started_at: '2026-06-15T10:00:00.000Z' })
  const nextMonth = makeRecord({ id: 'e', started_at: '2026-07-01T10:00:00.000Z' })

  it('groups by day — only today\'s records', () => {
    const groups = groupRecordsByGranularity([today1, today2], Granularity.Day)
    expect(groups).toHaveLength(1) // both on same day → 1 group
  })

  it('groups by week — only current week records', () => {
    // today1 (Thu 6/4), thisWeek (Mon 6/1) → both same week
    const groups = groupRecordsByGranularity([today1, thisWeek, nextMonth], Granularity.Week)
    expect(groups).toHaveLength(1) // 1 week group, nextMonth filtered out
  })

  it('groups by month — only current month records', () => {
    const groups = groupRecordsByGranularity([today1, laterThisMonth, nextMonth], Granularity.Month)
    expect(groups).toHaveLength(1) // 1 month group, nextMonth filtered out
  })

  it('groups by year — only current year records', () => {
    const groups = groupRecordsByGranularity([today1, nextMonth], Granularity.Year)
    expect(groups).toHaveLength(1) // both in 2026 → 1 group
  })

  it('each group has a label and total duration', () => {
    const groups = groupRecordsByGranularity([today1], Granularity.Day)
    expect(groups[0]).toHaveProperty('label')
    expect(groups[0]).toHaveProperty('totalDuration')
  })

  it('returns empty array for empty records', () => {
    expect(groupRecordsByGranularity([], Granularity.Day)).toEqual([])
  })
})

// ================================================================
describe('filterByGranularity', () => {
  it('Day: only today records', () => {
    const today = makeRecord({ id: 'a', started_at: '2026-06-04T10:00:00.000Z' })
    const yesterday = makeRecord({ id: 'b', started_at: '2026-06-03T10:00:00.000Z' })
    const tomorrow = makeRecord({ id: 'c', started_at: '2026-06-05T10:00:00.000Z' })

    const result = filterByGranularity([today, yesterday, tomorrow], Granularity.Day)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('Month: only current month records', () => {
    const jun1 = makeRecord({ id: 'a', started_at: '2026-06-01T10:00:00.000Z' })
    const jun30 = makeRecord({ id: 'b', started_at: '2026-06-30T10:00:00.000Z' })
    const may31 = makeRecord({ id: 'c', started_at: '2026-05-31T10:00:00.000Z' })
    const jul1 = makeRecord({ id: 'd', started_at: '2026-07-01T10:00:00.000Z' })

    const result = filterByGranularity([jun1, jun30, may31, jul1], Granularity.Month)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })
})

// ================================================================
describe('getTopTasks', () => {
  it('returns empty for empty records', () => {
    expect(getTopTasks([])).toEqual([])
  })

  it('returns tasks sorted by total focus time descending', () => {
    const records = [
      makeRecord({ task_id: 't1', actual_duration: 3000, status: 'completed', mode: 'work' }),
      makeRecord({ id: '2', task_id: 't2', actual_duration: 1500, status: 'completed', mode: 'work' }),
    ]
    const top = getTopTasks(records, 5)
    expect(top[0].taskId).toBe('t1')
    expect(top[0].totalDuration).toBe(3000)
    expect(top[1].taskId).toBe('t2')
  })

  it('limits to top N', () => {
    const records = [
      makeRecord({ task_id: 't1', actual_duration: 1000, status: 'completed', mode: 'work' }),
      makeRecord({ id: '2', task_id: 't2', actual_duration: 2000, status: 'completed', mode: 'work' }),
      makeRecord({ id: '3', task_id: 't3', actual_duration: 3000, status: 'completed', mode: 'work' }),
    ]
    const top = getTopTasks(records, 2)
    expect(top).toHaveLength(2)
    expect(top[0].taskId).toBe('t3')
  })

  it('combines null task_id as "自由专注"', () => {
    const records = [
      makeRecord({ task_id: undefined, actual_duration: 1500, status: 'completed', mode: 'work' }),
    ]
    const top = getTopTasks(records, 5)
    expect(top[0].taskId).toBeNull()
  })
})
