# FlowTime 规格文档（SDD）

> Specification-Driven Development · 基于 Pencil 视觉设计稿生成

---

## 一、项目概述

### 1.1 产品定义

**FlowTime** 是一款 Web 端三合一效率工具，整合 **待办事项管理**、**番茄钟计时**、**Markdown 笔记** 三大核心功能，并通过 **统计仪表盘**（支持日/周/月/年粒度）提供数据分析。

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 样式方案 | Tailwind CSS |
| 状态管理 | Zustand（轻量状态管理） |
| 本地持久化 | IndexedDB（via `idb-keyval`） |
| 路由 | React Router v6 |
| 图表 | Recharts（柱状图、饼图） |
| 图标 | Lucide React |
| 构建工具 | Vite |

### 1.3 设计风格

- **混合风格**：Flat Design 极简基调 + Bento Grid 模块化卡片布局
- **配色方案 E**：主色 `#8B5CF6`（紫罗兰）· 强调色 `#F59E0B`（琥珀）
- **暗色模式**：支持自动（跟随系统）/ 手动切换
- **导航**：左侧 64px 图标侧边栏，5 个导航项

### 1.4 设计参考

Pencil 视觉设计文件：`d:/1/develop/myapp/pencil-new.pen`

包含 5 个完整页面：
- **Dashboard**（n11Gj）：仪表盘首页，Bento Grid 卡片布局
- **Stats**（SBWiL）：统计详情页，含粒度切换 + 趋势图 + 任务分布
- **Todo**（IQn4A）：待办事项页，含筛选 + 任务列表
- **Pomodoro**（F3u51）：番茄钟页，含环形计时器 + 模式切换 + 任务关联
- **Notes**（sip4w）：笔记页，双栏布局（列表 + 编辑器）

---

## 二、系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                    App (BrowserRouter)                    │
│  ┌──────────┬──────────────────────────────────────────┐ │
│  │ Sidebar  │            <Outlet />                     │ │
│  │  64px    │  ┌────────────────────────────────────┐  │ │
│  │  fixed   │  │         Page Content               │  │ │
│  │          │  │  Dashboard / Stats / Todo /        │  │ │
│  │          │  │  Pomodoro / Notes                  │  │ │
│  │          │  └────────────────────────────────────┘  │ │
│  └──────────┴──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2.2 路由设计

| 路径 | 页面 | 组件 |
|------|------|------|
| `/` | 仪表盘首页 | `DashboardPage` |
| `/stats` | 统计详情 | `StatsPage` |
| `/todo` | 待办事项 | `TodoPage` |
| `/pomodoro` | 番茄钟 | `PomodoroPage` |
| `/notes` | 笔记 | `NotesPage` |
| `/notes/:id` | 笔记详情 | `NotesPage`（含选中项） |

### 2.3 目录结构

