import { useMemo, useCallback, useEffect, useState, useRef } from 'react'
import { useStore } from 'zustand'
import { useStatsStore, usePomodoroStore, useTodoStore } from '../stores'
import { Granularity, filterByGranularity } from '../utils/stats'
import type { Granularity as GranularityType } from '../utils/stats'
import type { PomodoroRecord } from '../types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Clock, CheckCircle2, TrendingUp, Target, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

// ── Constants ──

const GRANULARITY_TABS: { key: GranularityType; label: string }[] = [
  { key: Granularity.Day, label: '日' },
  { key: Granularity.Week, label: '周' },
  { key: Granularity.Month, label: '月' },
  { key: Granularity.Year, label: '年' },
]

const PIE_COLORS = ['#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#94A3B8']

function formatMinutes(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatAvgFocus(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`
}

// ── Trend data computation ──

function getWeekOfMonth(d: Date): number {
  return Math.ceil(d.getDate() / 7)
}

interface TrendPoint {
  label: string
  value: number
}

function accumulate(records: PomodoroRecord[], granularity: GranularityType, useCount: boolean, referenceDate?: string | null, endDate?: string | null) {
  const scopedRecords = filterByGranularity(records, granularity, referenceDate, endDate)
  const workRecords = scopedRecords.filter(
    (r) => r.mode === 'work' && r.status === 'completed',
  )
  // count mode: each record = 1; duration mode: sum actual_duration
  const addValue = (buckets: number[], idx: number, r: PomodoroRecord) => {
    buckets[idx] += useCount ? 1 : r.actual_duration
  }

  switch (granularity) {
    case Granularity.Day: {
      const buckets = new Array<number>(24).fill(0)
      for (const r of workRecords) {
        addValue(buckets, new Date(r.started_at).getHours(), r)
      }
      return buckets.map((v, i) => ({
        label: `${String(i).padStart(2, '0')}:00`,
        value: useCount ? v : Math.round(v / 60),
      }))
    }
    case Granularity.Week: {
      const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      const buckets = new Array<number>(7).fill(0)
      for (const r of workRecords) {
        const d = new Date(r.started_at)
        const dayOfWeek = d.getDay()
        const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        addValue(buckets, idx, r)
      }
      return buckets.map((v, i) => ({
        label: dayNames[i],
        value: useCount ? v : Math.round(v / 60),
      }))
    }
    case Granularity.Month: {
      const weekMap = new Map<number, number>()
      for (const r of workRecords) {
        const week = getWeekOfMonth(new Date(r.started_at))
        const prev = weekMap.get(week) ?? 0
        weekMap.set(week, prev + (useCount ? 1 : r.actual_duration))
      }
      return Array.from(weekMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([week, v]) => ({
          label: `第${week}周`,
          value: useCount ? v : Math.round(v / 60),
        }))
    }
    case Granularity.Year: {
      const monthNames = [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月',
      ]
      const buckets = new Array<number>(12).fill(0)
      for (const r of workRecords) {
        addValue(buckets, new Date(r.started_at).getMonth(), r)
      }
      return buckets.map((v, i) => ({
        label: monthNames[i],
        value: useCount ? v : Math.round(v / 60),
      }))
    }
  }
}

function computeTrendData(
  records: PomodoroRecord[],
  granularity: GranularityType,
  mode: 'duration' | 'count',
  referenceDate?: string | null,
  endDate?: string | null,
): TrendPoint[] {
  return accumulate(records, granularity, mode === 'count', referenceDate, endDate)
}

// ── Task distribution ──

interface TaskDistItem {
  name: string
  totalDuration: number
  percentage: number
  color: string
}

function computeTaskDistribution(
  records: PomodoroRecord[],
  todoNames: Map<string, string>,
): TaskDistItem[] {
  const workRecords = records.filter(
    (r) => r.mode === 'work' && r.status === 'completed',
  )
  if (workRecords.length === 0) return []

  const taskMap = new Map<string, number>()
  for (const r of workRecords) {
    const key = r.task_id ?? '__no_task__'
    taskMap.set(key, (taskMap.get(key) ?? 0) + r.actual_duration)
  }

  const sorted = Array.from(taskMap.entries())
    .map(([key, totalDuration]) => ({
      key,
      name: key === '__no_task__'
        ? '自由专注'
        : (todoNames.get(key) ?? '已删除的任务'),
      totalDuration,
    }))
    .sort((a, b) => b.totalDuration - a.totalDuration)

  const total = sorted.reduce((sum, t) => sum + t.totalDuration, 0)
  const top5 = sorted.slice(0, 5)
  const othersDuration = sorted
    .slice(5)
    .reduce((sum, t) => sum + t.totalDuration, 0)

  const result: TaskDistItem[] = top5.map((t, i) => ({
    name: t.name,
    totalDuration: t.totalDuration,
    percentage: total > 0 ? t.totalDuration / total : 0,
    color: PIE_COLORS[i],
  }))

  if (othersDuration > 0) {
    result.push({
      name: '其他',
      totalDuration: othersDuration,
      percentage: othersDuration / total,
      color: PIE_COLORS[5],
    })
  }

  return result
}

// ── Component ──

export default function Stats() {
  const granularity = useStore(useStatsStore, (s) => s.granularity)
  const records = useStore(useStatsStore, (s) => s.records)
  const selectedRange = useStore(useStatsStore, (s) => s.selectedRange)

  // Mount 时从 Supabase 加载番茄记录和待办（任务分布需要 todo 名称）
  useEffect(() => {
    Promise.all([
      usePomodoroStore.getState().loadRecords(),
      useTodoStore.getState().loadTodos(),
    ]).then(() => {
      const pomoRecords = usePomodoroStore.getState().records
      useStatsStore.getState().setRecords(pomoRecords)
    })
  }, [])

  // 响应式同步番茄记录变化
  useEffect(() => {
    const unsub = usePomodoroStore.subscribe((state) => {
      useStatsStore.getState().setRecords(state.records)
    })
    return unsub
  }, [])

  // Build todo id → name lookup map
  const allTodos = useStore(useTodoStore, (s) => s.todos)
  const todoNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of allTodos) {
      map.set(t.id, t.title)
    }
    return map
  }, [allTodos])

  // Trend toggle: count vs duration
  const [trendMode, setTrendMode] = useState<'duration' | 'count'>('duration')

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false)
  const todayDate = new Date()
  const [calendarYear, setCalendarYear] = useState(todayDate.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(todayDate.getMonth())
  const calendarRef = useRef<HTMLDivElement>(null)
  const [pendingRangeStart, setPendingRangeStart] = useState<string | null>(null)

  // Calendar click-outside
  useEffect(() => {
    if (!showCalendar) return
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false)
        setPendingRangeStart(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCalendar])

  // Derived data — threaded with selectedRange
  const rangeStart = selectedRange?.start ?? null
  const rangeEnd = selectedRange?.end ?? null

  const trendData = useMemo(
    () => computeTrendData(records, granularity, trendMode, rangeStart, rangeEnd),
    [records, granularity, trendMode, selectedRange],
  )

  const taskDistribution = useMemo(
    () => {
      const scopedRecords = filterByGranularity(records, granularity, rangeStart, rangeEnd)
      return computeTaskDistribution(scopedRecords, todoNames)
    },
    [records, todoNames, granularity, selectedRange],
  )

  const summary = useMemo(() => {
    const scopedRecords = filterByGranularity(records, granularity, rangeStart, rangeEnd)
    const workRecords = scopedRecords.filter((r) => r.mode === 'work')
    const completed = workRecords.filter((r) => r.status === 'completed')
    const totalFocusSecs = completed.reduce((s, r) => s + r.actual_duration, 0)
    const completedPomos = completed.length
    const completionRate =
      workRecords.length > 0 ? completed.length / workRecords.length : 0

    // Compute total days in the period for daily averages
    let totalDays = 1
    if (selectedRange) {
      const { start, end } = selectedRange
      switch (granularity) {
        case Granularity.Day:
          totalDays = daysBetween(start, end)
          break
        case Granularity.Month:
          totalDays = totalDaysInMonthRange(start, end)
          break
        case Granularity.Week:
          totalDays = 7
          break
        case Granularity.Year: {
          const y = parseInt(start.split('-')[0])
          totalDays = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365
          break
        }
      }
    } else {
      const ref = rangeStart
        ? (([y, m, d]) => new Date(y, m - 1, d))(rangeStart.split('-').map(Number))
        : new Date()
      switch (granularity) {
        case Granularity.Day:
          totalDays = 1
          break
        case Granularity.Week:
          totalDays = 7
          break
        case Granularity.Month:
          totalDays = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
          break
        case Granularity.Year:
          totalDays = (ref.getFullYear() % 4 === 0 && ref.getFullYear() % 100 !== 0) || ref.getFullYear() % 400 === 0 ? 366 : 365
          break
      }
    }

    const dailyAvg = completed.length === 0 ? 0 : completed.length / totalDays
    const dailyAvgFocusMinutes = completed.length === 0 ? 0 : Math.round(totalFocusSecs / totalDays / 60)

    return {
      totalFocusMinutes: Math.round(totalFocusSecs / 60),
      completedPomos,
      dailyAvg,
      dailyAvgFocusMinutes,
      completionRate,
    }
  }, [records, granularity, rangeStart, rangeEnd, selectedRange])

  const hasRecords = records.length > 0
  const hasTrendData = trendData.some((d) => d.value > 0)
  const hasTaskData = taskDistribution.length > 0

  const handleGranularityChange = useCallback((g: GranularityType) => {
    useStatsStore.getState().setGranularity(g)
    setPendingRangeStart(null)
  }, [])

  // ── Calendar helpers ──

  const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

  function daysInMonth(y: number, m: number): number {
    return new Date(y, m + 1, 0).getDate()
  }

  function firstDayOfMonth(y: number, m: number): number {
    return new Date(y, m, 1).getDay()
  }

  function formatDate(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  /** Format a human-readable period label based on granularity + reference date (and optional endDate for range) */
  function formatPeriodLabel(g: GranularityType, ref: string, endRef?: string): string {
    if (!endRef || ref === endRef) {
      const parts = ref.split('-').map(Number)
      const y = parts[0]; const mo = parts[1]; const day = parts[2]
      const d = new Date(y, mo - 1, day)

      switch (g) {
        case Granularity.Day:
          return `${y}年${mo}月${day}日`
        case Granularity.Week: {
          const dayOfWeek = d.getDay()
          const diff = day - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
          const mon = new Date(y, mo - 1, diff)
          const sun = new Date(y, mo - 1, diff + 6)
          return `${mon.getMonth() + 1}/${mon.getDate()} - ${sun.getMonth() + 1}/${sun.getDate()}`
        }
        case Granularity.Month:
          return `${y}年${mo}月`
        case Granularity.Year:
          return `${y}年`
      }
    }

    // Range format
    const sParts = ref.split('-').map(Number)
    const eParts = endRef.split('-').map(Number)
    switch (g) {
      case Granularity.Day:
        return `${sParts[0]}年${sParts[1]}月${sParts[2]}日 - ${eParts[0]}年${eParts[1]}月${eParts[2]}日`
      case Granularity.Month:
        return `${sParts[0]}年${sParts[1]}月 - ${eParts[0]}年${eParts[1]}月`
      default:
        return `${sParts[0]}年${sParts[1]}月${sParts[2]}日 - ${eParts[0]}年${eParts[1]}月${eParts[2]}日`
    }
  }

  function daysBetween(startDate: string, endDate: string): number {
    const s = new Date(startDate)
    const e = new Date(endDate)
    return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1
  }

  function totalDaysInMonthRange(startDate: string, endDate: string): number {
    const s = new Date(startDate)
    const e = new Date(endDate)
    let total = 0
    const cursor = new Date(s.getFullYear(), s.getMonth(), 1)
    while (cursor <= e) {
      total += new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return total
  }

  const handleDateSelect = (date: string) => {
    useStatsStore.getState().setSelectedRange(date, date)
    setShowCalendar(false)
  }

  const handleDaySelect = (date: string) => {
    if (pendingRangeStart) {
      if (date === pendingRangeStart) {
        useStatsStore.getState().setSelectedRange(date, date)
      } else {
        useStatsStore.getState().setSelectedRange(pendingRangeStart, date)
      }
      setPendingRangeStart(null)
      setShowCalendar(false)
    } else {
      setPendingRangeStart(date)
    }
  }

  const handleMonthSelect = (monthDate: string) => {
    if (pendingRangeStart) {
      if (monthDate === pendingRangeStart) {
        useStatsStore.getState().setSelectedRange(monthDate, monthDate)
      } else {
        useStatsStore.getState().setSelectedRange(pendingRangeStart, monthDate)
      }
      setPendingRangeStart(null)
      setShowCalendar(false)
    } else {
      setPendingRangeStart(monthDate)
    }
  }

  const handleClearRange = () => {
    useStatsStore.getState().clearSelectedRange()
  }

  // Mini calendar cells
  const calTotalDays = daysInMonth(calendarYear, calendarMonth)
  const calFirstDay = firstDayOfMonth(calendarYear, calendarMonth)
  const calCells: (number | null)[] = []
  for (let i = 0; i < calFirstDay; i++) calCells.push(null)
  for (let d = 1; d <= calTotalDays; d++) calCells.push(d)

  // ── Shared class strings ──

  const cardClass =
    'bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-5'
  const sectionTitleClass =
    'text-base font-semibold text-light-text dark:text-dark-text mb-4'

  // ── Render ──

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* ── Header row: title + tabs + calendar ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-light-text dark:text-dark-text">
            统计
          </h1>
          {/* Granularity tabs */}
          <div className="flex items-center gap-1 bg-light-card dark:bg-dark-card rounded-lg border border-light-border dark:border-dark-border p-1">
            {GRANULARITY_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleGranularityChange(key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  granularity === key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar picker */}
        <div className="flex items-center gap-2 relative">
          <button
            onMouseDown={(e) => { if (showCalendar) e.stopPropagation() }}
            onClick={() => setShowCalendar((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>
              {selectedRange
                ? formatPeriodLabel(granularity, selectedRange.start, selectedRange.end)
                : formatPeriodLabel(granularity, `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`)}
            </span>
          </button>

          {selectedRange && (
            <button
              onClick={handleClearRange}
              className="text-xs text-primary dark:text-primary-dark hover:underline whitespace-nowrap"
            >
              清除筛选
            </button>
          )}

          {/* Calendar popup — adapts to granularity */}
          {showCalendar && (
            <div
              ref={calendarRef}
              className="absolute top-full right-0 mt-1 z-30 w-64 p-3 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-xl"
            >
              {/* ── Header ── */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => {
                    if (granularity === Granularity.Year) {
                      setCalendarYear((y) => y - 9)
                    } else if (granularity === Granularity.Month) {
                      setCalendarYear((y) => y - 1)
                    } else {
                      if (calendarMonth === 0) { setCalendarYear((y) => y - 1); setCalendarMonth(11) }
                      else setCalendarMonth((m) => m - 1)
                    }
                  }}
                  className="p-0.5 rounded hover:bg-light-border/40 dark:hover:bg-dark-border/40"
                >
                  <ChevronLeft className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                </button>
                <span className="text-sm font-semibold text-light-text dark:text-dark-text">
                  {granularity === Granularity.Year
                    ? `${calendarYear - 4} - ${calendarYear + 4}`
                    : granularity === Granularity.Month
                      ? `${calendarYear}年`
                      : `${calendarYear}年${calendarMonth + 1}月`}
                </span>
                <button
                  onClick={() => {
                    if (granularity === Granularity.Year) {
                      setCalendarYear((y) => y + 9)
                    } else if (granularity === Granularity.Month) {
                      setCalendarYear((y) => y + 1)
                    } else {
                      if (calendarMonth === 11) { setCalendarYear((y) => y + 1); setCalendarMonth(0) }
                      else setCalendarMonth((m) => m + 1)
                    }
                  }}
                  className="p-0.5 rounded hover:bg-light-border/40 dark:hover:bg-dark-border/40"
                >
                  <ChevronRight className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                </button>
              </div>

              {/* ── Day: date grid ── */}
              {granularity === Granularity.Day && (
                <>
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {WEEKDAY.map((w) => (
                      <div key={w} className="text-center text-[10px] text-light-text-secondary/70 dark:text-dark-text-secondary/70 py-0.5">{w}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {calCells.map((day, ci) => {
                      if (day === null) return <div key={`e-${ci}`} className="aspect-square" />
                      const dateKey = formatDate(calendarYear, calendarMonth, day)
                      const isToday = dateKey === `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
                      const isRangeStart = selectedRange?.start === dateKey
                      const isRangeEnd = selectedRange?.end === dateKey
                      const isInRange = selectedRange && dateKey >= selectedRange.start && dateKey <= selectedRange.end
                      const isPendingStart = pendingRangeStart === dateKey
                      const isActive = isRangeStart || isRangeEnd || (!selectedRange && isPendingStart)
                      return (
                        <button
                          key={dateKey}
                          onClick={() => handleDaySelect(dateKey)}
                          className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors
                            ${isActive ? 'ring-2 ring-primary dark:ring-primary-dark bg-primary text-white dark:bg-primary-dark dark:text-white' : ''}
                            ${!isActive && isInRange ? 'bg-primary/15 dark:bg-primary-dark/15' : ''}
                            ${!isActive && !isInRange && isToday ? 'ring-1 ring-primary/60 dark:ring-primary-dark/60' : ''}
                            ${!isActive && !isInRange && !isToday ? 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/40 dark:hover:bg-dark-border/40' : ''}
                          `}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                  {pendingRangeStart && (
                    <div className="mt-2 text-center text-xs text-primary dark:text-primary-dark">
                      请选择结束日期
                    </div>
                  )}
                </>
              )}

              {/* ── Week: month calendar with clickable week rows ── */}
              {granularity === Granularity.Week && (
                <>
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {WEEKDAY.map((w) => (
                      <div key={w} className="text-center text-[10px] text-light-text-secondary/70 dark:text-dark-text-secondary/70 py-0.5">{w}</div>
                    ))}
                  </div>
                  {/* Group cells into rows of 7 */}
                  {Array.from({ length: Math.ceil(calCells.length / 7) }, (_, rowIdx) => {
                    const rowCells = calCells.slice(rowIdx * 7, rowIdx * 7 + 7)
                    // Find the Monday of this week row (first cell with a real date, or infer from context)
                    const firstRealDay = rowCells.find((c): c is number => c !== null)
                    if (firstRealDay === undefined) return null
                    // Compute Monday: if firstRealDay is the first cell, it IS Monday (position 0 = Sunday in JS getDay, but our grid starts at Sunday column)
                    // Actually, rowIdx 0 starts at `calFirstDay` column. We need the actual date of the Monday cell.
                    // Monday is column 1 in our grid. If that cell has a date, use it; otherwise use first day minus offset.
                    const monCell = rowCells[1] // column 1 = Monday
                    let mondayDate: string | null = null
                    if (monCell !== null && monCell !== undefined) {
                      mondayDate = formatDate(calendarYear, calendarMonth, monCell)
                    } else if (firstRealDay !== undefined) {
                      // Monday is in prev/next month — approximate by computing from first visible day
                      const firstDate = formatDate(calendarYear, calendarMonth, firstRealDay)
                      const parts = firstDate.split('-').map(Number)
                      const d = new Date(parts[0], parts[1] - 1, parts[2])
                      const dayOfWeek = d.getDay()
                      const diff = parts[2] - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
                      const mon = new Date(parts[0], parts[1] - 1, diff)
                      mondayDate = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
                    }
                    if (!mondayDate) return null

                    // Check if this week is the currently selected one
                    const ref = selectedRange?.start || `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
                    const refParts = ref.split('-').map(Number)
                    const refD = new Date(refParts[0], refParts[1] - 1, refParts[2])
                    const refDow = refD.getDay()
                    const refDiff = refParts[2] - refDow + (refDow === 0 ? -6 : 1)
                    const refMon = new Date(refParts[0], refParts[1] - 1, refDiff)
                    const refMonStr = `${refMon.getFullYear()}-${String(refMon.getMonth() + 1).padStart(2, '0')}-${String(refMon.getDate()).padStart(2, '0')}`
                    const isActiveWeek = mondayDate === refMonStr

                    return (
                      <button
                        key={rowIdx}
                        onClick={() => handleDateSelect(mondayDate!)}
                        className={`grid grid-cols-7 gap-0.5 w-full rounded-lg py-0.5 transition-colors
                          ${isActiveWeek ? 'bg-primary/15 dark:bg-primary-dark/15 ring-1 ring-primary/40 dark:ring-primary-dark/40' : 'hover:bg-light-border/20 dark:hover:bg-dark-border/20'}
                        `}
                      >
                        {rowCells.map((cell, ci) => (
                          <div
                            key={ci}
                            className={`aspect-square flex items-center justify-center text-xs
                              ${cell === null ? '' : 'font-medium'}
                              ${isActiveWeek && cell !== null ? 'text-primary dark:text-primary-dark' : cell !== null ? 'text-light-text-secondary dark:text-dark-text-secondary' : ''}
                            `}
                          >
                            {cell}
                          </div>
                        ))}
                      </button>
                    )
                  })}
                </>
              )}

              {/* ── Month: 4×3 grid ── */}
              {granularity === Granularity.Month && (
                <div className="grid grid-cols-4 gap-1.5">
                  {['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'].map((name, mi) => {
                    const ref = selectedRange?.start || `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
                    const refParts = ref.split('-').map(Number)
                    const monthDate = `${calendarYear}-${String(mi + 1).padStart(2, '0')}-01`
                    const monthVal = calendarYear * 12 + mi
                    const isCurrent = calendarYear === refParts[0] && mi === refParts[1] - 1
                    const isRangeStart = selectedRange?.start === monthDate
                    const isRangeEnd = selectedRange?.end === monthDate
                    const isInRange = selectedRange && (() => {
                      const sY = parseInt(selectedRange.start.split('-')[0])
                      const sM = parseInt(selectedRange.start.split('-')[1])
                      const eY = parseInt(selectedRange.end.split('-')[0])
                      const eM = parseInt(selectedRange.end.split('-')[1])
                      return monthVal >= sY * 12 + sM - 1 && monthVal <= eY * 12 + eM - 1
                    })()
                    const isPendingStart = pendingRangeStart === monthDate
                    const isActive = isRangeStart || isRangeEnd || (!selectedRange && (isPendingStart || isCurrent))
                    return (
                      <button
                        key={name}
                        onClick={() => handleMonthSelect(monthDate)}
                        className={`py-2 rounded-lg text-xs font-medium transition-colors
                          ${isActive ? 'ring-2 ring-primary dark:ring-primary-dark bg-primary text-white dark:bg-primary-dark dark:text-white' : ''}
                          ${!isActive && isInRange ? 'bg-primary/15 dark:bg-primary-dark/15' : ''}
                          ${!isActive && !isInRange && isCurrent && selectedRange ? 'bg-primary/15 dark:bg-primary-dark/15' : ''}
                          ${!isActive && !isInRange && !isCurrent ? 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/40 dark:hover:bg-dark-border/40' : ''}
                          ${!isActive && !isInRange && isCurrent && !selectedRange ? 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/40 dark:hover:bg-dark-border/40' : ''}
                        `}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
              )}
              {granularity === Granularity.Month && pendingRangeStart && (
                <div className="mt-2 text-center text-xs text-primary dark:text-primary-dark">
                  请选择结束月份
                </div>
              )}

              {/* ── Year: 3×3 grid ── */}
              {granularity === Granularity.Year && (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 9 }, (_, i) => {
                    const y = calendarYear - 4 + i
                    const ref = selectedRange?.start || `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
                    const refYear = parseInt(ref.split('-')[0], 10)
                    const isCurrent = y === refYear
                    return (
                      <button
                        key={y}
                        onClick={() => handleDateSelect(`${y}-01-01`)}
                        className={`py-2 rounded-lg text-xs font-medium transition-colors
                          ${isCurrent ? 'bg-primary text-white dark:bg-primary-dark dark:text-white' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/40 dark:hover:bg-dark-border/40'}
                        `}
                      >
                        {y}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {/* Total focus time */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary dark:text-primary-dark" />
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              总专注时长
            </span>
          </div>
          <div className="text-2xl font-bold text-light-text dark:text-dark-text">
            {hasRecords ? formatMinutes(summary.totalFocusMinutes * 60) : '--'}
          </div>
        </div>

        {/* Daily avg focus time */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary dark:text-primary-dark" />
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              日均专注时长
            </span>
          </div>
          <div className="text-2xl font-bold text-light-text dark:text-dark-text">
            {hasRecords ? formatAvgFocus(summary.dailyAvgFocusMinutes) : '--'}
          </div>
        </div>

        {/* Completed pomos */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              完成番茄数
            </span>
          </div>
          <div className="text-2xl font-bold text-light-text dark:text-dark-text">
            {hasRecords ? summary.completedPomos : '--'}
          </div>
        </div>

        {/* Daily avg pomos */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              日均番茄数
            </span>
          </div>
          <div className="text-2xl font-bold text-light-text dark:text-dark-text">
            {hasRecords ? summary.dailyAvg.toFixed(1) : '--'}
          </div>
        </div>

        {/* Completion rate */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-rose-500" />
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              完成率
            </span>
          </div>
          <div className="text-2xl font-bold text-light-text dark:text-dark-text">
            {hasRecords
              ? `${Math.round(summary.completionRate * 100)}%`
              : '--'}
          </div>
        </div>
      </div>

      {/* ── Trend chart ── */}
      <div className={cardClass + ' mb-6'}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionTitleClass + ' mb-0'}>专注趋势</h2>
          {/* Count / Duration toggle */}
          <div className="flex items-center gap-1 bg-light-bg dark:bg-dark-bg rounded-lg p-0.5">
            <button
              onClick={() => setTrendMode('count')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                trendMode === 'count'
                  ? 'bg-primary text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary'
              }`}
            >
              次数
            </button>
            <button
              onClick={() => setTrendMode('duration')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                trendMode === 'duration'
                  ? 'bg-primary text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary'
              }`}
            >
              时长
            </button>
          </div>
        </div>
        {!hasRecords ? (
          <div className="flex items-center justify-center h-48 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            暂无专注记录
          </div>
        ) : !hasTrendData ? (
          <div className="flex items-center justify-center h-48 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            暂无专注记录
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#7C7AA8' }}
                axisLine={{ stroke: '#E4E2F4' }}
                tickLine={false}
                interval={granularity === Granularity.Day ? 3 : 0}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#7C7AA8' }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, 'auto']}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #E4E2F4',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                }}
                formatter={(value: number) => [
                  trendMode === 'count' ? `${value} 次` : `${value} 分钟`,
                  trendMode === 'count' ? '专注次数' : '专注时长',
                ]}
              />
              <Bar
                dataKey="value"
                fill="#8B5CF6"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Task distribution ── */}
      <div className={cardClass}>
        <h2 className={sectionTitleClass}>任务分布</h2>
        {!hasTaskData ? (
          <div className="flex items-center justify-center h-48 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            暂无任务关联数据
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {/* Left: task list */}
            <div className="flex-1 min-w-0 space-y-2.5">
              {taskDistribution.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-light-text dark:text-dark-text flex-1 truncate">
                    {item.name}
                  </span>
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0">
                    {Math.round(item.percentage * 100)}%
                  </span>
                  <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0 w-16 text-right">
                    {formatMinutes(item.totalDuration)}
                  </span>
                </div>
              ))}
            </div>

            {/* Right: pie chart */}
            <div className="w-[180px] h-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskDistribution}
                    dataKey="totalDuration"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {taskDistribution.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #E4E2F4',
                      backgroundColor: '#FFFFFF',
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [
                      formatMinutes(value),
                      '专注时长',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
