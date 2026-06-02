import { useRef, useState, useCallback, useMemo } from 'react'
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react'
import { useStore } from 'zustand'
import { usePomodoroTimer } from '../hooks/usePomodoroTimer'
import { createPomodoroStore, type PomodoroMode } from '../stores/usePomodoroStore'
import { createTodoStore } from '../stores/useTodoStore'
import { formatTime } from '../utils/time'
import type { Todo } from '../types'

// ── Mode config ──────────────────────────────────────────────────────────────
const MODES: { key: PomodoroMode; label: string; minutes: number }[] = [
  { key: 'work', label: '工作', minutes: 25 },
  { key: 'short_break', label: '短休', minutes: 5 },
  { key: 'long_break', label: '长休', minutes: 15 },
]

const MODE_DURATIONS: Record<PomodoroMode, number> = {
  work: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
}

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

// ── Helpers ──────────────────────────────────────────────────────────────────
function totalDurationForMode(mode: PomodoroMode): number {
  return MODE_DURATIONS[mode]
}

function computeProgress(remainingSeconds: number, mode: PomodoroMode): number {
  const total = totalDurationForMode(mode)
  if (total <= 0) return 0
  return 1 - remainingSeconds / total
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Pomodoro() {
  const pomodoroStoreRef = useRef(createPomodoroStore({}))
  const todoStoreRef = useRef(createTodoStore({}))

  const store = pomodoroStoreRef.current
  const todoStore = todoStoreRef.current

  const timer = usePomodoroTimer(store)

  const taskCompletedPomos = useStore(store, (s) => s.taskCompletedPomos)
  const records = useStore(store, (s) => s.records)
  const allTodos = useStore(todoStore, (s) => s.todos)

  const todayFocusTime = useMemo(() => {
    return records
      .filter((r) => r.mode === 'work' && r.status === 'completed')
      .reduce((sum, r) => sum + r.actual_duration, 0)
  }, [records])

  const pendingTodos = useMemo(
    () => allTodos.filter((t) => t.status === 'pending'),
    [allTodos],
  )

  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false)

  const isRunning = timer.status === 'running'
  const isPaused = timer.status === 'paused'
  const isFinished = timer.status === 'finished'

  const progress = computeProgress(timer.remainingSeconds, timer.mode)
  const dashOffset = CIRCUMFERENCE * progress
  const ringColors = RING_COLORS[timer.mode]

  // ── Linked task info ─────────────────────────────────────────────────────
  const linkedTodo: Todo | undefined =
    timer.linkedTaskId
      ? pendingTodos.find((t) => t.id === timer.linkedTaskId) ??
        todoStore.getState().todos.find((t) => t.id === timer.linkedTaskId)
      : undefined

  const estimatedPomos = linkedTodo?.estimated_pomos ?? 0

  const handleToggleTaskDropdown = useCallback(() => {
    setTaskDropdownOpen((prev) => !prev)
  }, [])

  const handleSelectTask = useCallback(
    (todo: Todo) => {
      timer.linkTask(todo.id, todo.title)
      setTaskDropdownOpen(false)
    },
    [timer],
  )

  const handleUnlinkTask = useCallback(() => {
    timer.unlinkTask()
  }, [timer])

  // ── Start / Pause / Resume ──────────────────────────────────────────────
  const handleToggleRun = useCallback(() => {
    if (isRunning) {
      timer.pause()
    } else if (isPaused) {
      timer.resume()
    } else {
      timer.start()
    }
  }, [isRunning, isPaused, timer])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center px-6 py-8 min-h-full">
      {/* ── Mode switch ────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-8">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => timer.setMode(m.key)}
            disabled={isRunning}
            className={`
              px-5 py-2 rounded-full text-sm font-medium transition-colors
              disabled:opacity-60
              ${
                timer.mode === m.key
                  ? 'bg-primary text-white dark:bg-primary-dark dark:text-dark-bg'
                  : 'bg-light-card dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border'
              }
            `}
          >
            {m.label}
            <span className="ml-1 opacity-70">{m.minutes}min</span>
          </button>
        ))}
      </div>

      {/* ── Timer ring + center display ────────────────────────────────── */}
      <div className="relative mb-8">
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          className="w-72 h-72 -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className={ringColors.track}
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

        {/* Center time display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-mono font-bold tracking-tight text-light-text dark:text-dark-text">
            {timer.formattedTime}
          </span>
        </div>
      </div>

      {/* ── Control buttons ────────────────────────────────────────────── */}
      <div className="flex items-center gap-10 mb-8">
        {/* Skip */}
        <button
          onClick={timer.skip}
          disabled={timer.status === 'idle' || isFinished}
          className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <SkipForward className="w-5 h-5 mx-auto mb-1" />
          跳过
        </button>

        {/* Start / Pause circle */}
        <button
          onClick={handleToggleRun}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            bg-primary dark:bg-primary-dark text-white
            hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 dark:shadow-primary-dark/30
          `}
          aria-label={isRunning ? '暂停' : isPaused ? '继续' : '开始'}
        >
          {isRunning ? (
            <Pause className="w-8 h-8" />
          ) : (
            <Play className="w-8 h-8 ml-1" />
          )}
        </button>

        {/* Reset */}
        <button
          onClick={timer.reset}
          disabled={timer.status === 'idle'}
          className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-5 h-5 mx-auto mb-1" />
          重置
        </button>
      </div>

      {/* ── Task link card ─────────────────────────────────────────────── */}
      <div className="relative w-full max-w-sm">
        <button
          onClick={handleToggleTaskDropdown}
          className="w-full text-left px-4 py-3 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border hover:border-primary/40 dark:hover:border-primary-dark/40 transition-colors"
        >
          {timer.linkedTaskId ? (
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                  {timer.linkedTaskTitle}
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
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
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
                    ${todo.id === timer.linkedTaskId ? 'bg-light-bg dark:bg-dark-bg' : ''}
                  `}
                >
                  <span className="text-light-text dark:text-dark-text">
                    {todo.title}
                  </span>
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
          {timer.completedCount}
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
