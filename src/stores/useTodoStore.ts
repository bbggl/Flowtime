import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Todo } from '../types'
import { cacheTable, loadCachedTable, isOnline } from '../lib/offlineDb'

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

const CATEGORIES_KEY = 'flowtime-custom-categories'

function loadCustomCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (raw) {
      const names: string[] = JSON.parse(raw)
      return names.map((name) => ({ id: name, name, type: 'custom' as const }))
    }
  } catch { /* ignore */ }
  return []
}

function saveCustomCategories(cats: Category[]) {
  try {
    const names = cats.filter((c) => c.type === 'custom').map((c) => c.name)
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(names))
  } catch { /* ignore */ }
}

const PRIORITY_ORDER: Todo['priority'][] = ['medium', 'high', 'low']

interface TodoState {
  todos: Todo[]
  categories: Category[]
  currentCategory: string
  selectedDate: string | null

  // Actions
  loadTodos: () => Promise<void>
  loadCategories: () => Promise<void>
  addTodo: (title: string, category: string) => void
  toggleTodo: (id: string) => void
  changePriority: (id: string) => void
  changeEstimatedPomos: (id: string) => void
  deleteTodo: (id: string) => void
  createCategory: (name: string) => void
  renameCategory: (oldName: string, newName: string) => void
  deleteCategory: (name: string) => void
  setCurrentCategory: (category: string) => void
  setSelectedDate: (date: string | null) => void

  // Computed helpers
  getFilteredTodos: () => Todo[]
  isReadOnlyView: (categoryId: string) => boolean

  // Realtime handlers (Task 9)
  handleRealtimeInsert: (todo: Todo) => void
  handleRealtimeUpdate: (todo: Todo) => void
  handleRealtimeDelete: (id: string) => void
}

