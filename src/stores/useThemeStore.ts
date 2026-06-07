import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  sidebarExpanded: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setSidebarExpanded: (expanded: boolean) => void
  toggleSidebar: () => void
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('flowtime-theme')
  if (stored === 'light' || stored === 'dark') return stored
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function getInitialSidebarExpanded(): boolean {
  return localStorage.getItem('flowtime-sidebar-expanded') === 'true'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme()
  applyTheme(initial)

  return {
    theme: initial,
    sidebarExpanded: getInitialSidebarExpanded(),

    setTheme(theme) {
      localStorage.setItem('flowtime-theme', theme)
      applyTheme(theme)
      set({ theme })
    },

    toggleTheme() {
      const next = get().theme === 'dark' ? 'light' : 'dark'
      get().setTheme(next)
    },

    setSidebarExpanded(expanded) {
      localStorage.setItem('flowtime-sidebar-expanded', String(expanded))
      set({ sidebarExpanded: expanded })
    },

    toggleSidebar() {
      const next = !get().sidebarExpanded
      get().setSidebarExpanded(next)
    },
  }
})
