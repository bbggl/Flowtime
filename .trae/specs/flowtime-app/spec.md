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

#### Scenario: 编辑首页标题
- **WHEN** 用户点击仪表盘问候标题
- **THEN** 标题变为可编辑输入框，支持 Enter 保存、Escape 取消、blur 保存
- **AND** 自定义标题持久化到 Supabase `user_settings.greeting_text`，并用 localStorage 做离线缓存
- **WHEN** 鼠标悬停在标题上
- **THEN** 显示铅笔编辑图标（Pencil）

#### Scenario: 目标倒计时
- **WHEN** 用户查看仪表盘
- **THEN** Card 4 显示"目标倒计时"模块，包含可添加多个倒计时方块
- **AND** 每块显示关联待办标题 + 距离天数 + 颜色（优先级 + 剩余天数决定透明度：≤3天100%、≤7天80%、≤14天60%、≤30天40%、>30天25%）
- **AND** 高优先级橙色、中优先级紫色、低优先级灰色
- **AND** 过去日期显示负数（如 -3），颜色自动变灰
- **AND** 已完成待办在右下角显示绿色 ✓ 图标
- **AND** 仅左上角拖拽手柄（6 点图标）可拖动排序
- **AND** 鼠标悬停显示拖拽手柄和移除按钮（X）
- **AND** 移除按钮点击弹出确认弹窗"确定要从倒计时中移除吗？注意：只会移除倒计时，不会删除该待办事项"
- **AND** 点击加号弹出日历选择器，打开时自动刷新待办列表
- **AND** 点击倒计时方块跳转到 `/todo` 并定位到对应日期
- **AND** 倒计时数据持久化到 Supabase `user_settings.countdown_todo_ids` + localStorage

#### Scenario: 待办概览分类筛选
- **WHEN** 用户在设置页勾选/取消仪表盘分类
- **THEN** 仪表盘待办概览卡片仅显示所选分类的待办
- **AND** 今天分类附加子筛选：今天的待办、未来的待办、过去的待办（可单独开关）
- **AND** 设置默认全选，保存到 localStorage `flowtime-dashboard-categories`

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
- **AND** 默认预计番茄数为 0（不显示番茄数字）

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

#### Scenario: 重命名分类
- **WHEN** 用户双击自定义分类名称
- **THEN** 分类名变为可编辑输入框，Enter 确认、Escape 取消
- **AND** 重命名后所有属于该分类的待办同步更新
- **AND** 分类名称持久化到 Supabase `categories` 和 `todos` 表

#### Scenario: 删除分类
- **WHEN** 用户点击自定义分类旁的删除按钮
- **THEN** 弹出确认对话框"确定要删除分类及其所有待办吗？"
- **AND** 确认后删除分类和所有属于该分类的待办
- **AND** 若当前正在查看被删除的分类，自动切回"今天"

#### Scenario: 预计番茄数选择器
- **WHEN** 用户点击关联番茄任务的番茄数
- **THEN** 弹出数字滚轮列表（0-99），当前值高亮
- **AND** 点击数字即选中并关闭列表
- **AND** 点击外部区域关闭列表
- **AND** 列表在按钮下方展开，隐藏滚动条但支持鼠标滚轮滚动
- **AND** 当 estimated_pomos 为 0 时，番茄数不显示

#### Scenario: 倒计时关联按钮
- **WHEN** 待办已绑定倒计时
- **THEN** 该待办显示 🕐 时钟图标按钮（主色调常显）
- **AND** 点击跳转到仪表盘 `/` 查看倒计时

#### Scenario: 删除待办确认
- **WHEN** 用户点击待办删除按钮
- **THEN** 弹出确认弹窗"确定要删除待办吗？此操作不可恢复"
- **AND** 若该待办已绑定倒计时，弹窗提示"该待办已绑定倒计时，删除后将同时移除倒计时"，按钮文字变为"确认删除（含倒计时）"
- **AND** 确认后删除待办，同时从倒计时列表中移除

