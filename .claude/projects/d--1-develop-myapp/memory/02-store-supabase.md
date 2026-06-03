---
name: store-supabase-integration
description: Stores now sync to Supabase, 150 tests passing
metadata:
  type: project
---

## Store 接入 Supabase 完成 (#2)

### 改造内容

**`lib/supabase.ts`**: Properly typed `SupabaseClient` export, keep dummy fallback for dev.

**3 个 store 全部改造**（pattern 一致）:

1. **`useTodoStore`** — `addTodo/toggleTodo/changePriority/deleteTodo` 全部在乐观本地更新后异步写 Supabase；新增 `loadTodos()` 从 Supabase 加载
2. **`usePomodoroStore`** — `tick()` 和 `skip()` 完成时将 record 写入 `pomodoro_records`；work 模式完成时同步更新关联 task 的 `completed_pomos`；新增 `loadRecords()`
3. **`useNotesStore`** — `addNote/updateNote/deleteNote` 同步写 Supabase；新增 `loadNotes()`

### 架构决策

- **isRealSupabase guard**: `typeof supabase?.from === 'function'` — 当传入 mock 对象时跳过 Supabase 调用，保证现有单元测试不依赖真实 Supabase
- **乐观更新**: 本地状态立即更新，Supabase 写入 fire-and-forget
- **ID 替换**: `addTodo/addNote` 插入成功后用 Supabase 返回的 UUID 替换本地临时 ID

### 测试

- **10 test files, 150 tests all passing**
- 新增 `src/__tests__/supabase-stores.test.ts` — 9 个集成测试（含认证用户 CRUD）
- 修复了 mock `insert` 支持单对象参数、`update` 正确过滤 eq

**Why:** 待办清单 #2 项，Store 层从纯本地状态变为 Supabase 持久化。
**How to apply:** #3 (组件 mount 时 load) 需要调用 `store.loadTodos()` / `store.loadRecords()` / `store.loadNotes()`。
