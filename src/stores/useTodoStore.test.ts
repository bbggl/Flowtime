import { describe, it, expect, beforeEach } from 'vitest'
import { createTodoStore } from './useTodoStore'
import type { Todo } from '../types'

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
    insert: (rows: unknown[]) => {
      for (const row of rows) {
        tables[table].push({ ...(row as object), id: (row as Todo).id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) })
      }
      return { select: () => ({ single: () => Promise.resolve({ data: rows[0], error: null }) }) }
    },
    update: (updates: unknown) => ({
      eq: (_col: string, _val: string) => {
        for (const row of tables[table]) {
          Object.assign(row, updates as object)
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

describe('useTodoStore', () => {
  let store: ReturnType<typeof createTodoStore>

  beforeEach(() => {
    store = createTodoStore(createMockSupabase())
  })

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

    it('sets estimated_pomos to 0 for "today" category', () => {
      store.getState().addTodo('Today task', 'today')
      expect(store.getState().todos[0].estimated_pomos).toBe(0)
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
})
