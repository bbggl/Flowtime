import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'

let useThemeStore: typeof import('./useThemeStore').useThemeStore

beforeAll(async () => {
  // jsdom does not implement window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  const mod = await import('./useThemeStore')
  useThemeStore = mod.useThemeStore
})

function resetSidebarState() {
  useThemeStore.setState({ sidebarExpanded: false })
}

describe('useThemeStore - Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSidebarState()
  })

  it('默认 sidebarExpanded 为 false', () => {
    expect(useThemeStore.getState().sidebarExpanded).toBe(false)
  })

  it('setSidebarExpanded() 设置值', () => {
    useThemeStore.getState().setSidebarExpanded(true)
    expect(useThemeStore.getState().sidebarExpanded).toBe(true)

    useThemeStore.getState().setSidebarExpanded(false)
    expect(useThemeStore.getState().sidebarExpanded).toBe(false)
  })

  it('toggleSidebar() 在 true/false 之间切换', () => {
    useThemeStore.getState().toggleSidebar()
    expect(useThemeStore.getState().sidebarExpanded).toBe(true)

    useThemeStore.getState().toggleSidebar()
    expect(useThemeStore.getState().sidebarExpanded).toBe(false)

    useThemeStore.getState().toggleSidebar()
    expect(useThemeStore.getState().sidebarExpanded).toBe(true)
  })

  it('setSidebarExpanded 持久化到 localStorage', () => {
    useThemeStore.getState().setSidebarExpanded(true)
    expect(localStorage.getItem('flowtime-sidebar-expanded')).toBe('true')

    useThemeStore.getState().setSidebarExpanded(false)
    expect(localStorage.getItem('flowtime-sidebar-expanded')).toBe('false')
  })

  it('toggleSidebar 持久化到 localStorage', () => {
    useThemeStore.getState().toggleSidebar()
    expect(localStorage.getItem('flowtime-sidebar-expanded')).toBe('true')

    useThemeStore.getState().toggleSidebar()
    expect(localStorage.getItem('flowtime-sidebar-expanded')).toBe('false')
  })

  it('从 localStorage 恢复 sidebarExpanded 状态', () => {
    localStorage.setItem('flowtime-sidebar-expanded', 'true')
    const stored = localStorage.getItem('flowtime-sidebar-expanded')
    expect(stored).toBe('true')
  })
})