```
src/
├── main.tsx                    # 入口
├── App.tsx                     # 根组件（路由 + 布局）
├── index.css                   # Tailwind 入口
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # 左侧导航栏
│   │   └── ThemeToggle.tsx     # 暗色模式切换
│   ├── dashboard/
│   │   ├── GreetingCard.tsx    # 问候卡片
│   │   ├── TaskOverviewCard.tsx
│   │   ├── PomodoroRingCard.tsx
│   │   ├── DailyGoalCard.tsx
│   │   └── RecentNotesCard.tsx
│   ├── stats/
│   │   ├── GranularityTabs.tsx     # 日/周/月/年 切换
│   │   ├── SummaryCards.tsx        # 概览指标卡片组
│   │   ├── TrendChart.tsx          # 柱状趋势图
│   │   ├── TaskDistribution.tsx   # 任务专注分布图
│   │   └── TaskCompletionCard.tsx # 任务完成情况
│   ├── todo/
│   │   ├── TodoInput.tsx           # 输入框 + 添加按钮
│   │   ├── TodoFilter.tsx          # 筛选栏
│   │   ├── TodoItem.tsx            # 单个任务行
│   │   └── TodoList.tsx            # 任务列表
│   ├── pomodoro/
│   │   ├── TimerRing.tsx           # SVG 环形进度
│   │   ├── ModeSwitch.tsx          # 工作/短休/长休 切换
│   │   ├── PomodoroControls.tsx    # 控制按钮组
│   │   ├── TaskLinkCard.tsx        # 关联任务卡片
│   │   └── TodayStats.tsx          # 今日番茄统计
│   ├── notes/
│   │   ├── NoteSidebar.tsx         # 笔记列表侧边栏
│   │   ├── NoteListItem.tsx        # 单个笔记项
│   │   ├── NoteEditor.tsx          # 内容编辑器
│   │   └── NoteTagBar.tsx          # 标签栏
│   └── shared/
│       ├── Card.tsx                # 通用卡片容器
│       ├── Modal.tsx               # 通用模态框
│       └── EmptyState.tsx          # 空状态展示
├── stores/
│   ├── useThemeStore.ts          # 主题状态
│   ├── useTodoStore.ts           # 待办状态
│   ├── usePomodoroStore.ts       # 番茄钟状态
│   ├── useNotesStore.ts          # 笔记状态
│   └── useStatsStore.ts          # 统计状态（派生）
├── hooks/
│   ├── usePomodoroTimer.ts       # 番茄钟计时逻辑
│   ├── useLocalStorage.ts        # 本地存储封装
│   └── useTheme.ts               # 主题切换逻辑
├── types/
│   ├── todo.ts                   # Todo 类型
│   ├── pomodoro.ts               # Pomodoro 类型
│   ├── note.ts                   # Note 类型
│   └── stats.ts                  # Stats 类型
└── utils/
    ├── time.ts                   # 时间格式化
    ├── stats.ts                  # 统计计算
    └── constants.ts              # 常量定义
```

---

## 三、数据模型

### 3.1 Todo（待办事项）

```typescript
interface Todo {
  id: string;                    // UUID
  title: string;                 // 标题（必填）
  description?: string;          // 描述（可选）
  status: 'pending' | 'done';    // 状态
  priority: 'high' | 'medium' | 'low';  // 优先级
  tags: string[];                // 标签
  estimatedPomos: number;        // 预计番茄数
  completedPomos: number;        // 已完成番茄数
  noteId?: string;               // 关联笔记 ID
  createdAt: number;             // 创建时间戳
  completedAt?: number;          // 完成时间戳
}
```

### 3.2 PomodoroRecord（番茄钟记录）

```typescript
type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

interface PomodoroRecord {
  id: string;                    // UUID
  mode: PomodoroMode;            // 模式
  taskId?: string;               // 关联任务 ID（可选）
  duration: number;              // 设定时长（秒）
  actualDuration: number;        // 实际完成时长（秒）
  status: 'completed' | 'interrupted' | 'abandoned';
  startedAt: number;             // 开始时间戳
  completedAt: number;           // 完成时间戳
}
```

### 3.3 Note（笔记）

```typescript
interface Note {
  id: string;                    // UUID
  title: string;                 // 标题
  content: string;               // Markdown 内容
  tags: string[];                // 标签
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
}
```

### 3.4 常量定义

```typescript
// 番茄钟时长（秒）
const POMODORO_DURATIONS = {
  work: 25 * 60,         // 1500s
  shortBreak: 5 * 60,    // 300s
  longBreak: 15 * 60,   // 900s
};

// 长休触发条件：每完成 4 个 work 后自动切换为 longBreak
const LONG_BREAK_INTERVAL = 4;

// 统计粒度
type Granularity = 'day' | 'week' | 'month' | 'year';

// 主题模式
type ThemeMode = 'light' | 'dark' | 'system';
```

---

## 四、页面功能规格

### 4.1 仪表盘（`/`）

**布局**：左侧 64px Sidebar + 右侧 Bento Grid（3行卡片）

#### 卡片内容

| 位置 | 卡片 | 内容 |
|------|------|------|
| Row1-Left | **问候卡片** | 根据时段显示问候语（早安/下午好/晚上好）+ 日期 |
| Row1-Right | **今日目标** | 今日计划完成番茄数，支持修改 |
| Row2-Left | **待办概览** | 今日待完成 / 已完成 数量 + 进度条 |
| Row2-Right | **番茄钟环形图** | 今日已完成番茄数 / 目标数，环形进度 |
| Row3-Left | **最近笔记** | 最近 3 条笔记标题 + 时间 |
| Row3-Right | **快捷入口** | 开始专注 / 新建待办 / 写笔记 快捷按钮 |

