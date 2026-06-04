# Tasks

## 阶段一：项目初始化与基础框架

- [x] Task 1: 初始化 Vite + React + TypeScript 项目，配置 Tailwind CSS
  - 使用 `npm create vite@latest . -- --template react-ts` 初始化
  - 安装 Tailwind CSS、PostCSS、Autoprefixer，配置 `tailwind.config.ts`
  - 将附录 B 配色映射写入 CSS 变量和 Tailwind 扩展
  - 配置 `darkMode: 'class'`
  - 安装核心依赖：`react-router-dom`、`zustand`、`@supabase/supabase-js`、`lucide-react`、`recharts`、`@uiw/react-md-editor`、`idb-keyval`
  - 验证：`npm run dev` 启动无报错

- [x] Task 2: 搭建路由框架与全局布局
  - 创建 `App.tsx` 使用 `BrowserRouter` + `Routes`
  - 定义路由：`/`、`/stats`、`/todo`、`/pomodoro`、`/notes`、`/settings`
  - 创建 `Layout` 组件：左侧 `Sidebar` + 右侧 `<Outlet />`
  - 创建各页面占位组件
  - 验证：各路由可正常切换

- [x] Task 3: 实现侧边栏组件
  - 64px 宽固定侧边栏，包含 Logo、5 个导航按钮、暗色切换、设置按钮
  - 当前路由对应按钮高亮（紫色填充 + 白色图标）
  - 使用 `lucide-react` 图标：`layout-dashboard`、`square`、`timer`、`file-text`、`chart-bar`、`sun`/`moon`、`settings`、`zap`
  - 验证：点击导航跳转正确，激活态高亮正确

- [x] Task 4: 实现暗色模式切换
  - 创建 `useThemeStore`（Zustand）：管理 `theme: 'light' | 'dark' | 'system'`
  - 初始化逻辑：读 localStorage → 无则读 prefers-color-scheme → 默认 light
  - `<html>` 标签添加/移除 `dark` class
  - 侧边栏按钮触发切换
  - 验证：手动切换正常，刷新保持，跟随系统正常

## 阶段二：Supabase 集成

- [x] Task 5: 配置 Supabase 项目与数据库
  - 在 Supabase 控制台创建项目
  - 创建数据库表：todos、pomodoro_records、notes、categories、user_settings（含 RLS 策略）
  - user_settings 新增字段：greeting_text、countdown_todo_ids
  - 启用 Email Auth
  - 记录项目 URL 和 anon key

- [x] Task 6: 实现认证页面与 Auth 逻辑
  - 创建 `AuthPage`：登录/注册表单（邮箱 + 密码），切换登录/注册模式
  - 创建 `useAuth` hook：封装 `supabase.auth`，暴露 `user`、`signUp`、`signIn`、`signOut`
  - 保护路由：未登录重定向到 `/auth`
  - 创建 `supabase.ts` 客户端初始化文件
  - 验证：注册 → 登录 → 访问受保护页面 → 登出

## 阶段三：数据层

- [x] Task 7: 定义 TypeScript 类型与 Supabase 操作封装
  - 创建 `types/todo.ts`、`types/pomodoro.ts`、`types/note.ts`
  - 创建 `lib/supabase.ts` 封装 CRUD 操作（按 `user_id` 过滤）
  - 创建 Zustand stores：`useTodoStore`、`usePomodoroStore`、`useNotesStore`、`useStatsStore`
  - Store 从 Supabase 加载数据，修改时同步写入
  - 新增 Todo actions：`changeEstimatedPomos`、`renameCategory`、`deleteCategory`
  - 新增 Stats actions：`setSelectedDate`（时间范围筛选）
  - 验证：Store 数据正确读写

## 阶段四：待办事项页

- [x] Task 8: 实现待办分类系统与输入组件
  - 实现筛选栏：今天、全部、计划中、已完成 + 自定义分类 + 添加分类按钮
  - 今天排第一位，"全部""计划中""已完成"只读时不显示输入框
  - 自定义分类支持新建和选择，支持重命名（双击编辑）、删除（确认对话框）
  - 验证：分类切换正确，新建分类出现在列表末尾

- [x] Task 9: 实现任务列表与交互
  - `TodoItem` 组件：复选框、标题（完成划线动画）、描述（2行溢出省略）、优先级标签（点击轮转）、番茄数
  - 预计番茄数点击轮转：1→2→3→4→5→6→7→8→0→1 循环
  - 不与番茄关联的任务不显示番茄数字（estimated_pomos = 0 时隐藏）
  - `TodoInput` 组件：输入框 + 添加按钮，空输入按钮置灰
  - 查看历史日期时输入框自动隐藏
  - 任务完成/添加动画
  - 验证：添加、完成、优先级切换正常

