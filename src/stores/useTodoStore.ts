import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Todo } from '../types'
import { cacheTable, loadCachedTable, isOnline } from '../lib/offlineDb'
import { isNewDay } from '../utils/time'

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
  changeEstimatedPomos: (id: string, value: number) => void
  deleteTodo: (id: string) => void
  createCategory: (name: string) => void
  renameCategory: (oldName: string, newName: string) => void
  deleteCategory: (name: string) => void
  setCurrentCategory: (category: string) => void
  setSelectedDate: (date: string | null) => void
  reorderTodos: (fromIndex: number, toIndex: number) => void

  // Computed helpers
  getFilteredTodos: () => Todo[]
  isReadOnlyView: (categoryId: string) => boolean

  // Realtime handlers (Task 9)
  handleRealtimeInsert: (todo: Todo) => void
  handleRealtimeUpdate: (todo: Todo) => void
  handleRealtimeDelete: (id: string) => void

  // Multi-select state (Task 27)
  isMultiSelectMode: boolean
  selectedTodoIds: Set<string>
  toggleMultiSelectMode: () => void
  toggleTodoSelection: (id: string) => void
  clearSelection: () => void

  // Batch operations (Task 27)
  syncToToday: (ids: string[]) => void
  uncompleteTodos: (ids: string[]) => void
  moveTodos: (ids: string[], targetCategory: string) => void
  copyTodos: (ids: string[], targetCategory: string) => void

  // Sync cleanup (Task 27)
  breakExpiredSync: () => void
  setDayStartHour: (hour: number) => void
  dayStartHour: number

  // Urgency sort
  urgencySortEnabled: boolean
  setUrgencySortEnabled: (enabled: boolean) => void

  // Completed to bottom
  completedToBottom: boolean
  setCompletedToBottom: (enabled: boolean) => void
}

let idCounter = 0
function nextId(): string {
  return `todo_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`
}

