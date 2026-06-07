# Tasks

- [x] Task 1: 扩展 Store 状态模型
  - [x] 1.1 `useStatsStore` 中 `selectedDate: string | null` 替换为 `selectedRange: { start: string; end: string } | null`
  - [x] 1.2 新增 `setSelectedRange(start: string, end: string)` action（自动交换：若 start > end 则 swap）
  - [x] 1.3 新增 `clearSelectedRange()` action（重置为 null）
  - [x] 1.4 更新 `useStatsStore` 中所有引用 `selectedDate` 的地方（`getSummary`、`getTrendData`、`getTaskDistribution` 中的 `filterByGranularity` 调用）
  - 验证：`npm test` 现有测试通过

- [x] Task 2: 扩展 `filterByGranularity` 支持区间
  - [x] 2.1 修改签名：新增可选参数 `endDate?: string | null`
  - [x] 2.2 当提供 endDate 时，filter 返回 `start <= record_date < (end + 1 unit)` 的记录
  - [x] 2.3 日粒度：end 日期加一天作为上限
  - [x] 2.4 月粒度：end 月份加一月作为上限
  - [x] 2.5 新增单元测试覆盖区间过滤（stats-filter.test.ts + stats.test.ts）
  - 验证：`npm test` 新测试通过

- [x] Task 3: 日历 UI — 日粒度区间选择
  - [x] 3.1 日粒度日历新增 `pendingRangeStart: string | null` 局部状态
  - [x] 3.2 第一次点击：设置 `pendingRangeStart`，高亮该日期（ring 样式），底部显示"请选择结束日期"
  - [x] 3.3 第二次点击：调用 `setSelectedRange(start, end)`，关闭弹窗
  - [x] 3.4 区间内日期高亮（浅紫色背景 `bg-primary/15`）
  - [x] 3.5 点击第三下重新开始选择
  - [x] 3.6 点击弹窗外关闭 → 清除 `pendingRangeStart`
  - [x] 3.7 跨月导航时 `pendingRangeStart` 保留
  - 验证：日粒度区间选择交互正常，视觉效果正确

- [x] Task 4: 日历 UI — 月粒度区间选择
  - [x] 4.1 月粒度 4×3 网格重用 `pendingRangeStart` 状态
  - [x] 4.2 第一次点击月份：设置起点高亮，底部显示"请选择结束月份"
  - [x] 4.3 第二次点击月份：调用 `setSelectedRange(start, end)`，关闭弹窗
  - [x] 4.4 区间内月份高亮（浅紫色背景 `bg-primary/15`）
  - [x] 4.5 点击第三下重新开始选择
  - [x] 4.6 跨年导航时 `pendingRangeStart` 保留
  - 验证：月粒度区间选择交互正常

- [x] Task 5: 数据展示适配区间模式
  - [x] 5.1 `Stats.tsx` 中所有使用 `selectedDate` 的地方改为 `selectedRange`
  - [x] 5.2 `formatPeriodLabel` 新增区间格式
  - [x] 5.3 区间模式下概览卡片日均计算使用区间实际天数（`daysBetween` / `totalDaysInMonthRange`）
  - [x] 5.4 趋势图在日粒度区间下：X 轴仍为 24 小时（聚合整个区间的数据）
  - [x] 5.5 趋势图在月粒度区间下：X 轴为多月每周
  - [x] 5.6 任务分布图在区间下：统计区间内所有关联任务的专注时长
  - [x] 5.7 区间模式下日历按钮旁显示"清除筛选"替代"返回今天"
  - 验证：所有图表/卡片随区间选择正确更新

- [x] Task 6: 周/年粒度保持单选
  - [x] 6.1 周粒度日历：点击仍为单选整周，不进入区间模式
  - [x] 6.2 年粒度日历：点击仍为单选整年，不进入区间模式
  - [x] 6.3 从区间粒度切换到周/年时，`pendingRangeStart` 自动清除
  - [x] 6.4 周/年粒度下调用 `setSelectedRange(start, start)` 降级为单选语义
  - 验证：周/年粒度行为不变

# Task Dependencies
- Task 2 依赖 Task 1（需要 Store 提供 range 数据）
- Task 3、4 可并行（各自独立的日历 UI 逻辑）
- Task 5 依赖 Task 1、2（需要 Store + filter 就绪）
- Task 6 依赖 Task 3、4（需要在日历 UI 重构基础上验证）