#### 交互

- 点击 **"开始专注"** 按钮 → 跳转 `/pomodoro`
- 点击 **"新建待办"** 按钮 → 跳转 `/todo` 并聚焦输入框
- 点击 **"写笔记"** 按钮 → 跳转 `/notes` 并打开新建
- 点击番茄钟环形图 → 跳转 `/stats`
- 待办数量实时更新

#### 边缘情况

- **无数据**：待办和番茄显示 "暂无数据，开始你的第一个番茄吧！" 引导文案
- **全部完成**：待办进度条显示 100% 并变色
- **未设置目标**：使用默认值 8

---

### 4.2 统计详情（`/stats`）

**布局**：左侧 64px Sidebar + 右侧内容区

#### 4.2.1 粒度切换器

- 位于页面右上角，5 个切换按钮：**日** / **周** / **月** / **年**
- 当前选中项高亮（主色填充），带滑动指示器动效
- 切换粒度时，下方所有卡片数据同步更新
- 默认选中 **周**

#### 4.2.2 概览卡片组（4 个等宽卡片）

| 卡片 | 指标 |
|------|------|
| 总专注时长 | 选中时间范围内的总分钟数 |
| 完成番茄数 | 选中范围内的 completed 数量 |
| 日均番茄数 | 平均值（保留 1 位小数） |
| 完成率 | 完成番茄数 / 启动番茄数 × 100% |

#### 4.2.3 专注时长趋势图

- 使用 Recharts 柱状图
- X 轴：根据粒度显示（日→24小时、周→7天、月→4-5周、年→12月）
- Y 轴：专注时长（分钟）
- 柱子颜色：使用主色 `#8B5CF6`
- Hover 显示具体数值
- **空状态**：无数据时显示 "暂无专注记录"

#### 4.2.4 任务专注分布

- **左侧**：任务名称列表 + 色标 + 百分比标签
- **右侧**：Recharts 饼图 / 环形图，不同任务用不同颜色区分
- 颜色轮换使用预定义调色板
- 显示 Top 5 任务，其余归入 "其他"
- **空状态**：无关联任务时显示 "暂无任务关联数据"

#### 4.2.5 任务完成情况

- 表格列表：任务名 | 预计番茄 | 已完成 | 状态
- 状态用徽章显示：进行中（琥珀）/ 已完成（绿）/ 未开始（灰）
- 支持滚动查看更多

#### 交互

- 切换粒度 → 所有图表重新渲染，带淡入动画
- 饼图区域 Hover → 高亮对应扇区

#### 边缘情况

- 跨天/周/月时区处理
- 粒度切换时数据为空的渐变显示

---

### 4.3 待办事项（`/todo`）

**布局**：左侧 64px Sidebar + 右侧内容区

#### 4.3.1 输入区域

- 输入框 placeholder：`添加新任务...`
- 右侧紫色按钮（"添加" 或 "+"）
- 支持 Enter 键快捷添加
- 添加后输入框自动清空
- **空输入时按钮置灰不可点击**

#### 4.3.2 筛选栏

4 个标签按钮：
- **全部**：显示所有任务
- **今天**：今天创建的 pending 任务
- **计划中**：pending 的任务
- **已完成**：已勾选的任务

默认选中 **全部**。

#### 4.3.3 任务列表

每个任务项包含：
- **复选框**：点击切换完成状态（勾选 → 划线动画 → status: 'done'）
- **标题**：`font-weight: 600`，完成时划线 + 降低不透明度
- **描述**：`font-size: 13`，灰色文字，最多显示 2 行，溢出省略号
- **标签**：彩色圆点 + 优先级文字（高/橙 · 中/紫 · 低/灰）
- **番茄计数**：`已完成番茄数 / 预计番茄数`（紫色文字）
- **关联笔记图标**：如有关联显示 📝 图标
- **开始番茄按钮 ▶🍅**：点击跳转 `/pomodoro` 并自动关联该任务

列表用分割线分隔各任务项。

#### 4.3.4 动画

