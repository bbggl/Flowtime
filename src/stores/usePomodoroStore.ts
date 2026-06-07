import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PomodoroRecord } from '../types'
import { cacheTable, loadCachedTable, isOnline } from '../lib/offlineDb'

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
  soundEnabled: boolean
  notificationEnabled: boolean
  dayStartHour: number
  autoStartBreak: boolean

  // Actions
  loadRecords: () => Promise<void>
  loadSettings: () => Promise<void>
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
  setDuration: (mode: PomodoroMode, minutes: number) => void
  setDayStartHour: (hour: number) => void
  setAutoStartBreak: (on: boolean) => void
  setSoundEnabled: (on: boolean) => void
  setNotificationEnabled: (on: boolean) => void

  // Computed
  getProgress: () => number
  getTodayFocusTime: () => number
  shouldSuggestLongBreak: () => boolean

  // Realtime handlers (Task 9)
  handleRealtimeInsert: (record: PomodoroRecord) => void
  handleRealtimeUpdate: (record: PomodoroRecord) => void
  handleRealtimeDelete: (id: string) => void
}

const DEFAULT_WORK = 25 * 60
const DEFAULT_SHORT_BREAK = 5 * 60
const DEFAULT_LONG_BREAK = 15 * 60
const DEFAULT_INTERVAL = 4

// localStorage 同步缓存，消除刷新时的异步闪烁
function loadCached(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(`flowtime-${key}`)
    if (raw !== null) return parseInt(raw, 10) || fallback
  } catch { /* localStorage 不可用时静默忽略 */ }
  return fallback
}
function saveCached(key: string, value: number) {
  try { localStorage.setItem(`flowtime-${key}`, String(value)) } catch { /* noop */ }
}

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

function persistRecord(
  supabase: SupabaseClient,
  record: PomodoroRecord,
  isRealSupabase: boolean,
) {
  if (!isRealSupabase) return
  supabase
    .from('pomodoro_records')
    .insert({
      mode: record.mode,
      task_id: record.task_id ?? null,
      duration: record.duration,
      actual_duration: record.actual_duration,
      status: record.status,
      started_at: record.started_at,
      completed_at: record.completed_at,
    })
    .select()
    .single()
    .then(({ error }) => {
      if (error) console.warn('Pomodoro record insert failed:', error.message)
    })
}

