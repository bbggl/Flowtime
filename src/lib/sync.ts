/**
 * Central sync engine: Supabase Realtime (Task 9) + offline recovery (Task 8).
 *
 * Intended to be mounted once in Layout as a zero-height component
 * that manages subscriptions and reconnect logic.
 */

import { useEffect } from 'react'
import { supabase } from './supabase'
import { subscribeToRealtime, unsubscribeAll } from './realtime'
import { flushQueue, onOnline } from './offlineDb'
import { useTodoStore, usePomodoroStore, useNotesStore } from '../stores'
import { useAuth } from '../hooks/useAuth'

/**
 * React component — mounts realtime subscriptions when authenticated,
 * sets up offline queue flush on reconnect.
 */
export function SyncEngine() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      unsubscribeAll()
      return
    }

    // --- Task 9: Realtime subscriptions ---
    subscribeToRealtime(supabase, {
      onTodoChange(event) {
        const todoStore = useTodoStore.getState()
        switch (event.eventType) {
          case 'INSERT':
            if (event.new) todoStore.handleRealtimeInsert(event.new)
            break
          case 'UPDATE':
            if (event.new) todoStore.handleRealtimeUpdate(event.new)
            break
          case 'DELETE':
            if (event.old?.id) {
              const id = typeof event.old.id === 'string' ? event.old.id : String(event.old.id)
              todoStore.handleRealtimeDelete(id)
            }
            break
        }
      },
      onPomodoroChange(event) {
        const pomoStore = usePomodoroStore.getState()
        switch (event.eventType) {
          case 'INSERT':
            if (event.new) pomoStore.handleRealtimeInsert(event.new)
            break
          case 'UPDATE':
            if (event.new) pomoStore.handleRealtimeUpdate(event.new)
            break
          case 'DELETE':
            if (event.old?.id) {
              const id = typeof event.old.id === 'string' ? event.old.id : String(event.old.id)
              pomoStore.handleRealtimeDelete(id)
            }
            break
        }
      },
      onNoteChange(event) {
        const notesStore = useNotesStore.getState()
        switch (event.eventType) {
          case 'INSERT':
            if (event.new) notesStore.handleRealtimeInsert(event.new)
            break
          case 'UPDATE':
            if (event.new) notesStore.handleRealtimeUpdate(event.new)
            break
          case 'DELETE':
            if (event.old?.id) {
              const id = typeof event.old.id === 'string' ? event.old.id : String(event.old.id)
              notesStore.handleRealtimeDelete(id)
            }
            break
        }
      },
    })

    return () => {
      unsubscribeAll()
    }
  }, [user])

  // --- Task 8: Online sync ---
  useEffect(() => {
    const unsub = onOnline(async () => {
      // When we come back online, flush the mutation queue
      await flushQueue(async (table, operation, payload, key) => {
        try {
          switch (operation) {
            case 'insert':
              await supabase.from(table).insert(payload)
              break
            case 'update':
              // payload is { field: value }, key is the row id
              await supabase.from(table).update(payload).eq('id', key)
              break
            case 'delete':
              await supabase.from(table).delete().eq('id', key)
              break
          }
          return { success: true }
        } catch {
          return { success: false }
        }
      })

      // After flushing, reload fresh data from Supabase
      if (user) {
        try {
          await Promise.all([
            useTodoStore.getState().loadTodos(),
            usePomodoroStore.getState().loadRecords(),
            useNotesStore.getState().loadNotes(),
          ])
        } catch { /* reload is best-effort */ }
      }
    })

    return unsub
  }, [user])

  return null
}