- **勾选动画**：标题划线 0.3s ease-out
- **删除动画**：向右滑出 0.3s + 高度收缩 0.3s
- **添加动画**：新任务从上方滑入 0.3s

#### 交互

- 勾选任务 → 动画划线 + 更新统计
- 点击 ▶🍅 → 跳转番茄钟并关联任务
- 点击任务标题区 → 展开/折叠描述详情
- 右滑或长按 → 删除确认

#### 边缘情况

- **空列表**："还没有任务，添加第一个吧！" + 插画
- **筛选为空**："该分类下暂无任务"
- **大量任务**：列表区域可滚动，输入框和筛选栏固定

---

### 4.4 番茄钟（`/pomodoro`）

**布局**：左侧 64px Sidebar + 右侧垂直居中布局

#### 4.4.1 环形计时器

- **外层圆环**：`#E4E2F4`（border 色），`innerRadius: 0.78`
- **进度环**：`#8B5CF6`（主色），从 12 点钟方向顺时针收缩
- **中央数字**：`MM:SS` 格式，大号字体 64px，`font-weight: 700`
- 定时器使用 `requestAnimationFrame` 精确计时
- 定时器结束后自动播放音效提醒

#### 4.4.2 模式切换

3 个按钮：
- **工作 25min**（默认选中，紫色填充）
- **短休 5min**（紫色文字）
- **长休 15min**（紫色文字）

选中态：紫色填充 + 白色文字；未选中：透明 + 灰色文字。
切换模式时重置计时器。

#### 4.4.3 控制按钮

水平排列：
- **跳过**（灰色文字，13px）→ 跳过当前番茄，记录为 interrupted
- **开始/暂停**（紫色圆形 80×80，白色 Play 图标）→ 切换运行/暂停状态
- **重置**（灰色文字，13px）→ 重置当前计时器

#### 4.4.4 关联任务卡片

底部显示，500px 宽，水平排列：
- **任务信息**：标签 "当前任务" + 任务标题 + 提示 "可选关联任务"
- **番茄计数**：已完成的番茄数（大号紫色文字）
- **展开箭头**：点击展开 Todo 选择列表

#### 4.4.5 今日统计

- 番茄图标 🍅 × N 个（每个代表一个完成的番茄）
- 文字：`今日已完成 {n} 个番茄  总专注 {h}h {m}min`

#### 状态机

```
States: IDLE → RUNNING → PAUSED → (resume) → RUNNING
                              → (reset) → IDLE
                              → (skip) → IDLE
        RUNNING → (timer ends) → FINISHED → (next) → IDLE
```

#### 交互

- 点击关联任务卡 → 展开任务选择面板（下拉）
- 完成一个番茄 → 自动记录 + 关联任务 completedPomos++
- 完成 4 个 work → 自动切换到 longBreak

#### 边缘情况

- **浏览器后台标签页**：使用实际时间差计算，非递增计数器
- **电脑休眠/待机**：使用 `Date.now()` 差值补偿
- **无关联任务时**：任务卡显示 "无关联任务 — 自由专注"
- **快速切换**：防抖保护，500ms 内重复点击无效

---

### 4.5 笔记（`/notes`）

**布局**：左侧 64px Sidebar + 双栏（左列表 300px + 右编辑器 flex）

#### 4.5.1 笔记列表（左栏）

- **搜索框**：带 🔍 图标，"搜索笔记..." placeholder
- **笔记列表**：每项显示标题 + 时间 + 标签缩略
- **当前选中项**：标题紫色高亮
- **新建按钮**：底部固定，紫色填充，"+ 新建笔记"
- 列表项之间用分割线分隔
- 支持搜索过滤（标题模糊匹配）

#### 4.5.2 编辑器（右栏）

- **标题**：大号字体 24px，可编辑
- **标签栏**：水平排列的标签胶囊，可添加/删除
- **内容区**：Markdown 编辑器（可使用 `react-simplemde-editor` 或 `@uiw/react-md-editor`）
- 自动保存（debounce 1s 后存入 IndexedDB）

#### 交互

- 点击列表项 → 切换编辑器内容
- 新建笔记 → 清空编辑器，列表新增项
- 搜索 → 过滤列表，实时更新
- 编辑 → 自动保存