export const createPomodoroStore = (supabase: SupabaseClient) => {
  const isRealSupabase = typeof (supabase as any)?.from === 'function'

  return create<PomodoroState>((set, get) => ({
    mode: 'work',
    status: 'idle',
    remainingSeconds: loadCached('workDuration', DEFAULT_WORK),
    startTime: null,
    elapsedBeforePause: 0,
    completedCount: 0,
    linkedTaskId: null,
    linkedTaskTitle: null,
    taskCompletedPomos: 0,
    records: [],
    workDuration: loadCached('workDuration', DEFAULT_WORK),
    shortBreakDuration: loadCached('shortBreakDuration', DEFAULT_SHORT_BREAK),
    longBreakDuration: loadCached('longBreakDuration', DEFAULT_LONG_BREAK),
    longBreakInterval: loadCached('longBreakInterval', DEFAULT_INTERVAL),
    dailyGoal: loadCached('dailyGoal', 8),
    soundEnabled: true,
    notificationEnabled: true,
    dayStartHour: loadCached('dayStartHour', 0),
    autoStartBreak: localStorage.getItem('flowtime-autoStartBreak') === 'true',

    // ---- Load from Supabase (with offline fallback) ----
    async loadRecords() {
      if (!isRealSupabase) return

      if (isOnline()) {
        const { data, error } = await supabase
          .from('pomodoro_records')
          .select('*')
          .order('started_at', { ascending: false })

        if (!error && data) {
          const records = data as PomodoroRecord[]
          const today = new Date().toISOString().slice(0, 10)
          const todayCompleted = records.filter(
            (r) => r.mode === 'work' && r.status === 'completed' && r.started_at.startsWith(today),
          ).length
          set({ records, completedCount: todayCompleted })
          await cacheTable('pomodoro_records', data)
          return
        }
      }

      // Fallback: load from IndexedDB cache
      const cached = await loadCachedTable<PomodoroRecord>('pomodoro_records')
      if (cached.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        const todayCompleted = cached.filter(
          (r) => r.mode === 'work' && r.status === 'completed' && r.started_at.startsWith(today),
        ).length
        set({ records: cached as PomodoroRecord[], completedCount: todayCompleted })
      }
    },

    async loadSettings() {
      if (!isRealSupabase) {
        // 回退到 localStorage
        const soundOn = localStorage.getItem('flowtime-sound') !== 'false'
        const notifOn = localStorage.getItem('flowtime-notification') !== 'false'
        set({ soundEnabled: soundOn, notificationEnabled: notifOn })
        return
      }

      // 尝试 upsert：确保 user_settings 中有一行
      const { data: existing } = await supabase
        .from('user_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (!existing) {
        // 插入默认行
        await supabase.from('user_settings').insert({}).select().maybeSingle()
      }

      // 加载设置
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        const newWork = data.work_duration ?? DEFAULT_WORK
        const newShort = data.short_break_duration ?? DEFAULT_SHORT_BREAK
        const newLong = data.long_break_duration ?? DEFAULT_LONG_BREAK

        set((state) => {
          // idle 状态下同步 remainingSeconds，防止显示值与实际时长不一致导致闪烁
          let remainingSeconds = state.remainingSeconds
          if (state.status === 'idle') {
            if (state.mode === 'work') remainingSeconds = newWork
            else if (state.mode === 'short_break') remainingSeconds = newShort
            else remainingSeconds = newLong
          }

          return {
            workDuration: newWork,
            shortBreakDuration: newShort,
            longBreakDuration: newLong,
            longBreakInterval: data.long_break_interval ?? DEFAULT_INTERVAL,
            dailyGoal: data.daily_goal ?? 8,
            soundEnabled: data.sound_enabled ?? true,
            notificationEnabled: data.notification_enabled ?? true,
            dayStartHour: data.day_start_hour ?? 0,
            autoStartBreak: data.auto_start_break ?? false,
            remainingSeconds,
          }
        })
      }

      // 同步到 localStorage（刷新时即时恢复）
      const s = get()
      saveCached('workDuration', s.workDuration)
      saveCached('shortBreakDuration', s.shortBreakDuration)
      saveCached('longBreakDuration', s.longBreakDuration)
      saveCached('longBreakInterval', s.longBreakInterval)
      saveCached('dailyGoal', s.dailyGoal)
      saveCached('dayStartHour', s.dayStartHour)
      localStorage.setItem('flowtime-autoStartBreak', String(s.autoStartBreak))
      localStorage.setItem('flowtime-sound', String(s.soundEnabled))
      localStorage.setItem('flowtime-notification', String(s.notificationEnabled))
    },

    // ---- Timer controls ----
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
      const totalDuration = durationForMode(state.mode, state)
      const actualDuration = state.status === 'running' && state.startTime
        ? state.elapsedBeforePause + Math.floor((Date.now() - state.startTime) / 1000)
        : totalDuration - state.remainingSeconds

      // 记录放弃的番茄钟（工作模式才计入统计）
      if (state.mode === 'work' && actualDuration > 0) {
        const record: PomodoroRecord = {
          id: nextRecordId(),
          user_id: '',
          mode: state.mode,
          task_id: state.linkedTaskId ?? undefined,
          duration: totalDuration,
          actual_duration: actualDuration,
          status: 'interrupted',
          started_at: new Date(Date.now() - actualDuration * 1000).toISOString(),
          completed_at: new Date().toISOString(),
        }
        set({
          status: 'idle',
          remainingSeconds: totalDuration,
          startTime: null,
          elapsedBeforePause: 0,
          records: [...state.records, record],
        })
        persistRecord(supabase, record, isRealSupabase)
      } else {
        set({
          status: 'idle',
          remainingSeconds: totalDuration,
          startTime: null,
          elapsedBeforePause: 0,
        })
      }
    },

    // ---- 跳过 = 提前完成：记录为 completed，计入统计 ----
    skip() {
      const state = get()
      const totalDuration = durationForMode(state.mode, state)
      const actualDuration = state.status === 'running' && state.startTime
        ? state.elapsedBeforePause + Math.floor((Date.now() - state.startTime) / 1000)
        : totalDuration - state.remainingSeconds

      const record: PomodoroRecord = {
        id: nextRecordId(),
        user_id: '',
        mode: state.mode,
        task_id: state.linkedTaskId ?? undefined,
        duration: totalDuration,
        actual_duration: actualDuration || totalDuration,
        status: 'completed',
        started_at: new Date(Date.now() - (actualDuration || totalDuration) * 1000).toISOString(),
        completed_at: new Date().toISOString(),
      }

      const updates: Partial<PomodoroState> = {
        status: 'finished',
        remainingSeconds: totalDuration,
        startTime: null,
        elapsedBeforePause: 0,
        records: [...state.records, record],
      }

      // 工作模式：计入完成统计 + 关联任务计数
      if (state.mode === 'work') {
        updates.completedCount = state.completedCount + 1
        if (state.linkedTaskId) {
          updates.taskCompletedPomos = state.taskCompletedPomos + 1
        }
      }

      set(updates)

      // 同步写入 Supabase
      if (isRealSupabase) {
        supabase
          .from('pomodoro_records')
          .insert({
            mode: record.mode,
            task_id: record.task_id ?? null,
            duration: record.duration,
            actual_duration: record.actual_duration,
            status: record.status,
            started_at: record.started_at,
            completed_at: record.completed_at,
          })
          .select()
          .single()
          .then(({ error }) => {
            if (error) console.warn('Skip record insert failed:', error.message)
          })

        // 如果关联了任务，更新 completed_pomos
        if (state.mode === 'work' && state.linkedTaskId) {
          const newCompletedPomos = state.taskCompletedPomos + 1
          supabase
            .from('todos')
            .update({ completed_pomos: newCompletedPomos })
            .eq('id', state.linkedTaskId)
            .then(({ error }) => {
              if (error) console.warn('Task pomo update on skip failed:', error.message)
            })
        }
      }
    },

    tick(seconds) {
      const state = get()
      if (state.status !== 'running') return

      const remaining = state.remainingSeconds - seconds

      if (remaining <= 0) {
        const totalDuration = durationForMode(state.mode, state)
        const record: PomodoroRecord = {
          id: nextRecordId(),
          user_id: '',
          mode: state.mode,
          task_id: state.linkedTaskId ?? undefined,
          duration: totalDuration,
          actual_duration: totalDuration,
          status: 'completed',
          started_at: new Date(Date.now() - totalDuration * 1000).toISOString(),
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

        // 同步写入 Supabase
        persistRecord(supabase, record, isRealSupabase)

        // 如果关联了任务，更新任务的 completed_pomos
        if (state.mode === 'work' && state.linkedTaskId) {
          const newCompletedPomos = state.taskCompletedPomos + 1
          if (isRealSupabase) {
            supabase
              .from('todos')
              .update({ completed_pomos: newCompletedPomos })
              .eq('id', state.linkedTaskId)
              .then(({ error }) => {
                if (error) console.warn('Task pomo update failed:', error.message)
              })
          }
        }
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

      if (state.status === 'idle') {
        newState.remainingSeconds = durationForMode(state.mode, { ...state, ...newState } as PomodoroState)
      }

      set(newState)

      // 同步到 localStorage（刷新时立即恢复，消除异步闪烁）
      if (settings.work_duration !== undefined) saveCached('workDuration', settings.work_duration)
      if (settings.short_break_duration !== undefined) saveCached('shortBreakDuration', settings.short_break_duration)
      if (settings.long_break_duration !== undefined) saveCached('longBreakDuration', settings.long_break_duration)
      if (settings.long_break_interval !== undefined) saveCached('longBreakInterval', settings.long_break_interval)
      if (settings.daily_goal !== undefined) saveCached('dailyGoal', settings.daily_goal)

      // 持久化到 Supabase
      if (isRealSupabase) {
        const payload: Record<string, number> = {}
        if (settings.work_duration !== undefined) payload.work_duration = settings.work_duration
        if (settings.short_break_duration !== undefined) payload.short_break_duration = settings.short_break_duration
        if (settings.long_break_duration !== undefined) payload.long_break_duration = settings.long_break_duration
        if (settings.long_break_interval !== undefined) payload.long_break_interval = settings.long_break_interval
        if (settings.daily_goal !== undefined) payload.daily_goal = settings.daily_goal

        supabase
          .from('user_settings')
          .update(payload)
          .neq('user_id', '00000000-0000-0000-0000-000000000000')
          .then(({ error }) => {
            if (error) console.warn('Settings update failed:', error.message)
          })
      }
    },

    setDuration(mode, minutes) {
      const seconds = minutes * 60
      const settings: DurationSettings = {}
      if (mode === 'work') settings.work_duration = seconds
      else if (mode === 'short_break') settings.short_break_duration = seconds
      else settings.long_break_duration = seconds

      // Use existing setDurations which handles localStorage + Supabase persistence
      get().setDurations(settings)

      // If idle and current mode matches, update remainingSeconds too
      const state = get()
      if (state.status === 'idle' && state.mode === mode) {
        set({ remainingSeconds: seconds })
      }
      // If timer is running, DON'T change remainingSeconds — only affects next session
    },

    setDayStartHour(hour) {
      const clamped = Math.max(0, Math.min(7, Math.round(hour)))
      set({ dayStartHour: clamped })
      saveCached('dayStartHour', clamped)
      if (isRealSupabase) {
        supabase
          .from('user_settings')
          .update({ day_start_hour: clamped })
          .neq('user_id', '00000000-0000-0000-0000-000000000000')
          .then(({ error }) => {
            if (error) console.warn('day_start_hour update failed:', error.message)
          })
      }
    },

    setAutoStartBreak(on) {
      set({ autoStartBreak: on })
      localStorage.setItem('flowtime-autoStartBreak', String(on))
      if (isRealSupabase) {
        supabase
          .from('user_settings')
          .update({ auto_start_break: on })
          .neq('user_id', '00000000-0000-0000-0000-000000000000')
          .then(({ error }) => {
            if (error) console.warn('auto_start_break update failed:', error.message)
          })
      }
    },

    setSoundEnabled(on) {
      set({ soundEnabled: on })
      localStorage.setItem('flowtime-sound', String(on))
      if (isRealSupabase) {
        supabase
          .from('user_settings')
          .update({ sound_enabled: on })
          .neq('user_id', '00000000-0000-0000-0000-000000000000')
          .then(({ error }) => {
            if (error) console.warn('Sound setting update failed:', error.message)
          })
      }
    },

    setNotificationEnabled(on) {
      set({ notificationEnabled: on })
      localStorage.setItem('flowtime-notification', String(on))
      if (isRealSupabase) {
        supabase
          .from('user_settings')
          .update({ notification_enabled: on })
          .neq('user_id', '00000000-0000-0000-0000-000000000000')
          .then(({ error }) => {
            if (error) console.warn('Notification setting update failed:', error.message)
          })
      }
    },

    // ---- Computed ----
    getProgress() {
      const state = get()
      const total = durationForMode(state.mode, state)
      if (total <= 0) return 0
      return 1 - state.remainingSeconds / total
    },

    getTodayFocusTime() {
      const state = get()
      const today = new Date().toISOString().slice(0, 10)
      return state.records
        .filter((r) => r.mode === 'work' && r.status === 'completed' && r.started_at.startsWith(today))
        .reduce((sum, r) => sum + r.actual_duration, 0)
    },

    shouldSuggestLongBreak() {
      const state = get()
      return state.completedCount > 0 && state.completedCount % state.longBreakInterval === 0
    },

    // ---- Realtime sync handlers (Task 9) ----
    handleRealtimeInsert(record: PomodoroRecord) {
      if (get().records.some((r) => r.id === record.id)) return
      set({ records: [...get().records, record] })
    },

    handleRealtimeUpdate(record: PomodoroRecord) {
      set({
        records: get().records.map((r) => (r.id === record.id ? { ...r, ...record } : r)),
      })
    },

    handleRealtimeDelete(id: string) {
      set({ records: get().records.filter((r) => r.id !== id) })
    },
  }))
}
