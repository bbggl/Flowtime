import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { usePomodoroTimer } from '../hooks/usePomodoroTimer'
import { usePomodoroStore } from '../stores'
import { SyncEngine } from '../lib/sync'

/**
 * 隐藏组件 — 将番茄钟 rAF 计时循环提升到 Layout 层，
 * 确保切换页面时计时不中断。
 */
function TimerEngine() {
  usePomodoroTimer(usePomodoroStore)
  return null
}

/**
 * 启动时从 Supabase 加载用户设置，确保刷新后不丢失。
 */
function SettingsLoader() {
  useEffect(() => {
    usePomodoroStore.getState().loadSettings()
  }, [])
  return null
}

export default function Layout() {
  return (
    <div className="flex h-screen">
      <TimerEngine />
      <SettingsLoader />
      <SyncEngine />
      <Sidebar />
      <main className="flex-1 overflow-auto bg-light-bg dark:bg-dark-bg">
        <Outlet />
      </main>
    </div>
  )
}
