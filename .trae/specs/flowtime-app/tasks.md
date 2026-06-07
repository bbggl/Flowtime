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

## 阶段十：UX 改进与细节优化

- [x] Task 19: 笔记加载修复与删除确认
  - 修复 `loadNotes()` 覆盖 currentNoteId 导致仪表盘点击笔记跳转后自动切换回第一条的 bug
  - 笔记删除添加确认弹窗组件
  - 验证：仪表盘点击笔记跳转正常，删除确认弹窗正常

- [x] Task 20: 倒计时功能增强
  - 添加倒计时选择器打开时自动刷新待办列表，解决新加待办不同步问题
  - 过去日期倒计时显示负数（如 -3），颜色自动变灰
  - 已完成待办的倒计时方块右下角显示绿色 ✓ 图标
  - 仅左上角拖拽手柄可拖动排序
  - 点击倒计时方块跳转到 `/todo` 并定位到对应日期
  - 移除倒计时添加确认弹窗
  - 验证：倒计时同步正常，交互符合预期

- [x] Task 21: 待办删除确认与倒计时联动
  - 待办删除添加确认弹窗
  - 绑定倒计时的待办删除时特殊提示"该待办已绑定倒计时，删除后将同时移除倒计时"
  - 确认删除时同步从 Supabase `user_settings.countdown_todo_ids` 移除
  - 绑定倒计时的待办显示 🕐 时钟按钮（主色调常显），点击跳转仪表盘
  - 验证：删除确认弹窗正常，倒计时联动正确

- [x] Task 22: 番茄钟数量选择器改进
  - 替换预计番茄数循环点击（1→2→…→8→0→1）为数字滚轮选择器（0-99）
  - 数字列表在按钮下方展开，隐藏滚动条但支持鼠标滚轮
  - 点击外部区域关闭列表
  - 新建待办默认预计番茄数从 1 改为 0
  - 验证：选择器交互正常，默认值正确

- [x] Task 23: 通用组件
  - 创建 `ConfirmDialog` 通用确认弹窗组件（支持标题、消息、确认/取消按钮、危险/普通样式）
  - 创建 `.scrollbar-hide` CSS 工具类（隐藏滚动条保留滚轮功能）
  - 验证：组件复用正常，样式正确

## 阶段十一：功能增强（TDD）

- [x] Task 24: 侧边栏展开功能
  - [x] Task 24.1: TDD — `useThemeStore` 扩展 `sidebarExpanded` 状态，写测试：默认收起、切换展开/收起、localStorage 持久化
  - [x] Task 24.2: 实现 Sidebar 展开/收起按钮（ChevronLeft/ChevronRight 图标）+ 展开态布局（约180px 宽，图标+文字标题）
  - 验证：`npm test` 测试通过，手动切换/刷新保持正常

- [x] Task 25: 统计页日均专注时长
  - [x] Task 25.1: TDD — 写工具函数 `getDailyAvgFocus(records, days)` 测试：空记录 → 0、有记录计算正确
  - [x] Task 25.2: Stats 页面添加"日均专注时长"卡片（在"总专注时长"后），格式 X小时X分钟
  - 验证：`npm test` 测试通过，UI 显示正确

- [x] Task 26: 设置页增强
  - [x] Task 26.1: TDD — `usePomodoroStore` 扩展 `day_start_hour` + `auto_start_break` 字段，写测试：默认值、setter、localStorage 持久化
  - [x] Task 26.2: Settings 页面添加"今日切换时间点"滑块（0:00~7:00）和"专注结束后自动开始休息"开关
  - [x] Task 26.3: 更新 `user_settings` Supabase 表结构（新增 `day_start_hour`、`auto_start_break` 字段）
  - 验证：`npm test` 测试通过，设置修改即时生效，刷新保持

- [x] Task 27: 待办多选与同步
  - [x] Task 27.1: TDD — `Todo` 类型扩展 `synced_from_id` 字段，写 useTodoStore 测试：
    - `syncToToday(ids)`：批量创建关联副本到"今天"
    - `toggleSynced()`：切换完成状态时同步更新关联副本/源待办
    - `breakSync()`：置空所有过期 `synced_from_id`
    - `uncompleteTodos(ids)`：批量取消完成
    - `moveTodos(ids, category)`：批量移动分类
    - `copyTodos(ids, category)`：批量复制到分类
  - [x] Task 27.2: TDD — 写 `isNewDay(hour)` 工具函数测试：按 day_start_hour 判断是否新的一天
  - [x] Task 27.3: 实现多选模式 UI：右上角"多选"按钮、待办边缘高亮（ring-2 ring-primary）选中效果、底部操作栏
  - [x] Task 27.4: 实现操作栏：同步到今天、取消完成、移动/复制到分类选择
  - [x] Task 27.5: 实现次日自动断连逻辑（应用启动时 + 定时检查）
  - [x] Task 27.6: 更新 Supabase `todos` 表结构（新增 `synced_from_id` 字段）
  - 验证：`npm test` 测试通过，多选交互正常，同步/断连逻辑正确

- [x] Task 28: 番茄钟按钮合并
  - [x] Task 28.1: TDD — `usePomodoroStore` 扩展测试：
    - 长休息确认后切换模式到 long_break
    - 长休息结束后自动切回 short_break 时长
    - `auto_start_break` 开启时专注结束后自动开始休息
  - [x] Task 28.2: Pomodoro 页面：移除长休息按钮，合并为"专注 | 休息"两按钮，休息按钮默认显示短休息时长
  - [x] Task 28.3: 实现长休息提醒确认对话框 → 确认后自动切换到长休息 → 结束后切回短休息时长
  - [x] Task 28.4: 实现 `auto_start_break` 逻辑：专注计时完成 → 自动进入休息模式
  - 验证：`npm test` 测试通过，按钮切换正确，长休息流程正常

- [x] Task 29: 点击计时数字修改预设时长
  - [x] Task 29.1: TDD — `usePomodoroStore` 扩展 `setDuration(mode, minutes)` 测试：
    - 设置各模式时长
    - 同步更新 Supabase `user_settings`
    - 运行时修改不影响 `remainingSeconds`
  - [x] Task 29.2: Pomodoro 页面：计时数字可点击，弹出分钟选择器（风格与番茄数选择器一致）
  - 验证：`npm test` 测试通过，修改时长同步到设置页

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
- Task 24 无依赖，可先行
- Task 25 依赖 Task 16（Stats 页面已存在），可并行于 Task 24
- Task 26 依赖 Task 7（Store 已存在），可并行于 Task 24、25
- Task 27 依赖 Task 26.1（day_start_hour）和 Task 26.3（数据库字段）
- Task 28 依赖 Task 26.2（auto_start_break 设置）和 Task 26.3（数据库字段）
- Task 29 可并行于 Task 28（共享 Pomodoro 页面但独立功能）