let idCounter = 0
function nextId(): string {
  return `todo_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export const createTodoStore = (supabase: SupabaseClient) => {
  const isRealSupabase = typeof (supabase as any)?.from === 'function'

  return create<TodoState>((set, get) => ({
    todos: [],
    categories: [...SYSTEM_CATEGORIES, ...loadCustomCategories()],
    currentCategory: 'today',
    selectedDate: null,

    // ---- Load from Supabase (with offline fallback) ----
    async loadTodos() {
      if (!isRealSupabase) return

      if (isOnline()) {
        const { data, error } = await supabase
          .from('todos')
          .select('*')
          .order('created_at', { ascending: false })

        if (!error && data) {
          set({ todos: data as Todo[] })
          await cacheTable('todos', data)
          return
        }
      }

      // Fallback: load from IndexedDB cache
      const cached = await loadCachedTable<Todo>('todos')
      if (cached.length > 0) {
        set({ todos: cached as Todo[] })
      }
    },

    async loadCategories() {
      // localStorage 作为即时缓存
      const cached = loadCustomCategories()

      if (!isRealSupabase) {
        if (cached.length > 0) {
          set({ categories: [...SYSTEM_CATEGORIES, ...cached] })
        }
        return
      }

      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .order('created_at', { ascending: true })

      if (!error && data && data.length > 0) {
        const cats: Category[] = data.map((r: { name: string }) => ({
          id: r.name,
          name: r.name,
          type: 'custom' as const,
        }))
        set({ categories: [...SYSTEM_CATEGORIES, ...cats] })
        saveCustomCategories(cats)
      } else if (cached.length > 0) {
        // Supabase 无数据时回退 localStorage
        set({ categories: [...SYSTEM_CATEGORIES, ...cached] })
      }
    },

    // ---- Mutations ----
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
        date: category === 'today' ? (get().selectedDate || todayStr()) : undefined,
        estimated_pomos: 1,
        completed_pomos: 0,
        created_at: new Date().toISOString(),
        completed_at: undefined,
      }

      // 乐观更新本地状态
      set({ todos: [...get().todos, todo] })

      // 同步写入 Supabase
      if (isRealSupabase) {
        supabase
          .from('todos')
          .insert({
          title: todo.title,
          description: todo.description,
          status: todo.status,
          priority: todo.priority,
          category: todo.category,
          date: todo.date ?? null,
          estimated_pomos: todo.estimated_pomos,
          completed_pomos: todo.completed_pomos,
        })
        .select()
        .single()
          .then(({ data, error }) => {
            if (!error && data) {
              // 用服务器返回的数据替换本地记录（获取真实 ID）
              set({
                todos: get().todos.map((t) => (t.id === todo.id ? (data as Todo) : t)),
              })
            } else if (error) {
              console.warn('Todo insert failed:', error.message)
            }
          })
      }
    },

    toggleTodo(id) {
      const todo = get().todos.find((t) => t.id === id)
      if (!todo) return

      const nextStatus: Todo['status'] = todo.status === 'pending' ? 'done' : 'pending'
      const completed_at = nextStatus === 'done' ? new Date().toISOString() : null

      set({
        todos: get().todos.map((t) => {
          if (t.id !== id) return t
          return { ...t, status: nextStatus, completed_at: completed_at ?? undefined }
        }),
      })

      // 同步更新 Supabase
      if (isRealSupabase) {
        supabase
          .from('todos')
          .update({ status: nextStatus, completed_at })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('Todo toggle failed:', error.message)
          })
      }
    },

    changePriority(id) {
      const todo = get().todos.find((t) => t.id === id)
      if (!todo) return

      const idx = PRIORITY_ORDER.indexOf(todo.priority)
      const next = PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length]

      set({
        todos: get().todos.map((t) => (t.id !== id ? t : { ...t, priority: next })),
      })

      if (isRealSupabase) {
        supabase
          .from('todos')
          .update({ priority: next })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('Todo priority update failed:', error.message)
          })
      }
    },

    changeEstimatedPomos(id) {
      const todo = get().todos.find((t) => t.id === id)
      if (!todo) return

      // Cycle: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 0 → 1 → ...
      const next = todo.estimated_pomos >= 8 ? 0 : todo.estimated_pomos + 1

      set({
        todos: get().todos.map((t) => (t.id !== id ? t : { ...t, estimated_pomos: next })),
      })

      if (isRealSupabase) {
        supabase
          .from('todos')
          .update({ estimated_pomos: next })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('Todo estimated_pomos update failed:', error.message)
          })
      }
    },

    deleteTodo(id) {
      set({ todos: get().todos.filter((t) => t.id !== id) })

      if (isRealSupabase) {
        supabase
          .from('todos')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('Todo delete failed:', error.message)
          })
      }
    },

    createCategory(name) {
      const cats = get().categories
      if (cats.some((c) => c.name === name || c.id === name)) return
      const newCat: Category = { id: name, name, type: 'custom' }
      const updated = [...cats, newCat]
      set({ categories: updated })
      saveCustomCategories(updated)

      // 持久化到 Supabase
      if (isRealSupabase) {
        supabase
          .from('categories')
          .insert({ name })
          .select()
          .single()
          .then(({ error }: { error: any }) => {
            if (error) console.warn('Category insert failed:', error.message)
          })
      }
    },

    renameCategory(oldName, newName) {
      const cats = get().categories
      const trimmed = newName.trim()
      if (!trimmed || oldName === trimmed) return
      if (cats.some((c) => c.name === trimmed || c.id === trimmed)) return

      const updated = cats.map((c) =>
        c.id === oldName ? { ...c, id: trimmed, name: trimmed } : c,
      )
      set({ categories: updated })

      // 更新所有属于该分类的 todo
      const updatedTodos = get().todos.map((t) =>
        t.category === oldName ? { ...t, category: trimmed } : t,
      )
      set({ todos: updatedTodos })

      saveCustomCategories(updated)

      if (isRealSupabase) {
        // 更新 categories 表
        supabase
          .from('categories')
          .update({ name: trimmed })
          .eq('name', oldName)
          .then(({ error }) => {
            if (error) console.warn('Category rename failed:', error.message)
          })
        // 更新 todos 表
        supabase
          .from('todos')
          .update({ category: trimmed })
          .eq('category', oldName)
          .then(({ error }) => {
            if (error) console.warn('Todo category update failed:', error.message)
          })
      }
    },

    deleteCategory(name) {
      const cats = get().categories
      const updated = cats.filter((c) => c.id !== name)
      set({ categories: updated })
      saveCustomCategories(updated)

      // 删除属于该分类的 todo
      set({ todos: get().todos.filter((t) => t.category !== name) })

      if (isRealSupabase) {
        supabase
          .from('categories')
          .delete()
          .eq('name', name)
          .then(({ error }) => {
            if (error) console.warn('Category delete failed:', error.message)
          })
        supabase
          .from('todos')
          .delete()
          .eq('category', name)
          .then(({ error }) => {
            if (error) console.warn('Todo category delete failed:', error.message)
          })
      }
    },

    setCurrentCategory(category) {
      set({ currentCategory: category })
    },

    setSelectedDate(date) {
      set({ selectedDate: date })
    },

    // ---- Realtime sync handlers (Task 9) ----
    handleRealtimeInsert(todo: Todo) {
      if (get().todos.some((t) => t.id === todo.id)) return
      set({ todos: [...get().todos, todo] })
    },

    handleRealtimeUpdate(todo: Todo) {
      set({
        todos: get().todos.map((t) => (t.id === todo.id ? { ...t, ...todo } : t)),
      })
    },

    handleRealtimeDelete(id: string) {
      set({ todos: get().todos.filter((t) => t.id !== id) })
    },

    getFilteredTodos() {
      const { todos, currentCategory, selectedDate } = get()
      switch (currentCategory) {
        case 'today': {
          const targetDate = selectedDate || todayStr()
          return todos.filter((t) => t.category === 'today' && t.date === targetDate)
        }
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
}