#### 边缘情况

- **空状态**（无笔记）："还没有笔记，写点什么吧！" + 引导
- **空编辑器**：标题显示 "无标题"，内容区 Placeholder "开始编写..."
- **搜索无结果**："没有找到匹配的笔记"

---

### 4.6 侧边栏（全局共享）

**尺寸**：64px 宽，100vh 高

**从上到下排列**：
1. **Logo 图标**：⚡（zap），48px 高度，紫色
2. **导航按钮 ×5**（48×48 圆角卡片）：
   - 📊 仪表盘 → `/`
   - ✅ 待办 → `/todo`
   - ⏱️ 番茄钟 → `/pomodoro`
   - 📄 笔记 → `/notes`
   - 📈 统计 → `/stats`
3. **弹性空白区域**（fill_container）
4. **暗色模式切换**：☀️ 太阳图标 → 点击切换暗/亮
5. **设置按钮**：⚙️ 齿轮图标

**交互状态**：
- 当前激活项：紫色填充 + 白色图标
- 非激活项：灰色图标 + 透明背景
- Hover：背景色微变

---

## 五、暗色模式

### 5.1 实现方式

- Tailwind CSS `darkMode: 'class'` 策略
- `<html>` 标签添加/移除 `dark` class
- 使用 CSS 自定义属性作为双向数据绑定

### 5.2 配色映射

| 语义 | Light | Dark |
|------|-------|------|
| 背景 | `#FAFAFE` | `#0F172A` |
| 卡片/表面 | `#FFFFFF` | `#1E293B` |
| 主文字 | `#1E1B4B` | `#F1F5F9` |
| 次文字 | `#7C7AA8` | `#94A3B8` |
| 主色 | `#8B5CF6` | `#A78BFA` |
| 强调色 | `#F59E0B` | `#FBBF24` |
| 边框 | `#E4E2F4` | `#334155` |

### 5.3 切换逻辑

1. 默认读取 `localStorage.getItem('theme')`
2. 若无存储，读取 `window.matchMedia('(prefers-color-scheme: dark)')`
3. 用户点击切换 → 更新 `localStorage` + 即时切换 DOM class

---

## 六、番茄钟 ↔ 待办联动设计

### 6.1 联动规则

番茄钟与待办为 **可选关联**，非强制：

1. **从 Todo 页触发**：
   - 点击任务项的 ▶🍅 按钮
   - 跳转到 `/pomodoro` 页面
   - 自动将该任务设置为关联任务

2. **在番茄钟页关联**：
   - 点击底部任务卡片 → 展开下拉列表
   - 从 pending 状态的任务中选择
   - 支持 "自由专注" 选项（取消关联）

3. **番茄完成时**：
   - 若有关联任务 → `task.completedPomos += 1`
   - 若 `completedPomos >= estimatedPomos` → 任务标记为完成的候选

4. **番茄中断/跳过**：
   - 创建 PomodoroRecord（status: 'interrupted'）
   - 不计入任务统计

---

## 七、数据持久化方案

### 7.1 存储引擎

使用 **IndexedDB**（封装 `idb-keyval`）：
- 为每个数据类型创建独立 Store
- 提供 React Hook 封装 `useIndexedDB<T>(key: string)`

### 7.2 数据键值

| Key | Type | 说明 |
|-----|------|------|
| `todos` | `Todo[]` | 所有待办事项 |
| `pomodoroRecords` | `PomodoroRecord[]` | 所有番茄钟记录 |
| `notes` | `Note[]` | 所有笔记 |
| `settings` | `Settings` | 用户设置（目标数、主题等） |

### 7.3 数据迁移

- 版本号存储在 `settings.version`
- 启动时检查版本，执行必要的数据迁移逻辑

---

## 八、测试策略

### 8.1 单元测试（Vitest）

- 工具函数测试：`utils/time.ts`、`utils/stats.ts`
- Store 逻辑测试：各 Zustand Store 的 action/reducer
- Hook 测试：`usePomodoroTimer` 计时逻辑

### 8.2 组件测试（React Testing Library）

- TodoItem 勾选/删除交互
- PomodoroControls 状态切换
- GranularityTabs 粒度切换
- NoteEditor 输入/保存

