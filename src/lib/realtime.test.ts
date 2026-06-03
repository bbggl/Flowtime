import { describe, it, expect, vi, beforeEach } from 'vitest'
import { subscribeToRealtime, unsubscribeAll, isSubscribed } from './realtime'

// Build a mock Supabase channel that records subscriptions
function createMockSupabaseWithChannel() {
  const subscriptions: Array<{
    event: string
    schema: string
    table: string
    callback: (payload: unknown) => void
  }> = []

  const channel: any = {
    on: vi.fn(
      (_event: string, filter: any, callback: (payload: unknown) => void) => {
        subscriptions.push({
          event: filter.event,
          schema: filter.schema,
          table: filter.table,
          callback,
        })
        return channel
      },
    ),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      if (cb) cb('SUBSCRIBED')
      return channel
    }),
    unsubscribe: vi.fn(),
  }

  return {
    channel: vi.fn().mockReturnValue(channel),
    subscriptions,
    channelInstance: channel,
    // re-create a fresh channel each call
    reset: () => {
      channel.on.mockClear()
      channel.subscribe.mockClear()
      channel.unsubscribe.mockClear()
    },
  }
}

describe('realtime', () => {
  let mock: ReturnType<typeof createMockSupabaseWithChannel>

  beforeEach(() => {
    unsubscribeAll()
    mock = createMockSupabaseWithChannel()
  })

  describe('subscribeToRealtime', () => {
    it('subscribes to todos, pomodoro_records, and notes tables', () => {
      const callbacks = {
        onTodoChange: vi.fn(),
        onPomodoroChange: vi.fn(),
        onNoteChange: vi.fn(),
      }

      // Cast mock to expected type for the call
      subscribeToRealtime(mock as any, callbacks)

      expect(mock.channel).toHaveBeenCalledTimes(3)
      // Verify channel names
      const names = mock.channel.mock.calls.map((c: string[]) => c[0])
      expect(names).toContain('flowtime-todos')
      expect(names).toContain('flowtime-pomodoro')
      expect(names).toContain('flowtime-notes')
    })

    it('forwards INSERT payload to the correct callback', () => {
      const callbacks = {
        onTodoChange: vi.fn(),
        onPomodoroChange: vi.fn(),
        onNoteChange: vi.fn(),
      }

      subscribeToRealtime(mock as any, callbacks)

      // Simulate a Postgres change on todos
      const payload = {
        eventType: 'INSERT',
        schema: 'public',
        table: 'todos',
        new: { id: '1', title: 'Hello', user_id: 'u1' },
        old: {},
      }

      // Emit the payload through the recorded subscriber for todos
      // The subscriptions array has [todos, pomodoro, notes]
      mock.subscriptions[0].callback(payload)

      expect(callbacks.onTodoChange).toHaveBeenCalledTimes(1)
      expect(callbacks.onPomodoroChange).not.toHaveBeenCalled()
      expect(callbacks.onNoteChange).not.toHaveBeenCalled()

      const event = callbacks.onTodoChange.mock.calls[0][0]
      expect(event.eventType).toBe('INSERT')
      expect(event.table).toBe('todos')
      expect(event.new).toEqual(payload.new)
    })

    it('forwards UPDATE payload to the correct callback', () => {
      const callbacks = {
        onTodoChange: vi.fn(),
        onPomodoroChange: vi.fn(),
        onNoteChange: vi.fn(),
      }

      subscribeToRealtime(mock as any, callbacks)

      const payload = {
        eventType: 'UPDATE',
        schema: 'public',
        table: 'notes',
        new: { id: 'n1', title: 'Updated', content: 'new' },
        old: { id: 'n1' },
      }

      mock.subscriptions[2].callback(payload) // notes is index 2
      expect(callbacks.onNoteChange).toHaveBeenCalledTimes(1)
      expect(callbacks.onNoteChange.mock.calls[0][0].eventType).toBe('UPDATE')
    })

    it('forwards DELETE payload with new=null and old record', () => {
      const callbacks = {
        onTodoChange: vi.fn(),
        onPomodoroChange: vi.fn(),
        onNoteChange: vi.fn(),
      }

      subscribeToRealtime(mock as any, callbacks)

      const payload = {
        eventType: 'DELETE',
        schema: 'public',
        table: 'todos',
        new: {},
        old: { id: 'deleted-id' },
      }

      mock.subscriptions[0].callback(payload)
      const event = callbacks.onTodoChange.mock.calls[0][0]
      expect(event.eventType).toBe('DELETE')
      expect(event.old).toEqual({ id: 'deleted-id' })
    })
  })

  describe('unsubscribeAll', () => {
    it('unsubscribes all channels', () => {
      subscribeToRealtime(mock as any, {
        onTodoChange: vi.fn(),
        onPomodoroChange: vi.fn(),
        onNoteChange: vi.fn(),
      })

      expect(isSubscribed()).toBe(true)

      unsubscribeAll()

      // Each channel's unsubscribe should have been called once
      expect(mock.channelInstance.unsubscribe).toHaveBeenCalledTimes(3)
      expect(isSubscribed()).toBe(false)
    })

    it('does not throw when called twice', () => {
      subscribeToRealtime(mock as any, {
        onTodoChange: vi.fn(),
        onPomodoroChange: vi.fn(),
        onNoteChange: vi.fn(),
      })
      unsubscribeAll()
      expect(() => unsubscribeAll()).not.toThrow()
    })
  })
})
