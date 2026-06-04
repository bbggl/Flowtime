import { useState, useMemo } from 'react'
import { useStore } from 'zustand'
import { useNavigate } from 'react-router-dom'
import { usePomodoroStore, useTodoStore } from '../stores'
import { useAuth } from '../hooks/useAuth'
import { Timer, Bell, Volume2, LogOut, CheckSquare, ExternalLink, Info } from 'lucide-react'

export default function Settings() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  // ── Pomodoro settings (from store, persisted to Supabase) ──
  const workDuration = useStore(usePomodoroStore, (s) => s.workDuration)
  const shortBreakDuration = useStore(usePomodoroStore, (s) => s.shortBreakDuration)
  const longBreakDuration = useStore(usePomodoroStore, (s) => s.longBreakDuration)
  const longBreakInterval = useStore(usePomodoroStore, (s) => s.longBreakInterval)
  const dailyGoal = useStore(usePomodoroStore, (s) => s.dailyGoal)
  const setDurations = useStore(usePomodoroStore, (s) => s.setDurations)
  const soundEnabled = useStore(usePomodoroStore, (s) => s.soundEnabled)
  const notificationEnabled = useStore(usePomodoroStore, (s) => s.notificationEnabled)
  const setSoundEnabled = useStore(usePomodoroStore, (s) => s.setSoundEnabled)
  const setNotificationEnabled = useStore(usePomodoroStore, (s) => s.setNotificationEnabled)

  const workMin = workDuration / 60
  const shortBreakMin = shortBreakDuration / 60
  const longBreakMin = longBreakDuration / 60

  const handlePomodoroChange = (field: string, value: number) => {
    const settings: Record<string, number> = {}
    switch (field) {
      case 'workDuration':
        settings.work_duration = value * 60
        break
      case 'shortBreakDuration':
        settings.short_break_duration = value * 60
        break
      case 'longBreakDuration':
        settings.long_break_duration = value * 60
        break
      case 'longBreakInterval':
        settings.long_break_interval = value
        break
      case 'dailyGoal':
        settings.daily_goal = value
        break
    }
    setDurations(settings)
  }

  // ── Dashboard todo overview settings ──
  const categories = useStore(useTodoStore, (s) => s.categories)

  // Only real categories (today + custom), not readonly views (全部/计划中/已完成)
  const selectableCategories = useMemo(
    () => categories.filter((c) => c.type !== 'readonly'),
    [categories],
  )

  const DASHBOARD_CATEGORIES_KEY = 'flowtime-dashboard-categories'
  const DASHBOARD_TODAY_FILTER_KEY = 'flowtime-dashboard-today-filter'

  const [dashboardCategories, setDashboardCategories] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_CATEGORIES_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        if (parsed.length > 0) return parsed
      }
    } catch { /* ignore */ }
    // Default: all non-readonly categories
    return selectableCategories.map((c) => c.id)
  })

  const [todaySubFilter, setTodaySubFilter] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_TODAY_FILTER_KEY)
      if (raw) return JSON.parse(raw) as string[]
    } catch { /* ignore */ }
    return ['today', 'future', 'past']
  })

  const toggleDashboardCategory = (catId: string) => {
    setDashboardCategories((prev) => {
      const next = prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId]
      localStorage.setItem(DASHBOARD_CATEGORIES_KEY, JSON.stringify(next))
      return next
    })
  }

  const toggleTodaySub = (filter: string) => {
    setTodaySubFilter((prev) => {
      const next = prev.includes(filter)
        ? prev.filter((f) => f !== filter)
        : [...prev, filter]
      localStorage.setItem(DASHBOARD_TODAY_FILTER_KEY, JSON.stringify(next))
      return next
    })
  }

  // ── Notification settings (persisted to Supabase + localStorage) ──
  const toggleNotification = () => setNotificationEnabled(!notificationEnabled)
  const toggleSound = () => setSoundEnabled(!soundEnabled)

  // ── Logout ──
  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const sectionHeader =
    'text-lg font-semibold text-light-text dark:text-dark-text mb-4 flex items-center gap-2'
  const labelClass = 'text-sm font-medium text-light-text dark:text-dark-text'
  const fieldWrapper = 'flex flex-col gap-1.5'
  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary'
  const toggleTrack = (on: boolean) =>
    `relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
      on ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
    }`
  const toggleKnob = (on: boolean) =>
    `absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
      on ? 'translate-x-5' : 'translate-x-0'
    }`

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-light-text dark:text-dark-text mb-6">
        设置
      </h1>

      {/* ── Section 1: 番茄设置 ── */}
      <section className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-6 mb-6">
        <h2 className={sectionHeader}>
          <Timer className="w-5 h-5 text-primary dark:text-primary-dark" />
          番茄设置
        </h2>

        <div className="space-y-4">
          {/* Daily goal */}
          <div className={fieldWrapper}>
            <label htmlFor="dailyGoal" className={labelClass}>
              每日目标（番茄数）
            </label>
            <input
              id="dailyGoal"
              type="number"
              min={1}
              max={20}
              value={dailyGoal}
              onChange={(e) =>
                handlePomodoroChange('dailyGoal', Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          {/* Work duration */}
          <div className={fieldWrapper}>
            <label htmlFor="workDuration" className={labelClass}>
              工作时长（{workMin} 分钟）
            </label>
            <input
              id="workDuration"
              type="range"
              min={1}
              max={60}
              step={1}
              value={workMin}
              onChange={(e) =>
                handlePomodoroChange('workDuration', Number(e.target.value))
              }
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
              <span>1 分钟</span>
              <span>60 分钟</span>
            </div>
          </div>

          {/* Short break */}
          <div className={fieldWrapper}>
            <label htmlFor="shortBreak" className={labelClass}>
              短休息时长（分钟）
            </label>
            <input
              id="shortBreak"
              type="number"
              min={1}
              max={30}
              value={shortBreakMin}
              onChange={(e) =>
                handlePomodoroChange('shortBreakDuration', Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          {/* Long break */}
          <div className={fieldWrapper}>
            <label htmlFor="longBreak" className={labelClass}>
              长休息时长（分钟）
            </label>
            <input
              id="longBreak"
              type="number"
              min={1}
              max={60}
              value={longBreakMin}
              onChange={(e) =>
                handlePomodoroChange('longBreakDuration', Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          {/* Long break interval */}
          <div className={fieldWrapper}>
            <label htmlFor="longBreakInterval" className={labelClass}>
              长休息间隔（番茄数）
            </label>
            <input
              id="longBreakInterval"
              type="number"
              min={1}
              max={10}
              value={longBreakInterval}
              onChange={(e) =>
                handlePomodoroChange('longBreakInterval', Number(e.target.value))
              }
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* ── Section 2: 通知设置 ── */}
      <section className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-6">
        <h2 className={sectionHeader}>
          <Bell className="w-5 h-5 text-primary dark:text-primary-dark" />
          通知设置
        </h2>

        <div className="space-y-5">
          {/* Browser notification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
              <span className="text-sm text-light-text dark:text-dark-text">
                浏览器桌面通知
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationEnabled}
              onClick={toggleNotification}
              className={toggleTrack(notificationEnabled)}
            >
              <span className={toggleKnob(notificationEnabled)} />
            </button>
          </div>

          {/* Sound alert */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
              <span className="text-sm text-light-text dark:text-dark-text">
                声音提醒
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              onClick={toggleSound}
              className={toggleTrack(soundEnabled)}
            >
              <span className={toggleKnob(soundEnabled)} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Section 3: 仪表盘设置 ── */}
      <section className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-6 mt-6">
        <h2 className={sectionHeader}>
          <CheckSquare className="w-5 h-5 text-primary dark:text-primary-dark" />
          仪表盘设置
        </h2>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-3">
          选择仪表盘待办概览中显示的待办分类
        </p>
        <div className="space-y-2">
          {selectableCategories.map((cat) => {
            const isToday = cat.id === 'today'
            const checked = dashboardCategories.includes(cat.id)
            return (
              <div key={cat.id}>
                <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDashboardCategory(cat.id)}
                    className="w-4 h-4 rounded accent-primary dark:accent-primary-dark cursor-pointer"
                  />
                  <span className="text-sm text-light-text dark:text-dark-text font-medium">
                    {cat.name}
                  </span>
                </label>
                {/* Today sub-filters */}
                {isToday && checked && (
                  <div className="ml-7 mt-1 space-y-1">
                    {([
                      { key: 'today', label: '今天的待办' },
                      { key: 'future', label: '未来的待办' },
                      { key: 'past', label: '过去的待办' },
                    ] as const).map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 cursor-pointer select-none py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={todaySubFilter.includes(key)}
                          onChange={() => toggleTodaySub(key)}
                          className="w-3.5 h-3.5 rounded accent-primary dark:accent-primary-dark cursor-pointer"
                        />
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Section 4: 账户 ── */}
      <section className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-6 mt-6">
        <h2 className={sectionHeader}>
          <LogOut className="w-5 h-5 text-primary dark:text-primary-dark" />
          账户
        </h2>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-500 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          退出登录
        </button>
      </section>

      {/* ── Section 5: 关于 ── */}
      <section className="bg-light-card dark:bg-dark-card rounded-xl border border-light-border dark:border-dark-border p-6 mt-6">
        <h2 className={sectionHeader}>
          <Info className="w-5 h-5 text-primary dark:text-primary-dark" />
          关于
        </h2>
        <a
          href={`${window.location.origin}/easy-vibe`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm font-medium text-light-text dark:text-dark-text hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Easy Vibe
        </a>
      </section>
    </div>
  )
}
