import { describe, it, expect, beforeEach } from 'vitest'
import { createPomodoroStore } from './usePomodoroStore'

function makeStore() {
  const store = createPomodoroStore({} as any)
  // Set default durations for predictable testing
  store.getState().setDurations({
    work_duration: 25 * 60,
    short_break_duration: 5 * 60,
    long_break_duration: 15 * 60,
    long_break_interval: 4,
    daily_goal: 8,
  })
  return store
}

describe('usePomodoroStore', () => {
  let store: ReturnType<typeof createPomodoroStore>

  beforeEach(() => {
    store = makeStore()
  })

  // --- Scenario: 计时运行 ---
  describe('计时运行 (Timer Running)', () => {
    it('starts in IDLE state with work mode default', () => {
      expect(store.getState().status).toBe('idle')
      expect(store.getState().mode).toBe('work')
      expect(store.getState().remainingSeconds).toBe(25 * 60)
    })

    it('transitions to RUNNING on start', () => {
      store.getState().start()
      expect(store.getState().status).toBe('running')
    })

    it('decrements remainingSeconds on tick', () => {
      store.getState().start()
      store.getState().tick(10)
      expect(store.getState().remainingSeconds).toBe(25 * 60 - 10)
    })

    it('getting progress returns ratio of elapsed to total', () => {
      store.getState().start()
      store.getState().tick(750) // 12.5 minutes
      const progress = store.getState().getProgress()
      expect(progress).toBeCloseTo(0.5, 1)
    })
  })

  // --- Scenario: 计时完成 ---
  describe('计时完成 (Timer Completion)', () => {
    it('transitions to FINISHED when remaining reaches 0', () => {
      store.getState().start()
      store.getState().tick(25 * 60)
      expect(store.getState().status).toBe('finished')
    })

    it('increments completedCount on work completion', () => {
      store.getState().start()
      store.getState().tick(25 * 60)
      expect(store.getState().completedCount).toBe(1)
    })

    it('records a PomodoroRecord with status completed', () => {
      store.getState().start()
      store.getState().tick(25 * 60)
      const records = store.getState().records
      expect(records).toHaveLength(1)
      expect(records[0].status).toBe('completed')
      expect(records[0].mode).toBe('work')
    })

    it('increments linked task completed_pomos on work completion', () => {
      store.getState().linkTask('task1', 'Test Task')
      store.getState().start()
      store.getState().tick(25 * 60)
      expect(store.getState().taskCompletedPomos).toBe(1)
    })

    it('does not increment completedCount on break completion', () => {
      store.getState().setMode('short_break')
      store.getState().start()
      store.getState().tick(5 * 60)
      expect(store.getState().completedCount).toBe(0)
    })
  })

  // --- Scenario: 暂停/继续 ---
  describe('暂停/继续 (Pause/Resume)', () => {
    it('transitions to PAUSED on pause', () => {
      store.getState().start()
      store.getState().pause()
      expect(store.getState().status).toBe('paused')
    })

    it('transitions back to RUNNING on resume', () => {
      store.getState().start()
      store.getState().pause()
      store.getState().resume()
      expect(store.getState().status).toBe('running')
    })

    it('preserves remaining time across pause/resume', () => {
      store.getState().start()
      store.getState().tick(300) // 5 min elapsed
      store.getState().pause()
      store.getState().resume()
      expect(store.getState().remainingSeconds).toBe(25 * 60 - 300)
    })

    it('ignores pause when not running', () => {
      store.getState().pause()
      expect(store.getState().status).toBe('idle')
    })
  })

  // --- Scenario: 跳过 ---
  describe('跳过 (Skip)', () => {
    it('records PomodoroRecord with interrupted status', () => {
      store.getState().start()
      store.getState().tick(300)
      store.getState().skip()
      const records = store.getState().records
      expect(records).toHaveLength(1)
      expect(records[0].status).toBe('interrupted')
    })

    it('does not increment completedCount', () => {
      store.getState().start()
      store.getState().skip()
      expect(store.getState().completedCount).toBe(0)
    })

    it('does not increment task completedPomos', () => {
      store.getState().linkTask('task1', 'Test')
      store.getState().start()
      store.getState().skip()
      expect(store.getState().taskCompletedPomos).toBe(0)
    })

    it('returns to IDLE state', () => {
      store.getState().start()
      store.getState().skip()
      expect(store.getState().status).toBe('idle')
      expect(store.getState().remainingSeconds).toBe(25 * 60)
    })
  })

  // --- Scenario: 重置 ---
  describe('重置 (Reset)', () => {
    it('returns to IDLE with full duration', () => {
      store.getState().start()
      store.getState().tick(600)
      store.getState().reset()
      expect(store.getState().status).toBe('idle')
      expect(store.getState().remainingSeconds).toBe(25 * 60)
    })

    it('does not create a record', () => {
      store.getState().start()
      store.getState().reset()
      expect(store.getState().records).toHaveLength(0)
    })
  })

  // --- Scenario: 模式切换 ---
  describe('模式切换 (Mode Switch)', () => {
    it('switches to short_break and resets timer', () => {
      store.getState().start()
      store.getState().tick(600)
      store.getState().setMode('short_break')
      expect(store.getState().mode).toBe('short_break')
      expect(store.getState().remainingSeconds).toBe(5 * 60)
      expect(store.getState().status).toBe('idle')
    })

    it('switches to long_break', () => {
      store.getState().setMode('long_break')
      expect(store.getState().mode).toBe('long_break')
      expect(store.getState().remainingSeconds).toBe(15 * 60)
    })

    it('switches back to work', () => {
      store.getState().setMode('short_break')
      store.getState().setMode('work')
      expect(store.getState().remainingSeconds).toBe(25 * 60)
    })
  })

  // --- Scenario: 关联任务 ---
  describe('关联任务 (Task Linking)', () => {
    it('links a task by id and tracks title', () => {
      store.getState().linkTask('task-1', 'Design API')
      expect(store.getState().linkedTaskId).toBe('task-1')
      expect(store.getState().linkedTaskTitle).toBe('Design API')
    })

    it('unlinks task to free focus', () => {
      store.getState().linkTask('task-1', 'Design API')
      store.getState().unlinkTask()
      expect(store.getState().linkedTaskId).toBeNull()
      expect(store.getState().linkedTaskTitle).toBeNull()
    })

    it('links task_id in records when linked', () => {
      store.getState().linkTask('task-1', 'Design API')
      store.getState().start()
      store.getState().tick(25 * 60)
      expect(store.getState().records[0].task_id).toBe('task-1')
    })
  })

  // --- Scenario: 今日统计 ---
  describe('今日统计 (Today Stats)', () => {
    it('returns completed pomo count', () => {
      store.getState().start()
      store.getState().tick(25 * 60)
      expect(store.getState().completedCount).toBe(1)
    })

    it('returns total focus time in seconds', () => {
      store.getState().start()
      store.getState().tick(25 * 60)
      expect(store.getState().getTodayFocusTime()).toBe(25 * 60)
    })

    it('accumulates multiple sessions', () => {
      // Session 1
      store.getState().start()
      store.getState().tick(25 * 60)
      // Session 2
      store.getState().start()
      store.getState().tick(25 * 60)
      expect(store.getState().completedCount).toBe(2)
      expect(store.getState().getTodayFocusTime()).toBe(50 * 60)
    })
  })

  // --- 配置 ---
  describe('设置 (Settings)', () => {
    it('allows updating durations', () => {
      store.getState().setDurations({ work_duration: 30 * 60 })
      expect(store.getState().workDuration).toBe(30 * 60)
    })

    it('resets timer when work duration changes while idle', () => {
      store.getState().setDurations({ work_duration: 30 * 60 })
      expect(store.getState().remainingSeconds).toBe(30 * 60)
    })

    it('triggers long_break suggestion after N completions', () => {
      expect(store.getState().shouldSuggestLongBreak()).toBe(false)
      store.getState().completedCount = 3
      expect(store.getState().shouldSuggestLongBreak()).toBe(false)
      store.getState().completedCount = 4
      expect(store.getState().shouldSuggestLongBreak()).toBe(true)
    })
  })
})
