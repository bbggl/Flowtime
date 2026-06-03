import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock idb-keyval: in-memory store replaces IndexedDB
const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: (key: string) => Promise.resolve(structuredClone(store.get(key) ?? null)),
  set: (key: string, value: unknown) => {
    store.set(key, structuredClone(value))
    return Promise.resolve()
  },
  del: (key: string) => {
    store.delete(key)
    return Promise.resolve()
  },
}))

import {
  cacheTable,
  loadCachedTable,
  queueMutation,
  getQueue,
  clearQueue,
  flushQueue,
  isOnline,
  onOnline,
  onOffline,
} from './offlineDb'
import type { SyncHandler } from './offlineDb'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    configurable: true,
    value,
  })
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('offlineDb', () => {
  beforeEach(() => {
    store.clear()
    mockOnline(true)
  })

  // -- cacheTable / loadCachedTable ----------------------------------------

  describe('cacheTable + loadCachedTable', () => {
    it('round-trips data through cache', async () => {
      const rows = [{ id: '1', title: 'hello' }]
      await cacheTable('todos', rows)
      const loaded = await loadCachedTable<typeof rows[0]>('todos')
      expect(loaded).toEqual(rows)
    })

    it('returns empty array when no cache exists', async () => {
      const loaded = await loadCachedTable('nonexistent')
      expect(loaded).toEqual([])
    })

    it('overwrites previous cache on second write', async () => {
      await cacheTable('todos', [{ id: 'a' }])
      await cacheTable('todos', [{ id: 'b' }])
      const loaded = await loadCachedTable('todos')
      expect(loaded).toEqual([{ id: 'b' }])
    })
  })

  // -- queueMutation / getQueue / clearQueue -------------------------------

  describe('mutation queue', () => {
    it('queues a mutation and retrieves it', async () => {
      await queueMutation({
        table: 'todos',
        operation: 'insert',
        payload: { title: 'Test' },
        key: 'tmp-1',
      })

      const queue = await getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].table).toBe('todos')
      expect(queue[0].operation).toBe('insert')
      expect(queue[0].payload).toEqual({ title: 'Test' })
      expect(queue[0].key).toBe('tmp-1')
    })

    it('queues multiple mutations in order', async () => {
      await queueMutation({ table: 'a', operation: 'insert', payload: {}, key: '1' })
      await queueMutation({ table: 'b', operation: 'update', payload: { x: 1 }, key: '2' })

      const queue = await getQueue()
      expect(queue).toHaveLength(2)
      expect(queue[0].table).toBe('a')
      expect(queue[1].table).toBe('b')
    })

    it('clearQueue empties the queue', async () => {
      await queueMutation({ table: 'a', operation: 'insert', payload: {}, key: '1' })
      await clearQueue()
      expect(await getQueue()).toEqual([])
    })

    it('each mutation gets a unique id', async () => {
      await queueMutation({ table: 'a', operation: 'insert', payload: {}, key: '1' })
      await queueMutation({ table: 'a', operation: 'insert', payload: {}, key: '2' })
      const queue = await getQueue()
      expect(queue[0].id).not.toBe(queue[1].id)
    })
  })

  // -- flushQueue ----------------------------------------------------------

  describe('flushQueue', () => {
    it('flushes all queued mutations and empties queue on success', async () => {
      const handled: Array<{ table: string; op: string }> = []
      const handler: SyncHandler = async (table, op, _payload, _key) => {
        handled.push({ table, op })
        return { success: true }
      }

      await queueMutation({ table: 'todos', operation: 'insert', payload: { title: 'A' }, key: '1' })
      await queueMutation({ table: 'todos', operation: 'update', payload: { status: 'done' }, key: '2' })

      await flushQueue(handler)
      expect(handled).toHaveLength(2)
      expect(await getQueue()).toEqual([])
    })

    it('keeps failed mutations in queue', async () => {
      let call = 0
      const handler: SyncHandler = async () => {
        call++
        return { success: call !== 1 } // first fails, second succeeds
      }

      await queueMutation({ table: 'a', operation: 'insert', payload: {}, key: '1' })
      await queueMutation({ table: 'b', operation: 'insert', payload: {}, key: '2' })

      const remaining = await flushQueue(handler)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].table).toBe('a')
    })

    it('keeps all mutations when handler throws', async () => {
      const handler: SyncHandler = async () => {
        throw new Error('network error')
      }

      await queueMutation({ table: 'todos', operation: 'insert', payload: { title: 'A' }, key: '1' })
      await flushQueue(handler)

      const queue = await getQueue()
      expect(queue).toHaveLength(1)
    })

    it('returns queue without flushing when offline', async () => {
      mockOnline(false)
      const handler: SyncHandler = vi.fn()

      await queueMutation({ table: 'todos', operation: 'insert', payload: {}, key: '1' })
      await flushQueue(handler)

      expect(handler).not.toHaveBeenCalled()
      expect(await getQueue()).toHaveLength(1)
    })
  })

  // -- Network detection ---------------------------------------------------

  describe('isOnline', () => {
    it('returns true when navigator.onLine is true', () => {
      mockOnline(true)
      expect(isOnline()).toBe(true)
    })

    it('returns false when navigator.onLine is false', () => {
      mockOnline(false)
      expect(isOnline()).toBe(false)
    })
  })

  describe('onOnline / onOffline', () => {
    it('calls onOnline handler when online event fires', async () => {
      mockOnline(false)
      const fn = vi.fn()
      onOnline(fn)

      mockOnline(true)
      window.dispatchEvent(new Event('online'))
      await delay(10)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('calls onOffline handler when offline event fires', async () => {
      mockOnline(true)
      const fn = vi.fn()
      onOffline(fn)

      mockOnline(false)
      window.dispatchEvent(new Event('offline'))
      await delay(10)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('unsubscribe removes the handler', async () => {
      const fn = vi.fn()
      const unsub = onOnline(fn)
      unsub()

      mockOnline(true)
      window.dispatchEvent(new Event('online'))
      await delay(10)
      expect(fn).not.toHaveBeenCalled()
    })
  })
})