#### Scenario: 选择月份跳转
- **WHEN** 用户点击"今天"底部日历标题
- **THEN** 弹出年选择器 + 月网格（4×3），支持年份前后翻页
- **AND** 有待办的月份显示小圆点标记

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
- **WHEN** 点击卡片外部区域
- **THEN** 下拉列表自动关闭
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
- **THEN** 左侧显示所有笔记列表（标题 + 时间），默认选中第一条
- **AND** 支持搜索框实时过滤（标题模糊匹配）

#### Scenario: 新建笔记
- **WHEN** 用户点击底部"+ 新建笔记"按钮
- **THEN** 列表新增空笔记项，编辑器切换到新建笔记

#### Scenario: 编辑笔记
- **WHEN** 用户在编辑器中输入
- **THEN** 自动保存（debounce 1s 后写入 Supabase）
- **AND** 标题支持编辑（24px 字体）
- **AND** 标签栏支持添加/删除标签胶囊

#### Scenario: 删除笔记确认
- **WHEN** 用户点击笔记列表中的删除按钮
- **THEN** 弹出确认弹窗"确定要删除笔记吗？删除后不可恢复"
- **AND** 确认后删除笔记

#### Scenario: 搜索无结果
- **WHEN** 搜索关键词无匹配
- **THEN** 显示"没有找到匹配的笔记"

#### Scenario: 空状态
- **WHEN** 用户尚无笔记
- **THEN** 显示"还没有笔记，写点什么吧！"

---

### Requirement: 统计详情
系统 SHALL 提供数据统计页面，支持日/周/月/年粒度切换和时间范围筛选，展示概览指标、趋势图和任务分布。

#### Scenario: 粒度切换
- **WHEN** 用户点击粒度切换按钮
- **THEN** 选中按钮高亮，所有图表同步切换到对应粒度
- **AND** 默认选中"周"

#### Scenario: 时间范围筛选
- **WHEN** 用户点击标题栏右侧日历图标按钮
- **THEN** 弹出日历选择器，UI 根据当前粒度自适应：
  - 日粒度：标准月历网格，点击选择具体日期
  - 周粒度：月历按行分组为周，点击选中整周
  - 月粒度：4×3 月份网格，点击选中整月
  - 年粒度：3×3 年份网格（显示当年±4年），点击选中整年
- **AND** 选中后弹窗关闭，所有统计数据重新计算为该时间范围的数据
- **AND** 按钮旁显示当前选中时间范围的格式化标签（如"6/4", "5/26 - 6/1", "2026年6月", "2026年"）
- **AND** 点击外部区域关闭弹窗

#### Scenario: 返回今天
- **WHEN** 用户已选择一个历史时间范围
- **THEN** 日历按钮旁显示"返回今天"链接
- **AND** 点击后恢复为当前时间范围（selectedDate = null）

#### Scenario: 概览卡片
- **WHEN** 用户查看统计页
- **THEN** 显示 4 个等宽卡片：总专注时长（分钟）、完成番茄数、日均番茄数、完成率
- **AND** 所有指标仅在选定时间范围内计算

#### Scenario: 趋势图
- **WHEN** 用户查看趋势图
- **THEN** 柱状图展示专注时长趋势（支持 duration/count 切换）
- **AND** 周粒度 X 轴为周一~周日
- **AND** 日粒度 X 轴为 24 小时
- **AND** 月粒度 X 轴为 4-5 周
- **AND** 年粒度 X 轴为 12 月

#### Scenario: 任务分布
- **WHEN** 用户查看任务分布
- **THEN** 左侧显示任务名称 + 色标 + 百分比，右侧显示饼图/环形图
- **AND** 显示 Top 5 任务，其余归入"其他"
- **AND** 仅在选定时间范围内的记录中计算

#### Scenario: 空数据
- **WHEN** 选定时间范围内无数据
- **THEN** 显示"暂无专注记录""暂无任务关联数据"

---

### Requirement: 设置页
系统 SHALL 提供设置页面，支持配置番茄钟参数、仪表盘筛选偏好和通知偏好，以及退出登录。

#### Scenario: 番茄设置
- **WHEN** 用户打开设置
- **THEN** 可修改：每日番茄目标数（默认 8）、工作时长（默认 25min）、短休时长（默认 5min）、长休时长（默认 15min）、长休触发间隔（默认 4）
- **AND** 修改即时生效并保存到 Supabase

