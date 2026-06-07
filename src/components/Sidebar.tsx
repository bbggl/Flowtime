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
  ChevronLeft,
  ChevronRight,
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
  const { theme, toggleTheme, sidebarExpanded, toggleSidebar } = useThemeStore()

  return (
    <aside
      className={`h-screen flex flex-col items-center py-4 bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border transition-all ${
        sidebarExpanded ? 'w-44 items-start px-3' : 'w-16 items-center'
      }`}
    >
      <div className={`mb-6 flex items-center gap-2 ${sidebarExpanded ? 'pl-1' : ''}`}>
        <Zap className="w-7 h-7 text-primary dark:text-primary-dark shrink-0" />
        {sidebarExpanded && (
          <span className="text-base font-bold text-light-text dark:text-dark-text whitespace-nowrap">
            Flow Time
          </span>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `h-10 rounded-xl flex items-center transition-colors ${
                sidebarExpanded ? 'justify-start px-2 gap-3' : 'justify-center'
              } ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark'
              }`
            }
            title={sidebarExpanded ? undefined : label}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {sidebarExpanded && (
              <span className="text-sm truncate">{label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-2 mt-auto w-full px-2">
        {sidebarExpanded ? (
          <div className="flex items-center gap-2 w-full justify-center">
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark"
              title="收起侧边栏"
            >
              <ChevronLeft className="w-5 h-5" />
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
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark"
              title={theme === 'dark' ? '切换到明亮模式' : '切换到暗色模式'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        ) : (
          <>
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
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-primary dark:hover:text-primary-dark"
              title="展开侧边栏"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
