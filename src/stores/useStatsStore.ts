import { create } from 'zustand'
import type { PomodoroRecord } from '../types'
import {
  Granularity,
  calculateTotalFocusTime,
  calculateCompletionRate,
  groupRecordsByGranularity,
  getTopTasks,
  type GroupedRecords,
  type TaskStat,
  type Granularity as GranularityType,
} from '../utils/stats'

interface Summary {
  totalFocusTime: number
  completedPomos: number
  completionRate: number
}

interface StatsState {
  granularity: GranularityType
  records: PomodoroRecord[]
  selectedRange: { start: string; end: string } | null

  // Actions
  setGranularity: (g: GranularityType) => void
  setRecords: (records: PomodoroRecord[]) => void
  setSelectedRange: (start: string, end: string) => void
  clearSelectedRange: () => void

  // Computed
  getSummary: () => Summary
  getTrendData: () => GroupedRecords[]
  getTaskDistribution: () => TaskStat[]
}

export const createStatsStore = () =>
  create<StatsState>((set, get) => ({
    granularity: Granularity.Week,
    records: [],
    selectedRange: null,

    setGranularity(g) {
      set({ granularity: g })
    },

    setRecords(records) {
      set({ records })
    },

    setSelectedRange(start, end) {
      const [s, e] = start > end ? [end, start] : [start, end]
      set({ selectedRange: { start: s, end: e } })
    },

    clearSelectedRange() {
      set({ selectedRange: null })
    },

    getSummary() {
      const { records } = get()
      const workRecords = records.filter((r) => r.mode === 'work')
      const completedRecords = workRecords.filter((r) => r.status === 'completed')

      return {
        totalFocusTime: calculateTotalFocusTime(records),
        completedPomos: completedRecords.length,
        completionRate: calculateCompletionRate(records),
      }
    },

    getTrendData() {
      const { records, granularity } = get()
      return groupRecordsByGranularity(records, granularity)
    },

    getTaskDistribution() {
      const { records } = get()
      return getTopTasks(records, 5)
    },
  }))
