# FlowTime TDD 设计方案

> 混合策略：纯函数/简单 Store 用 Red-Green-Refactor，复杂逻辑用 Spec 场景映射

---

## 一、决策汇总

| 决策 | 选择 |
|------|------|
| 测试范围 | 逻辑层（Zustand Store + Custom Hook + 工具函数） |
| Supabase 策略 | 真实测试项目，依赖注入方式注入 Store |
| 执行环境 | 本地优先，CI 可选 |
| TDD 策略 | 混合：纯函数/简单 Store 用方案A，计时器/统计用方案B |

## 二、测试基础设施

### 工具链

- **测试框架**：Vitest（与 Vite 原生集成）
- **组件测试**：@testing-library/react + @testing-library/jest-dom
- **Supabase**：独立测试项目（与生产项目分离）

### 运行命令

```bash
npm test            # 单次运行全部测试
npm run test:watch  # watch 模式（TDD 循环用）
```

### 目录结构

```
src/
├── __tests__/
│   ├── setup.ts                # 全局 setup：jest-dom matchers 注册
│   ├── supabase-auth.test.ts   # Supabase 认证测试
│   ├── supabase-schema.test.ts # Supabase 表结构测试
│   └── stats-filter.test.ts    # 统计时间范围筛选测试
├── utils/
│   ├── time.ts
│   ├── time.test.ts
│   ├── stats.ts
│   └── stats.test.ts
├── stores/
│   ├── useTodoStore.ts
│   ├── useTodoStore.test.ts
│   ├── usePomodoroStore.ts
│   ├── usePomodoroStore.test.ts
│   ├── useNotesStore.ts
│   ├── useNotesStore.test.ts
│   ├── useStatsStore.ts
│   └── useStatsStore.test.ts
└── hooks/
    ├── usePomodoroTimer.ts
    └── usePomodoroTimer.test.ts
```

### Vitest 配置

- `globals: true` — 免去每个文件 import describe/it/expect
- `setupFiles` → `src/__tests__/setup.ts`
- `environment: 'jsdom'`
- `.env.test` 文件配置测试 Supabase 项目凭证

## 三、TDD 工作流

### 方案 A：逐任务 Red-Green-Refactor

适用：`utils/time.ts`、`utils/stats.ts`、`useTodoStore`、`useNotesStore`

```
1. 写测试 → Red（测试失败，功能不存在）
2. 实现最小代码 → Green（测试通过）
3. 补充边缘 case → Green
4. 重构 → 测试仍绿
5. 下一个 action → 循环
```

### 方案 B：Spec 场景映射

适用：`usePomodoroTimer`、`usePomodoroStore`、`useStatsStore`

```
1. 从 spec.md 提取所有 WHEN/THEN Scenario → 写 describe/it 骨架
2. 全部 Red
3. 逐个实现场景 → 逐批 Green
```

`usePomodoroTimer` 测试骨架（9 个 Scenario）：

```
describe('usePomodoroTimer', () => {
  describe('计时运行',   () => { /* 环形进度 + 倒计时 + requestAnimationFrame 精度 */ })
  describe('计时完成',   () => { /* 音效 + 通知 + 闪动效 + 记录 PomodoroRecord + completedPomos+1 */ })
  describe('暂停/继续',  () => { /* 暂停暂停计时 + 继续从暂停位置 */ })
  describe('跳过',       () => { /* 记录 interrupted 状态，不计入任务统计 */ })
  describe('重置',       () => { /* 回到初始值，状态 IDLE */ })
  describe('模式切换',   () => { /* 重置为对应时长 + 模式标签高亮 */ })
  describe('关联任务',   () => { /* 下拉选择 + 自由专注 + 点击外部关闭 */ })
  describe('今日统计',   () => { /* 番茄图标数 + 总专注时长 */ })
})
```

`useStatsStore` 测试骨架（新增时间范围筛选场景）：

```
describe('useStatsStore', () => {
  describe('粒度切换',       () => { /* 日/周/月/年 */ })
  describe('时间范围筛选',   () => { /* selectedDate + filterByGranularity */ })
  describe('概览指标',       () => { /* 4 指标随粒度和日期变化 */ })
  describe('趋势数据',       () => { /* duration/count 切换 */ })
  describe('任务分布',       () => { /* Top 5 + 其他，随筛选范围变化 */ })
  describe('loadRecords',    () => { /* 从 Supabase 加载 */ })
})
```

### 不纳入 TDD

| 对象 | 原因 |
|------|------|
| React 组件 | 视觉布局为主，不在逻辑层 TDD 范围内 |
| Recharts 图表 | 第三方库，测试价值低 |
| Tailwind CSS 样式 | 纯视觉 |

## 四、Supabase 测试集成

### 测试项目配置

- 独立 Supabase 项目，表结构与生产一致
- 表：todos、pomodoro_records、notes、user_settings
- RLS 策略开启，按 user_id 隔离

### 客户端注入

```typescript
// src/__tests__/supabase-test.ts
import { createClient } from '@supabase/supabase-js'

export const testSupabase = createClient(
  import.meta.env.VITE_SUPABASE_TEST_URL,
  import.meta.env.VITE_SUPABASE_TEST_ANON_KEY
)
```

Store 使用工厂函数模式，接受 Supabase 客户端作为参数：

```typescript
// stores/useTodoStore.ts
export const createTodoStore = (supabase: SupabaseClient) =>
  create<TodoState>((set, get) => ({ /* ... */ }))
```

### 测试数据隔离

```
beforeEach → 创建测试用户
afterEach  → DELETE WHERE user_id = testUserId
```

## 五、TDD 执行顺序

| 步骤 | 内容 | TDD 对象 | 策略 |
|------|------|----------|------|
| 1 | 工具函数 | `time.test.ts` | 方案 A |
| 2 | 工具函数 | `stats.test.ts` | 方案 A |
| 3 | Todo Store | `useTodoStore.test.ts` | 方案 A |
| 4 | Notes Store | `useNotesStore.test.ts` | 方案 A |
| 5 | Pomodoro Store | `usePomodoroStore.test.ts` | 方案 B |
| 6 | Pomodoro Timer Hook | `usePomodoroTimer.test.ts` | 方案 B |
| 7 | Stats Store | `useStatsStore.test.ts` | 方案 B |

## 六、验收标准

- [ ] `npm test` 命令可运行，输出全部通过
- [ ] 每个 Store 的 action 至少有一个测试
- [ ] usePomodoroTimer 的 9 个 Scenario 全部有对应测试（含点击外部关闭下拉）
- [ ] useStatsStore 的时间范围筛选（filterByGranularity）有完整测试覆盖
- [ ] stats-filter.test.ts：统计页粒度 + 日历选择器的核心逻辑测试通过
- [ ] usePomodoroStore 的番茄完成/跳过/任务关联有对应测试
- [ ] useTodoStore 的 changeEstimatedPomos、renameCategory、deleteCategory 有测试
- [ ] 测试使用真实 Supabase 测试项目，afterEach 清理数据
