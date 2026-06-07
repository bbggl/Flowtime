import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createStatsStore } from './useStatsStore'
import { Granularity } from '../utils/stats'
import type { PomodoroRecord } from '../types'

const MOCK_NOW = new Date(2026, 5, 4, 12, 0, 0) // June 4, 2026

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

describe('useStatsStore', () => {
  let store: ReturnType<typeof createStatsStore>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(MOCK_NOW)
    store = createStatsStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('初始状态', () => {
    it('defaults to week granularity', () => {
      expect(store.getState().granularity).toBe(Granularity.Week)
    })

    it('has empty records initially', () => {
      expect(store.getState().records).toEqual([])
    })
  })

  describe('selectedRange', () => {
    it('defaults to null', () => {
      expect(store.getState().selectedRange).toBeNull()
    })

    it('can set and clear selected range', () => {
      store.getState().setSelectedRange('2026-06-01', '2026-06-03')
      expect(store.getState().selectedRange).toEqual({ start: '2026-06-01', end: '2026-06-03' })
      store.getState().clearSelectedRange()
      expect(store.getState().selectedRange).toBeNull()
    })

    it('auto-swaps start and end when start > end', () => {
      store.getState().setSelectedRange('2026-06-10', '2026-06-01')
      expect(store.getState().selectedRange).toEqual({ start: '2026-06-01', end: '2026-06-10' })
    })
  })

  describe('粒度切换 (Granularity Switch)', () => {
    it('switches to day granularity', () => {
      store.getState().setGranularity(Granularity.Day)
      expect(store.getState().granularity).toBe(Granularity.Day)
    })

    it('switches to month granularity', () => {
      store.getState().setGranularity(Granularity.Month)
      expect(store.getState().granularity).toBe(Granularity.Month)
    })

    it('switches to year granularity', () => {
      store.getState().setGranularity(Granularity.Year)
      expect(store.getState().granularity).toBe(Granularity.Year)
    })

    it('can cycle through all granularities', () => {
      store.getState().setGranularity(Granularity.Day)
      expect(store.getState().granularity).toBe(Granularity.Day)
      store.getState().setGranularity(Granularity.Week)
      expect(store.getState().granularity).toBe(Granularity.Week)
      store.getState().setGranularity(Granularity.Month)
      expect(store.getState().granularity).toBe(Granularity.Month)
      store.getState().setGranularity(Granularity.Year)
      expect(store.getState().granularity).toBe(Granularity.Year)
    })
  })

  describe('概览卡片 (Summary Cards)', () => {
    it('returns zero summary for empty records', () => {
      const summary = store.getState().getSummary()
      expect(summary.totalFocusTime).toBe(0)
      expect(summary.completedPomos).toBe(0)
      expect(summary.completionRate).toBe(0)
    })

    it('computes summary from records', () => {
      const records = [
        makeRecord({ actual_duration: 1500, status: 'completed' }),
        makeRecord({ id: '2', actual_duration: 900, status: 'completed' }),
      ]
      store.getState().setRecords(records)
      const summary = store.getState().getSummary()
      expect(summary.totalFocusTime).toBe(2400)
      expect(summary.completedPomos).toBe(2)
      expect(summary.completionRate).toBe(1)
    })

    it('excludes interrupted records from summary', () => {
      const records = [
        makeRecord({ actual_duration: 1500, status: 'completed' }),
        makeRecord({ id: '2', actual_duration: 500, status: 'interrupted' }),
      ]
      store.getState().setRecords(records)
      const summary = store.getState().getSummary()
      expect(summary.completedPomos).toBe(1)
      expect(summary.totalFocusTime).toBe(1500)
    })
  })

  describe('趋势图数据 (Trend Data)', () => {
    it('returns grouped trend data', () => {
      // Use today (June 4) — filterByGranularity now scopes to current period
      const records = [
        makeRecord({ started_at: '2026-06-04T09:00:00.000Z', actual_duration: 1500 }),
        makeRecord({ id: '2', started_at: '2026-06-04T14:00:00.000Z', actual_duration: 900 }),
      ]
      store.getState().setRecords(records)
      store.getState().setGranularity(Granularity.Day)
      const trend = store.getState().getTrendData()
      expect(trend).toHaveLength(1) // one day → one group
    })

    it('returns empty array when no records', () => {
      expect(store.getState().getTrendData()).toEqual([])
    })
  })

  describe('任务分布 (Task Distribution)', () => {
    it('returns top tasks sorted by focus time', () => {
      const records = [
        makeRecord({ task_id: 'task-a', actual_duration: 3000, status: 'completed' }),
        makeRecord({ id: '2', task_id: 'task-b', actual_duration: 1500, status: 'completed' }),
      ]
      store.getState().setRecords(records)
      const dist = store.getState().getTaskDistribution()
      expect(dist[0].taskId).toBe('task-a')
      expect(dist[0].totalDuration).toBe(3000)
    })

    it('limits to top 5', () => {
      const records = Array.from({ length: 10 }, (_, i) =>
        makeRecord({
          id: `${i}`,
          task_id: `task-${i}`,
          actual_duration: 1000 - i * 100,
          status: 'completed',
        }),
      )
      store.getState().setRecords(records)
      const dist = store.getState().getTaskDistribution()
      expect(dist.length).toBeLessThanOrEqual(5)
    })
  })
})
