# FlowTime App Spec

## Why
构建一款 Web 端三合一效率工具（待办 + 番茄钟 + 笔记），支持跨设备同步，替代多工具切换的低效工作流。

## What Changes
- 新增完整的 FlowTime 应用：5 个页面 + 侧边栏导航 + 暗色模式 + Supabase 后端
- **BREAKING**: 无（全新项目）

## Impact
- Affected specs: 无（新项目）
- Affected code: 全新项目，Vite + React + TypeScript + Tailwind CSS

---

## ADDED Requirements

### Requirement: 左侧导航栏
系统 SHALL 提供 64px 宽的固定左侧导航栏，包含 Logo（zap 图标）、5 个导航按钮（仪表盘/待办/番茄钟/笔记/统计）、暗色模式切换按钮、设置按钮。

#### Scenario: 导航激活态
- **WHEN** 用户点击某一导航按钮
- **THEN** 该按钮变为紫色填充 + 白色图标，其余按钮为灰色图标透明背景
- **AND** 页面切换到对应路由

#### Scenario: 当前页面高亮
- **WHEN** 用户通过 URL 直接访问某页面
- **THEN** 对应导航按钮自动高亮

---

### Requirement: 暗色模式
系统 SHALL 支持明亮/暗色模式切换，使用 Tailwind CSS `darkMode: 'class'` 策略，配色映射见附录 B。

#### Scenario: 手动切换
- **WHEN** 用户点击侧边栏底部太阳/月亮图标
- **THEN** 页面即时切换暗色模式，localStorage 记录偏好

#### Scenario: 自动跟随系统
- **WHEN** 用户未手动设置过主题
- **THEN** 系统跟随 `prefers-color-scheme` 自动选择

---

### Requirement: 用户认证（Supabase）
系统 SHALL 集成 Supabase Auth 提供用户认证，支持邮箱注册/登录和 Google/GitHub 第三方登录。所有数据按 `user_id` 隔离。

#### Scenario: 首次使用
- **WHEN** 用户首次打开应用
- **THEN** 显示登录/注册页面
- **AND** 认证后进入仪表盘

#### Scenario: 跨设备同步
- **WHEN** 用户使用同一账号在不同设备登录
- **THEN** 数据自动同步（通过 Supabase Realtime）

---

### Requirement: 仪表盘首页
系统 SHALL 在首页以 Bento Grid 布局展示 6 张卡片：问候卡片、今日番茄目标、待办概览、番茄钟环形图、最近笔记、快捷入口。

#### Scenario: 快捷跳转
- **WHEN** 用户点击"开始专注"
- **THEN** 跳转到 `/pomodoro`
- **WHEN** 用户点击"新建待办"
- **THEN** 跳转到 `/todo` 并聚焦输入框
- **WHEN** 用户点击"写笔记"
- **THEN** 跳转到 `/notes` 并打开新建

#### Scenario: 无数据状态
- **WHEN** 用户尚无任何待办和番茄记录
- **THEN** 显示引导文案"暂无数据，开始你的第一个番茄吧！"

---

### Requirement: 待办事项
系统 SHALL 提供完整的待办管理功能，包含自定义分类体系。

#### 分类体系
| 标签 | 类型 | 说明 |
|------|------|------|
| 今天 | 特殊分类 | 每日清空，手动添加，有日历回溯查看历史，排第一位 |
| 全部 | 只读视图 | 汇总所有自定义分类的全部任务，不含今天 |
| 计划中 | 只读视图 | 汇总所有自定义分类中未完成的任务，不含今天 |
| 已完成 | 只读视图 | 汇总所有自定义分类中已完成的任务，不含今天 |
| 自定义分类 | 可编辑 | 用户创建，一个任务只属一个分类 |

#### Scenario: 添加任务
- **WHEN** 用户在当前选中分类中输入标题并按 Enter 或点击添加按钮
- **THEN** 新任务出现在列表中，优先级默认中
- **AND** 若为自定义分类且关联番茄钟，默认预计番茄数 1

