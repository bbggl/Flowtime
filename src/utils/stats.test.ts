import { describe, it, expect } from 'vitest'
import {
  calculateTotalFocusTime,
  calculateCompletionRate,
  groupRecordsByGranularity,
  getTopTasks,
  Granularity,
} from './stats'
import type { PomodoroRecord } from '../types'

function makeRecord(overrides: Partial<PomodoroRecord> = {}): PomodoroRecord {
  return {
    id: '1',
    user_id: 'test',
    mode: 'work',
    duration: 1500,
    actual_duration: 1500,
    status: 'completed',
    started_at: '2026-06-01T10:00:00.000Z',
    completed_at: '2026-06-01T10:25:00.000Z',
    ...overrides,
  }
}

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

describe('groupRecordsByGranularity', () => {
  const mon = makeRecord({ id: 'a', started_at: '2026-06-01T10:00:00.000Z' })
  const tue = makeRecord({ id: 'b', started_at: '2026-06-02T10:00:00.000Z' })
  const jun = makeRecord({ id: 'c', started_at: '2026-06-15T10:00:00.000Z' })
  const jul = makeRecord({ id: 'd', started_at: '2026-07-01T10:00:00.000Z' })

  it('groups by day', () => {
    const groups = groupRecordsByGranularity([mon, tue], Granularity.Day)
    expect(groups).toHaveLength(2)
  })

  it('groups by week', () => {
    const groups = groupRecordsByGranularity([mon, tue, jun], Granularity.Week)
    expect(groups.length).toBeGreaterThanOrEqual(2)
  })

  it('groups by month', () => {
    const groups = groupRecordsByGranularity([mon, jun, jul], Granularity.Month)
    expect(groups.length).toBeGreaterThanOrEqual(2)
  })

  it('groups by year', () => {
    const groups = groupRecordsByGranularity([mon, jul], Granularity.Year)
    expect(groups).toHaveLength(1)
  })

  it('each group has a label and total duration', () => {
    const groups = groupRecordsByGranularity([mon], Granularity.Day)
    expect(groups[0]).toHaveProperty('label')
    expect(groups[0]).toHaveProperty('totalDuration')
  })

  it('returns empty array for empty records', () => {
    expect(groupRecordsByGranularity([], Granularity.Day)).toEqual([])
  })
})

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
