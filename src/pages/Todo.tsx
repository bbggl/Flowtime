import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Play,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Check,
  X,
  Clock,
  CheckSquare,
  MoveRight,
  Undo2,
} from 'lucide-react'
import { useTodoStore, usePomodoroStore } from '../stores'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import type { Todo } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function todayStr(): string {
  const now = new Date()
  const hour = parseInt(localStorage.getItem('flowtime-dayStartHour') || '0', 10)
  const d = now.getHours() < hour
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    : now
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

const PRIORITY_META = {
  high: { label: '高', bg: 'bg-accent/15 text-accent dark:bg-accent-dark/20 dark:text-accent-dark' },
  medium: { label: '中', bg: 'bg-primary/15 text-primary dark:bg-primary-dark/20 dark:text-primary-dark' },
  low: { label: '低', bg: 'bg-light-text-secondary/15 text-light-text-secondary dark:bg-dark-text-secondary/20 dark:text-dark-text-secondary' },
} as const

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

type DateStatus = 'all-done' | 'has-pending' | 'none'

// ---------------------------------------------------------------------------
// Calendar sub-component
// ---------------------------------------------------------------------------
function CalendarView({
  year,
  month,
  todos,
  onJump,
  onDateClick,
  onClose,
}: {
  year: number
  month: number
  todos: Todo[]
  onJump: (year: number, month: number) => void
  onDateClick: (date: string) => void
  onClose: () => void
}) {
  const totalDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const today = todayStr()

  // Month/year picker state
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)
  const pickerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  // Click outside to close picker
  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  // Click outside to close calendar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleMonthSelect = (m: number) => {
    onJump(pickerYear, m)
    setShowPicker(false)
  }

  const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

  // Build set of (YYYY-MM) keys that have todos — for marking months with dots
  const monthsWithTodos = new Set<string>()
  for (const t of todos) {
    if (t.date) {
      monthsWithTodos.add(t.date.slice(0, 7)) // "YYYY-MM"
    }
  }

  // Build date -> status map
  const statusMap = new Map<string, DateStatus>()
  for (let d = 1; d <= totalDays; d++) {
    const key = formatDate(year, month, d)
    const dayTodos = todos.filter((t) => t.date === key)
    if (dayTodos.length === 0) {
      statusMap.set(key, 'none')
    } else if (dayTodos.every((t) => t.status === 'done')) {
      statusMap.set(key, 'all-done')
    } else {
      statusMap.set(key, 'has-pending')
    }
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  return (
    <div
      ref={calendarRef}
      className="relative w-72 p-4 rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-lg"
    >
      {/* Header — month/year title only, clickable to open picker */}
      <div className="flex items-center justify-center mb-3">
        <button
          onMouseDown={(e) => { if (showPicker) e.stopPropagation() }}
          onClick={() => {
            if (showPicker) {
              setShowPicker(false)
            } else {
              setPickerYear(year)
              setShowPicker(true)
            }
          }}
          className="text-sm font-semibold text-light-text dark:text-dark-text hover:text-primary dark:hover:text-primary-dark transition-colors px-2 py-0.5 rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg"
          title="选择月份"
        >
          {year}年{month + 1}月
        </button>
      </div>

      {/* Month/Year picker dropdown — absolute overlay */}
      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute top-12 left-4 right-4 z-20 p-2 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-xl"
        >
          {/* Year stepper */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setPickerYear((y) => y - 1)}
              className="p-0.5 rounded hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
            </button>
            <span className="text-xs font-semibold text-light-text dark:text-dark-text">{pickerYear}年</span>
            <button
              onClick={() => setPickerYear((y) => y + 1)}
              className="p-0.5 rounded hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1">
            {MONTH_NAMES.map((name, idx) => {
              const isCurrent = pickerYear === year && idx === month
              const hasTodos = monthsWithTodos.has(`${pickerYear}-${String(idx + 1).padStart(2, '0')}`)
              return (
                <button
                  key={name}
                  onClick={() => handleMonthSelect(idx)}
                  className={`relative py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${isCurrent
                      ? 'bg-primary text-white dark:bg-primary-dark dark:text-white'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/50 dark:hover:bg-dark-border/50'
                    }
                  `}
                >
                  {name}
                  {hasTodos && (
                    <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isCurrent ? 'bg-white/70' : 'bg-primary/60 dark:bg-primary-dark/60'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary py-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />

          const dateKey = formatDate(year, month, day)
          const status = statusMap.get(dateKey) ?? 'none'
          const isToday = dateKey === today

          return (
            <button
              key={dateKey}
              onClick={() => onDateClick(dateKey)}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer hover:scale-110 active:scale-95
                ${status === 'all-done' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : ''}
                ${status === 'has-pending' ? 'bg-red-400/20 text-red-500 dark:text-red-400' : ''}
                ${status === 'none' ? 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/40 dark:hover:bg-dark-border/40' : ''}
                ${isToday ? 'ring-2 ring-primary dark:ring-primary-dark' : ''}
              `}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Todo page
// ---------------------------------------------------------------------------
export default function Todo() {
  const navigate = useNavigate()

  // --- Todo store ---
  const todos = useTodoStore((s) => s.todos)
  const categories = useTodoStore((s) => s.categories)
  const currentCategory = useTodoStore((s) => s.currentCategory)
  const addTodo = useTodoStore((s) => s.addTodo)
  const toggleTodo = useTodoStore((s) => s.toggleTodo)
  const changePriority = useTodoStore((s) => s.changePriority)
  const changeEstimatedPomos = useTodoStore((s) => s.changeEstimatedPomos)
  const deleteTodo = useTodoStore((s) => s.deleteTodo)
  const reorderTodos = useTodoStore((s) => s.reorderTodos)
  const createCategory = useTodoStore((s) => s.createCategory)
  const renameCategory = useTodoStore((s) => s.renameCategory)
  const deleteCategory = useTodoStore((s) => s.deleteCategory)
  const setCurrentCategory = useTodoStore((s) => s.setCurrentCategory)
  const getFilteredTodos = useTodoStore((s) => s.getFilteredTodos)
  const isReadOnlyView = useTodoStore((s) => s.isReadOnlyView)
  const selectedDate = useTodoStore((s) => s.selectedDate)
  const setSelectedDate = useTodoStore((s) => s.setSelectedDate)

  // Multi-select
  const isMultiSelectMode = useTodoStore((s) => s.isMultiSelectMode)
  const selectedTodoIds = useTodoStore((s) => s.selectedTodoIds)
  const toggleMultiSelectMode = useTodoStore((s) => s.toggleMultiSelectMode)
  const toggleTodoSelection = useTodoStore((s) => s.toggleTodoSelection)
  const syncToToday = useTodoStore((s) => s.syncToToday)
  const uncompleteTodos = useTodoStore((s) => s.uncompleteTodos)
  const moveTodos = useTodoStore((s) => s.moveTodos)
  const copyTodos = useTodoStore((s) => s.copyTodos)

  // Mount 时从 Supabase 加载数据
  useEffect(() => {
    useTodoStore.getState().loadTodos()
    useTodoStore.getState().loadCategories()
  }, [])

  // --- Pomodoro store ---
  const linkTask = usePomodoroStore((s) => s.linkTask)

  // --- Local state ---
  const [inputValue, setInputValue] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set())
  const [editingCatName, setEditingCatName] = useState<string | null>(null)
  const [renameCatInput, setRenameCatInput] = useState('')
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; hasCountdown: boolean; hasSyncedCopies: boolean } | null>(null)
  // Pomodoro count picker
  const [pomoPickerId, setPomoPickerId] = useState<string | null>(null)

  // Move/copy category picker for multi-select
  const [moveCopyOpen, setMoveCopyOpen] = useState<'move' | 'copy' | null>(null)

  // --- Date helpers ---
  function isPastDate(dateStr: string): boolean {
    return dateStr < todayStr()
  }

  // --- Detect newly added tasks for enter animation ---
  const prevTodosLenRef = useRef(todos.length)

  useEffect(() => {
    if (todos.length > prevTodosLenRef.current && todos.length > 0) {
      const newId = todos[todos.length - 1].id
      setEnteringIds((prev) => new Set([...prev, newId]))
      const timer = setTimeout(() => {
        setEnteringIds((prev) => {
          const next = new Set(prev)
          next.delete(newId)
          return next
        })
      }, 350)
      return () => clearTimeout(timer)
    }
    prevTodosLenRef.current = todos.length
  }, [todos.length])

  // Close pomo picker on outside click
  useEffect(() => {
    if (!pomoPickerId) return
    const handler = () => {
      setPomoPickerId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pomoPickerId])

  // --- Derived ---
  const isReadonly = isReadOnlyView(currentCategory)
  const isTodayView = currentCategory === 'today'
  const isPastSelected = selectedDate ? isPastDate(selectedDate) : false
  const showInput = !isReadonly && !isPastSelected
  const filteredTodos = getFilteredTodos()

  // The store already filters by date for "today" view (with selectedDate support)
  const displayTodos = filteredTodos

  // Drag-and-drop with "dodge" animation
  const dragSourceDisplayIdxRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null) // for 3px threshold
  const dragGrabRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }) // grab offset within element
  const dragTileRef = useRef<HTMLElement | null>(null)
  const dragScrollRef = useRef<HTMLElement | null>(null)
  const lastReorderTimeRef = useRef(0)
  const todoDropRef = useRef(false)

  // --- Handlers ---
  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || isReadonly) return
    addTodo(trimmed, currentCategory)
    setInputValue('')
  }, [inputValue, isReadonly, addTodo, currentCategory])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleAdd()
    },
    [handleAdd],
  )

  const handleCreateCategory = useCallback(() => {
    const name = newCategoryName.trim()
    if (!name) {
      setShowAddCategory(false)
      setNewCategoryName('')
      return
    }
    createCategory(name)
    setCurrentCategory(name)
    setNewCategoryName('')
    setShowAddCategory(false)
  }, [newCategoryName, createCategory, setCurrentCategory])

  const handleCategoryInputBlur = useCallback(() => {
    // 延迟关闭，让确认按钮的 onClick 有机会先触发
    setTimeout(() => {
      setShowAddCategory(false)
      setNewCategoryName('')
    }, 150)
  }, [])

  const handleCategoryKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleCreateCategory()
      if (e.key === 'Escape') {
        setShowAddCategory(false)
        setNewCategoryName('')
      }
    },
    [handleCreateCategory],
  )

  const handleStartRenameCategory = useCallback((name: string) => {
    setEditingCatName(name)
    setRenameCatInput(name)
  }, [])

  const handleConfirmRenameCategory = useCallback(() => {
    const newName = renameCatInput.trim()
    if (editingCatName && newName && newName !== editingCatName) {
      renameCategory(editingCatName, newName)
      // If we were viewing the renamed category, switch to the new name
      if (currentCategory === editingCatName) {
        setCurrentCategory(newName)
      }
    }
    setEditingCatName(null)
    setRenameCatInput('')
  }, [editingCatName, renameCatInput, renameCategory, currentCategory, setCurrentCategory])

  const handleCancelRenameCategory = useCallback(() => {
    setEditingCatName(null)
    setRenameCatInput('')
  }, [])

  const handleDeleteCategory = useCallback(
    (name: string) => {
      if (!window.confirm(`确定要删除分类"${name}"及其所有待办吗？`)) return
      deleteCategory(name)
      // If we were viewing the deleted category, switch to today
      if (currentCategory === name) {
        setCurrentCategory('today')
      }
    },
    [deleteCategory, currentCategory, setCurrentCategory],
  )

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleConfirmRenameCategory()
      if (e.key === 'Escape') handleCancelRenameCategory()
    },
    [handleConfirmRenameCategory, handleCancelRenameCategory],
  )

  // Countdown helpers
  const COUNTDOWN_CACHE_KEY = 'flowtime-countdown-ids'
  const isRealSupabase = typeof (supabase as any)?.from === 'function'

  function getCountdownIds(): string[] {
    try {
      const raw = localStorage.getItem(COUNTDOWN_CACHE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function removeFromCountdown(id: string) {
    const ids = getCountdownIds().filter((x) => x !== id)
    try { localStorage.setItem(COUNTDOWN_CACHE_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
    if (isRealSupabase) {
      supabase
        .from('user_settings')
        .update({ countdown_todo_ids: ids })
        .neq('user_id', '00000000-0000-0000-0000-000000000000')
        .then(({ error }: { error: any }) => {
          if (error) console.warn('Countdown remove failed:', error.message)
        })
    }
  }

  const handleDelete = useCallback(
    (id: string, title: string) => {
      const hasCountdown = getCountdownIds().includes(id)
      const store = useTodoStore.getState()
      const hasSyncedCopies = store.todos.some((t) => t.synced_from_id === id)
      setDeleteConfirm({ id, title, hasCountdown, hasSyncedCopies })
    },
    [],
  )

  const handleStartPomodoro = useCallback(
    (task: Todo) => {
      linkTask(task.id, task.title)
      navigate('/pomodoro')
    },
    [linkTask, navigate],
  )

  const handleCalendarJump = useCallback((y: number, m: number) => {
    setCalendarDate({ year: y, month: m })
  }, [])

  const handleDateClick = useCallback(
    (date: string) => {
      setSelectedDate(date)
      setShowCalendar(false)
    },
    [setSelectedDate],
  )

  const handleBackToToday = useCallback(() => {
    setSelectedDate(null)
    setShowCalendar(false)
  }, [setSelectedDate])

  // --- Render ---
  return (
    <>
    <div
      className="flex flex-col h-full p-6"
      onClick={(e) => {
        if (!isMultiSelectMode) return
        const target = e.target as HTMLElement
        // Don't exit if clicking on a todo item or interactive element
        if (target.closest('[data-todo-item]') || target.closest('button') || target.closest('input')) return
        toggleMultiSelectMode()
      }}
    >
      {/* Inline animation keyframes */}
      <style>{`
        @keyframes todoEnter {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes todoLeave {
          from { opacity: 1; transform: translateX(0); max-height: 80px; margin-bottom: 12px; }
          to   { opacity: 0; transform: translateX(40px); max-height: 0; margin-bottom: 0; }
        }
        .todo-enter { animation: todoEnter 0.3s ease-out; }
        .todo-leave { animation: todoLeave 0.28s ease-out forwards; overflow: hidden; }
      `}</style>

      {/* ================================================================ */}
      {/* Category filter bar                                               */}
      {/* ================================================================ */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 flex-shrink-0">
        {categories.map((cat) => {
            const isCustom = cat.type === 'custom'
            const isEditing = editingCatName === cat.name

            if (isEditing) {
              return (
                <div key={cat.id} className="flex-shrink-0 flex items-center gap-1">
                  <input
                    autoFocus
                    value={renameCatInput}
                    onChange={(e) => setRenameCatInput(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleCancelRenameCategory}
                    className="w-24 px-3 py-1.5 rounded-full text-sm bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text outline-none focus:ring-2 ring-primary/40 dark:ring-primary-dark/40"
                  />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); handleConfirmRenameCategory() }}
                    disabled={!renameCatInput.trim()}
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary dark:bg-primary-dark text-white disabled:opacity-40 transition-opacity"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            }

            return (
              <div key={cat.id} className="flex-shrink-0 group relative">
                <button
                  onClick={() => {
                    if (isMultiSelectMode && cat.id === 'today') {
                      toggleMultiSelectMode()
                    }
                    setCurrentCategory(cat.id)
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors min-w-[3rem] text-center
                    ${
                      currentCategory === cat.id
                        ? 'bg-primary text-white dark:bg-primary-dark dark:text-white'
                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/50 dark:hover:bg-dark-border/50'
                    }
                  `}
                >
                  {cat.name}
                </button>
                {isCustom && (
                  <span className="absolute -top-1 -right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartRenameCategory(cat.name) }}
                      className="w-4 h-4 rounded-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border flex items-center justify-center hover:bg-primary/10 dark:hover:bg-primary-dark/10 transition-colors"
                      title="重命名分类"
                    >
                      <svg className="w-2.5 h-2.5 text-light-text-secondary dark:text-dark-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.name) }}
                      className="w-4 h-4 rounded-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="删除分类"
                    >
                      <X className="w-2.5 h-2.5 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                  </span>
                )}
              </div>
            )
          })}

        {/* Add-category "+" button  /  inline name input */}
        {showAddCategory ? (
          <div className="flex-shrink-0 flex items-center gap-1">
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={handleCategoryKeyDown}
              onBlur={handleCategoryInputBlur}
              placeholder="分类名"
              className="w-24 px-3 py-1.5 rounded-full text-sm bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder:text-light-text-secondary/60 dark:placeholder:text-dark-text-secondary/60 outline-none focus:ring-2 ring-primary/40 dark:ring-primary-dark/40"
            />
            <button
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim()}
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary dark:bg-primary-dark text-white disabled:opacity-40 transition-opacity"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCategory(true)}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition-colors"
            aria-label="新建分类"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Multi-select toggle (hidden in today view) */}
        {!isTodayView && (
          <div className="ml-auto flex-shrink-0">
            <button
              onClick={toggleMultiSelectMode}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isMultiSelectMode
                  ? 'bg-primary text-white dark:bg-primary-dark dark:text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/50 dark:hover:bg-dark-border/50 border border-light-border dark:border-dark-border'
              }`}
            >
              {isMultiSelectMode ? '取消' : '多选'}
            </button>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Task input (hidden for read-only views and past dates)            */}
      {/* ================================================================ */}
      {showInput && (
        <div className="flex gap-3 mb-5 flex-shrink-0">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="添加新任务..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder:text-light-text-secondary/60 dark:placeholder:text-dark-text-secondary/60 outline-none focus:ring-2 ring-primary/40 dark:ring-primary-dark/40 transition-shadow text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            className="px-5 py-2.5 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            添加
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* Task list                                                         */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden -mx-1 px-1 py-0.5">
        {displayTodos.length === 0 ? (
          /* ---- Empty state ---- */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-light-border/50 dark:bg-dark-border/30 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-light-text-secondary/40 dark:text-dark-text-secondary/40" />
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {isPastSelected
                ? '该日期暂无历史待办'
                : isReadonly
                  ? '该分类下暂无任务'
                  : '还没有任务，添加第一个吧！'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayTodos.map((todo, displayIdx) => {
              const isDone = todo.status === 'done'
              const isDeleting = deletingIds.has(todo.id)
              const isEntering = enteringIds.has(todo.id)
              const meta = PRIORITY_META[todo.priority]
              const isSelected = selectedTodoIds.has(todo.id)

              return (
                <div
                  key={todo.id}
                  data-todo-item
                  data-todo-id={todo.id}
                  data-todo-display-idx={displayIdx}
                  onClick={() => {
                    if (isTodayView) return
                    if (!isMultiSelectMode) {
                      toggleMultiSelectMode()
                    }
                    toggleTodoSelection(todo.id)
                  }}
                  className={`group relative flex flex-col gap-1.5 pl-10 pr-4 py-3 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border transition-shadow hover:shadow-sm transition-transform duration-200 ease-out
                    ${isEntering ? 'todo-enter' : ''}
                    ${isDeleting ? 'todo-leave' : ''}
                    ${isMultiSelectMode ? 'cursor-pointer' : ''}
                    ${isMultiSelectMode && isSelected ? 'ring-2 ring-primary dark:ring-primary-dark' : ''}
                  `}
                >
                  {/* Drag handle (hidden in multi-select mode) */}
                  {!isMultiSelectMode && (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const itemEl = (e.currentTarget as HTMLElement).closest('[data-todo-item]') as HTMLElement
                      if (!itemEl) return
                      dragSourceDisplayIdxRef.current = displayIdx
                      dragStartRef.current = { x: e.clientX, y: e.clientY }

                      // Record grab offset (cursor position relative to item top-left)
                      const startRect = itemEl.getBoundingClientRect()
                      dragGrabRef.current = {
                        x: e.clientX - startRect.left,
                        y: e.clientY - startRect.top,
                      }
                      dragTileRef.current = itemEl

                      // Unclip: remove overflow from the scroll container
                      const scrollContainer = itemEl.closest('.overflow-y-auto') as HTMLElement | null
                      if (scrollContainer) {
                        dragScrollRef.current = scrollContainer
                        scrollContainer.style.overflow = 'visible'
                      }

                      lastReorderTimeRef.current = 0

                      // Lift the dragged item
                      itemEl.style.transition = 'none'
                      itemEl.style.pointerEvents = 'none'
                      itemEl.style.zIndex = '30'
                      itemEl.style.boxShadow = '0 8px 25px rgba(0,0,0,0.12)'

                      let wasDragged = false

                      const applyTransform = (cx: number, cy: number) => {
                        const el = dragTileRef.current
                        if (!el) return
                        const saved = el.style.transform
                        el.style.transform = ''
                        const naturalRect = el.getBoundingClientRect()
                        el.style.transform = saved
                        const dx = cx - dragGrabRef.current.x - naturalRect.left
                        const dy = cy - dragGrabRef.current.y - naturalRect.top
                        el.style.transform = `translate(${dx}px, ${dy}px)`
                      }

                      const onMouseMove = (ev: MouseEvent) => {
                        if (!dragStartRef.current || !dragTileRef.current) return
                        const dx = ev.clientX - dragStartRef.current.x
                        const dy = ev.clientY - dragStartRef.current.y

                        if (!wasDragged && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                          wasDragged = true
                        }

                        if (!wasDragged) return

                        // Follow cursor (recalculates offset to account for layout changes from reorder)
                        applyTransform(ev.clientX, ev.clientY)

                        // Find which item is under the cursor (skips dragged item: pointer-events:none)
                        const targetEl = document.elementFromPoint(ev.clientX, ev.clientY)
                        const targetItem = targetEl?.closest('[data-todo-item]') as HTMLElement | null

                        if (targetItem) {
                          const targetDisplayIdx = Number(targetItem.dataset.todoDisplayIdx)
                          if (targetDisplayIdx !== dragSourceDisplayIdxRef.current && Date.now() - lastReorderTimeRef.current > 60) {
                            const sourceId = dragTileRef.current.dataset.todoId
                            const targetId = targetItem.dataset.todoId
                            if (sourceId && targetId) {
                              const store = useTodoStore.getState()
                              const fromFull = store.todos.findIndex((t) => t.id === sourceId)
                              const toFull = store.todos.findIndex((t) => t.id === targetId)
                              if (fromFull !== -1 && toFull !== -1 && fromFull !== toFull) {
                                reorderTodos(fromFull, toFull)
                                lastReorderTimeRef.current = Date.now()
                                dragSourceDisplayIdxRef.current = targetDisplayIdx
                              }
                            }
                          }
                        }
                      }

                      const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove)
                        document.removeEventListener('mouseup', onMouseUp)

                        // Restore scroll container overflow
                        if (dragScrollRef.current) {
                          dragScrollRef.current.style.overflow = ''
                          dragScrollRef.current = null
                        }

                        if (wasDragged) {
                          todoDropRef.current = true
                        }

                        const draggedEl = dragTileRef.current
                        if (draggedEl) {
                          draggedEl.style.transition = 'transform 0.2s ease-out'
                          draggedEl.style.transform = ''
                          draggedEl.style.pointerEvents = ''
                          draggedEl.style.zIndex = ''
                          draggedEl.style.boxShadow = ''

                          setTimeout(() => {
                            draggedEl.style.transition = ''
                          }, 220)
                        }

                        dragSourceDisplayIdxRef.current = null
                        dragStartRef.current = null
                        dragTileRef.current = null
                      }

                      document.addEventListener('mousemove', onMouseMove)
                      document.addEventListener('mouseup', onMouseUp)
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity cursor-grab active:cursor-grabbing p-0.5"
                  >
                    <svg className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                    </svg>
                  </div>
                  )}

                  {/* Top row: checkbox + title + inline actions */}
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => {
                        if (isMultiSelectMode) {
                          toggleTodoSelection(todo.id)
                          return
                        }
                        if (todoDropRef.current) { todoDropRef.current = false; return }
                        toggleTodo(todo.id)
                      }}
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200
                        ${
                          isDone
                            ? 'bg-primary border-primary dark:bg-primary-dark dark:border-primary-dark'
                            : 'border-light-text-secondary/40 dark:border-dark-text-secondary/40 hover:border-primary dark:hover:border-primary-dark'
                        }
                      `}
                      aria-label={isDone ? '标记为未完成' : '标记为已完成'}
                    >
                      {isDone && <Check className="w-3 h-3 text-white" />}
                    </button>

                    {/* Title (strikethrough + opacity on done) */}
                    <span
                      className={`flex-1 text-sm font-semibold transition-all duration-300 ease-out truncate
                        ${
                          isDone
                            ? 'line-through text-light-text-secondary/60 dark:text-dark-text-secondary/60'
                            : 'text-light-text dark:text-dark-text'
                        }
                      `}
                    >
                      {todo.title}
                    </span>

                    {/* Priority tag (click to cycle, hidden for past dates) */}
                    {!isPastSelected && (
                      <button
                        onClick={() => changePriority(todo.id)}
                        className={`flex-shrink-0 px-2 py-0.5 rounded-md text-xs font-medium transition-all hover:scale-105 active:scale-95 ${meta.bg}`}
                        title="点击切换优先级"
                      >
                        {meta.label}
                      </button>
                    )}

                    {/* Pomodoro count — click to open number picker */}
                    <div className="relative flex-shrink-0">
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setPomoPickerId(pomoPickerId === todo.id ? null : todo.id)}
                        className="text-xs font-mono text-primary dark:text-primary-dark tabular-nums hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="点击更改番茄钟数量"
                      >
                        🍅 {todo.completed_pomos}/{todo.estimated_pomos}
                      </button>
                      {pomoPickerId === todo.id && (
                        <div
                          onMouseDown={(e) => e.stopPropagation()}
                          className="absolute top-full left-0 mt-1 z-40 w-14 max-h-40 overflow-y-auto scrollbar-hide rounded-lg bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-lg">
                          {Array.from({ length: 100 }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                changeEstimatedPomos(todo.id, i)
                                setPomoPickerId(null)
                              }}
                              className={`w-full px-2 py-1 text-xs font-mono text-center hover:bg-light-bg dark:hover:bg-dark-bg transition-colors ${
                                i === todo.estimated_pomos
                                  ? 'text-primary dark:text-primary-dark font-bold bg-primary/10 dark:bg-primary-dark/10'
                                  : 'text-light-text dark:text-dark-text'
                              }`}
                            >
                              {i}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Start pomodoro button (hidden for past dates) */}
                    {!isPastSelected && (
                      <button
                        onClick={() => handleStartPomodoro(todo)}
                        className="flex-shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium text-primary dark:text-primary-dark hover:bg-primary/10 dark:hover:bg-primary-dark/10 transition-colors"
                        title="开始番茄钟"
                      >
                        <Play className="w-3 h-3" />
                        🍅
                      </button>
                    )}

                    {/* Jump to countdown button (only for countdown-bound todos) */}
                    {getCountdownIds().includes(todo.id) && (
                      <button
                        onClick={() => navigate('/')}
                        className="flex-shrink-0 p-1 rounded-lg text-primary dark:text-primary-dark hover:bg-primary/10 dark:hover:bg-primary-dark/10 transition-all"
                        title="查看倒计时"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete button (visible on hover, hidden for past dates) */}
                    {!isPastSelected && (
                      <button
                        onClick={() => handleDelete(todo.id, todo.title)}
                        className="flex-shrink-0 p-1 rounded-lg text-light-text-secondary/40 dark:text-dark-text-secondary/40 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                        title="删除任务"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Description row (2-line ellipsis, only if present) */}
                  {todo.description && (
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-2 ml-8">
                      {todo.description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Calendar (only in "today" view)                                   */}
      {/* ================================================================ */}
      {isTodayView && (
        <div className="flex-shrink-0 mt-4 flex flex-col items-start gap-3">
          {/* Show selected date info + back button when viewing history */}
          {selectedDate && selectedDate !== todayStr() && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-primary/10 dark:bg-primary-dark/10 border border-primary/20 dark:border-primary-dark/20">
              <span className="text-sm text-primary dark:text-primary-dark font-medium">
                {isPastSelected
                  ? `查看 ${selectedDate} 的历史待办（仅可标记完成）`
                  : `查看 ${selectedDate} 的待办`}
              </span>
              <button
                onClick={handleBackToToday}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-primary dark:bg-primary-dark text-white hover:opacity-90 transition-opacity"
              >
                返回今天
              </button>
            </div>
          )}

          {showCalendar && (
            <div className="mb-3">
              <CalendarView
                year={calendarDate.year}
                month={calendarDate.month}
                todos={todos}
                onJump={handleCalendarJump}
                onDateClick={handleDateClick}
                onClose={() => setShowCalendar(false)}
              />
            </div>
          )}

          <button
            onMouseDown={(e) => { if (showCalendar) e.stopPropagation() }}
            onClick={() => setShowCalendar((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>{showCalendar ? '收起日历' : '查看日历'}</span>
          </button>
        </div>
      )}
    </div>

    {/* Multi-select bottom action bar */}
    {isMultiSelectMode && (
      <div className={`fixed bottom-0 z-50 flex items-center justify-between px-6 py-3 bg-light-card dark:bg-dark-card border-t border-light-border dark:border-dark-border shadow-lg transition-all ${
        (() => { try { return JSON.parse(localStorage.getItem('flowtime-sidebar-expanded') || 'false') } catch { return false } })() ? 'left-44' : 'left-16'
      } right-0`}>
        <span className="text-sm font-medium text-light-text dark:text-dark-text">
          已选 {selectedTodoIds.size} 项
        </span>
          <div className="flex items-center gap-2">
            {/* 同步到今天 */}
            <button
              onClick={() => {
                const ids = Array.from(selectedTodoIds)
                if (ids.length === 0) return
                syncToToday(ids)
              }}
              disabled={selectedTodoIds.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark hover:bg-primary/20 dark:hover:bg-primary-dark/20 disabled:opacity-40 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              同步到今天
            </button>

            {/* 取消完成 */}
            <button
              onClick={() => {
                const ids = Array.from(selectedTodoIds)
                if (ids.length === 0) return
                uncompleteTodos(ids)
              }}
              disabled={selectedTodoIds.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-light-border/50 dark:bg-dark-border/50 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border dark:hover:bg-dark-border disabled:opacity-40 transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              取消完成
            </button>

            {/* 移动/复制到 */}
            <div className="relative">
              <button
                onClick={() => setMoveCopyOpen(moveCopyOpen ? null : 'move')}
                disabled={selectedTodoIds.size === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-light-border/50 dark:bg-dark-border/50 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border dark:hover:bg-dark-border disabled:opacity-40 transition-colors"
              >
                <MoveRight className="w-3.5 h-3.5" />
                移动/复制到
              </button>

              {moveCopyOpen && (
                <div className="absolute bottom-full right-0 mb-2 p-2 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-xl min-w-[160px]">
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary px-2 py-1 mb-1">
                    选择目标分类
                  </p>
                  <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto mb-2">
                    {categories
                      .filter((c) => c.type !== 'readonly' && c.id !== currentCategory && c.id !== 'today')
                      .map((cat) => (
                        <div key={cat.id} className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (moveCopyOpen === 'move') {
                                moveTodos(Array.from(selectedTodoIds), cat.id)
                              } else {
                                copyTodos(Array.from(selectedTodoIds), cat.id)
                              }
                              setMoveCopyOpen(null)
                            }}
                            className="flex-1 text-left px-2 py-1 rounded-lg text-xs text-light-text dark:text-dark-text hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition-colors"
                          >
                            {cat.name}
                          </button>
                        </div>
                      ))}
                    {categories.filter((c) => c.type !== 'readonly' && c.id !== currentCategory && c.id !== 'today').length === 0 && (
                      <p className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60 px-2 py-1">
                        无可用分类
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-light-border dark:border-dark-border">
                    <button
                      onClick={() => setMoveCopyOpen('move')}
                      className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                        moveCopyOpen === 'move'
                          ? 'bg-primary text-white dark:bg-primary-dark dark:text-white'
                          : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/50 dark:hover:bg-dark-border/50'
                      }`}
                    >
                      移动
                    </button>
                    <button
                      onClick={() => setMoveCopyOpen('copy')}
                      className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                        moveCopyOpen === 'copy'
                          ? 'bg-primary text-white dark:bg-primary-dark dark:text-white'
                          : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/50 dark:hover:bg-dark-border/50'
                      }`}
                    >
                      复制
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 取消 */}
            <button
              onClick={toggleMultiSelectMode}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              取消
            </button>
          </div>
        </div>
    )}

    {/* Delete confirmation */}
    <ConfirmDialog
      isOpen={deleteConfirm !== null}
      title="删除待办"
      message={
        (() => {
          const base = `确定要删除待办「${deleteConfirm?.title ?? ''}」吗？`
          const warnings: string[] = []
          if (deleteConfirm?.hasCountdown) {
            warnings.push('⚠️ 该待办已绑定倒计时，删除后将同时移除倒计时')
          }
          if (deleteConfirm?.hasSyncedCopies) {
            warnings.push('⚠️ 该待办已同步到今天，删除后将同时删除今天中的同步副本')
          }
          if (warnings.length > 0) {
            return `${base}\n\n${warnings.join('\n')}\n\n此操作不可恢复。`
          }
          return `${base}\n\n此操作不可恢复。`
        })()
      }
      confirmLabel={
        deleteConfirm?.hasSyncedCopies
          ? '确认删除（含同步副本）'
          : deleteConfirm?.hasCountdown
            ? '确认删除（含倒计时）'
            : '确认删除'
      }
      onConfirm={() => {
        if (deleteConfirm) {
          if (deleteConfirm.hasCountdown) {
            removeFromCountdown(deleteConfirm.id)
          }
          setDeletingIds((prev) => new Set([...prev, deleteConfirm.id]))
          setTimeout(() => {
            deleteTodo(deleteConfirm.id)
            setDeletingIds((prev) => {
              const next = new Set(prev)
              next.delete(deleteConfirm.id)
              return next
            })
          }, 280)
          setDeleteConfirm(null)
        }
      }}
      onCancel={() => setDeleteConfirm(null)}
    />
  </>
  )
}
