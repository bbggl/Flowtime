import { useState } from 'react'
import { useStore } from 'zustand'
import { createPomodoroStore } from '../stores/usePomodoroStore'
import { supabase } from '../lib/supabase'
import { Timer, Bell, Volume2 } from 'lucide-react'

const pomodoroStore = createPomodoroStore(supabase)

function loadLocalFlag(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  return raw !== 'false'
}

export default function Settings() {
  // ── Pomodoro settings (from store, in seconds internally) ──
  const workDuration = useStore(pomodoroStore, (s) => s.workDuration)
  const shortBreakDuration = useStore(pomodoroStore, (s) => s.shortBreakDuration)
  const longBreakDuration = useStore(pomodoroStore, (s) => s.longBreakDuration)
  const longBreakInterval = useStore(pomodoroStore, (s) => s.longBreakInterval)
  const dailyGoal = useStore(pomodoroStore, (s) => s.dailyGoal)
  const setDurations = useStore(pomodoroStore, (s) => s.setDurations)

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

  // ── Notification settings (local state + localStorage) ──
  const [notificationOn, setNotificationOn] = useState(() =>
    loadLocalFlag('flowtime-notification', true),
  )
  const [soundOn, setSoundOn] = useState(() =>
    loadLocalFlag('flowtime-sound', true),
  )

  const toggleNotification = () => {
    const next = !notificationOn
    setNotificationOn(next)
    localStorage.setItem('flowtime-notification', String(next))
  }

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem('flowtime-sound', String(next))
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
              aria-checked={notificationOn}
              onClick={toggleNotification}
              className={toggleTrack(notificationOn)}
            >
              <span className={toggleKnob(notificationOn)} />
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
              aria-checked={soundOn}
              onClick={toggleSound}
              className={toggleTrack(soundOn)}
            >
              <span className={toggleKnob(soundOn)} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
