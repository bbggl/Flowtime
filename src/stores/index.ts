import { createTodoStore } from './useTodoStore'
import { createPomodoroStore } from './usePomodoroStore'
import { createNotesStore } from './useNotesStore'
import { createStatsStore } from './useStatsStore'
import { supabase } from '../lib/supabase'

// 全局单例 Store — 所有页面共享同一个实例
export const useTodoStore = createTodoStore(supabase)
export const usePomodoroStore = createPomodoroStore(supabase)
export const useNotesStore = createNotesStore(supabase)
export const useStatsStore = createStatsStore()