function todayStr(): string {
  const now = new Date()
  const hour = parseInt(localStorage.getItem('flowtime-dayStartHour') || '0', 10)
  const d = now.getHours() < hour
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    : now
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const createTodoStore = (supabase: SupabaseClient) => {
  const isRealSupabase = typeof (supabase as any)?.from === 'function'

  return create<TodoState>((set, get) => ({
    todos: [],
    categories: [...SYSTEM_CATEGORIES, ...loadCustomCategories()],
    currentCategory: 'today',
    selectedDate: null,
    isMultiSelectMode: false,
    selectedTodoIds: new Set<string>(),
    dayStartHour: 0,
    urgencySortEnabled: (() => {
      try { return localStorage.getItem('flowtime-urgency-sort') === 'true' } catch { return false }
    })(),
    completedToBottom: (() => {
      try { return localStorage.getItem('flowtime-completed-bottom') === 'true' } catch { return false }
    })(),

    // ---- Load from Supabase (with offline fallback) ----
    async loadTodos() {
      if (!isRealSupabase) {
        // 没有 Supabase 时从 IndexedDB 加载
        const cached = await loadCachedTable<Todo>('todos')
        if (cached.length > 0) {
          set({ todos: cached as Todo[] })
        }
        return
      }

      if (isOnline()) {
        const { data, error } = await supabase
          .from('todos')
          .select('*')
          .order('sort_order', { ascending: true })
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
        estimated_pomos: 0,
        completed_pomos: 0,
        sort_order: 0,
        created_at: new Date().toISOString(),
        completed_at: undefined,
      }

      // 乐观更新本地状态
      const updatedTodos = [...get().todos, todo]
      set({ todos: updatedTodos })

      // 缓存到 IndexedDB，确保刷新后数据不丢失
      cacheTable('todos', updatedTodos)

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
          sort_order: todo.sort_order,
        })
        .select()
        .single()
          .then(({ data, error }) => {
            if (!error && data) {
              // 用服务器返回的数据替换本地记录（获取真实 ID）
              set({
                todos: get().todos.map((t) => (t.id === todo.id ? (data as Todo) : t)),
              })
              // 服务器返回后再次缓存，确保 IndexedDB 中的 ID 与服务器一致
              cacheTable('todos', get().todos)
            } else if (error) {
              console.warn('Todo insert failed:', error.message)
            }
          })
      }
    },

    toggleTodo(id) {
      const todos = get().todos
      const todo = todos.find((t) => t.id === id)
      if (!todo) return

      const nextStatus: Todo['status'] = todo.status === 'pending' ? 'done' : 'pending'
      const completed_at = nextStatus === 'done' ? new Date().toISOString() : null

      // Collect all related ids to toggle: source + synced copies
      const idsToToggle = new Set<string>([id])
      // If this todo is the source (other todos have synced_from_id pointing to it)
      for (const t of todos) {
        if (t.synced_from_id === id) idsToToggle.add(t.id)
      }
      // If this todo is a synced copy, also toggle the source
      if (todo.synced_from_id) idsToToggle.add(todo.synced_from_id)

      set({
        todos: todos.map((t) => {
          if (!idsToToggle.has(t.id)) return t
          return { ...t, status: nextStatus, completed_at: completed_at ?? undefined }
        }),
      })

      // 同步更新 Supabase
      if (isRealSupabase) {
        for (const tid of idsToToggle) {
          supabase
            .from('todos')
            .update({ status: nextStatus, completed_at })
            .eq('id', tid)
            .then(({ error }) => {
              if (error) console.warn('Todo toggle failed:', error.message)
            })
        }
      }
    },

    changePriority(id) {
      const todos = get().todos
      const todo = todos.find((t) => t.id === id)
      if (!todo) return

      const idx = PRIORITY_ORDER.indexOf(todo.priority)
      const next = PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length]

      // 收集源与同步副本的关联 ID（双向）
      const idsToUpdate = new Set<string>([id])
      if (todo.synced_from_id) idsToUpdate.add(todo.synced_from_id)
      for (const t of todos) {
        if (t.synced_from_id === id) idsToUpdate.add(t.id)
      }

      set({
        todos: todos.map((t) =>
          idsToUpdate.has(t.id) ? { ...t, priority: next } : t,
        ),
      })

      if (isRealSupabase) {
        for (const tid of idsToUpdate) {
          supabase
            .from('todos')
            .update({ priority: next })
            .eq('id', tid)
            .then(({ error }) => {
              if (error) console.warn('Todo priority update failed:', error.message)
            })
        }
      }
    },

    changeEstimatedPomos(id, value) {
      const todos = get().todos
      const todo = todos.find((t) => t.id === id)
      if (!todo) return

      // 收集源与同步副本的关联 ID（双向）
      const idsToUpdate = new Set<string>([id])
      if (todo.synced_from_id) idsToUpdate.add(todo.synced_from_id)
      for (const t of todos) {
        if (t.synced_from_id === id) idsToUpdate.add(t.id)
      }

      set({
        todos: todos.map((t) =>
          idsToUpdate.has(t.id) ? { ...t, estimated_pomos: value } : t,
        ),
      })

      if (isRealSupabase) {
        for (const tid of idsToUpdate) {
          supabase
            .from('todos')
            .update({ estimated_pomos: value })
            .eq('id', tid)
            .then(({ error }) => {
              if (error) console.warn('Todo estimated_pomos update failed:', error.message)
            })
        }
      }
    },

    deleteTodo(id) {
      const state = get()
      const todo = state.todos.find((t) => t.id === id)
      if (!todo) return

      // 收集所有需要删除的 ID
      // - 删除源待办时，同时删除所有关联副本
      // - 删除关联副本时，仅删除副本自身（不影响源待办）
      const idsToDelete = new Set<string>([id])

      // 如果被删除的是源待办，同时删除所有关联副本（synced_from_id 指向它的）
      for (const t of state.todos) {
        if (t.synced_from_id === id) idsToDelete.add(t.id)
      }

      // 清理引用
      set({
        todos: state.todos.filter((t) => !idsToDelete.has(t.id)),
      })

      if (isRealSupabase) {
        const ids = Array.from(idsToDelete)
        Promise.all(
          ids.map((delId) =>
            supabase.from('todos').delete().eq('id', delId),
          ),
        ).catch((err) => console.warn('Todo batch delete failed:', err))
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

    reorderTodos(fromIndex, toIndex) {
      const todos = [...get().todos]
      const fromTodo = todos[fromIndex]
      const toTodo = todos[toIndex]

      // 紧急程度排序开启时，只允许在同优先级内拖动
      if (get().urgencySortEnabled && fromTodo.priority !== toTodo.priority) {
        return
      }

      const [item] = todos.splice(fromIndex, 1)
      todos.splice(toIndex, 0, item)

      let updated: Todo[]
      if (get().urgencySortEnabled) {
        // 仅重排同优先级待办的 sort_order，不影响其他优先级
        const priority = item.priority
        let order = 0
        updated = todos.map((t) => {
          if (t.priority === priority) {
            return { ...t, sort_order: order++ }
          }
          return t
        })
      } else {
        // Reassign sequential sort_order
        updated = todos.map((t, i) => ({ ...t, sort_order: i }))
      }
      set({ todos: updated })

      // Sync to Supabase (fire-and-forget, batch updates)
      if (isRealSupabase) {
        Promise.all(
          updated.map((t) =>
            supabase.from('todos').update({ sort_order: t.sort_order }).eq('id', t.id),
          ),
        ).catch((err) => console.warn('Reorder sync failed:', err))
      }
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

    // ---- Multi-select (Task 27) ----

    toggleMultiSelectMode() {
      set({
        isMultiSelectMode: !get().isMultiSelectMode,
        selectedTodoIds: get().isMultiSelectMode ? new Set<string>() : get().selectedTodoIds,
      })
    },

    toggleTodoSelection(id) {
      const next = new Set(get().selectedTodoIds)
      if (next.has(id)) {
        next.delete(id)
        // 取消选中后如果没有任何选中项，退出多选模式
        if (next.size === 0) {
          set({ selectedTodoIds: next, isMultiSelectMode: false })
          return
        }
      } else {
        next.add(id)
      }
      set({ selectedTodoIds: next })
    },

    clearSelection() {
      set({ selectedTodoIds: new Set<string>() })
    },

    syncToToday(ids) {
      const todos = get().todos
      const now = new Date().toISOString()
      const date = todayStr()

      const copies: Todo[] = []
      let minOrder = 0
      let first = true
      for (const t of todos) {
        if (first || t.sort_order < minOrder) {
          minOrder = t.sort_order
          first = false
        }
      }

      for (const id of ids) {
        const src = todos.find((t) => t.id === id)
        if (!src) continue
        // 如果今天已存在该待办的同步副本，跳过重复同步
        if (todos.some((t) => t.synced_from_id === src.id && t.category === 'today')) {
          continue
        }
        const newTodo: Todo = {
          id: nextId(),
          user_id: src.user_id,
          title: src.title,
          description: src.description,
          status: src.status,
          priority: src.priority,
          category: 'today',
          date,
          estimated_pomos: src.estimated_pomos,
          completed_pomos: src.completed_pomos,
          sort_order: --minOrder,
          created_at: now,
          completed_at: src.completed_at,
          synced_from_id: src.id,
        }
        copies.push(newTodo)
      }

      if (copies.length === 0) return

      const updatedTodos = [...todos, ...copies]
      set({
        todos: updatedTodos,
        isMultiSelectMode: false,
        selectedTodoIds: new Set<string>(),
      })

      // 缓存到 IndexedDB，确保刷新后数据不丢失
      cacheTable('todos', updatedTodos)

      if (isRealSupabase) {
        for (const c of copies) {
          supabase
            .from('todos')
            .insert({
              title: c.title,
              description: c.description ?? null,
              status: c.status,
              priority: c.priority,
              category: c.category,
              date: c.date ?? null,
              estimated_pomos: c.estimated_pomos,
              completed_pomos: c.completed_pomos,
              sort_order: c.sort_order,
              synced_from_id: c.synced_from_id,
            })
            .select()
            .single()
            .then(({ data, error }) => {
              if (!error && data) {
                set({
                  todos: get().todos.map((t) => (t.id === c.id ? (data as Todo) : t)),
                })
                // 服务器返回后再次缓存，确保 IndexedDB 中的 ID 与服务器一致
                cacheTable('todos', get().todos)
              }
            })
        }
      }
    },

    uncompleteTodos(ids) {
      const todos = get().todos
      const updated = todos.map((t) => {
        if (ids.includes(t.id) && t.status === 'done') {
          return { ...t, status: 'pending' as const, completed_at: undefined }
        }
        return t
      })

      set({ todos: updated })

      if (isRealSupabase) {
        for (const id of ids) {
          const todo = todos.find((t) => t.id === id)
          if (!todo || todo.status !== 'done') continue
          supabase
            .from('todos')
            .update({ status: 'pending', completed_at: null })
            .eq('id', id)
            .then(({ error }) => {
              if (error) console.warn('Uncomplete failed:', error.message)
            })
        }
      }
    },

    moveTodos(ids, targetCategory) {
      set({
        todos: get().todos.map((t) =>
          ids.includes(t.id) ? { ...t, category: targetCategory } : t,
        ),
        isMultiSelectMode: false,
        selectedTodoIds: new Set<string>(),
      })

      if (isRealSupabase) {
        for (const id of ids) {
          supabase
            .from('todos')
            .update({ category: targetCategory })
            .eq('id', id)
            .then(({ error }) => {
              if (error) console.warn('Move failed:', error.message)
            })
        }
      }
    },

    copyTodos(ids, targetCategory) {
      const todos = get().todos
      const now = new Date().toISOString()
      const copies: Todo[] = []

      for (const id of ids) {
        const src = todos.find((t) => t.id === id)
        if (!src) continue
        copies.push({
          ...src,
          id: nextId(),
          category: targetCategory,
          created_at: now,
          synced_from_id: undefined,
        })
      }

      if (copies.length === 0) return

      set({
        todos: [...todos, ...copies],
        isMultiSelectMode: false,
        selectedTodoIds: new Set<string>(),
      })

      if (isRealSupabase) {
        for (const c of copies) {
          supabase
            .from('todos')
            .insert({
              title: c.title,
              description: c.description ?? null,
              status: c.status,
              priority: c.priority,
              category: c.category,
              date: c.date ?? null,
              estimated_pomos: c.estimated_pomos,
              completed_pomos: c.completed_pomos,
              sort_order: c.sort_order,
            })
            .select()
            .single()
            .then(({ data, error }) => {
              if (!error && data) {
                set({
                  todos: get().todos.map((t) => (t.id === c.id ? (data as Todo) : t)),
                })
              }
            })
        }
      }
    },

    // ---- Sync cleanup (Task 27) ----

    breakExpiredSync() {
      const todos = get().todos
      const dayStart = get().dayStartHour
      let changed = false

      const updated = todos.map((t) => {
        if (t.category === 'today' && t.synced_from_id) {
          const source = todos.find((s) => s.id === t.synced_from_id)
          const sourceDate = source?.date
          if (!source || (sourceDate && isNewDay(dayStart, sourceDate))) {
            changed = true
            return { ...t, synced_from_id: undefined }
          }
        }
        return t
      })

      if (!changed) return

      set({ todos: updated })

      if (isRealSupabase) {
        for (const t of updated) {
          if (t.category === 'today' && !t.synced_from_id) {
            supabase
              .from('todos')
              .update({ synced_from_id: null })
              .eq('id', t.id)
              .then(({ error }) => {
                if (error) console.warn('Break expired sync (copy) failed:', error.message)
              })
          }
        }
      }
    },

    setDayStartHour(hour) {
      set({ dayStartHour: hour })
    },

    setUrgencySortEnabled(enabled) {
      set({ urgencySortEnabled: enabled })
      try { localStorage.setItem('flowtime-urgency-sort', String(enabled)) } catch { /* ignore */ }
    },

    setCompletedToBottom(enabled) {
      set({ completedToBottom: enabled })
      try { localStorage.setItem('flowtime-completed-bottom', String(enabled)) } catch { /* ignore */ }
    },

    getFilteredTodos() {
      const { todos, currentCategory, selectedDate, urgencySortEnabled, completedToBottom } = get()
      let filtered: Todo[]
      switch (currentCategory) {
        case 'today': {
          const targetDate = selectedDate || todayStr()
          filtered = todos.filter((t) => t.category === 'today' && t.date === targetDate)
          break
        }
        case 'all':
          filtered = todos.filter((t) => t.category !== 'today')
          break
        case 'planned':
          filtered = todos.filter((t) => t.category !== 'today' && t.status === 'pending')
          break
        case 'completed':
          filtered = todos.filter((t) => t.category !== 'today' && t.status === 'done')
          break
        default:
          filtered = todos.filter((t) => t.category === currentCategory)
      }

      // 紧急程度排序：高 → 中 → 低，同级内按 sort_order
      if (urgencySortEnabled) {
        const priorityOrder: Record<Todo['priority'], number> = { high: 0, medium: 1, low: 2 }
        filtered = [...filtered].sort((a, b) => {
          const p = priorityOrder[a.priority] - priorityOrder[b.priority]
          if (p !== 0) return p
          return a.sort_order - b.sort_order
        })
      }

      // 已完成排到底部：pending 在前，done 在后（保持各自组内原有顺序）
      if (completedToBottom && currentCategory !== 'completed') {
        filtered = [...filtered].sort((a, b) => {
          if (a.status === b.status) return 0
          return a.status === 'done' ? 1 : -1
        })
      }

      return filtered
    },

    isReadOnlyView(categoryId) {
      const cat = get().categories.find((c) => c.id === categoryId)
      return cat?.type === 'readonly'
    },
  }))
}
