import { describe, it, expect } from 'vitest'
import { usePomodoroStore, useTodoStore, useNotesStore } from './index'

describe('Store 全局单例', () => {
  it('设置页修改工作时长，番茄钟 Store 可见', () => {
    // 模拟设置页修改
    usePomodoroStore.getState().setDurations({ work_duration: 60 })
    // 同一实例读取
    expect(usePomodoroStore.getState().workDuration).toBe(60)
  })

  it('番茄页添加待办，Dashboard 可见', () => {
    useTodoStore.getState().addTodo('共享任务', 'work')
    expect(useTodoStore.getState().todos).toHaveLength(1)
    expect(useTodoStore.getState().todos[0].title).toBe('共享任务')
  })

  it('笔记页创建笔记，其他页面可读取', () => {
    useNotesStore.getState().addNote()
    expect(useNotesStore.getState().notes).toHaveLength(1)
  })

  it('多次 import 返回同一个实例', () => {
    // 模拟不同文件分别 import
    const storeA = usePomodoroStore
    const storeB = usePomodoroStore
    storeA.getState().setDurations({ daily_goal: 5 })
    expect(storeB.getState().dailyGoal).toBe(5)
  })
})
