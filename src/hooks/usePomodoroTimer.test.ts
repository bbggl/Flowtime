import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePomodoroTimer } from './usePomodoroTimer'
import { createPomodoroStore } from '../stores/usePomodoroStore'

describe('usePomodoroTimer', () => {
  let store: ReturnType<typeof createPomodoroStore>
  let rafCallbacks: FrameRequestCallback[]
  let mockNow: number

  beforeEach(() => {
    rafCallbacks = []
    mockNow = 1000000

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks[id - 1] = () => {}
    })
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow)

    store = createPomodoroStore({} as any, () => null)
    store.getState().setDurations({
      work_duration: 25 * 60,
      short_break_duration: 5 * 60,
      long_break_duration: 15 * 60,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- 计时运行 ---
  describe('计时运行 (Timer Running)', () => {
    it('starts idle with formatted time', () => {
      const { result } = renderHook(() => usePomodoroTimer(store))
      expect(result.current.status).toBe('idle')
      expect(result.current.formattedTime).toBe('25:00')
    })

    it('starts running and begins rAF loop', () => {
      const { result } = renderHook(() => usePomodoroTimer(store))
      act(() => {
        result.current.start()
      })
      expect(result.current.status).toBe('running')
      // rAF should have been called
      expect(window.requestAnimationFrame).toHaveBeenCalled()
    })

    it('responds to store tick updates', () => {
      store.getState().start()
      const { result } = renderHook(() => usePomodoroTimer(store))
      expect(result.current.remainingSeconds).toBe(25 * 60)

      act(() => {
        store.getState().tick(3)
      })
      expect(result.current.remainingSeconds).toBe(25 * 60 - 3)
    })

    it('accumulates sub-second rAF frames and ticks every 1s', () => {
      const { result } = renderHook(() => usePomodoroTimer(store))
      act(() => { result.current.start() })

      // 模拟 65 帧，每帧 16ms，累积约 1040ms → 应该 tick 1 秒
      act(() => {
        for (let i = 0; i < 65; i++) {
          mockNow += 16
          const cbs = [...rafCallbacks]
          rafCallbacks = []
          for (const cb of cbs) {
            cb(mockNow)
          }
        }
      })

      // 直接读 store 验证 tick 实际被调用了
      expect(store.getState().remainingSeconds).toBe(25 * 60 - 1)
    })
  })

  // --- 计时完成 ---
  describe('计时完成 (Timer Completion)', () => {
    it('finishes when time runs out (simulated)', () => {
      // We don't actually wait 25 min — just verify finish via store
      store.getState().start()
      const { result } = renderHook(() => usePomodoroTimer(store))
      expect(result.current.status).toBe('running')

      // Tick to 0 via store directly (simulating rAF loop reaching end)
      act(() => {
        store.getState().tick(25 * 60)
      })
      expect(result.current.status).toBe('finished')
      expect(result.current.formattedTime).toBe('00:00')
    })
  })

  // --- 暂停/继续 ---
  describe('暂停/继续 (Pause/Resume)', () => {
    it('pauses and resumes the timer', () => {
      const { result } = renderHook(() => usePomodoroTimer(store))
      act(() => { result.current.start() })
      expect(result.current.status).toBe('running')

      act(() => { result.current.pause() })
      expect(result.current.status).toBe('paused')

      act(() => { result.current.resume() })
      expect(result.current.status).toBe('running')
    })
  })

  // --- 跳过 ---
  describe('跳过 (Skip)', () => {
    it('skips and returns to finished', () => {
      store.getState().start()
      const { result } = renderHook(() => usePomodoroTimer(store))
      act(() => { result.current.skip() })
      expect(result.current.status).toBe('finished')
    })
  })

  // --- 重置 ---
  describe('重置 (Reset)', () => {
    it('resets to initial time', () => {
      store.getState().start()
      store.getState().tick(600) // 10 min elapsed
      const { result } = renderHook(() => usePomodoroTimer(store))
      act(() => { result.current.reset() })
      expect(result.current.status).toBe('idle')
      expect(result.current.remainingSeconds).toBe(25 * 60)
    })
  })

  // --- 模式切换 ---
  describe('模式切换 (Mode Switch)', () => {
    it('switches mode and resets timer', () => {
      const { result } = renderHook(() => usePomodoroTimer(store))
      act(() => { result.current.setMode('short_break') })
      expect(result.current.mode).toBe('short_break')
      expect(result.current.remainingSeconds).toBe(5 * 60)
    })
  })

  // --- 关联任务 ---
  describe('关联任务 (Task Linking)', () => {
    it('links and unlinks tasks', () => {
      const { result } = renderHook(() => usePomodoroTimer(store))
      act(() => { result.current.linkTask('t1', 'Design') })
      expect(result.current.linkedTaskId).toBe('t1')
      expect(result.current.linkedTaskTitle).toBe('Design')

      act(() => { result.current.unlinkTask() })
      expect(result.current.linkedTaskId).toBeNull()
    })
  })

  // --- 今日统计 ---
  describe('今日统计 (Today Stats)', () => {
    it('returns completed count and focus time', () => {
      store.getState().start()
      store.getState().tick(25 * 60)
      const { result } = renderHook(() => usePomodoroTimer(store))
      expect(result.current.completedCount).toBe(1)
    })
  })

  // --- Hook cleanup ---
  describe('清理 (Cleanup)', () => {
    it('stops rAF loop on unmount', () => {
      const { result, unmount } = renderHook(() => usePomodoroTimer(store))
      act(() => { result.current.start() })
      expect(window.requestAnimationFrame).toHaveBeenCalled()
      unmount()
      expect(window.cancelAnimationFrame).toHaveBeenCalled()
    })
  })
})
