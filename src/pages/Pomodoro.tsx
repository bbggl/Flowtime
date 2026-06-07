import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Play, Pause, SkipForward, RotateCcw, Check } from 'lucide-react'
import { useStore } from 'zustand'
import { useTodoStore, usePomodoroStore } from '../stores'
import { type PomodoroMode } from '../stores/usePomodoroStore'
import { formatTime } from '../utils/time'
import type { Todo } from '../types'

// ── Mode labels (key → display name) ────────────────────────────────────────
const MODE_LABELS: Record<PomodoroMode, string> = {
  work: '专注',
  short_break: '休息',
  long_break: '休息',
}

const VISIBLE_MODES: PomodoroMode[] = ['work', 'short_break']

// ── SVG ring constants ───────────────────────────────────────────────────────
const VIEWBOX = 100
const RING_RADIUS = 44.5
const STROKE_WIDTH = 11
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const RING_COLORS: Record<PomodoroMode, { track: string; progress: string }> = {
  work: {
    track: 'text-light-border dark:text-dark-border',
    progress: 'text-primary dark:text-primary-dark',
  },
  short_break: {
    track: 'text-light-border dark:text-dark-border',
    progress: 'text-emerald-500 dark:text-emerald-400',
  },
  long_break: {
    track: 'text-light-border dark:text-dark-border',
    progress: 'text-sky-500 dark:text-sky-400',
  },
}

// ── Sound ────────────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null

function playBeep() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sine'

    // 三连音：C5 → E5 → G5
    const now = audioCtx.currentTime
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      osc.frequency.setValueAtTime(freq, now + i * 0.15)
    })
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.6)

    osc.start(now)
    osc.stop(now + 0.6)
  } catch {
    // 浏览器不支持 Web Audio，静默忽略
  }
}

function shouldPlaySound(): boolean {
  // 优先读 store（从 Supabase 加载的持久化值），回退 localStorage
  const storeVal = usePomodoroStore.getState().soundEnabled
  if (storeVal !== undefined) return storeVal
  return localStorage.getItem('flowtime-sound') !== 'false'
}

