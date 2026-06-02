import { useMemo, useCallback } from 'react'
import { useStore } from 'zustand'
import { createStatsStore } from '../stores/useStatsStore'
import { Granularity } from '../utils/stats'
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
import { Clock, CheckCircle2, TrendingUp, Target } from 'lucide-react'

const statsStore = createStatsStore()

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

// ── Trend data computation ──

function getWeekOfMonth(d: Date): number {
  return Math.ceil(d.getDate() / 7)
}

interface TrendPoint {
  label: string
  minutes: number
}

function computeTrendData(
  records: PomodoroRecord[],
  granularity: GranularityType,
): TrendPoint[] {
  const workRecords = records.filter(
    (r) => r.mode === 'work' && r.status === 'completed',
  )

  switch (granularity) {
    case Granularity.Day: {
      const buckets = new Array<number>(24).fill(0)
      for (const r of workRecords) {
        const hour = new Date(r.started_at).getHours()
        buckets[hour] += r.actual_duration
      }
      return buckets.map((secs, i) => ({
        label: `${String(i).padStart(2, '0')}:00`,
        minutes: Math.round(secs / 60),
      }))
    }
    case Granularity.Week: {
      const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      const buckets = new Array<number>(7).fill(0)
      for (const r of workRecords) {
        const d = new Date(r.started_at)
        const dayOfWeek = d.getDay() // 0 = Sunday
        const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        buckets[idx] += r.actual_duration
      }
      return buckets.map((secs, i) => ({
        label: dayNames[i],
        minutes: Math.round(secs / 60),
      }))
    }
    case Granularity.Month: {
      const weekMap = new Map<number, number>()
      for (const r of workRecords) {
        const week = getWeekOfMonth(new Date(r.started_at))
        weekMap.set(week, (weekMap.get(week) ?? 0) + r.actual_duration)
      }
      return Array.from(weekMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([week, secs]) => ({
          label: `第${week}周`,
          minutes: Math.round(secs / 60),
        }))
    }
    case Granularity.Year: {
      const monthNames = [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月',
      ]
      const buckets = new Array<number>(12).fill(0)
      for (const r of workRecords) {
        const month = new Date(r.started_at).getMonth()
        buckets[month] += r.actual_duration
      }
      return buckets.map((secs, i) => ({
        label: monthNames[i],
        minutes: Math.round(secs / 60),
      }))
    }
  }
}

// ── Task distribution ──

interface TaskDistItem {
  name: string
  totalDuration: number
  percentage: number
  color: string
}

function computeTaskDistribution(records: PomodoroRecord[]): TaskDistItem[] {
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
      name: key === '__no_task__' ? '无任务' : key,
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
  const granularity = useStore(statsStore, (s) => s.granularity)
  const records = useStore(statsStore, (s) => s.records)

  // Derived data
  const trendData = useMemo(
    () => computeTrendData(records, granularity),
    [records, granularity],
  )

  const taskDistribution = useMemo(
    () => computeTaskDistribution(records),
    [records],
  )

  const summary = useMemo(() => {
    const workRecords = records.filter((r) => r.mode === 'work')
    const completed = workRecords.filter((r) => r.status === 'completed')
    const totalFocusSecs = completed.reduce((s, r) => s + r.actual_duration, 0)
    const completedPomos = completed.length
    const completionRate =
      workRecords.length > 0 ? completed.length / workRecords.length : 0

    // Daily avg
    const days = new Set(workRecords.map((r) => r.started_at.split('T')[0]))
    const dailyAvg = days.size > 0 ? completed.length / days.size : 0

    return {
      totalFocusMinutes: Math.round(totalFocusSecs / 60),
      completedPomos,
      dailyAvg,
      completionRate,
    }
  }, [records])

  const hasRecords = records.length > 0
  const hasTrendData = trendData.some((d) => d.minutes > 0)
  const hasTaskData = taskDistribution.length > 0

  const handleGranularityChange = useCallback((g: GranularityType) => {
    statsStore.getState().setGranularity(g)
  }, [])

  // ── Shared class strings ──

  const cardClass =
    'bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-5'
  const sectionTitleClass =
    'text-base font-semibold text-light-text dark:text-dark-text mb-4'

  // ── Render ──

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-xl font-bold text-light-text dark:text-dark-text mb-5">
        统计
      </h1>

      {/* ── Granularity tabs ── */}
      <div className="flex items-center gap-1 mb-5 bg-light-card dark:bg-dark-card rounded-lg border border-light-border dark:border-dark-border p-1 w-fit">
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

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
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
        <h2 className={sectionTitleClass}>专注趋势</h2>
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
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #E4E2F4',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                }}
                formatter={(value: number) => [`${value} 分钟`, '专注时长']}
              />
              <Bar
                dataKey="minutes"
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
