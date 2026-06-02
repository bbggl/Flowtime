import { create } from 'zustand'
import type { PomodoroRecord } from '../types'

export type PomodoroMode = 'work' | 'short_break' | 'long_break'
export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface DurationSettings {
  work_duration?: number
  short_break_duration?: number
  long_break_duration?: number
  long_break_interval?: number
  daily_goal?: number
}

interface PomodoroState {
  mode: PomodoroMode
  status: PomodoroStatus
  remainingSeconds: number
  startTime: number | null
  elapsedBeforePause: number
  completedCount: number
  linkedTaskId: string | null
  linkedTaskTitle: string | null
  taskCompletedPomos: number
  records: PomodoroRecord[]
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  dailyGoal: number

  // Actions
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  skip: () => void
  tick: (seconds: number) => void
  setMode: (mode: PomodoroMode) => void
  linkTask: (taskId: string, taskTitle: string) => void
  unlinkTask: () => void
  setDurations: (settings: DurationSettings) => void

  // Computed
  getProgress: () => number
  getTodayFocusTime: () => number
  shouldSuggestLongBreak: () => boolean
}

const DEFAULT_WORK = 25 * 60
const DEFAULT_SHORT_BREAK = 5 * 60
const DEFAULT_LONG_BREAK = 15 * 60
const DEFAULT_INTERVAL = 4

function durationForMode(mode: PomodoroMode, state: PomodoroState): number {
  switch (mode) {
    case 'work':
      return state.workDuration
    case 'short_break':
      return state.shortBreakDuration
    case 'long_break':
      return state.longBreakDuration
  }
}

let recordIdCounter = 0
function nextRecordId(): string {
  return `rec_${++recordIdCounter}_${Math.random().toString(36).slice(2, 8)}`
}

export const createPomodoroStore = (_supabase: unknown) =>
  create<PomodoroState>((set, get) => ({
    mode: 'work',
    status: 'idle',
    remainingSeconds: DEFAULT_WORK,
    startTime: null,
    elapsedBeforePause: 0,
    completedCount: 0,
    linkedTaskId: null,
    linkedTaskTitle: null,
    taskCompletedPomos: 0,
    records: [],
    workDuration: DEFAULT_WORK,
    shortBreakDuration: DEFAULT_SHORT_BREAK,
    longBreakDuration: DEFAULT_LONG_BREAK,
    longBreakInterval: DEFAULT_INTERVAL,
    dailyGoal: 8,

    start() {
      const state = get()
      if (state.status === 'running') return
      set({
        status: 'running',
        startTime: Date.now(),
        elapsedBeforePause: state.remainingSeconds < durationForMode(state.mode, state)
          ? durationForMode(state.mode, state) - state.remainingSeconds
          : 0,
      })
    },

    pause() {
      const state = get()
      if (state.status !== 'running') return
      const elapsed = state.startTime
        ? state.elapsedBeforePause + Math.floor((Date.now() - state.startTime) / 1000)
        : state.elapsedBeforePause
      set({
        status: 'paused',
        elapsedBeforePause: elapsed,
        startTime: null,
      })
    },

    resume() {
      const state = get()
      if (state.status !== 'paused') return
      set({
        status: 'running',
        startTime: Date.now(),
      })
    },

    reset() {
      const state = get()
      set({
        status: 'idle',
        remainingSeconds: durationForMode(state.mode, state),
        startTime: null,
        elapsedBeforePause: 0,
      })
    },

    skip() {
      const state = get()
      const actualDuration = state.startTime
        ? state.elapsedBeforePause + Math.floor((Date.now() - state.startTime) / 1000)
        : state.elapsedBeforePause

      const record: PomodoroRecord = {
        id: nextRecordId(),
        user_id: '',
        mode: state.mode,
        task_id: state.linkedTaskId ?? undefined,
        duration: durationForMode(state.mode, state),
        actual_duration: actualDuration,
        status: 'interrupted',
        started_at: new Date(Date.now() - actualDuration * 1000).toISOString(),
        completed_at: new Date().toISOString(),
      }

      set({
        status: 'idle',
        remainingSeconds: durationForMode(state.mode, state),
        startTime: null,
        elapsedBeforePause: 0,
        records: [...state.records, record],
      })
    },

    tick(seconds) {
      const state = get()
      if (state.status !== 'running') return

      const remaining = state.remainingSeconds - seconds

      if (remaining <= 0) {
        // Timer complete
        const actualDuration = durationForMode(state.mode, state)
        const record: PomodoroRecord = {
          id: nextRecordId(),
          user_id: '',
          mode: state.mode,
          task_id: state.linkedTaskId ?? undefined,
          duration: durationForMode(state.mode, state),
          actual_duration: actualDuration,
          status: 'completed',
          started_at: new Date(Date.now() - actualDuration * 1000).toISOString(),
          completed_at: new Date().toISOString(),
        }

        const updates: Partial<PomodoroState> = {
          status: 'finished',
          remainingSeconds: 0,
          startTime: null,
          elapsedBeforePause: 0,
          records: [...state.records, record],
        }

        if (state.mode === 'work') {
          updates.completedCount = state.completedCount + 1
          if (state.linkedTaskId) {
            updates.taskCompletedPomos = state.taskCompletedPomos + 1
          }
        }

        set(updates)
      } else {
        set({ remainingSeconds: remaining })
      }
    },

    setMode(mode) {
      const state = get()
      set({
        mode,
        status: 'idle',
        remainingSeconds: durationForMode(mode, state),
        startTime: null,
        elapsedBeforePause: 0,
      })
    },

    linkTask(taskId, taskTitle) {
      set({ linkedTaskId: taskId, linkedTaskTitle: taskTitle, taskCompletedPomos: 0 })
    },

    unlinkTask() {
      set({ linkedTaskId: null, linkedTaskTitle: null, taskCompletedPomos: 0 })
    },

    setDurations(settings) {
      const state = get()
      const newState: Record<string, unknown> = {}
      if (settings.work_duration !== undefined) newState.workDuration = settings.work_duration
      if (settings.short_break_duration !== undefined) newState.shortBreakDuration = settings.short_break_duration
      if (settings.long_break_duration !== undefined) newState.longBreakDuration = settings.long_break_duration
      if (settings.long_break_interval !== undefined) newState.longBreakInterval = settings.long_break_interval
      if (settings.daily_goal !== undefined) newState.dailyGoal = settings.daily_goal

      // Reset timer if idle and mode duration changed
      if (state.status === 'idle') {
        newState.remainingSeconds = durationForMode(state.mode, { ...state, ...newState } as PomodoroState)
      }

      set(newState)
    },

    getProgress() {
      const state = get()
      const total = durationForMode(state.mode, state)
      if (total <= 0) return 0
      return 1 - state.remainingSeconds / total
    },

    getTodayFocusTime() {
      const state = get()
      return state.records
        .filter((r) => r.mode === 'work' && r.status === 'completed')
        .reduce((sum, r) => sum + r.actual_duration, 0)
    },

    shouldSuggestLongBreak() {
      const state = get()
      return state.completedCount > 0 && state.completedCount % state.longBreakInterval === 0
    },
  }))