#### Scenario: 今天分类特殊行为
- **WHEN** 用户在"今天"分类中添加任务
- **THEN** 任务不显示番茄数（今天任务不与番茄关联）
- **AND** 次日自动清空
- **WHEN** 用户点击今天底部的日历按钮
- **THEN** 显示月历视图，不同日期根据当天待办状态显示颜色：无色（无待办）、绿色（全部完成）、红色（有未完成）
- **AND** 点击某日期可查看该日历史待办

#### Scenario: 任务完成
- **WHEN** 用户勾选任务复选框
- **THEN** 标题显示划线动画（0.3s ease-out），状态变为 done

#### Scenario: 优先级切换
- **WHEN** 用户点击任务优先级标签
- **THEN** 在高/中/低三个值间轮转切换

#### Scenario: 番茄关联
- **WHEN** 用户点击任务的 ▶🍅 按钮
- **THEN** 跳转到 `/pomodoro` 并自动关联该任务
- **AND** 任务显示预计番茄数和已完成番茄数
- **WHEN** 任务不关联番茄钟
- **THEN** 不显示番茄相关数字

#### Scenario: 筛选分类
- **WHEN** 用户选择不同分类标签
- **THEN** 任务列表切换到对应分类
- **AND** "全部""计划中""已完成"为只读视图，不显示输入框

#### Scenario: 自定义分类管理
- **WHEN** 用户点击筛选栏末尾的 "+" 按钮
- **THEN** 弹出输入框创建新分类
- **AND** 新分类出现在筛选栏末尾

#### Scenario: 空列表
- **WHEN** 当前分类下无任务
- **THEN** 显示"还没有任务，添加第一个吧！"

---

### Requirement: 番茄钟计时器
系统 SHALL 提供番茄钟计时功能，支持工作/短休/长休三种模式，使用 SVG 环形进度条展示。

#### 常量
- 工作：25 分钟（可自定义）
- 短休：5 分钟（可自定义）
- 长休：15 分钟（可自定义）
- 每完成 4 个工作番茄自动建议长休（间隔可自定义）

#### Scenario: 计时运行
- **WHEN** 用户点击开始按钮
- **THEN** 环形进度从 12 点钟方向顺时针收缩，中央显示 MM:SS 倒计时
- **AND** 使用 `requestAnimationFrame` + `Date.now()` 差值补偿确保精度

#### Scenario: 计时完成
- **WHEN** 计时器归零
- **THEN** 播放音效 + 浏览器通知 + 环闪动效
- **AND** 自动记录 PomodoroRecord（status: completed）
- **AND** 若关联任务，任务 completedPomos += 1

#### Scenario: 暂停/继续
- **WHEN** 计时运行中用户点击暂停
- **THEN** 计时暂停，按钮变为播放图标
- **WHEN** 再次点击
- **THEN** 从暂停位置继续计时

#### Scenario: 跳过
- **WHEN** 用户点击跳过按钮
- **THEN** 记录 PomodoroRecord（status: interrupted），不计入任务统计

#### Scenario: 重置
- **WHEN** 用户点击重置按钮
- **THEN** 计时器回到初始值，状态变为 IDLE

#### Scenario: 模式切换
- **WHEN** 用户点击模式切换按钮
- **THEN** 计时器重置为对应时长，模式标签高亮

#### Scenario: 关联任务
- **WHEN** 用户点击底部任务卡片
- **THEN** 展开下拉列表，可从 pending 任务中选择关联
- **AND** 支持选择"自由专注"取消关联
- **WHEN** 无关联任务
- **THEN** 卡片显示"无关联任务 — 自由专注"

#### Scenario: 今日统计
- **WHEN** 用户在番茄钟页面
- **THEN** 底部显示今日已完成番茄数（🍅 图标）和总专注时长

---

### Requirement: 笔记管理
系统 SHALL 提供双栏笔记管理：左侧 300px 笔记列表，右侧 Markdown 编辑器。

#### Scenario: 笔记列表
- **WHEN** 用户打开笔记页
- **THEN** 左侧显示所有笔记列表，默认选中第一条
- **AND** 支持搜索框实时过滤（标题模糊匹配）

#### Scenario: 新建笔记
- **WHEN** 用户点击底部"+ 新建笔记"按钮
- **THEN** 列表新增空笔记项，编辑器切换到新建笔记

