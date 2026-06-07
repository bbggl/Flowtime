import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTodoStore } from './useTodoStore'
import type { Todo } from '../types'

// Minimal mock: only mock what the store imports
vi.mock('../lib/offlineDb', () => ({
  isOnline: () => true,
  cacheTable: vi.fn(),
  loadCachedTable: vi.fn().mockResolvedValue([]),
  queueMutation: vi.fn(),
  getQueue: vi.fn().mockResolvedValue([]),
  clearQueue: vi.fn(),
  flushQueue: vi.fn(),
  onOnline: vi.fn(() => () => {}),
  onOffline: vi.fn(() => () => {}),
}))

// In-memory mock Supabase client
function createMockSupabase() {
  const tables: Record<string, Record<string, unknown>[]> = {
    todos: [],
    categories: [],
  }

  const from = (table: string) => ({
    select: () => ({
      eq: (_col: string, _val: string) => ({
        order: (_col: string, _opts?: { ascending: boolean }) =>
          Promise.resolve({ data: [...tables[table]], error: null }),
      }),
      order: (_col: string, _opts?: { ascending: boolean }) =>
        Promise.resolve({ data: [...tables[table]], error: null }),
    }),
    insert: (rows: unknown | unknown[]) => {
      const items = Array.isArray(rows) ? rows : [rows]
      for (const row of items) {
        tables[table].push({ ...(row as object), id: (row as Todo).id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) })
      }
      return { select: () => ({ single: () => Promise.resolve({ data: items[0], error: null }) }) }
    },
    update: (updates: unknown) => ({
      eq: (_col: string, _val: string) => {
        for (const row of tables[table]) {
          if ((row as Record<string, unknown>)[_col] === _val) {
            Object.assign(row, updates as object)
          }
        }
        return Promise.resolve({ data: null, error: null })
      },
    }),
    delete: () => ({
      eq: (_col: string, _val: string) => {
        const idx = tables[table].findIndex((r) => (r as unknown as Todo).id === _val)
        if (idx >= 0) tables[table].splice(idx, 1)
        return Promise.resolve({ data: null, error: null })
      },
    }),
  })

  return { from } as any
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    user_id: 'u1',
    title: 'Test',
    status: 'pending',
    priority: 'medium',
    category: 'work',
    estimated_pomos: 1,
    completed_pomos: 0,
    sort_order: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function todayStr(): string {
  const now = new Date()
  const hour = parseInt(localStorage.getItem('flowtime-dayStartHour') || '0', 10)
  const d = now.getHours() < hour
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    : now
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTodoStore', () => {
  let store: ReturnType<typeof createTodoStore>

  beforeEach(() => {
    store = createTodoStore(createMockSupabase())
  })

  // =========================================================================
  // Existing tests (unchanged)
  // =========================================================================

  describe('addTodo', () => {
    it('adds a new todo to the list', () => {
      store.getState().addTodo('Test task', 'my-category')
      const todos = store.getState().todos
      expect(todos).toHaveLength(1)
      expect(todos[0].title).toBe('Test task')
      expect(todos[0].category).toBe('my-category')
      expect(todos[0].status).toBe('pending')
      expect(todos[0].priority).toBe('medium')
    })

    it('sets estimated_pomos to 1 for custom category', () => {
      store.getState().addTodo('Test task', 'my-category')
      expect(store.getState().todos[0].estimated_pomos).toBe(1)
    })

    it('sets estimated_pomos to 1 for "today" category', () => {
      store.getState().addTodo('Today task', 'today')
      expect(store.getState().todos[0].estimated_pomos).toBe(1)
    })
  })

  describe('toggleTodo', () => {
    it('toggles pending to done', () => {
      store.getState().addTodo('Task', 'my-category')
      const id = store.getState().todos[0].id
      store.getState().toggleTodo(id)
      expect(store.getState().todos[0].status).toBe('done')
    })

    it('toggles done back to pending', () => {
      store.getState().addTodo('Task', 'my-category')
      const id = store.getState().todos[0].id
      store.getState().toggleTodo(id)
      store.getState().toggleTodo(id)
      expect(store.getState().todos[0].status).toBe('pending')
    })
  })

  describe('changePriority', () => {
    it('cycles priority from medium to high to low to medium', () => {
      store.getState().addTodo('Task', 'my-category')
      const id = store.getState().todos[0].id
      expect(store.getState().todos[0].priority).toBe('medium')
      store.getState().changePriority(id)
      expect(store.getState().todos[0].priority).toBe('high')
      store.getState().changePriority(id)
      expect(store.getState().todos[0].priority).toBe('low')
      store.getState().changePriority(id)
      expect(store.getState().todos[0].priority).toBe('medium')
    })
  })

  describe('deleteTodo', () => {
    it('removes a todo from the list', () => {
      store.getState().addTodo('Task', 'my-category')
      const id = store.getState().todos[0].id
      store.getState().deleteTodo(id)
      expect(store.getState().todos).toHaveLength(0)
    })
  })

  describe('categories', () => {
    it('has default system categories', () => {
      const cats = store.getState().categories
      expect(cats.map((c) => c.id)).toContain('today')
      expect(cats.map((c) => c.id)).toContain('all')
      expect(cats.map((c) => c.id)).toContain('planned')
      expect(cats.map((c) => c.id)).toContain('completed')
    })

    it('allows creating custom categories', () => {
      store.getState().createCategory('Work')
      const cats = store.getState().categories
      expect(cats.some((c) => c.name === 'Work')).toBe(true)
    })

    it('today is the first category', () => {
      expect(store.getState().categories[0].id).toBe('today')
    })
  })

  describe('filtering', () => {
    it('filters by category', () => {
      store.getState().addTodo('Task A', 'work')
      store.getState().addTodo('Task B', 'personal')
      store.getState().setCurrentCategory('work')
      expect(store.getState().getFilteredTodos()).toHaveLength(1)
      expect(store.getState().getFilteredTodos()[0].title).toBe('Task A')
    })

    it('"all" category shows all non-today tasks', () => {
      store.getState().addTodo('Task A', 'work')
      store.getState().addTodo('Task B', 'personal')
      store.getState().addTodo('Today', 'today')
      store.getState().setCurrentCategory('all')
      expect(store.getState().getFilteredTodos()).toHaveLength(2)
    })

    it('"planned" shows only pending non-today tasks', () => {
      store.getState().addTodo('Pending', 'work')
      store.getState().addTodo('Done', 'work')
      const doneId = store.getState().todos[1].id
      store.getState().toggleTodo(doneId)
      store.getState().setCurrentCategory('planned')
      expect(store.getState().getFilteredTodos()).toHaveLength(1)
      expect(store.getState().getFilteredTodos()[0].title).toBe('Pending')
    })

    it('"completed" shows only done non-today tasks', () => {
      store.getState().addTodo('Pending', 'work')
      store.getState().addTodo('Done', 'work')
      const doneId = store.getState().todos[1].id
      store.getState().toggleTodo(doneId)
      store.getState().setCurrentCategory('completed')
      expect(store.getState().getFilteredTodos()).toHaveLength(1)
      expect(store.getState().getFilteredTodos()[0].title).toBe('Done')
    })
  })

  describe('today special behavior', () => {
    it('sets today date on todo when adding to today', () => {
      store.getState().addTodo('Today task', 'today')
      const todo = store.getState().todos[0]
      expect(todo.date).toBeDefined()
    })
  })

  describe('isReadOnlyView', () => {
    it('returns true for all, planned, completed', () => {
      expect(store.getState().isReadOnlyView('all')).toBe(true)
      expect(store.getState().isReadOnlyView('planned')).toBe(true)
      expect(store.getState().isReadOnlyView('completed')).toBe(true)
    })

    it('returns false for today and custom categories', () => {
      expect(store.getState().isReadOnlyView('today')).toBe(false)
      expect(store.getState().isReadOnlyView('work')).toBe(false)
    })
  })

  // =========================================================================
  // Task 7: Cross-day persistence + historical calendar
  // =========================================================================

  describe('selectedDate filtering (Task 7)', () => {
    it('setSelectedDate changes the selectedDate state', () => {
      store.getState().setSelectedDate('2026-01-15')
      expect(store.getState().selectedDate).toBe('2026-01-15')
    })

    it('setSelectedDate(null) clears selection', () => {
      store.getState().setSelectedDate('2026-01-15')
      store.getState().setSelectedDate(null)
      expect(store.getState().selectedDate).toBeNull()
    })

    it('getFilteredTodos for "today" uses selectedDate when set', () => {
      // Add a task dated yesterday and a task dated today — both "today" category
      const yesterday = '2020-01-01' // a past date
      store.getState().addTodo('Yesterday task', 'today')
      store.getState().addTodo('Today task', 'today')

      // Manually set the date on the first todo to yesterday (addTodo auto-sets today)
      const state = store.getState()
      const todos = [...state.todos]
      todos[0] = { ...todos[0], date: yesterday }
      // We need a way to inject dated todos. Use direct store replacement for testing.
      // The store's state is mutable via the zustand setter.
      store.setState({ todos })

      // Default: no selectedDate → should show today's tasks only
      store.getState().setCurrentCategory('today')
      store.getState().setSelectedDate(null)
      const todayFiltered = store.getState().getFilteredTodos()
      expect(todayFiltered.every((t) => t.date === todayStr())).toBe(true)

      // Select yesterday → should show yesterday's tasks
      store.getState().setSelectedDate(yesterday)
      const historyFiltered = store.getState().getFilteredTodos()
      expect(historyFiltered).toHaveLength(1)
      expect(historyFiltered[0].title).toBe('Yesterday task')
      expect(historyFiltered[0].date).toBe(yesterday)
    })

    it('getFilteredTodos for "today" without selectedDate returns no tasks from past dates (auto-clear)', () => {
      const yesterday = '2020-01-01'
      store.getState().addTodo('Past task', 'today')
      const state = store.getState()
      const todos = [...state.todos]
      todos[0] = { ...todos[0], date: yesterday }
      store.setState({ todos })

      store.getState().setCurrentCategory('today')
      store.getState().setSelectedDate(null)

      const filtered = store.getState().getFilteredTodos()
      // Past-date "today" tasks should NOT appear in today's view
      expect(filtered.every((t) => t.date === todayStr())).toBe(true)
      expect(filtered.find((t) => t.title === 'Past task')).toBeUndefined()
    })

    it('selectedDate only affects "today" category view', () => {
      store.getState().addTodo('Work task', 'work')
      store.getState().setSelectedDate('2020-01-01')
      store.getState().setCurrentCategory('work')

      // Non-"today" views ignore selectedDate
      const filtered = store.getState().getFilteredTodos()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Work task')
    })
  })

  // =========================================================================
  // Task 9: Realtime sync handlers
  // =========================================================================

  describe('handleRealtimeInsert', () => {
    it('adds a new todo from realtime event', () => {
      const remote = makeTodo({ id: 'r1', title: 'From remote' })
      store.getState().handleRealtimeInsert(remote)
      expect(store.getState().todos).toHaveLength(1)
      expect(store.getState().todos[0].id).toBe('r1')
      expect(store.getState().todos[0].title).toBe('From remote')
    })

    it('does not add duplicate (same id)', () => {
      const remote = makeTodo({ id: 'r1' })
      store.getState().handleRealtimeInsert(remote)
      store.getState().handleRealtimeInsert(remote)
      expect(store.getState().todos).toHaveLength(1)
    })

    it('respects current category filter after insert', () => {
      const remote = makeTodo({ id: 'r1', title: 'Remote task', category: 'work' })
      store.getState().handleRealtimeInsert(remote)
      store.getState().setCurrentCategory('work')
      expect(store.getState().getFilteredTodos()).toHaveLength(1)
    })
  })

  describe('handleRealtimeUpdate', () => {
    it('updates an existing todo from realtime', () => {
      store.getState().addTodo('Local', 'work')
      const id = store.getState().todos[0].id

      store.getState().handleRealtimeUpdate({ id, title: 'Updated from remote', status: 'done' } as Todo)
      const updated = store.getState().todos[0]
      expect(updated.title).toBe('Updated from remote')
      expect(updated.status).toBe('done')
    })

    it('ignores update for non-existent id', () => {
      store.getState().handleRealtimeUpdate({ id: 'unknown', title: 'Ghost' } as Todo)
      expect(store.getState().todos).toHaveLength(0)
    })
  })

  describe('handleRealtimeDelete', () => {
    it('removes a todo identified by id from realtime', () => {
      store.getState().addTodo('To be deleted', 'work')
      const id = store.getState().todos[0].id

      store.getState().handleRealtimeDelete(id)
      expect(store.getState().todos).toHaveLength(0)
    })

    it('does nothing for unknown id', () => {
      store.getState().addTodo('Keep me', 'work')
      store.getState().handleRealtimeDelete('unknown')
      expect(store.getState().todos).toHaveLength(1)
    })
  })

  // =========================================================================
  // Task 27: Multi-select & sync
  // =========================================================================

  describe('syncToToday', () => {
    it('creates a copy with synced_from_id, correct category/date', () => {
      store.getState().addTodo('Source task', 'work')
      const src = store.getState().todos[0]
      const today = todayStr()

      store.getState().syncToToday([src.id])

      const todos = store.getState().todos
      // Should have 2 todos: source + copy
      const copy = todos.find((t) => t.id !== src.id)
      expect(copy).toBeDefined()
      expect(copy!.title).toBe('Source task')
      expect(copy!.synced_from_id).toBe(src.id)
      expect(copy!.category).toBe('today')
      expect(copy!.date).toBe(today)
      expect(copy!.estimated_pomos).toBe(0)
      expect(copy!.completed_pomos).toBe(0)
    })

    it('exits multi-select mode after sync', () => {
      store.getState().addTodo('Task', 'work')
      store.getState().toggleMultiSelectMode()
      expect(store.getState().isMultiSelectMode).toBe(true)

      store.getState().syncToToday([store.getState().todos[0].id])
      expect(store.getState().isMultiSelectMode).toBe(false)
    })
  })

  describe('toggleTodo with sync', () => {
    it('toggling source also toggles synced copy', () => {
      store.getState().addTodo('Source', 'work')
      const src = store.getState().todos[0]
      store.getState().syncToToday([src.id])
      // Find the synced copy
      const copy = store.getState().todos.find((t) => t.synced_from_id === src.id)
      expect(copy).toBeDefined()

      // Toggle source
      store.getState().toggleTodo(src.id)
      const todos = store.getState().todos
      const updatedSrc = todos.find((t) => t.id === src.id)
      const updatedCopy = todos.find((t) => t.synced_from_id === src.id)
      expect(updatedSrc!.status).toBe('done')
      expect(updatedCopy!.status).toBe('done')
    })

    it('toggling synced copy also toggles source', () => {
      store.getState().addTodo('Source', 'work')
      const src = store.getState().todos[0]
      store.getState().syncToToday([src.id])
      const copy = store.getState().todos.find((t) => t.synced_from_id === src.id)
      expect(copy).toBeDefined()

      // Toggle the synced copy
      store.getState().toggleTodo(copy!.id)
      const todos = store.getState().todos
      const updatedSrc = todos.find((t) => t.id === src.id)
      expect(updatedSrc!.status).toBe('done')
    })
  })

  describe('breakExpiredSync', () => {
    it('removes synced_from_id for expired syncs', () => {
      // Create a source with an old date
      store.getState().addTodo('Old source', 'work')
      const src = store.getState().todos[0]

      // Create a synced copy manually with synced_from_id
      const copy = makeTodo({
        title: 'Old source',
        category: 'today',
        date: todayStr(),
        synced_from_id: src.id,
        estimated_pomos: 0,
      })
      store.setState({ todos: [...store.getState().todos, copy] })

      // Set source date to an old date
      const state = store.getState()
      store.setState({
        todos: state.todos.map((t) =>
          t.id === src.id ? { ...t, date: '2020-01-01' } : t,
        ),
      })

      store.getState().breakExpiredSync()

      const todos = store.getState().todos
      const updatedCopy = todos.find((t) => t.id === copy.id)
      expect(updatedCopy!.synced_from_id).toBeUndefined()
    })
  })

  describe('uncompleteTodos', () => {
    it('sets status to pending, only for done todos', () => {
      store.getState().addTodo('Done task', 'work')
      store.getState().addTodo('Pending task', 'work')
      const doneId = store.getState().todos[0].id
      const pendingId = store.getState().todos[1].id
      store.getState().toggleTodo(doneId)

      store.getState().uncompleteTodos([doneId, pendingId])

      const todos = store.getState().todos
      expect(todos.find((t) => t.id === doneId)!.status).toBe('pending')
      expect(todos.find((t) => t.id === pendingId)!.status).toBe('pending')
    })
  })

  describe('moveTodos', () => {
    it('changes category', () => {
      store.getState().addTodo('Task A', 'work')
      store.getState().addTodo('Task B', 'work')
      const ids = store.getState().todos.map((t) => t.id)

      store.getState().moveTodos(ids, 'personal')

      const todos = store.getState().todos
      expect(todos.every((t) => t.category === 'personal')).toBe(true)
    })

    it('exits multi-select mode', () => {
      store.getState().addTodo('Task', 'work')
      store.getState().toggleMultiSelectMode()
      expect(store.getState().isMultiSelectMode).toBe(true)

      store.getState().moveTodos([store.getState().todos[0].id], 'personal')
      expect(store.getState().isMultiSelectMode).toBe(false)
    })
  })

  describe('copyTodos', () => {
    it('creates copies with new ids', () => {
      store.getState().addTodo('Task A', 'work')
      const srcId = store.getState().todos[0].id

      store.getState().copyTodos([srcId], 'personal')

      const todos = store.getState().todos
      // Should have original + 1 copy
      expect(todos).toHaveLength(2)
      const copy = todos.find((t) => t.id !== srcId)
      expect(copy).toBeDefined()
      expect(copy!.title).toBe('Task A')
      expect(copy!.category).toBe('personal')
      expect(copy!.synced_from_id).toBeUndefined()
    })

    it('exits multi-select mode', () => {
      store.getState().addTodo('Task', 'work')
      store.getState().toggleMultiSelectMode()
      expect(store.getState().isMultiSelectMode).toBe(true)

      store.getState().copyTodos([store.getState().todos[0].id], 'personal')
      expect(store.getState().isMultiSelectMode).toBe(false)
    })
  })

  describe('multi-select state', () => {
    it('toggleMultiSelectMode toggles the flag', () => {
      expect(store.getState().isMultiSelectMode).toBe(false)
      store.getState().toggleMultiSelectMode()
      expect(store.getState().isMultiSelectMode).toBe(true)
      store.getState().toggleMultiSelectMode()
      expect(store.getState().isMultiSelectMode).toBe(false)
    })

    it('toggleTodoSelection adds/removes ids', () => {
      expect(store.getState().selectedTodoIds.size).toBe(0)
      store.getState().toggleTodoSelection('id1')
      expect(store.getState().selectedTodoIds.has('id1')).toBe(true)
      store.getState().toggleTodoSelection('id1')
      expect(store.getState().selectedTodoIds.has('id1')).toBe(false)
    })

    it('clearSelection empties the set', () => {
      store.getState().toggleTodoSelection('id1')
      store.getState().toggleTodoSelection('id2')
      store.getState().clearSelection()
      expect(store.getState().selectedTodoIds.size).toBe(0)
    })
  })
})
