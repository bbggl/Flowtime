/**
 * Supabase Realtime cross-device sync.
 *
 * Subscribes to Postgres changes on todos / pomodoro_records / notes tables
 * and dispatches events to the corresponding Zustand stores.
 *
 * RLS ensures each client only receives changes for its own user_id.
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Todo, PomodoroRecord, Note } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeEvent<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  new: T | null    // null on DELETE
  old: Partial<T> | null   // old record (id at minimum)
}

export type RealtimeCallbacks = {
  onTodoChange: (event: ChangeEvent<Todo>) => void
  onPomodoroChange: (event: ChangeEvent<PomodoroRecord>) => void
  onNoteChange: (event: ChangeEvent<Note>) => void
}

// ---------------------------------------------------------------------------
// Channel management
// ---------------------------------------------------------------------------

let channels: RealtimeChannel[] = []
let subscribed = false

/**
 * Start realtime subscriptions. Safe to call multiple times — previous
 * subscriptions are cleaned up first.
 */
export function subscribeToRealtime(
  supabase: { channel: (name: string) => RealtimeChannel },
  callbacks: RealtimeCallbacks,
): void {
  // Idempotent: clean up existing first
  unsubscribeAll()

  const todoChannel = supabase
    .channel('flowtime-todos')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'todos' },
      (payload: RealtimePostgresChangesPayload<Todo>) => {
        callbacks.onTodoChange({
          eventType: payload.eventType,
          table: 'todos',
          new: payload.new as Todo | null,
          old: (payload.old as Partial<Todo>) ?? null,
        })
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[realtime] todos channel ready')
    })

  const pomodoroChannel = supabase
    .channel('flowtime-pomodoro')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pomodoro_records' },
      (payload: RealtimePostgresChangesPayload<PomodoroRecord>) => {
        callbacks.onPomodoroChange({
          eventType: payload.eventType,
          table: 'pomodoro_records',
          new: payload.new as PomodoroRecord | null,
          old: (payload.old as Partial<PomodoroRecord>) ?? null,
        })
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[realtime] pomodoro_records channel ready')
    })

  const notesChannel = supabase
    .channel('flowtime-notes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes' },
      (payload: RealtimePostgresChangesPayload<Note>) => {
        callbacks.onNoteChange({
          eventType: payload.eventType,
          table: 'notes',
          new: payload.new as Note | null,
          old: (payload.old as Partial<Note>) ?? null,
        })
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[realtime] notes channel ready')
    })

  channels = [todoChannel, pomodoroChannel, notesChannel]
  subscribed = true
}

export function unsubscribeAll(): void {
  for (const ch of channels) {
    try {
      ch.unsubscribe()
    } catch { /* channel may already be closed */ }
  }
  channels = []
  subscribed = false
}

export function isSubscribed(): boolean {
  return subscribed
}
