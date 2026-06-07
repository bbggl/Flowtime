export interface Todo {
  id: string
  user_id: string
  title: string
  description?: string
  status: 'pending' | 'done'
  priority: 'high' | 'medium' | 'low'
  category: string
  date?: string
  estimated_pomos: number
  completed_pomos: number
  sort_order: number
  created_at: string
  completed_at?: string
  synced_from_id?: string
}

export interface PomodoroRecord {
  id: string
  user_id: string
  mode: 'work' | 'short_break' | 'long_break'
  task_id?: string
  duration: number
  actual_duration: number
  status: 'completed' | 'interrupted'
  started_at: string
  completed_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  daily_goal: number
  work_duration: number
  short_break_duration: number
  long_break_duration: number
  long_break_interval: number
  sound_enabled: boolean
  notification_enabled: boolean
}
