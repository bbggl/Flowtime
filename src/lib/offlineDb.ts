/**
 * Offline-first storage layer using IndexedDB (via idb-keyval).
 *
 * Strategy:
 * - On Supabase read success → cache the response locally
 * - On Supabase read failure / offline → serve from IndexedDB cache
 * - On Supabase write failure / offline → queue the mutation for later sync
 * - On network restore → flush queue to Supabase, then reload fresh data
 */

import { get, set, del } from 'idb-keyval'

// ---------------------------------------------------------------------------
// Network detection
// ---------------------------------------------------------------------------

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

let onlineHandlers: Array<() => void> = []
let offlineHandlers: Array<() => void> = []

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    onlineHandlers.forEach((fn) => fn())
  })
  window.addEventListener('offline', () => {
    offlineHandlers.forEach((fn) => fn())
  })
}

export function onOnline(fn: () => void): () => void {
  onlineHandlers.push(fn)
  return () => {
    onlineHandlers = onlineHandlers.filter((h) => h !== fn)
  }
}

export function onOffline(fn: () => void): () => void {
  offlineHandlers.push(fn)
  return () => {
    offlineHandlers = offlineHandlers.filter((h) => h !== fn)
  }
}

// ---------------------------------------------------------------------------
// Table cache (IndexedDB: key = `cache:<table>`)
// ---------------------------------------------------------------------------

function cacheKey(table: string): string {
  return `cache:${table}`
}

export async function cacheTable<T>(table: string, rows: T[]): Promise<void> {
  try {
    await set(cacheKey(table), rows)
  } catch {
    // IndexedDB may be unavailable (private browsing, quota, etc.)
  }
}

export async function loadCachedTable<T>(table: string): Promise<T[]> {
  try {
    const rows = await get<T[]>(cacheKey(table))
    return rows ?? []
  } catch {
    return []
  }
}

export async function clearCache(): Promise<void> {
  try {
    await del('mutation-queue')
    await del(cacheKey('todos'))
    await del(cacheKey('pomodoro_records'))
    await del(cacheKey('notes'))
    await del(cacheKey('user_settings'))
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Mutation queue
// ---------------------------------------------------------------------------

export interface QueuedMutation {
  id: string
  table: string
  operation: 'insert' | 'update' | 'delete'
  /** Row data for insert; { field: value } for update; { id } for delete */
  payload: Record<string, unknown>
  /** The id / eq key used to identify the row for update/delete */
  key: string
  timestamp: number
}

function uid(): string {
  return (
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

export async function queueMutation(
  mutation: Omit<QueuedMutation, 'id' | 'timestamp'>,
): Promise<void> {
  try {
    const queue = (await get<QueuedMutation[]>('mutation-queue')) ?? []
    queue.push({ ...mutation, id: uid(), timestamp: Date.now() })
    await set('mutation-queue', queue)
  } catch { /* noop */ }
}

export async function getQueue(): Promise<QueuedMutation[]> {
  try {
    return (await get<QueuedMutation[]>('mutation-queue')) ?? []
  } catch {
    return []
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await set('mutation-queue', [])
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Sync: flush queued mutations to Supabase
// ---------------------------------------------------------------------------

export type SyncHandler = (
  table: string,
  operation: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown>,
  key: string,
) => Promise<{ success: boolean }>

/**
 * Flush the pending mutation queue. Returns the mutations that failed.
 */
export async function flushQueue(handler: SyncHandler): Promise<QueuedMutation[]> {
  if (!isOnline()) {
    return await getQueue()
  }

  const queue = await getQueue()
  if (queue.length === 0) return []

  const remaining: QueuedMutation[] = []

  for (const mutation of queue) {
    try {
      const result = await handler(
        mutation.table,
        mutation.operation,
        mutation.payload,
        mutation.key,
      )
      if (!result.success) {
        remaining.push(mutation)
      }
    } catch {
      remaining.push(mutation)
    }
  }

  if (remaining.length === 0) {
    await clearQueue()
  } else {
    await set('mutation-queue', remaining)
  }

  return remaining
}