#### Scenario: 仪表盘设置
- **WHEN** 用户打开设置 → 仪表盘设置区域
- **THEN** 显示所有可筛选的分类复选框（今天 + 自定义分类）
- **AND** 勾选/取消立即生效，持久化到 localStorage `flowtime-dashboard-categories`
- **AND** 今天分类下方展开子筛选：今天的待办、未来的待办、过去的待办
- **AND** 子筛选仅在"今天"分类被勾选时显示

#### Scenario: 通知设置
- **WHEN** 用户打开设置
- **THEN** 可开关：浏览器桌面通知、音效提醒
- **AND** 修改即时生效

#### Scenario: 退出登录
- **WHEN** 用户点击设置页面底部"退出登录"按钮
- **THEN** 调用 `signOut()` 清除认证状态
- **AND** 跳转到 `/auth` 登录页

---

### Requirement: 数据持久化（Supabase）
系统 SHALL 以 Supabase 作为后端，所有数据按 `user_id` 隔离，支持 Realtime 跨设备同步。

#### 数据库表
- **todos**: id, user_id, title, description, status, priority, category, date, estimated_pomos, completed_pomos, sort_order, synced_from_id, created_at, completed_at
- **pomodoro_records**: id, user_id, mode, task_id, duration, actual_duration, status, started_at, completed_at
- **notes**: id, user_id, title, content, tags, created_at, updated_at
- **categories**: id, user_id, name, type, created_at
- **user_settings**: id, user_id, daily_goal, work_duration, short_break_duration, long_break_duration, long_break_interval, sound_enabled, notification_enabled, greeting_text, countdown_todo_ids, day_start_hour, auto_start_break

#### Scenario: 离线降级
- **WHEN** 网络不可用
- **THEN** 数据暂存本地 IndexedDB，恢复网络后自动同步

---

---

### Requirement: 待办多选与同步
系统 SHALL 在非"今天"分类的待办页面右上角提供多选按钮，支持批量同步到今天、取消完成、移动/复制到其他分类。

#### 数据模型
`Todo` 类型新增 `synced_from_id?: string` 字段，指向源待办 ID，标识当前是关联副本。

#### Scenario: 多选模式入口
- **WHEN** 用户在非"今天"分类页面
- **THEN** 右上角显示"多选"按钮
- **WHEN** 用户点击多选按钮
- **THEN** 进入多选模式，每个待办出现可选勾选框，底部出现操作栏
- **AND** 选中的待办边缘高亮（ring-2 ring-primary）

#### Scenario: 退出多选模式
- **WHEN** 用户再次点击右上角按钮或点击取消
- **THEN** 退出多选模式，所有选中状态清除

#### Scenario: 同步到今天
- **WHEN** 用户选中待办并点击"同步到今天"
- **THEN** 在"今天"分类下创建关联副本，`synced_from_id` 指向原待办，`category='today'`
- **AND** 原分类下的待办保留不变

#### Scenario: 关联副本状态同步
- **WHEN** 关联副本的完成状态发生变化
- **THEN** 对应的源待办同步更新完成状态，反之亦然

#### Scenario: 次日断开同步
- **WHEN** 系统时间到达"日期切换时间点"（由设置 `day_start_hour` 决定）
- **THEN** 所有 `category='today'` 且 `synced_from_id` 不为空的待办的 `synced_from_id` 被置空
- **AND** 关联副本和源待办各自独立

#### Scenario: 批量取消完成
- **WHEN** 用户选中已完成的待办并点击"取消完成"
- **THEN** 选中待办的 `status` 变为 `'pending'`，`completed_at` 置空
- **AND** 未完成的待办不受影响

#### Scenario: 移动/复制到其他分类
- **WHEN** 用户在"今天"分类下选中 `synced_from_id` 不为空的待办，或在非只读分类下选中普通待办，点击"移动/复制到"
- **THEN** 弹出分类选择器
- **AND** 选择移动：待办 `category` 变更为目标分类
- **AND** 选择复制：在目标分类下创建副本（新 ID，不保留 synced_from_id）

---

### Requirement: 番茄钟按钮合并
系统 SHALL 将番茄钟页面的短休息和长休息按钮合并为一个"休息"按钮，显示短休息时长。