- [x] Task 10: 实现今天分类特殊逻辑
  - "今天"分类的任务次日自动清空（存带日期的历史）
  - 底部日历按钮：月历视图，日期颜色：无色/绿色/红色
  - 日历月份选择器：点击标题弹出年选择器 + 4×3 月网格，有待办月份显示小圆点
  - 点击历史日期查看当天待办
  - 点击日历外部自动关闭
  - 验证：日历显示正确，历史查看正常

## 阶段五：番茄钟页

- [x] Task 11: 实现番茄钟计时核心逻辑
  - `usePomodoroTimer` hook：状态机 IDLE/RUNNING/PAUSED/FINISHED
  - `requestAnimationFrame` + `Date.now()` 差值补偿计时
  - 暂停/继续/跳过/重置逻辑
  - 验证：计时器运行准确，暂停恢复正确

- [x] Task 12: 实现番茄钟 UI 组件
  - `TimerRing`：SVG 环形进度条，innerRadius 0.78，从 12 点钟方向
  - `ModeSwitch`：工作/短休/长休 3 个按钮切换
  - `PomodoroControls`：跳过（灰色文字）/ 开始暂停（紫色圆形 80px）/ 重置（灰色文字）
  - `TaskLinkCard`：关联任务信息 + 番茄计数 + 展开选择 + 点击外部关闭下拉
  - `TodayStats`：🍅 图标 + 统计文字
  - 验证：UI 与 Pencil 设计稿一致，所有按钮功能正常

- [x] Task 13: 实现番茄完成处理
  - 计时归零 → 播放音效 + 浏览器通知 + 环闪动效
  - 记录 PomodoroRecord 写入 Supabase
  - 关联任务 completedPomos += 1
  - 完成 4 个 work 自动建议长休
  - 验证：完成流程端到端正确

## 阶段六：笔记页

- [x] Task 14: 实现笔记列表与编辑器
  - `NoteSidebar`：300px 列表（标题 + 时间，不含内容预览）+ 搜索框 + 新建按钮
  - `NoteEditor`：集成 @uiw/react-md-editor，标题可编辑，标签栏可添加/删除
  - 自动保存：debounce 1s 写入 Supabase
  - 验证：新建、编辑、搜索、自动保存正常

## 阶段七：仪表盘页

- [x] Task 15: 实现仪表盘卡片组
  - 6 张卡片 Bento Grid 布局（2 列 3 行）
  - 问候卡片：根据时段显示问候语，标题可点击编辑（持久化到 Supabase）
  - 目标倒计时模块（Card 4）：多块可拖拽排序的倒计时方块
  - 今日目标卡片：番茄目标数
  - 待办概览卡片：完成/总数 + 进度条，支持分类筛选（通过设置页配置）
  - 最近笔记：最近 3 条
  - 快捷入口：3 个跳转按钮
  - 无数据时显示引导文案
  - 验证：所有卡片数据正确，快捷跳转正确

## 阶段八：统计页

- [x] Task 16: 实现统计页面
  - `GranularityTabs`：日/周/月/年切换
  - 时间范围筛选：日历选择器（根据粒度自适应日/周/月/年视图）
  - `filterByGranularity` 工具函数：按粒度和参考日期筛选记录
  - `useStatsStore.selectedDate`：时间范围状态管理
  - `SummaryCards`：4 个概览指标卡片，随筛选范围变化
  - `TrendChart`：Recharts 柱状图，X 轴按粒度变化，支持 duration/count 切换
  - `TaskDistribution`：任务列表 + 饼图（Recharts），随筛选范围变化
  - 空数据状态显示 + "返回今天"按钮
  - 验证：粒度切换正常，时间范围筛选正确，图表数据正确

## 阶段九：设置页与收尾

- [x] Task 17: 实现设置页
  - 番茄设置：每日目标、工作时长、短休时长、长休时长、长休间隔
  - 仪表盘设置：待办概览分类筛选（多选复选框 + 今天子筛选）
  - 通知设置：桌面通知开关、音效开关
  - 账户：退出登录按钮
  - 使用滑块或数字输入，即时生效保存
  - 验证：修改设置后番茄钟参数生效

- [x] Task 18: 番茄钟 ↔ 待办联动完善
  - Todo 页 ▶🍅 按钮跳转并关联任务
  - 番茄钟页 TaskLinkCard 展开选择任务
  - 番茄完成更新关联任务计数
  - 验证：端到端联动正确

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 可并行于 Task 3
- Task 6 依赖 Task 5
- Task 7 可并行于 Task 6（类型定义可先行）
- Task 8、11、14 可并行（各自独立页面）
- Task 9 依赖 Task 8
- Task 10 依赖 Task 9
- Task 12 依赖 Task 11
- Task 13 依赖 Task 12
- Task 15 依赖 Task 7（需要 Store 数据）
- Task 16 依赖 Task 7
- Task 18 依赖 Task 9、Task 13
- Task 17 可并行
