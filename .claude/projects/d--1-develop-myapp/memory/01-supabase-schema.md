---
name: supabase-schema-4-tables-rls
description: Supabase 4 tables + RLS created, 18 schema tests passing
metadata:
  type: project
---

## Supabase 建表完成 (#1)

Supabase 项目: `https://sdbyuiizqdnluplmgmts.supabase.co`

### 已创建 4 张表:

| 表 | 说明 | 关键约束 |
|---|------|---------|
| `todos` | 待办事项 | status CHECK (pending/done), priority CHECK (high/medium/low) |
| `pomodoro_records` | 番茄钟记录 | mode CHECK (work/short_break/long_break), status CHECK (completed/interrupted), task_id FK → todos.id ON DELETE SET NULL |
| `notes` | 笔记 | tags text[] default '{}' |
| `user_settings` | 用户设置 | user_id UNIQUE, 每用户一行 |

### RLS: 每表 4 条 Policy (SELECT/INSERT/UPDATE/DELETE)，全部 `auth.uid() = user_id`

### 测试: `src/__tests__/supabase-schema.test.ts` — 18 tests 全部通过

### .env 配置: URL + anon key 已写入 `.env` 和 `.env.test`

**Why:** 这是待办清单 #1 项，是所有后续 Supabase 集成的基础。
**How to apply:** 后续任务 #2 (Store 接入 Supabase) 和 #4 (认证联调) 都依赖这些表。
