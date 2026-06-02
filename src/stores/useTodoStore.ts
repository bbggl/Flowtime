import { create } from 'zustand'
import type { Todo } from '../types'

export interface Category {
  id: string
  name: string
  type: 'system' | 'custom' | 'readonly'
}

const SYSTEM_CATEGORIES: Category[] = [
  { id: 'today', name: '今天', type: 'system' },
  { id: 'all', name: '全部', type: 'readonly' },
  { id: 'planned', name: '计划中', type: 'readonly' },
  { id: 'completed', name: '已完成', type: 'readonly' },
]

const PRIORITY_ORDER: Todo['priority'][] = ['medium', 'high', 'low']

interface TodoState {
  todos: Todo[]
  categories: Category[]
  currentCategory: string
  selectedDate: string | null

  // Actions
  addTodo: (title: string, category: string) => void
  toggleTodo: (id: string) => void
  changePriority: (id: string) => void
  deleteTodo: (id: string) => void
  createCategory: (name: string) => void
  setCurrentCategory: (category: string) => void
  setSelectedDate: (date: string | null) => void

  // Computed helpers
  getFilteredTodos: () => Todo[]
  isReadOnlyView: (categoryId: string) => boolean
}

let idCounter = 0
function nextId(): string {
  return `todo_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export const createTodoStore = (_supabase: unknown) =>
  create<TodoState>((set, get) => ({
    todos: [],
    categories: [...SYSTEM_CATEGORIES],
    currentCategory: 'today',
    selectedDate: null,

    addTodo(title, category) {
      if (!title.trim()) return

      const todo: Todo = {
        id: nextId(),
        user_id: '',
        title: title.trim(),
        description: '',
        status: 'pending',
        priority: 'medium',
        category,
        date: category === 'today' ? todayStr() : undefined,
        estimated_pomos: category === 'today' ? 0 : 1,
        completed_pomos: 0,
        created_at: new Date().toISOString(),
        completed_at: undefined,
      }

      set({ todos: [...get().todos, todo] })
    },

    toggleTodo(id) {
      set({
        todos: get().todos.map((t) => {
          if (t.id !== id) return t
          const nextStatus = t.status === 'pending' ? 'done' : 'pending'
          return {
            ...t,
            status: nextStatus,
            completed_at: nextStatus === 'done' ? new Date().toISOString() : undefined,
          }
        }),
      })
    },

    changePriority(id) {
      set({
        todos: get().todos.map((t) => {
          if (t.id !== id) return t
          const idx = PRIORITY_ORDER.indexOf(t.priority)
          const next = PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length]
          return { ...t, priority: next }
        }),
      })
    },

    deleteTodo(id) {
      set({ todos: get().todos.filter((t) => t.id !== id) })
    },

    createCategory(name) {
      const cats = get().categories
      if (cats.some((c) => c.name === name || c.id === name)) return
      const newCat: Category = { id: name, name, type: 'custom' }
      set({ categories: [...cats, newCat] })
    },

    setCurrentCategory(category) {
      set({ currentCategory: category })
    },

    setSelectedDate(date) {
      set({ selectedDate: date })
    },

    getFilteredTodos() {
      const { todos, currentCategory } = get()
      switch (currentCategory) {
        case 'today':
          return todos.filter((t) => t.category === 'today')
        case 'all':
          return todos.filter((t) => t.category !== 'today')
        case 'planned':
          return todos.filter((t) => t.category !== 'today' && t.status === 'pending')
        case 'completed':
          return todos.filter((t) => t.category !== 'today' && t.status === 'done')
        default:
          return todos.filter((t) => t.category === currentCategory)
      }
    },

    isReadOnlyView(categoryId) {
      const cat = get().categories.find((c) => c.id === categoryId)
      return cat?.type === 'readonly'
    },
  }))