// ── Notification ─────────────────────────────────────────────────────────────
async function sendNotification(title: string, body: string) {
  const storeVal = usePomodoroStore.getState().notificationEnabled
  const enabled = storeVal !== undefined ? storeVal : localStorage.getItem('flowtime-notification') !== 'false'
  if (!enabled) return
  if (!('Notification' in window)) return

  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/vite.svg' })
  } else if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      new Notification(title, { body, icon: '/vite.svg' })
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function computeProgress(remainingSeconds: number, total: number): number {
  if (total <= 0) return 0
  return 1 - remainingSeconds / total
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Pomodoro() {
  // 计时引擎已提升到 Layout，此处直接读 store（切换页面不中断）
  const mode = useStore(usePomodoroStore, (s) => s.mode)
  const status = useStore(usePomodoroStore, (s) => s.status)
  const remainingSeconds = useStore(usePomodoroStore, (s) => s.remainingSeconds)
  const linkedTaskId = useStore(usePomodoroStore, (s) => s.linkedTaskId)
  const linkedTaskTitle = useStore(usePomodoroStore, (s) => s.linkedTaskTitle)
  const taskCompletedPomos = useStore(usePomodoroStore, (s) => s.taskCompletedPomos)
  const records = useStore(usePomodoroStore, (s) => s.records)
  const completedCount = useStore(usePomodoroStore, (s) => s.completedCount)
  const storeWorkDuration = useStore(usePomodoroStore, (s) => s.workDuration)
  const storeShortBreakDuration = useStore(usePomodoroStore, (s) => s.shortBreakDuration)
  const storeLongBreakDuration = useStore(usePomodoroStore, (s) => s.longBreakDuration)
  const setDuration = usePomodoroStore((s) => s.setDuration)
  const allTodos = useStore(useTodoStore, (s) => s.todos)
  const categories = useStore(useTodoStore, (s) => s.categories)
  const formattedTime = useMemo(() => formatTime(remainingSeconds), [remainingSeconds])

  // Mount 时从 Supabase 加载番茄记录
  useEffect(() => {
    usePomodoroStore.getState().loadRecords()
  }, [])

  // 动态时长 → mode 按钮显示和进度计算
  const modeDurations = useMemo(
    (): Record<PomodoroMode, number> => ({
      work: storeWorkDuration,
      short_break: storeShortBreakDuration,
      long_break: storeLongBreakDuration,
    }),
    [storeWorkDuration, storeShortBreakDuration, storeLongBreakDuration],
  )

  const todayFocusTime = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return records
      .filter((r) => r.mode === 'work' && r.status === 'completed' && r.started_at.startsWith(today))
      .reduce((sum, r) => sum + r.actual_duration, 0)
  }, [records])

  // 去重：如果有 pending 同步副本，只显示副本（隐藏源待办），避免重复
  const pendingTodos = useMemo(() => {
    // 收集"有 pending 同步副本"的源待办 ID
    const syncedSourceIds = new Set<string>()
    for (const t of allTodos) {
      if (t.synced_from_id && t.status === 'pending' && t.category === 'today') {
        syncedSourceIds.add(t.synced_from_id)
      }
    }
    return allTodos.filter((t) => {
      if (t.status !== 'pending') return false
      // 如果这个待办是源，且有 pending 同步副本，隐藏它（副本会代替显示）
      if (syncedSourceIds.has(t.id)) return false
      return true
    })
  }, [allTodos])

  // 解析待办的分类标签
  function getTodoCategoryLabel(todo: Todo): string {
    if (todo.synced_from_id) {
      // 同步副本：显示"今天，来源分类名"
      const source = allTodos.find((t) => t.id === todo.synced_from_id)
      const sourceCat = categories.find((c) => c.id === source?.category)
      return `今天，${sourceCat?.name || source?.category || ''}`
    }
    // 普通待办：显示所属分类名
    const cat = categories.find((c) => c.id === todo.category)
    return cat?.name || todo.category
  }

  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false)
  const taskDropdownRef = useRef<HTMLDivElement>(null)

  const [durationEditing, setDurationEditing] = useState(false)
  const durationEditRef = useRef<HTMLButtonElement>(null)

  // Click outside to close task dropdown
  useEffect(() => {
    if (!taskDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (taskDropdownRef.current && !taskDropdownRef.current.contains(e.target as Node)) {
        setTaskDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [taskDropdownOpen])

  // Click outside to exit duration editing
  useEffect(() => {
    if (!durationEditing) return
    const handler = (e: MouseEvent) => {
      if (durationEditRef.current && !durationEditRef.current.contains(e.target as Node)) {
        setDurationEditing(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [durationEditing])

  // Wheel handler for duration editing
  const handleDurationWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!durationEditing) return
      e.preventDefault()
      const currentMin = Math.round(
        (mode === 'work'
          ? storeWorkDuration
          : mode === 'short_break'
            ? storeShortBreakDuration
            : storeLongBreakDuration
        ) / 60,
      )
      const delta = e.deltaY > 0 ? -1 : 1
      const newMin = Math.max(1, Math.min(60, currentMin + delta))
      setDuration(mode, newMin)
    },
    [durationEditing, mode, storeWorkDuration, storeShortBreakDuration, storeLongBreakDuration, setDuration],
  )

  const [flashRing, setFlashRing] = useState(false)
  const [showLongBreakTip, setShowLongBreakTip] = useState(false)
  const dismissedBreakCountRef = useRef<number>(-1)

  // ── Hold-to-confirm for skip / reset ────────────────────────────────────
  const HOLD_MS = 2000
  const holdTargetRef = useRef<'skip' | 'reset' | null>(null)
  const holdTimerRef = useRef<number>(0)
  const holdStartRef = useRef<number>(0)
  const [holdProgress, setHoldProgress] = useState(0) // 0..1
  const [confirmedAction, setConfirmedAction] = useState<'skip' | 'reset' | null>(null)

  const startHold = useCallback((action: 'skip' | 'reset') => {
    // 禁止在不允许的状态下触发长按（兜底 disabled attribute 的浏览器不一致行为）
    if (action === 'skip' && (status === 'idle' || status === 'finished')) return
    if (action === 'reset' && status === 'idle') return

    holdTargetRef.current = action
    holdStartRef.current = Date.now()
    setHoldProgress(0)

    const tick = () => {
      const elapsed = Date.now() - holdStartRef.current
      const pct = Math.min(elapsed / HOLD_MS, 1)
      setHoldProgress(pct)
      if (pct >= 1) {
        setConfirmedAction(action)
        setHoldProgress(0)
        holdTargetRef.current = null
      } else {
        holdTimerRef.current = requestAnimationFrame(tick)
      }
    }
    holdTimerRef.current = requestAnimationFrame(tick)
  }, [status])

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) cancelAnimationFrame(holdTimerRef.current)
    holdTargetRef.current = null
    setHoldProgress(0)
  }, [])

  // Fire confirmed action after a short visual flash
  useEffect(() => {
    if (!confirmedAction) return
    const id = setTimeout(() => {
      if (confirmedAction === 'skip') {
        usePomodoroStore.getState().skip()
      } else {
        usePomodoroStore.getState().reset()
      }
      setConfirmedAction(null)
    }, 200)
    return () => clearTimeout(id)
  }, [confirmedAction])

  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  const isFinished = status === 'finished'

  const total = modeDurations[mode]
  const progress = computeProgress(remainingSeconds, total)
  const dashOffset = CIRCUMFERENCE * progress
  const ringColors = RING_COLORS[mode]

  // ── Detect finished transition → sound + notification + flash ────────────
  const prevStatusRef = useRef(status)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status

    if (prev !== 'finished' && status === 'finished') {
      // 环闪动效
      setFlashRing(true)
      setTimeout(() => setFlashRing(false), 1200)

      // 音效
      if (shouldPlaySound()) {
        playBeep()
      }

      // 浏览器通知（仅工作完成时）
      if (mode === 'work') {
        sendNotification(
          '🍅 番茄完成！',
          `已完成 ${completedCount} 个番茄，继续加油！`,
        )
      }

      // Auto-revert from long_break to short_break after long break finishes
      if (mode === 'long_break') {
        usePomodoroStore.setState({ mode: 'short_break' })
      }

      // Auto-start break after work completes
      const autoStartBreak = usePomodoroStore.getState().autoStartBreak
      if (autoStartBreak && mode === 'work') {
        setTimeout(() => {
          const s = usePomodoroStore.getState()
          if (s.status === 'finished' && s.mode === 'work') {
            if (!s.shouldSuggestLongBreak()) {
              s.setMode('short_break')
              s.start()
            }
          }
        }, 1500)
      }
    }
  }, [status, mode, completedCount])

  // ── Long break suggestion after N work completions ──────────────────────
  useEffect(() => {
    const suggest = usePomodoroStore.getState().shouldSuggestLongBreak()
    if (suggest && mode === 'work' && status === 'finished' && completedCount !== dismissedBreakCountRef.current) {
      setShowLongBreakTip(true)
    }
  }, [completedCount, mode, status])

  const handleAcceptLongBreak = useCallback(() => {
    dismissedBreakCountRef.current = completedCount
    setShowLongBreakTip(false)
    const store = usePomodoroStore.getState()
    store.setMode('long_break')
    // Auto-start the long break timer
    store.start()
  }, [completedCount])

  const handleDismissLongBreakTip = useCallback(() => {
    dismissedBreakCountRef.current = completedCount
    setShowLongBreakTip(false)
  }, [completedCount])

  // ── Linked task info ─────────────────────────────────────────────────────
  const linkedTodo: Todo | undefined =
    linkedTaskId
      ? pendingTodos.find((t) => t.id === linkedTaskId) ??
        useTodoStore.getState().todos.find((t) => t.id === linkedTaskId)
      : undefined

  const estimatedPomos = linkedTodo?.estimated_pomos ?? 0

  const handleToggleTaskDropdown = useCallback(() => {
    setTaskDropdownOpen((prev) => !prev)
  }, [])

  const handleSelectTask = useCallback(
    (todo: Todo) => {
      usePomodoroStore.getState().linkTask(todo.id, todo.title)
      setTaskDropdownOpen(false)
    },
    [],
  )

  const handleUnlinkTask = useCallback(() => {
    usePomodoroStore.getState().unlinkTask()
  }, [])

  // ── Start / Pause / Resume ──────────────────────────────────────────────
  const handleToggleRun = useCallback(() => {
    if (isFinished) {
      // 完成后点按钮：重置到初始状态
      usePomodoroStore.getState().reset()
    } else if (isRunning) {
      usePomodoroStore.getState().pause()
    } else if (isPaused) {
      usePomodoroStore.getState().resume()
    } else {
      usePomodoroStore.getState().start()
    }
  }, [isRunning, isPaused, isFinished])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center px-6 py-8 min-h-full">
      {/* ── Long break suggestion banner ──────────────────────────────────── */}
      {showLongBreakTip && (
        <div className="w-full max-w-sm mb-6 px-4 py-3 rounded-xl bg-accent/10 dark:bg-accent-dark/10 border border-accent/30 dark:border-accent-dark/30 flex items-center justify-between gap-3">
          <p className="text-sm text-accent dark:text-accent-dark font-medium">
            🎉 已完成 {completedCount} 个番茄！来一次长休息吧？
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleAcceptLongBreak}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-accent dark:bg-accent-dark text-white hover:opacity-90 transition-opacity"
            >
              长休
            </button>
            <button
              onClick={handleDismissLongBreakTip}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-accent/30 dark:border-accent-dark/30 text-accent dark:text-accent-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10 transition-colors"
            >
              跳过
            </button>
          </div>
        </div>
      )}

      {/* ── Mode switch ────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-8">
        {VISIBLE_MODES.map((key) => {
          const isWork = key === 'work'
          const isActive = isWork ? mode === 'work' : (mode === 'short_break' || mode === 'long_break')
          const displayDuration = isWork
            ? modeDurations.work
            : (mode === 'long_break' ? modeDurations.long_break : modeDurations.short_break)

          return (
            <button
              key={key}
              onClick={() => {
                usePomodoroStore.getState().setMode(key)
                setShowLongBreakTip(false)
              }}
              disabled={isRunning}
              className={`
                px-5 py-2 rounded-full text-sm font-medium transition-colors
                disabled:opacity-60
                ${
                  isActive
                    ? 'bg-primary text-white dark:bg-primary-dark dark:text-dark-bg'
                    : 'bg-light-card dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border'
                }
              `}
            >
              {MODE_LABELS[key]}
              <span className="ml-1 opacity-70">{Math.round(displayDuration / 60)}min</span>
            </button>
          )
        })}
      </div>

      {/* ── Timer ring + center display ────────────────────────────────── */}
      <div className="relative mb-8">
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          className={`w-72 h-72 -rotate-90 ${flashRing ? 'animate-pulse' : ''}`}
        >
          {/* Background track */}
          <circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className={`${ringColors.track} transition-colors ${flashRing ? 'opacity-30' : ''}`}
          />
          {/* Progress arc */}
          <circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className={`${ringColors.progress} transition-[stroke-dashoffset] duration-300 ease-linear`}
          />
        </svg>

        {/* Center time display — clickable to edit duration */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <button
            ref={durationEditRef}
            onClick={() => setDurationEditing((v) => !v)}
            onWheel={handleDurationWheel}
            className={`relative text-6xl font-mono font-bold tracking-tight transition-all cursor-pointer select-none
              ${durationEditing
                ? 'text-primary dark:text-primary-dark ring-2 ring-primary dark:ring-primary-dark rounded-2xl px-3 py-1'
                : 'text-light-text dark:text-dark-text hover:text-primary dark:hover:text-primary-dark'
              }`}
            title={durationEditing ? '滚轮调整分钟，点击外部退出' : '点击修改时长'}
          >
            {isFinished ? '00:00' : formattedTime}
          </button>

          {isFinished && (
            <span className="mt-1 text-sm font-medium text-primary dark:text-primary-dark animate-pulse">
              {mode === 'work' ? '完成！' : '休息结束'}
            </span>
          )}
        </div>
      </div>

      {/* ── Control buttons ────────────────────────────────────────────── */}
      <div className="flex items-center gap-10 mb-8">
        {/* Skip — hold 2s to complete pomodoro */}
        <button
          onPointerDown={() => startHold('skip')}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          disabled={status === 'idle' || isFinished}
          className="relative text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors select-none"
        >
          <div className="relative mx-auto w-5 h-5 mb-1">
            {confirmedAction === 'skip' ? (
              <Check className="w-5 h-5 text-emerald-500" />
            ) : (
              <SkipForward className="w-5 h-5" />
            )}
            {/* hold progress ring */}
            {holdTargetRef.current === 'skip' && (
              <svg
                className="absolute -rotate-90"
                style={{ width: 28, height: 28, top: -4, left: -4 }}
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <circle
                  cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeDasharray={2 * Math.PI * 10}
                  strokeDashoffset={2 * Math.PI * 10 * (1 - holdProgress)}
                  strokeLinecap="round"
                  className="text-emerald-500"
                />
              </svg>
            )}
          </div>
          {holdTargetRef.current === 'skip' ? '按住…' : '完成'}
        </button>

        {/* Start / Pause / Replay circle */}
        <button
          onClick={handleToggleRun}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            bg-primary dark:bg-primary-dark text-white
            hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 dark:shadow-primary-dark/30
          `}
          aria-label={isRunning ? '暂停' : isPaused ? '继续' : isFinished ? '重新开始' : '开始'}
        >
          {isRunning ? (
            <Pause className="w-8 h-8" />
          ) : isFinished ? (
            <RotateCcw className="w-8 h-8" />
          ) : (
            <Play className="w-8 h-8 ml-1" />
          )}
        </button>

        {/* Reset — hold 2s to abandon */}
        <button
          onPointerDown={() => startHold('reset')}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          disabled={status === 'idle'}
          className="relative text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors select-none"
        >
          <div className="relative mx-auto w-5 h-5 mb-1">
            {confirmedAction === 'reset' ? (
              <Check className="w-5 h-5 text-red-500" />
            ) : (
              <RotateCcw className="w-5 h-5" />
            )}
            {/* hold progress ring */}
            {holdTargetRef.current === 'reset' && (
              <svg
                className="absolute -rotate-90"
                style={{ width: 28, height: 28, top: -4, left: -4 }}
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <circle
                  cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeDasharray={2 * Math.PI * 10}
                  strokeDashoffset={2 * Math.PI * 10 * (1 - holdProgress)}
                  strokeLinecap="round"
                  className="text-red-500"
                />
              </svg>
            )}
          </div>
          {holdTargetRef.current === 'reset' ? '按住…' : '放弃'}
        </button>
      </div>

      {/* ── Task link card ─────────────────────────────────────────────── */}
      <div className="relative w-full max-w-sm">
        <button
          onMouseDown={(e) => { if (taskDropdownOpen) e.stopPropagation() }}
          onClick={handleToggleTaskDropdown}
          className="w-full text-left px-4 py-3 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border hover:border-primary/40 dark:hover:border-primary-dark/40 transition-colors"
        >
          {linkedTaskId ? (
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                  {linkedTaskTitle}
                </p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                  🍅 {taskCompletedPomos}/{estimatedPomos}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleUnlinkTask()
                }}
                className="ml-2 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors shrink-0"
              >
                取消关联
              </button>
            </div>
          ) : (
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              无关联任务 — 自由专注
            </p>
          )}
        </button>

        {/* Dropdown */}
        {taskDropdownOpen && (
          <div
            ref={taskDropdownRef}
            className="absolute top-full left-0 right-0 mt-1 z-20 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto"
          >
            {pendingTodos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                暂无待办任务
              </p>
            ) : (
              pendingTodos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => handleSelectTask(todo)}
                  className={`
                    w-full text-left px-4 py-3 text-sm hover:bg-light-bg dark:hover:bg-dark-bg transition-colors
                    ${todo.id === linkedTaskId ? 'bg-light-bg dark:bg-dark-bg' : ''}
                  `}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-light-text dark:text-dark-text truncate">
                      {todo.title}
                    </span>
                    <span className="shrink-0 ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium bg-light-border/40 dark:bg-dark-border/40 text-light-text-secondary dark:text-dark-text-secondary">
                      {getTodoCategoryLabel(todo)}
                    </span>
                  </div>
                  {todo.estimated_pomos > 0 && (
                    <span className="ml-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      🍅 {todo.completed_pomos}/{todo.estimated_pomos}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Today stats ────────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
        <span>🍅</span>
        <span className="font-medium text-light-text dark:text-dark-text">
          {completedCount}
        </span>
        <span>次完成</span>
        <span className="mx-1">·</span>
        <span className="font-medium text-light-text dark:text-dark-text">
          {formatTime(todayFocusTime)}
        </span>
        <span>专注</span>
      </div>
    </div>
  )
}