### 8.3 E2E 测试（Playwright，可选）

- 完整用户流程：添加 Todo → 启动番茄 → 完成 → 查看统计
- 暗色模式切换
- 多页面导航

---

## 九、实施计划

### 阶段一：基础框架搭建

| 步骤 | 内容 | 产出 |
|------|------|------|
| 1 | 初始化 Vite + React + TS 项目 | 项目骨架 |
| 2 | 配置 Tailwind CSS + 设计 Token | `tailwind.config.ts` |
| 3 | 配置 React Router + 路由框架 | `App.tsx` 路由定义 |
| 4 | 实现 Sidebar + 布局组件 | `Sidebar.tsx`, 全局 Layout |
| 5 | 实现暗色模式切换 | `useThemeStore`, `ThemeToggle` |

### 阶段二：数据层

| 步骤 | 内容 | 产出 |
|------|------|------|
| 6 | 定义所有 TypeScript 类型 | `types/*.ts` |
| 7 | 实现 IndexedDB 封装 | `hooks/useIndexedDB.ts` |
| 8 | 实现 TodoStore | `stores/useTodoStore.ts` |
| 9 | 实现 PomodoroStore | `stores/usePomodoroStore.ts` |
| 10 | 实现 NotesStore | `stores/useNotesStore.ts` |
| 11 | 实现 Stats 派生逻辑 | `stores/useStatsStore.ts` |

### 阶段三：页面实现

| 步骤 | 内容 | 产出 |
|------|------|------|
| 12 | Dashboard 仪表盘页 | `DashboardPage` + 6 个子卡片 |
| 13 | Todo 待办页 | `TodoPage` + 子组件 |
| 14 | Pomodoro 番茄钟页 | `PomodoroPage` + 计时 Hook |
| 15 | Notes 笔记页 | `NotesPage` + 编辑器 |
| 16 | Stats 统计页 | `StatsPage` + 图表组件 |

### 阶段四：联动与优化

| 步骤 | 内容 | 产出 |
|------|------|------|
| 17 | 番茄钟 ↔ 待办联动 | 跨页面状态同步 |
| 18 | 动画实现 | 划掉、滑出、淡入 |
| 19 | 音效提醒 | 番茄完成音效 |
| 20 | 测试 | 单元 + 组件测试 |

---

## 十、非功能需求

### 10.1 性能

- 首屏加载 < 2s（Vite 构建）
- 计时器使用 `requestAnimationFrame`，不阻塞 UI
- 图表组件懒加载（`React.lazy`）

### 10.2 可访问性

- 按钮提供 `aria-label`
- 颜色对比度满足 WCAG AA
- 支持键盘导航（Tab / Enter / Escape）

### 10.3 浏览器兼容

- 支持 Chrome、Firefox、Edge 最新两个版本
- 不支持 IE

---

## 附录 A：Pencil 页面 → 组件映射

| Pencil Frame | 页面 | 关键节点 |
|--------------|------|----------|
| `n11Gj` | Dashboard | Sidebar, Greeting, BentoGrid (3 rows) |
| `SBWiL` | Stats | GranularityTabs, SummaryRow (4 cards), TrendChart, DistributionSection (TaskDistCard + TaskCompCard) |
| `IQn4A` | Todo | InputRow, FilterBar (4 filters), TaskList (5 items) |
| `F3u51` | Pomodoro | TimerRingOuter (320px ring), ModeRow (3 modes), ControlRow, TaskLinkCard, TodayStats |
| `sip4w` | Notes | NotesListPane (300px), EditorPane |

## 附录 B：Pencil 变量 → CSS 自定义属性

```css
:root {
  --color-bg: #FAFAFE;
  --color-surface: #FFFFFF;
  --color-text: #1E1B4B;
  --color-text-secondary: #7C7AA8;
  --color-primary: #8B5CF6;
  --color-accent: #F59E0B;
  --color-border: #E4E2F4;
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --sidebar-width: 64px;
}

.dark {
  --color-bg: #0F172A;
  --color-surface: #1E293B;
  --color-text: #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-primary: #A78BFA;
  --color-accent: #FBBF24;
  --color-border: #334155;
}
```
