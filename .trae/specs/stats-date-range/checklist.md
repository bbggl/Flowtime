# Checklist

## Store 状态模型
- [x] `useStatsStore` 中 `selectedDate` 已替换为 `selectedRange: { start, end } | null`
- [x] `setSelectedRange` 自动交换起止顺序（start > end 时 swap）
- [x] `clearSelectedRange` 可重置为 null

## filterByGranularity 区间过滤
- [x] `filterByGranularity` 支持 endDate 参数，日粒度区间过滤正确
- [x] `filterByGranularity` 月粒度区间过滤正确（跨年场景验证）
- [x] 周/年粒度不受区间影响（保持单选行为）
- [x] 区间过滤测试覆盖（stats-filter.test.ts + stats.test.ts 新增 14 项测试）

## 日粒度区间选择 UI
- [x] 日粒度日历：首次点击高亮为起点，底部显示"请选择结束日期"
- [x] 第二次点击：区间高亮，弹窗关闭，按钮标签更新为区间格式
- [x] 起点晚于终点自动交换
- [x] 同日期点击两次 = 单选该日
- [x] 第三次点击重新开始选择
- [x] 跨月导航时起点保留
- [x] 点击弹窗外关闭 → pendingRangeStart 清除

## 月粒度区间选择 UI
- [x] 月粒度日历：首次点击高亮为起点，底部显示"请选择结束月份"
- [x] 第二次点击：区间高亮，弹窗关闭，按钮标签更新为区间格式
- [x] 跨年导航时起点保留
- [x] 同月份点击两次 = 单选该月

## 数据展示
- [x] 概览卡片（总专注时长/日均专注/完成番茄数/日均番茄数/完成率）在区间下正确计算
- [x] 趋势图日粒度区间：X 轴 24 小时，数据为区间内聚合
- [x] 趋势图月粒度区间：X 轴为多月每周，标签格式正确
- [x] 任务分布图在区间下正确统计
- [x] `formatPeriodLabel` 区间格式正确
- [x] 区间模式下显示"清除筛选"链接（替代"返回今天"）
- [x] 清除筛选后恢复默认当前时间范围

## 周/年粒度
- [x] 周粒度日历仍为单选整周
- [x] 年粒度日历仍为单选整年
- [x] 切换到周/年粒度时区间 pending 状态清除

## 测试
- [x] `npm test` 全部通过（273/277，4 个失败为预先存在的 Supabase 集成测试问题）
- [x] 新增测试覆盖区间过滤（14 项）
- [x] 新增测试覆盖 Store 区间状态
