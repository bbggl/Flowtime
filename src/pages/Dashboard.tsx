import { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sun,
  Sunset,
  Moon,
  Target,
  CheckSquare,
  FileText,
  Play,
  Plus,
  PenTool,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
} from 'lucide-react'
import { useTodoStore, usePomodoroStore, useNotesStore } from '../stores'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Todo } from '../types'

const COUNTDOWN_CACHE_KEY = 'flowtime-countdown-ids'
const isRealSupabase = typeof (supabase as any)?.from === 'function'

function loadCachedCountdown(): string[] {
  try {
    const raw = localStorage.getItem(COUNTDOWN_CACHE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCachedCountdown(ids: string[]) {
  try { localStorage.setItem(COUNTDOWN_CACHE_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TimeOfDay = 'morning' | 'afternoon' | 'evening'

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}

const greetingConfig: Record<TimeOfDay, { text: string; Icon: typeof Sun }> = {
  morning: { text: '早安', Icon: Sun },
  afternoon: { text: '下午好', Icon: Sunset },
  evening: { text: '晚上好', Icon: Moon },
}

function displayName(user: { email?: string; user_metadata?: { name?: string } } | null): string {
  if (user?.user_metadata?.name) return user.user_metadata.name
  if (user?.email) return user.email.split('@')[0]
  return '用户'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TodoProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-light-text dark:text-dark-text font-medium">
          {done}/{total} 已完成
        </span>
        <span className="text-light-text-secondary dark:text-dark-text-secondary">
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
        <div
          className="h-full rounded-full bg-primary dark:bg-primary-dark transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const GREETING_CACHE_KEY = 'flowtime-greeting'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // --- Editable greeting ---
  const [customGreeting, setCustomGreeting] = useState<string | null>(() => {
    try { return localStorage.getItem(GREETING_CACHE_KEY) } catch { return null }
  })
  const [editingGreeting, setEditingGreeting] = useState(false)
  const [greetingDraft, setGreetingDraft] = useState('')

  // Load greeting from Supabase
  useEffect(() => {
    if (!isRealSupabase) return
    supabase
      .from('user_settings')
      .select('greeting_text')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }: { data: any; error: any }) => {
        if (!error && data?.greeting_text) {
          setCustomGreeting(data.greeting_text)
          localStorage.setItem(GREETING_CACHE_KEY, data.greeting_text)
        }
      })
  }, [])

  const saveGreeting = (text: string) => {
    const trimmed = text.trim()
    setCustomGreeting(trimmed || null)
    setEditingGreeting(false)
    if (trimmed) {
      localStorage.setItem(GREETING_CACHE_KEY, trimmed)
    } else {
      localStorage.removeItem(GREETING_CACHE_KEY)
    }
    if (isRealSupabase) {
      supabase
        .from('user_settings')
        .update({ greeting_text: trimmed || null })
        .neq('user_id', '00000000-0000-0000-0000-000000000000')
        .then(({ error }: { error: any }) => {
          if (error) console.warn('Greeting save failed:', error.message)
        })
    }
  }

  const startEditGreeting = () => {
    setGreetingDraft(customGreeting || `${greeting}，${displayName(user)}`)
    setEditingGreeting(true)
  }

  // Mount 时从 Supabase 加载数据
  useEffect(() => {
    useTodoStore.getState().loadTodos()
    usePomodoroStore.getState().loadRecords()
    useNotesStore.getState().loadNotes()
  }, [])

  const todos = useTodoStore((s) => s.todos)
  const completedCount = usePomodoroStore((s) => s.completedCount)
  const dailyGoal = usePomodoroStore((s) => s.dailyGoal)
  const notes = useNotesStore((s) => s.notes)

  // Dashboard todo overview filter settings
  const dashboardFilteredTodos = useMemo(() => {
    const todayDate = todayStr()
    // Read selected categories from localStorage
    let selectedCats: string[]
    try {
      const raw = localStorage.getItem('flowtime-dashboard-categories')
      selectedCats = raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      selectedCats = []
    }
    // Default: show all categories if no selection saved
    if (selectedCats.length === 0) return todos

    // Read today sub-filter from localStorage
    let todayFilter: string[]
    try {
      const raw = localStorage.getItem('flowtime-dashboard-today-filter')
      todayFilter = raw ? (JSON.parse(raw) as string[]) : ['today', 'future', 'past']
    } catch {
      todayFilter = ['today', 'future', 'past']
    }

    return todos.filter((t) => {
      if (!selectedCats.includes(t.category)) return false
      if (t.category === 'today' && t.date) {
        if (t.date === todayDate && !todayFilter.includes('today')) return false
        if (t.date > todayDate && !todayFilter.includes('future')) return false
        if (t.date < todayDate && !todayFilter.includes('past')) return false
      }
      return true
    })
  }, [todos])

  const todoStats = useMemo(() => {
    const done = dashboardFilteredTodos.filter((t) => t.status === 'done').length
    return { total: dashboardFilteredTodos.length, done }
  }, [dashboardFilteredTodos])

  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 3),
    [notes],
  )

  const isEmpty = todos.length === 0 && completedCount === 0 && notes.length === 0

  function todayStr(): string {
    return new Date().toISOString().slice(0, 10)
  }

  // Calendar helpers (timezone-safe, same logic as Todo calendar)
  function daysInMonth(y: number, m: number): number {
    return new Date(y, m + 1, 0).getDate()
  }
  function firstDayOfMonth(y: number, m: number): number {
    return new Date(y, m, 1).getDay()
  }
  function formatDate(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
  const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

  // --- Countdown state (multiple tiles, persisted) ---
  const [countdownTodoIds, setCountdownTodoIds] = useState<string[]>(loadCachedCountdown)
  const [showCountdownPicker, setShowCountdownPicker] = useState(false)
  const [pickerDate, setPickerDate] = useState(todayStr)
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear())
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth())
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  // Load countdown from Supabase on mount
  useEffect(() => {
    if (!isRealSupabase) return
    supabase
      .from('user_settings')
      .select('countdown_todo_ids')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }: { data: any; error: any }) => {
        if (!error && data?.countdown_todo_ids) {
          const ids: string[] = data.countdown_todo_ids
          if (ids.length > 0) {
            setCountdownTodoIds(ids)
            saveCachedCountdown(ids)
          }
        }
      })
  }, [])

  // Persist countdown changes to localStorage + Supabase
  useEffect(() => {
    saveCachedCountdown(countdownTodoIds)
    if (!isRealSupabase) return
    const timer = setTimeout(() => {
      supabase
        .from('user_settings')
        .update({ countdown_todo_ids: countdownTodoIds })
        .neq('user_id', '00000000-0000-0000-0000-000000000000')
        .then(({ error }: { error: any }) => {
          if (error) console.warn('Countdown save failed:', error.message)
        })
    }, 500)
    return () => clearTimeout(timer)
  }, [countdownTodoIds])

  const countdownTodos = useMemo(
    () => countdownTodoIds.map((id) => todos.find((t) => t.id === id)).filter(Boolean) as Todo[],
    [todos, countdownTodoIds],
  )

  // Compute days and color for a given todo (timezone-safe)
  function getCountdownDays(todo: Todo): number | null {
    if (!todo.date) return null
    const parts = todo.date.split('-').map(Number)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const target = new Date(parts[0], parts[1] - 1, parts[2])
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  function getCountdownColor(todo: Todo): { base: string; opacity: string } {
    const days = getCountdownDays(todo)
    if (days === null || days <= 0) {
      return { base: 'text-light-text-secondary dark:text-dark-text-secondary', opacity: 'opacity-30' }
    }
    const opacity = days <= 3 ? 'opacity-100' : days <= 7 ? 'opacity-80' : days <= 14 ? 'opacity-60' : days <= 30 ? 'opacity-40' : 'opacity-25'
    switch (todo.priority) {
      case 'high': return { base: 'text-accent dark:text-accent-dark', opacity }
      case 'medium': return { base: 'text-primary dark:text-primary-dark', opacity }
      case 'low': return { base: 'text-light-text-secondary dark:text-dark-text-secondary', opacity }
    }
  }

  const addCountdown = (id: string) => {
    if (!countdownTodoIds.includes(id)) {
      setCountdownTodoIds((prev) => [...prev, id])
    }
    setShowCountdownPicker(false)
  }

  const removeCountdown = (id: string) => {
    setCountdownTodoIds((prev) => prev.filter((x) => x !== id))
  }

  // Drag-and-drop reorder
  const dragIdxRef = useRef<number | null>(null)
  const moveCountdown = useCallback((from: number, to: number) => {
    setCountdownTodoIds((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  // Todos for the picker date
  const pickerDateTodos = useMemo(
    () => todos.filter((t) => t.date === pickerDate),
    [todos, pickerDate],
  )

  const timeOfDay = getTimeOfDay()
  const { text: greeting, Icon: GreetingIcon } = greetingConfig[timeOfDay]

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------
  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-6 px-6">
        <Sparkles className="w-16 h-16 text-primary/40 dark:text-primary-dark/40" />
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-light-text dark:text-dark-text">
            {customGreeting || `${greeting}，${displayName(user)}`}
          </p>
          <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-xs">
            暂无数据，开始你的第一个番茄吧！
          </p>
        </div>
        <button
          onClick={() => navigate('/pomodoro')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary dark:bg-primary-dark text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Play className="w-4 h-4" />
          开始专注
        </button>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Normal state — Bento grid: 2 cols x 3 rows
  // -----------------------------------------------------------------------
  return (
    <div className="p-6 h-full">
      {/* Greeting row — editable */}
      <div className="mb-5 flex items-center gap-3 group/greet">
        <GreetingIcon className="w-7 h-7 text-primary dark:text-primary-dark flex-shrink-0" />
        {editingGreeting ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={greetingDraft}
              onChange={(e) => setGreetingDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveGreeting(greetingDraft)
                if (e.key === 'Escape') setEditingGreeting(false)
              }}
              onBlur={() => saveGreeting(greetingDraft)}
              placeholder="输入自定义标题..."
              className="text-xl font-bold bg-transparent border-b-2 border-primary dark:border-primary-dark text-light-text dark:text-dark-text outline-none py-0.5 w-full max-w-sm"
            />
          </div>
        ) : (
          <h1
            onClick={startEditGreeting}
            className="text-xl font-bold text-light-text dark:text-dark-text cursor-pointer hover:text-primary dark:hover:text-primary-dark transition-colors select-none flex items-center gap-2"
            title="点击编辑标题"
          >
            {customGreeting || `${greeting}，${displayName(user)}`}
            <Pencil className="w-4 h-4 opacity-0 group-hover/greet:opacity-40 transition-opacity flex-shrink-0" />
          </h1>
        )}
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-fr">
        {/* Card 1: Greeting card */}
        <div className="rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border p-5 flex flex-col justify-center gap-1">
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            {new Date().toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
          <p className="text-lg font-semibold text-light-text dark:text-dark-text">
            {customGreeting || `${greeting}，${displayName(user)}`}
          </p>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            今天也是专注的一天
          </p>
        </div>

        {/* Card 2: Today's pomodoro goal */}
        <div className="rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border p-5 flex flex-col justify-center gap-3">
          <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <Target className="w-4 h-4" />
            今日番茄目标
          </div>
          <div>
            <span className="text-3xl font-bold text-light-text dark:text-dark-text">
              {completedCount}
            </span>
            <span className="text-light-text-secondary dark:text-dark-text-secondary">
              {' '}/{' '}{dailyGoal}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary dark:bg-primary-dark transition-[width] duration-500 ease-out"
              style={{ width: `${dailyGoal > 0 ? Math.min((completedCount / dailyGoal) * 100, 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
            {completedCount >= dailyGoal
              ? '已完成今日目标！'
              : `还差 ${dailyGoal - completedCount} 个番茄`}
          </p>
        </div>

        {/* Card 3: Todo overview */}
        <div className="rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border p-5 flex flex-col justify-center gap-3">
          <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <CheckSquare className="w-4 h-4" />
            待办概览
          </div>
          <TodoProgressBar done={todoStats.done} total={todoStats.total} />
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
            {todoStats.total === 0
              ? '暂无待办事项'
              : todoStats.done === todoStats.total
                ? '全部完成！'
                : `还有 ${todoStats.total - todoStats.done} 项待完成`}
          </p>
        </div>

        {/* Card 4: Target countdown — rectangular with square sub-tiles */}
        <div className="rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border p-5 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0">
            <Clock className="w-4 h-4" />
            目标倒计时
            {countdownTodos.length > 0 && (
              <span className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                ({countdownTodos.length})
              </span>
            )}
          </div>

          {/* Body: horizontal row of square tiles */}
          <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto overflow-y-hidden">
            {/* ---- Existing countdown tiles (draggable) ---- */}
            {countdownTodos.map((todo, idx) => {
              const days = getCountdownDays(todo)
              const color = getCountdownColor(todo)
              return (
                <div
                  key={todo.id}
                  draggable
                  onDragStart={(e) => {
                    dragIdxRef.current = idx
                    e.dataTransfer.effectAllowed = 'move'
                    ;(e.currentTarget as HTMLElement).style.opacity = '0.5'
                  }}
                  onDragEnd={(e) => {
                    dragIdxRef.current = null
                    ;(e.currentTarget as HTMLElement).style.opacity = '1'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = dragIdxRef.current
                    if (from !== null && from !== idx) {
                      moveCountdown(from, idx)
                    }
                    dragIdxRef.current = null
                  }}
                  className="relative flex-shrink-0 h-full aspect-square rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center gap-0.5 p-2 group cursor-grab active:cursor-grabbing select-none"
                >
                  {/* Drag handle indicator */}
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-40 transition-opacity">
                    <svg className="w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                    </svg>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeCountdown(todo.id)}
                    className="absolute top-1 right-1 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                    title="移除倒计时"
                  >
                    <X className="w-3 h-3 text-light-text-secondary/50 dark:text-dark-text-secondary/50 hover:text-red-400" />
                  </button>

                  <span className="text-[10px] text-light-text-secondary/70 dark:text-dark-text-secondary/70">
                    距离
                  </span>
                  <span className="text-[10px] font-medium text-light-text dark:text-dark-text truncate max-w-full px-1 text-center leading-tight">
                    {todo.title}
                  </span>
                  <span className="text-[10px] text-light-text-secondary/70 dark:text-dark-text-secondary/70">
                    还有
                  </span>
                  <span className={`text-2xl font-bold tabular-nums leading-none ${color.base} ${color.opacity}`}>
                    {days !== null ? Math.abs(days) : '--'}
                  </span>
                  <span className="text-[10px] text-light-text-secondary/70 dark:text-dark-text-secondary/70">
                    天
                  </span>
                </div>
              )
            })}

            {/* ---- Add tile ---- */}
            <button
              onClick={() => {
                const d = new Date(); d.setHours(0,0,0,0)
                setPickerDate(todayStr())
                setPickerYear(d.getFullYear())
                setPickerMonth(d.getMonth())
                setShowCountdownPicker(true)
              }}
              className="flex-shrink-0 h-full aspect-square rounded-xl border-2 border-dashed border-light-text-secondary/20 dark:border-dark-text-secondary/20 hover:border-primary/50 dark:hover:border-primary-dark/50 transition-colors flex flex-col items-center justify-center gap-1 group"
              title="添加倒计时"
            >
              <Plus className="w-5 h-5 text-light-text-secondary/25 dark:text-dark-text-secondary/25 group-hover:text-primary/50 dark:group-hover:text-primary-dark/50 transition-colors" />
              <span className="text-[10px] text-light-text-secondary/25 dark:text-dark-text-secondary/25 group-hover:text-primary/50 dark:group-hover:text-primary-dark/50 transition-colors">
                添加
              </span>
            </button>
          </div>
        </div>

        {/* ---- Countdown picker modal ---- */}
        {showCountdownPicker && (() => {
          const totalDays = daysInMonth(pickerYear, pickerMonth)
          const firstDay = firstDayOfMonth(pickerYear, pickerMonth)
          const cells: (number | null)[] = []
          for (let i = 0; i < firstDay; i++) cells.push(null)
          for (let d = 1; d <= totalDays; d++) cells.push(d)

          const changeMonth = (dir: -1 | 1) => {
            if (dir === -1) {
              if (pickerMonth === 0) { setPickerYear((y) => y - 1); setPickerMonth(11) }
              else setPickerMonth((m) => m - 1)
            } else {
              if (pickerMonth === 11) { setPickerYear((y) => y + 1); setPickerMonth(0) }
              else setPickerMonth((m) => m + 1)
            }
            setShowMonthPicker(false)
          }

          const today = todayStr()

          // Status map: which dates have todos
          const dateHasTodos = new Set<string>()
          for (let d = 1; d <= totalDays; d++) {
            const key = formatDate(pickerYear, pickerMonth, d)
            if (todos.some((t) => t.date === key)) dateHasTodos.add(key)
          }

          // Build set of (YYYY-MM) keys that have todos — for month picker dots
          const monthsWithTodos = new Set<string>()
          for (const t of todos) {
            if (t.date) monthsWithTodos.add(t.date.slice(0, 7))
          }

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
              onClick={() => setShowCountdownPicker(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-[320px] max-h-[80vh] rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-2xl p-5 flex flex-col gap-3 overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-light-text dark:text-dark-text">
                    选择日期
                  </span>
                  <button
                    onClick={() => setShowCountdownPicker(false)}
                    className="p-1 rounded-lg hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition-colors"
                  >
                    <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                  </button>
                </div>

                {/* ── Mini calendar ── */}
                <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                  {/* Month header */}
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => changeMonth(-1)} className="p-0.5 rounded hover:bg-light-border/50 dark:hover:bg-dark-border/50">
                      <ChevronLeft className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowMonthPicker((v) => !v)}
                        className="text-xs font-semibold text-light-text dark:text-dark-text px-2 py-0.5 rounded hover:bg-light-border/30 dark:hover:bg-dark-border/30"
                      >
                        {pickerYear}年{pickerMonth + 1}月
                      </button>
                      {/* Quick month grid */}
                      {showMonthPicker && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 p-2 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-lg w-44">
                          <div className="flex items-center justify-between mb-1.5">
                            <button onClick={() => { setPickerYear((y) => y - 1); }} className="p-0.5 rounded hover:bg-light-border/50">
                              <ChevronLeft className="w-3 h-3 text-light-text-secondary" />
                            </button>
                            <span className="text-[10px] font-semibold text-light-text">{pickerYear}年</span>
                            <button onClick={() => { setPickerYear((y) => y + 1); }} className="p-0.5 rounded hover:bg-light-border/50">
                              <ChevronRight className="w-3 h-3 text-light-text-secondary" />
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {MONTHS.map((name, mi) => {
                              const hasTodos = monthsWithTodos.has(`${pickerYear}-${String(mi + 1).padStart(2, '0')}`)
                              return (
                              <button
                                key={name}
                                onClick={() => { setPickerMonth(mi); setShowMonthPicker(false); }}
                                className={`relative py-1 rounded text-[10px] font-medium transition-colors
                                  ${mi === pickerMonth ? 'bg-primary text-white dark:bg-primary-dark' : 'text-light-text-secondary hover:bg-light-border/50 dark:hover:bg-dark-border/50'}
                                `}
                              >
                                {name}
                                {hasTodos && (
                                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${mi === pickerMonth ? 'bg-white/70' : 'bg-primary/60 dark:bg-primary-dark/60'}`} />
                                )}
                              </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => changeMonth(1)} className="p-0.5 rounded hover:bg-light-border/50 dark:hover:bg-dark-border/50">
                      <ChevronRight className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                  </div>

                  {/* Weekday labels */}
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {WEEKDAY.map((w) => (
                      <div key={w} className="text-center text-[10px] text-light-text-secondary/70 dark:text-dark-text-secondary/70 py-0.5">
                        {w}
                      </div>
                    ))}
                  </div>

                  {/* Date cells */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {cells.map((day, ci) => {
                      if (day === null) return <div key={`e-${ci}`} className="aspect-square" />
                      const dateKey = formatDate(pickerYear, pickerMonth, day)
                      const isSelected = dateKey === pickerDate
                      const isToday = dateKey === today
                      const hasTodos = dateHasTodos.has(dateKey)
                      return (
                        <button
                          key={dateKey}
                          onClick={() => setPickerDate(dateKey)}
                          className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors
                            ${isSelected ? 'bg-primary text-white dark:bg-primary-dark dark:text-white' : ''}
                            ${!isSelected && isToday ? 'ring-1 ring-primary/60 dark:ring-primary-dark/60' : ''}
                            ${!isSelected && !isToday && hasTodos ? 'text-light-text dark:text-dark-text font-semibold' : ''}
                            ${!isSelected && !isToday && !hasTodos ? 'text-light-text-secondary/50 dark:text-dark-text-secondary/50' : ''}
                            ${!isSelected ? 'hover:bg-light-border/40 dark:hover:bg-dark-border/40' : ''}
                          `}
                        >
                          {day}
                          {hasTodos && !isSelected && (
                            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary/60 dark:bg-primary-dark/60" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── Selected date info + todo list ── */}
                <div>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">
                    {pickerDate} 的待办
                  </p>
                  <div className="space-y-1 max-h-[160px] overflow-y-auto">
                    {pickerDateTodos.length === 0 ? (
                      <p className="text-xs text-light-text-secondary/50 dark:text-dark-text-secondary/50 text-center py-4">
                        该日期暂无待办
                      </p>
                    ) : (
                      pickerDateTodos
                        .filter((t) => !countdownTodoIds.includes(t.id))
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => addCountdown(t.id)}
                            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg border border-transparent hover:border-light-border dark:hover:border-dark-border"
                          >
                            <span className="mr-2 text-primary dark:text-primary-dark">+</span>
                            {t.title}
                          </button>
                        ))
                    )}
                    {pickerDateTodos.filter((t) => !countdownTodoIds.includes(t.id)).length === 0 && pickerDateTodos.length > 0 && (
                      <p className="text-xs text-light-text-secondary/50 dark:text-dark-text-secondary/50 text-center py-3">
                        该日期的待办已全部添加
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Card 5: Recent notes */}
        <div className="rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <FileText className="w-4 h-4" />
            最近笔记
          </div>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              暂无笔记
            </p>
          ) : (
            <ul className="space-y-2.5 flex-1">
              {recentNotes.map((note) => (
                <li key={note.id}>
                  <button
                    onClick={() => {
                      useNotesStore.getState().setCurrentNote(note.id)
                      navigate('/notes')
                    }}
                    className="text-sm font-medium text-light-text dark:text-dark-text truncate w-full text-left hover:text-primary dark:hover:text-primary-dark transition-colors cursor-pointer"
                  >
                    {note.title || '无标题'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 6: Quick actions */}
        <div className="rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border p-5 flex flex-col justify-center gap-3">
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            快捷操作
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/pomodoro')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark font-medium hover:bg-primary/20 dark:hover:bg-primary-dark/20 transition-colors text-sm"
            >
              <Play className="w-4 h-4" />
              开始专注
            </button>
            <button
              onClick={() => navigate('/todo')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 dark:bg-accent-dark/10 text-accent dark:text-accent-dark font-medium hover:bg-accent/20 dark:hover:bg-accent-dark/20 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              新建待办
            </button>
            <button
              onClick={() => navigate('/notes')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark font-medium hover:bg-primary/20 dark:hover:bg-primary-dark/20 transition-colors text-sm"
            >
              <PenTool className="w-4 h-4" />
              写笔记
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