#### Scenario: 编辑笔记
- **WHEN** 用户在编辑器中输入
- **THEN** 自动保存（debounce 1s 后写入 Supabase）
- **AND** 标题支持编辑（24px 字体）
- **AND** 标签栏支持添加/删除标签胶囊

#### Scenario: 搜索无结果
- **WHEN** 搜索关键词无匹配
- **THEN** 显示"没有找到匹配的笔记"

#### Scenario: 空状态
- **WHEN** 用户尚无笔记
- **THEN** 显示"还没有笔记，写点什么吧！"

---

### Requirement: 统计详情
系统 SHALL 提供数据统计页面，支持日/周/月/年粒度切换，展示概览指标、趋势图和任务分布。

#### Scenario: 粒度切换
- **WHEN** 用户点击粒度切换按钮
- **THEN** 选中按钮高亮，所有图表同步切换到对应粒度
- **AND** 默认选中"周"

#### Scenario: 概览卡片
- **WHEN** 用户查看统计页
- **THEN** 显示 4 个等宽卡片：总专注时长（分钟）、完成番茄数、日均番茄数、完成率

#### Scenario: 趋势图
- **WHEN** 用户查看趋势图
- **THEN** 柱状图展示专注时长趋势
- **AND** 周粒度 X 轴为周一~周日
- **AND** 日粒度 X 轴为 24 小时
- **AND** 月粒度 X 轴为 4-5 周
- **AND** 年粒度 X 轴为 12 月

#### Scenario: 任务分布
- **WHEN** 用户查看任务分布
- **THEN** 左侧显示任务名称 + 色标 + 百分比，右侧显示饼图/环形图
- **AND** 显示 Top 5 任务，其余归入"其他"

#### Scenario: 空数据
- **WHEN** 选定时间范围内无数据
- **THEN** 显示"暂无专注记录""暂无任务关联数据"

---

### Requirement: 设置页
系统 SHALL 提供设置页面，支持配置番茄钟参数和通知偏好。

#### Scenario: 番茄设置
- **WHEN** 用户打开设置
- **THEN** 可修改：每日番茄目标数（默认 8）、工作时长（默认 25min）、短休时长（默认 5min）、长休时长（默认 15min）、长休触发间隔（默认 4）
- **AND** 修改即时生效并保存到 Supabase

#### Scenario: 通知设置
- **WHEN** 用户打开设置
- **THEN** 可开关：浏览器桌面通知、音效提醒
- **AND** 修改即时生效

---

### Requirement: 数据持久化（Supabase）
系统 SHALL 以 Supabase 作为后端，所有数据按 `user_id` 隔离，支持 Realtime 跨设备同步。

#### 数据库表
- **todos**: id, user_id, title, description, status, priority, category, estimated_pomos, completed_pomos, created_at, completed_at
- **pomodoro_records**: id, user_id, mode, task_id, duration, actual_duration, status, started_at, completed_at
- **notes**: id, user_id, title, content, tags, created_at, updated_at
- **user_settings**: id, user_id, daily_goal, work_duration, short_break_duration, long_break_duration, long_break_interval, sound_enabled, notification_enabled

#### Scenario: 离线降级
- **WHEN** 网络不可用
- **THEN** 数据暂存本地 IndexedDB，恢复网络后自动同步

---

## MODIFIED Requirements
无（全新项目）

## REMOVED Requirements
无（全新项目）

---

## 附录 A：技术栈
| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| 路由 | React Router v6 |
| 图表 | Recharts |
| 图标 | Lucide React |
| 编辑器 | @uiw/react-md-editor |
| 后端 | Supabase (PostgreSQL + Auth + Realtime) |
| 构建 | Vite |

## 附录 B：配色映射
| 语义 | Light | Dark |
|------|-------|------|
| 背景 | `#FAFAFE` | `#0F172A` |
| 卡片 | `#FFFFFF` | `#1E293B` |
| 主文字 | `#1E1B4B` | `#F1F5F9` |
| 次文字 | `#7C7AA8` | `#94A3B8` |
| 主色 | `#8B5CF6` | `#A78BFA` |
| 强调色 | `#F59E0B` | `#FBBF24` |
| 边框 | `#E4E2F4` | `#334155` |
