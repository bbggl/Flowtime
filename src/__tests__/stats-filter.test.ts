/**
 * TDD: 统计页按粒度筛选时间范围
 *
 * 验证 filterByGranularity 正确过滤记录：
 * - 按日：仅当天
 * - 按周：仅当前周 (周一→周日)
 * - 按月：仅当月
 * - 按年：仅当年
 *
 * 验证 accumulate 只聚合筛选后的记录：
 * - 昨天的记录不应出现在"按日"视图
 * - 上周的记录不应出现在"按周"视图
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { filterByGranularity, Granularity } from '../utils/stats'
import type { PomodoroRecord } from '../types'

// ── helpers ──

function makeRecord(
  startedAtISO: string,
  overrides?: Partial<PomodoroRecord>,
): PomodoroRecord {
  return {
    id: `rec_${Math.random().toString(36).slice(2)}`,
    user_id: 'test-user',
    mode: 'work',
    task_id: undefined,
    duration: 25 * 60,
    actual_duration: 25 * 60,
    status: 'completed',
    started_at: startedAtISO,
    completed_at: startedAtISO,
    ...overrides,
  }
}

/** Return ISO string offset by `days` from a fixed reference date */
function isoAt(daysOffset: number, hour = 10): string {
  const d = new Date(2026, 5, 4 + daysOffset, hour, 0, 0) // June 4, 2026 = today
  return d.toISOString()
}

// ── freeze "now" to 2026-06-04 (Thursday) ──

