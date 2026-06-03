/**
 * TDD: Store 接入 Supabase 集成测试
 *
 * RED phase: Store ↔ Supabase 集成测试
 * Stores 目前是本地状态，Supabase 持久化测试预期失败
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const configured = Boolean(supabaseUrl && supabaseAnonKey)

// 固定测试用户（已通过 MCP 确认 email）
const TEST_EMAIL = 'tdd-test@flowtime.test'
const TEST_PASSWORD = 'test123456'

let supabase: SupabaseClient
let userId: string
let authReady = false

// ============================================================
// Setup
// ============================================================

async function ensureTestUser(): Promise<boolean> {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })

  // 1. 先尝试登录
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })

  if (signInData?.user) {
    userId = signInData.user.id
    return true
  }

  // 2. 如果用户不存在，尝试注册
  if (signInError?.message?.includes('Invalid login')) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (signUpError) {
      console.warn('SignUp failed:', signUpError.message)
      return false
    }
    if (signUpData.session) {
      userId = signUpData.user!.id
      return true
    }
    console.warn('Email confirmation required — run MCP: UPDATE auth.users SET email_confirmed_at=now() WHERE email=\'' + TEST_EMAIL + '\'')
    return false
  }

  console.warn('Auth error:', signInError?.message)
  return false
}

async function cleanupAll() {
  if (!userId) return
  await supabase.from('pomodoro_records').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('todos').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('notes').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('user_settings').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  await supabase.auth.signOut()
}

// ============================================================
// Part A: Supabase 原始 CRUD
// ============================================================

describe('Supabase 原始 CRUD', () => {
  beforeAll(async () => {
    if (!configured) return
    authReady = await ensureTestUser()
  }, 20000)

  afterAll(async () => {
    if (!configured || !authReady) return
    await cleanupAll()
  })

  it('todos: INSERT → SELECT → UPDATE → DELETE', async () => {
    if (!configured || !authReady) return

    const { data: todo, error: e1 } = await supabase
      .from('todos')
      .insert({ title: 'CRUD Test', category: 'test', priority: 'high' })
      .select()
      .single()
    expect(e1).toBeNull()
    expect(todo.title).toBe('CRUD Test')

    const { data: f } = await supabase.from('todos').select().eq('id', todo.id).single()
    expect(f.status).toBe('pending')

    await supabase.from('todos').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', todo.id)
    const { data: u } = await supabase.from('todos').select().eq('id', todo.id).single()
    expect(u.status).toBe('done')

    await supabase.from('todos').delete().eq('id', todo.id)
    const { data: d } = await supabase.from('todos').select().eq('id', todo.id)
    expect(d).toHaveLength(0)
  })

  it('pomodoro_records: INSERT', async () => {
    if (!configured || !authReady) return
    const { data, error } = await supabase
      .from('pomodoro_records')
      .insert({
        mode: 'work', duration: 1500, actual_duration: 1450, status: 'completed',
        started_at: new Date(Date.now() - 1500000).toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select().single()
    expect(error).toBeNull()
    expect(data.user_id).toBe(userId)
  })

  it('notes: INSERT + UPDATE tags', async () => {
    if (!configured || !authReady) return
    const { data } = await supabase
      .from('notes')
      .insert({ title: 'N1', content: '# C', tags: ['a', 'b'] })
      .select().single()
    expect(data!.tags).toEqual(['a', 'b'])

    await supabase.from('notes').update({ title: 'N2', tags: ['c'], updated_at: new Date().toISOString() }).eq('id', data!.id)
    const { data: r } = await supabase.from('notes').select().eq('id', data!.id).single()
    expect(r.title).toBe('N2')
    expect(r.tags).toEqual(['c'])
  })

  it('user_settings: INSERT + UNIQUE constraint', async () => {
    if (!configured || !authReady) return
    const { data, error } = await supabase
      .from('user_settings')
      .insert({ daily_goal: 10 })
      .select().single()
    expect(error).toBeNull()
    expect(data.daily_goal).toBe(10)

    const { error: dup } = await supabase.from('user_settings').insert({ daily_goal: 5 })
    expect(dup).not.toBeNull()
  })
})

// ============================================================
// Part B: Store ↔ Supabase（RED — 预期失败）
// ============================================================

let createTodoStore: any
let createPomodoroStore: any
let createNotesStore: any

describe('Store ↔ Supabase', () => {
  beforeAll(async () => {
    if (!configured) return
    authReady = await ensureTestUser()
    const todoMod = await import('../stores/useTodoStore')
    const pomoMod = await import('../stores/usePomodoroStore')
    const notesMod = await import('../stores/useNotesStore')
    createTodoStore = todoMod.createTodoStore
    createPomodoroStore = pomoMod.createPomodoroStore
    createNotesStore = notesMod.createNotesStore
  }, 20000)

  afterAll(async () => {
    if (!configured || !authReady) return
    await cleanupAll()
  })

  it('addTodo — Supabase 中有新记录', async () => {
    if (!configured || !authReady) return

    const store = createTodoStore(supabase)
    const state = store.getState()
    const result = state.addTodo('Store Todo', 'store-test')
    if (result instanceof Promise) await result
    await new Promise((r) => setTimeout(r, 500))

    const { data } = await supabase.from('todos').select('*').eq('title', 'Store Todo')
    expect(data).toBeDefined()
    expect(data!.length).toBeGreaterThanOrEqual(1)  // RED: store 不写 Supabase
  })

  it('toggleTodo — Supabase 状态更新', async () => {
    if (!configured || !authReady) return

    // 先通过 store addTodo（写入本地 + Supabase），再 toggle
    const store = createTodoStore(supabase)
    store.getState().addTodo('Toggle Me', 'store-test')
    await new Promise((r) => setTimeout(r, 800))

    const todo = store.getState().todos.find((t: any) => t.title === 'Toggle Me')
    if (!todo) return

    store.getState().toggleTodo(todo.id)
    await new Promise((r) => setTimeout(r, 500))

    const { data: updated } = await supabase.from('todos').select().eq('id', todo.id).single()
    expect(updated.status).toBe('done')
  })

  it('deleteTodo — Supabase 记录删除', async () => {
    if (!configured || !authReady) return

    const { data: todo } = await supabase
      .from('todos').insert({ title: 'Delete Me', category: 'store-test' }).select().single()

    const store = createTodoStore(supabase)
    const result = store.getState().deleteTodo(todo.id)
    if (result instanceof Promise) await result
    await new Promise((r) => setTimeout(r, 500))

    const { data } = await supabase.from('todos').select().eq('id', todo.id)
    expect(data).toHaveLength(0)  // RED: store delete 不删 Supabase
  })

  it('番茄完成 → record 写入 Supabase', async () => {
    if (!configured || !authReady) return

    const store = createPomodoroStore(supabase)
    store.getState().start()
    store.getState().tick(25 * 60)
    // 等待异步 Supabase 写入完成
    await new Promise((r) => setTimeout(r, 1500))

    const { data } = await supabase.from('pomodoro_records').select('*').eq('user_id', userId)
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })

  // ---- Load methods (mount 行为) ----
  it('loadTodos — 从 Supabase 加载数据填充 store', async () => {
    if (!configured || !authReady) return

    // 直接插入数据到 Supabase
    await supabase.from('todos').insert({ title: 'Pre-existing Todo', category: 'work' })

    const store = createTodoStore(supabase)
    await store.getState().loadTodos()

    const todos = store.getState().todos
    expect(todos.some((t: any) => t.title === 'Pre-existing Todo')).toBe(true)
  })

  it('loadRecords — 从 Supabase 加载番茄记录', async () => {
    if (!configured || !authReady) return

    await supabase.from('pomodoro_records').insert({
      mode: 'work', duration: 1500, actual_duration: 1400, status: 'completed',
      started_at: new Date(Date.now() - 1500000).toISOString(),
      completed_at: new Date().toISOString(),
    })

    const store = createPomodoroStore(supabase)
    await store.getState().loadRecords()

    expect(store.getState().records.length).toBeGreaterThanOrEqual(1)
  })

  it('loadNotes — 从 Supabase 加载笔记', async () => {
    if (!configured || !authReady) return

    await supabase.from('notes').insert({ title: 'Existing Note', content: 'content' })

    const store = createNotesStore(supabase)
    await store.getState().loadNotes()

    expect(store.getState().notes.some((n: any) => n.title === 'Existing Note')).toBe(true)
  })

  it('addNote + updateNote → Supabase 持久化', async () => {
    if (!configured || !authReady) return

    const store = createNotesStore(supabase)
    const state = store.getState()
    const r1 = state.addNote()
    if (r1 instanceof Promise) await r1

    const note = state.getCurrentNote()
    if (!note) return

    const r2 = state.updateNote(note.id, { title: 'Store Note', content: '# Hello' })
    if (r2 instanceof Promise) await r2
    await new Promise((r) => setTimeout(r, 500))

    const { data } = await supabase.from('notes').select('*').eq('user_id', userId)
    expect(data!.length).toBeGreaterThanOrEqual(1)  // RED
  })
})