#### Scenario: 休息按钮默认行为
- **WHEN** 用户查看番茄钟页面
- **THEN** 仅显示两个模式按钮：专注 | 休息
- **AND** 休息按钮显示短休息时长（从设置读取）

#### Scenario: 长休息提醒确认
- **WHEN** 完成 N 个专注后（N = long_break_interval），长休息提醒弹窗弹出
- **AND** 用户点击确认
- **THEN** 自动切换到长休息时长并开始计时
- **AND** 休息按钮暂时显示长休息时长

#### Scenario: 长休息结束后恢复
- **WHEN** 长休息计时结束
- **THEN** 休息按钮时长自动切回短休息时长

#### Scenario: 拒绝长休息
- **WHEN** 长休息提醒弹窗弹出
- **AND** 用户取消或忽略
- **THEN** 不进入长休息，继续正常流程，可按休息按钮开始短休息

---

### Requirement: 侧边栏展开
系统 SHALL 提供手动展开/收起侧边栏的功能，展开时显示每个模块的标题。

#### Scenario: 展开/收起切换
- **WHEN** 用户点击侧边栏底部的展开/收起按钮（ChevronLeft/ChevronRight 图标）
- **THEN** 侧边栏在 64px（收起）和约 180px（展开）之间切换
- **AND** 展开态显示图标 + 文字标题

#### Scenario: 展开状态持久化
- **WHEN** 用户切换展开/收起状态
- **THEN** 状态写入 localStorage
- **AND** 刷新页面后保持上次状态

---

### Requirement: 点击计时数字修改预设时长
系统 SHALL 支持在番茄钟页面点击计时数字直接修改当前模式的预设时长，并同步到设置。

#### Scenario: 点击数字弹出编辑器
- **WHEN** 用户点击番茄钟页面中央的计时数字（如 25:00）
- **THEN** 数字进入编辑模式（ring-2 ring-primary 高亮），鼠标滚轮可调整分钟数
- **WHEN** 用户选择新时长（滚轮调整）
- **THEN** 更新当前模式预设时长
- **AND** 同步更新设置页对应字段
- **AND** 持久化到 Supabase `user_settings`
- **WHEN** 用户点击外部区域
- **THEN** 退出编辑模式

#### Scenario: 运行时修改不影响当前计时
- **WHEN** 计时器正在运行中
- **AND** 用户点击数字修改时长
- **THEN** 当前倒计时不受影响
- **AND** 修改仅影响下次开始该模式的时长

---

### Requirement: 统计页日均专注时长
系统 SHALL 在统计页总专注时长卡片后新增日均专注时长卡片。

#### Scenario: 日均专注显示
- **WHEN** 用户查看统计页
- **THEN** 在"总专注时长"后面显示"日均专注时长"卡片
- **AND** 根据当前粒度和时间范围计算日均值
- **AND** 格式为 X小时X分钟

---

## MODIFIED Requirements

### Requirement: 设置页（修改）
系统 SHALL 提供设置页面，在原有基础上新增日期切换时间点和自动休息开关。

#### Scenario: 日期切换时间点设置
- **WHEN** 用户打开设置 → 常规设置区域
- **THEN** 可设置"今日切换时间点"，范围 0:00 ~ 7:00（每小时一档），默认 0:00
- **AND** 该值决定"今天"分类的日期判定边界和待办同步断开时间
- **AND** 修改即时生效，持久化到 Supabase `user_settings.day_start_hour`

#### Scenario: 自动开始休息设置
- **WHEN** 用户打开设置 → 番茄钟设置区域
- **THEN** 可开关"专注结束后自动开始休息"，默认关闭
- **AND** 开启后，专注计时结束时自动进入休息模式并开始计时
- **AND** 修改即时生效，持久化到 Supabase `user_settings.auto_start_break`

### Requirement: 番茄钟计时器（修改）
系统 SHALL 修改为仅显示专注/休息两个模式按钮。休息按钮行为见"番茄钟按钮合并"需求。

#### 数据库变更
`user_settings` 表新增字段：
- `day_start_hour`: integer，默认 0，范围 0-7
- `auto_start_break`: boolean，默认 false

`todos` 表新增字段：
- `synced_from_id`: text，nullable，指向源待办 ID

## REMOVED Requirements
无

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
