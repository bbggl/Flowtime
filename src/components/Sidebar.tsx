import { NavLink } from 'react-router-dom'
import {
  Zap,
  LayoutDashboard,
  CheckSquare,
  Timer,
  FileText,
  BarChart3,
  Sun,
  Moon,
  Settings,
} from 'lucide-react'
import { useThemeStore } from '../stores/useThemeStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/todo', icon: CheckSquare, label: '待办' },
  { to: '/pomodoro', icon: Timer, label: '番茄钟' },
  { to: '/notes', icon: FileText, label: '笔记' },
  { to: '/stats', icon: BarChart3, label: '统计' },
]

export default function Sidebar() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <aside className="w-16 h-screen flex flex-col items-center py-4 bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border">
      <div className="mb-6">
        <Zap className="w-7 h-7 text-primary dark:text-primary-dark" />
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark'
              }`
            }
            title={label}
          >
            <Icon className="w-5 h-5" />
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark"
          title={theme === 'dark' ? '切换到明亮模式' : '切换到暗色模式'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-primary text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark'
            }`
          }
          title="设置"
        >
          <Settings className="w-5 h-5" />
        </NavLink>
      </div>
    </aside>
  )
}
