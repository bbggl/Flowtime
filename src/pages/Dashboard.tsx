import { useMemo, useEffect } from 'react'
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
} from 'lucide-react'
import { useTodoStore, usePomodoroStore, useNotesStore } from '../stores'
import { useAuth } from '../hooks/useAuth'

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

function RingChart({ completed, goal }: { completed: number; goal: number }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const ratio = goal > 0 ? Math.min(completed / goal, 1) : 0
  const dashOffset = circumference * (1 - ratio)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-light-border dark:text-dark-border"
        />
        {/* Progress ring */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="text-primary dark:text-primary-dark transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="text-center">
        <span className="text-2xl font-bold text-light-text dark:text-dark-text">
          {completed}
        </span>
        <span className="text-light-text-secondary dark:text-dark-text-secondary">
          {' '}/{' '}{goal}
        </span>
      </div>
      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
        今日完成率 {goal > 0 ? Math.round(ratio * 100) : 0}%
      </span>
    </div>
  )
}

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

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

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

  const todoStats = useMemo(() => {
    const done = todos.filter((t) => t.status === 'done').length
    return { total: todos.length, done }
  }, [todos])

  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 3),
    [notes],
  )

  const isEmpty = todos.length === 0 && completedCount === 0 && notes.length === 0

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
            {greeting}，{displayName(user)}
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
      {/* Greeting row */}
      <div className="mb-5 flex items-center gap-3">
        <GreetingIcon className="w-7 h-7 text-primary dark:text-primary-dark" />
        <h1 className="text-xl font-bold text-light-text dark:text-dark-text">
          {greeting}，{displayName(user)}
        </h1>
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
            {greeting}，{displayName(user)}
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

        {/* Card 4: Pomodoro ring chart */}
        <div className="rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border p-5 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary self-start">
            番茄进度
          </p>
          <RingChart completed={completedCount} goal={dailyGoal} />
        </div>

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
                  <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                    {note.title || '无标题'}
                  </p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5">
                    {note.content || '空笔记'}
                  </p>
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
