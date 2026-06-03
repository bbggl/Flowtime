import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useStore } from 'zustand'
import type { createPomodoroStore } from '../stores/usePomodoroStore'
import { formatTime } from '../utils/time'
import type { PomodoroMode } from '../stores/usePomodoroStore'

type Store = ReturnType<typeof createPomodoroStore>

export function usePomodoroTimer(store: Store) {
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number>(0)
  const accumulatedRef = useRef<number>(0)

  const mode = useStore(store, (s) => s.mode)
  const status = useStore(store, (s) => s.status)
  const remainingSeconds = useStore(store, (s) => s.remainingSeconds)
  const completedCount = useStore(store, (s) => s.completedCount)
  const linkedTaskId = useStore(store, (s) => s.linkedTaskId)
  const linkedTaskTitle = useStore(store, (s) => s.linkedTaskTitle)

  const formattedTime = useMemo(() => formatTime(remainingSeconds), [remainingSeconds])

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const tick = useCallback(
    (now: number) => {
      if (lastFrameRef.current === 0) {
        lastFrameRef.current = now
      }
      const delta = now - lastFrameRef.current
      lastFrameRef.current = now

      // 累积毫秒级 delta，满 1 秒才 tick
      accumulatedRef.current += delta
      const fullSeconds = Math.floor(accumulatedRef.current / 1000)
      if (fullSeconds > 0) {
        store.getState().tick(fullSeconds)
        accumulatedRef.current -= fullSeconds * 1000
      }

      const currentStatus = store.getState().status
      if (currentStatus === 'running') {
        rafRef.current = requestAnimationFrame(tick)
      }
    },
    [store],
  )

  // Start rAF loop when status becomes 'running'
  useEffect(() => {
    if (status === 'running') {
      lastFrameRef.current = 0
      accumulatedRef.current = 0
      rafRef.current = requestAnimationFrame(tick)
    } else {
      stopRaf()
    }
    return stopRaf
  }, [status, tick, stopRaf])

  const start = useCallback(() => store.getState().start(), [store])
  const pause = useCallback(() => store.getState().pause(), [store])
  const resume = useCallback(() => store.getState().resume(), [store])
  const reset = useCallback(() => store.getState().reset(), [store])
  const skip = useCallback(() => store.getState().skip(), [store])
  const setMode = useCallback((m: PomodoroMode) => store.getState().setMode(m), [store])
  const linkTask = useCallback((id: string, title: string) => store.getState().linkTask(id, title), [store])
  const unlinkTask = useCallback(() => store.getState().unlinkTask(), [store])

  return {
    mode,
    status,
    remainingSeconds,
    formattedTime,
    completedCount,
    linkedTaskId,
    linkedTaskTitle,
    start,
    pause,
    resume,
    reset,
    skip,
    setMode,
    linkTask,
    unlinkTask,
  }
}