const MOCK_NOW = new Date(2026, 5, 4, 12, 0, 0) // June 4, 2026, Thursday, noon
const REAL_DATE_NOW = Date.now.bind(Date)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(MOCK_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

// ================================================================
describe('filterByGranularity', () => {
  it('Day: 仅返回当天的记录', () => {
    const records = [
      makeRecord(isoAt(0, 9)),   // today 09:00
      makeRecord(isoAt(0, 14)),  // today 14:00
      makeRecord(isoAt(-1, 10)), // yesterday
      makeRecord(isoAt(-2, 10)), // 2 days ago
      makeRecord(isoAt(1, 10)),  // tomorrow
    ]

    const result = filterByGranularity(records, Granularity.Day)

    expect(result).toHaveLength(2)
    expect(result.every((r) => r.started_at.startsWith('2026-06-04'))).toBe(true)
  })

  it('Day: 空记录不报错', () => {
    expect(filterByGranularity([], Granularity.Day)).toEqual([])
  })

  it('Week: 仅返回本周 (周一 6/1 → 周日 6/7) 的记录', () => {
    // June 4, 2026 is Thursday → week is Mon 6/1 – Sun 6/7 (4 weekdays in range)
    const records = [
      makeRecord(isoAt(-3, 10)), // Monday 6/1    — this week ✓
      makeRecord(isoAt(-2, 10)), // Tuesday 6/2   — this week ✓
      makeRecord(isoAt(0, 10)),  // Thursday 6/4  — this week ✓
      makeRecord(isoAt(3, 10)),  // Sunday 6/7    — this week ✓
      makeRecord(isoAt(4, 10)),  // Monday 6/8    — next week ✗
    ]

    const result = filterByGranularity(records, Granularity.Week)

    expect(result).toHaveLength(4)
    const dates = result.map((r) => r.started_at.slice(0, 10))
    expect(dates).toContain('2026-06-01')
    expect(dates).toContain('2026-06-02')
    expect(dates).toContain('2026-06-04')
    expect(dates).toContain('2026-06-07')
    expect(dates).not.toContain('2026-06-08')
  })

  it('Week: 周日视为本周最后一天（中国习惯）', () => {
    // June 7, 2026 is Sunday — it should belong to the same week as June 4
    const records = [
      makeRecord('2026-06-07T10:00:00.000Z'), // Sunday
    ]

    const result = filterByGranularity(records, Granularity.Week)

    expect(result).toHaveLength(1)
  })

  it('Month: 仅返回当月的记录', () => {
    const records = [
      makeRecord('2026-06-01T10:00:00.000Z'), // June
      makeRecord('2026-06-15T10:00:00.000Z'), // June
      makeRecord('2026-05-31T10:00:00.000Z'), // May
      makeRecord('2026-07-01T10:00:00.000Z'), // July
    ]

    const result = filterByGranularity(records, Granularity.Month)

    expect(result).toHaveLength(2)
    expect(result.every((r) => r.started_at.startsWith('2026-06'))).toBe(true)
  })

  it('Year: 仅返回当年的记录', () => {
    const records = [
      makeRecord('2026-01-01T10:00:00.000Z'), // 2026
      makeRecord('2026-12-31T10:00:00.000Z'), // 2026
      makeRecord('2025-12-31T10:00:00.000Z'), // 2025
      makeRecord('2027-01-01T10:00:00.000Z'), // 2027
    ]

    const result = filterByGranularity(records, Granularity.Year)

    expect(result).toHaveLength(2)
    expect(result.every((r) => r.started_at.startsWith('2026'))).toBe(true)
  })

  it('非 work 模式的记录也会被正确筛选', () => {
    const records = [
      makeRecord(isoAt(0, 9), { mode: 'short_break' }),
      makeRecord(isoAt(-1, 10), { mode: 'work' }),
    ]

    const result = filterByGranularity(records, Granularity.Day)

    // Both are filtered by date first, mode filtering is separate concern
    expect(result).toHaveLength(1)
    expect(result[0].mode).toBe('short_break')
  })

  it('非 completed 状态的记录也会被正确筛选', () => {
    const records = [
      makeRecord(isoAt(0, 9), { status: 'interrupted' }),
      makeRecord(isoAt(-1, 10), { status: 'completed' }),
    ]

    const result = filterByGranularity(records, Granularity.Day)

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('interrupted')
  })
})

// ================================================================
// filterByGranularity with endDate range parameter
// ================================================================
describe('filterByGranularity with endDate (range)', () => {
  // ── Helpers ──

  function rec(dateStr: string, id = dateStr): PomodoroRecord {
    return makeRecord(`${dateStr}T10:00:00.000Z`, { id })
  }

  it('Day: filters date range correctly (inclusive)', () => {
    const records = [
      rec('2026-06-01', 'a'),
      rec('2026-06-05', 'b'),
      rec('2026-06-08', 'c'),
      rec('2026-06-10', 'd'),
      rec('2026-06-15', 'e'),
    ]
    // June 1 to June 8 inclusive
    const result = filterByGranularity(records, Granularity.Day, '2026-06-01', '2026-06-08')
    expect(result).toHaveLength(3) // June 1, 5, 8
    expect(result.map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('Day: single day when start equals end', () => {
    const records = [
      rec('2026-06-01', 'a'),
      rec('2026-06-05', 'b'),
      rec('2026-06-10', 'c'),
    ]
    const result = filterByGranularity(records, Granularity.Day, '2026-06-05', '2026-06-05')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('Day: falls back to single-point when endDate is null', () => {
    const records = [
      rec('2026-06-01', 'a'),
      rec('2026-06-04', 'b'), // today
      rec('2026-06-10', 'c'),
    ]
    // null endDate → same as old behavior, only June 4 (today)
    const result = filterByGranularity(records, Granularity.Day, null, null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('Day: falls back to single-point when endDate is undefined', () => {
    const records = [
      rec('2026-06-01', 'a'),
      rec('2026-06-04', 'b'),
      rec('2026-06-10', 'c'),
    ]
    const result = filterByGranularity(records, Granularity.Day)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('Month: filters month range correctly', () => {
    const records = [
      rec('2026-01-15', 'a'),
      rec('2026-02-01', 'b'),
      rec('2026-03-10', 'c'),
      rec('2026-03-31', 'd'),
      rec('2026-04-01', 'e'),
      rec('2026-05-20', 'f'),
    ]
    // February to April inclusive
    const result = filterByGranularity(records, Granularity.Month, '2026-02-01', '2026-04-30')
    expect(result).toHaveLength(4) // Feb, Mar(2), Apr
    expect(result.map((r) => r.id).sort()).toEqual(['b', 'c', 'd', 'e'])
  })

  it('Month: single month when start equals end', () => {
    const records = [
      rec('2026-01-15', 'a'),
      rec('2026-02-01', 'b'),
      rec('2026-02-28', 'c'),
      rec('2026-03-10', 'd'),
    ]
    const result = filterByGranularity(records, Granularity.Month, '2026-02-01', '2026-02-01')
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id).sort()).toEqual(['b', 'c'])
  })

  it('Month: falls back to single-point when endDate is null', () => {
    const records = [
      rec('2026-05-15', 'a'),
      rec('2026-06-01', 'b'),
      rec('2026-06-15', 'c'),
      rec('2026-07-01', 'd'),
    ]
    // null endDate → only June (current month for mock now)
    const result = filterByGranularity(records, Granularity.Month, null, null)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id).sort()).toEqual(['b', 'c'])
  })

  it('Week: filters week range correctly', () => {
    // referenceDate = June 1 (Monday), endDate = June 14 (Sunday)
    // Week 1: June 1-7, Week 2: June 8-14
    const records = [
      rec('2026-05-31', 'a'), // Sunday before
      rec('2026-06-01', 'b'), // Week 1 Monday
      rec('2026-06-07', 'c'), // Week 1 Sunday
      rec('2026-06-08', 'd'), // Week 2 Monday
      rec('2026-06-14', 'e'), // Week 2 Sunday
      rec('2026-06-15', 'f'), // Monday after
    ]
    const result = filterByGranularity(records, Granularity.Week, '2026-06-01', '2026-06-14')
    expect(result).toHaveLength(4) // b, c, d, e
    expect(result.map((r) => r.id).sort()).toEqual(['b', 'c', 'd', 'e'])
  })

  it('Year: filters year range correctly', () => {
    const records = [
      rec('2024-12-31', 'a'),
      rec('2025-01-01', 'b'),
      rec('2025-12-31', 'c'),
      rec('2026-01-01', 'd'),
      rec('2026-06-15', 'e'),
      rec('2027-01-01', 'f'),
    ]
    // 2025 to 2026 inclusive
    const result = filterByGranularity(records, Granularity.Year, '2025-01-01', '2026-12-31')
    expect(result).toHaveLength(4) // b, c, d, e
    expect(result.map((r) => r.id).sort()).toEqual(['b', 'c', 'd', 'e'])
  })

  it('Year: single year when start equals end', () => {
    const records = [
      rec('2024-12-31', 'a'),
      rec('2025-01-01', 'b'),
      rec('2025-06-15', 'c'),
      rec('2026-01-01', 'd'),
    ]
    const result = filterByGranularity(records, Granularity.Year, '2025-01-01', '2025-01-01')
    expect(result).toHaveLength(2) // b, c
    expect(result.map((r) => r.id).sort()).toEqual(['b', 'c'])
  })
})

// ================================================================
// filterByGranularity with optional referenceDate
// ================================================================
describe('filterByGranularity with referenceDate', () => {
  it('Day: uses reference date instead of "now"', () => {
    // "now" is June 4, but reference date is June 10
    const june4 = makeRecord('2026-06-04T10:00:00.000Z')
    const june10 = makeRecord('2026-06-10T10:00:00.000Z')

    const result = filterByGranularity([june4, june10], Granularity.Day, '2026-06-10')

    expect(result).toHaveLength(1)
    expect(result[0].started_at).toContain('2026-06-10')
  })

  it('Day: falls back to "now" when referenceDate is null', () => {
    const today = makeRecord(isoAt(0, 9))
    const yesterday = makeRecord(isoAt(-1, 10))

    const result = filterByGranularity([today, yesterday], Granularity.Day, null)

    // Only today (June 4) should pass
    expect(result).toHaveLength(1)
  })

  it('Day: falls back to "now" when referenceDate is undefined', () => {
    const today = makeRecord(isoAt(0, 9))
    const yesterday = makeRecord(isoAt(-1, 10))

    const result = filterByGranularity([today, yesterday], Granularity.Day)

    expect(result).toHaveLength(1)
  })

  it('Week: filters by the week containing the reference date', () => {
    // June 10, 2026 is Wednesday → week is Mon 6/8 – Sun 6/14
    const mon = makeRecord('2026-06-08T10:00:00.000Z')
    const wed = makeRecord('2026-06-10T10:00:00.000Z')
    const sun = makeRecord('2026-06-14T10:00:00.000Z')
    const prevMon = makeRecord('2026-06-07T10:00:00.000Z') // Sunday before
    const nextMon = makeRecord('2026-06-15T10:00:00.000Z') // Monday after

    const result = filterByGranularity(
      [mon, wed, sun, prevMon, nextMon],
      Granularity.Week,
      '2026-06-10',
    )

    expect(result).toHaveLength(3)
    expect(result.map((r) => r.started_at.slice(0, 10)).sort()).toEqual([
      '2026-06-08',
      '2026-06-10',
      '2026-06-14',
    ])
  })

  it('Month: filters by the reference month', () => {
    const march = makeRecord('2026-03-15T10:00:00.000Z')
    const april = makeRecord('2026-04-01T10:00:00.000Z')
    const april2 = makeRecord('2026-04-20T10:00:00.000Z')
    const may = makeRecord('2026-05-01T10:00:00.000Z')

    const result = filterByGranularity([march, april, april2, may], Granularity.Month, '2026-04-15')

    expect(result).toHaveLength(2)
    expect(result.every((r) => r.started_at.startsWith('2026-04'))).toBe(true)
  })

  it('Year: filters by the reference year', () => {
    const r2025 = makeRecord('2025-12-31T10:00:00.000Z')
    const r2026 = makeRecord('2026-06-15T10:00:00.000Z')
    const r2027 = makeRecord('2027-01-01T10:00:00.000Z')

    const result = filterByGranularity([r2025, r2026, r2027], Granularity.Year, '2026-03-01')

    expect(result).toHaveLength(1)
    expect(result[0].started_at).toContain('2026')
  })

  it('works with all granularities using the same reference date', () => {
    const records = [
      makeRecord('2026-02-14T10:00:00.000Z'), // different month
      makeRecord('2026-03-01T10:00:00.000Z'),
      makeRecord('2026-03-15T10:00:00.000Z'),
      makeRecord('2026-03-31T10:00:00.000Z'),
    ]
    const ref = '2026-03-15'

    // Day: only March 15
    expect(filterByGranularity(records, Granularity.Day, ref)).toHaveLength(1)
    // Week: March 15 is Sunday → week Mon 3/9 – Sun 3/15 → records on 3/1 and 3/15 = 2
    // Actually March 15 is Sunday, week is Mon 3/9 to Sun 3/15 → only March 15 falls in this week
    expect(filterByGranularity(records, Granularity.Week, ref)).toHaveLength(1)
    // Month: all March records = 3
    expect(filterByGranularity(records, Granularity.Month, ref)).toHaveLength(3)
    // Year: all 2026 records = 4
    expect(filterByGranularity(records, Granularity.Year, ref)).toHaveLength(4)
  })
})
