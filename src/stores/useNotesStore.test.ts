import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createNotesStore } from './useNotesStore'
import type { Note } from '../types'

vi.mock('../lib/offlineDb', () => ({
  isOnline: () => true,
  cacheTable: vi.fn(),
  loadCachedTable: vi.fn().mockResolvedValue([]),
  queueMutation: vi.fn(),
  getQueue: vi.fn().mockResolvedValue([]),
  clearQueue: vi.fn(),
  flushQueue: vi.fn(),
  onOnline: vi.fn(() => () => {}),
  onOffline: vi.fn(() => () => {}),
}))

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    user_id: 'u1',
    title: '',
    content: '',
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('useNotesStore', () => {
  let store: ReturnType<typeof createNotesStore>

  beforeEach(() => {
    store = createNotesStore({} as any)
  })

  describe('addNote', () => {
    it('creates a new empty note', () => {
      store.getState().addNote()
      const notes = store.getState().notes
      expect(notes).toHaveLength(1)
      expect(notes[0].title).toBe('')
      expect(notes[0].content).toBe('')
      expect(notes[0].tags).toEqual([])
    })

    it('sets the new note as current', () => {
      store.getState().addNote()
      expect(store.getState().currentNoteId).toBe(store.getState().notes[0].id)
    })
  })

  describe('updateNote', () => {
    it('updates note title', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().updateNote(id, { title: 'My Note' })
      expect(store.getState().notes[0].title).toBe('My Note')
    })

    it('updates note content', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().updateNote(id, { content: '# Hello' })
      expect(store.getState().notes[0].content).toBe('# Hello')
    })

    it('updates note tags', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().updateNote(id, { tags: ['work', 'ideas'] })
      expect(store.getState().notes[0].tags).toEqual(['work', 'ideas'])
    })

    it('sets updated_at timestamp on update', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().updateNote(id, { title: 'Updated' })
      const updated = store.getState().notes[0].updated_at
      expect(updated).toBeTruthy()
      // valid ISO date string
      expect(new Date(updated).getTime()).not.toBeNaN()
    })
  })

  describe('deleteNote', () => {
    it('removes the note from the list', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().deleteNote(id)
      expect(store.getState().notes).toHaveLength(0)
    })

    it('clears currentNoteId if deleted note was current', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().deleteNote(id)
      expect(store.getState().currentNoteId).toBeNull()
    })

    it('switches to next note if deleted note was current and others exist', () => {
      store.getState().addNote()
      const firstId = store.getState().notes[0].id
      store.getState().updateNote(firstId, { title: 'Note 1' }) // 填充标题，允许再新增
      store.getState().addNote()
      store.getState().setCurrentNote(firstId)
      store.getState().deleteNote(firstId)
      expect(store.getState().currentNoteId).toBe(store.getState().notes[0].id)
    })
  })

  describe('searchNotes', () => {
    it('returns notes matching the search query in title', () => {
      store.getState().addNote()
      store.getState().updateNote(store.getState().notes[0].id, { title: 'Meeting Notes' })
      store.getState().addNote()
      store.getState().updateNote(store.getState().notes[1].id, { title: 'Shopping List' })

      store.getState().setSearchQuery('Meeting')
      const filtered = store.getState().getFilteredNotes()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Meeting Notes')
    })

    it('returns all notes when query is empty', () => {
      store.getState().addNote()
      store.getState().updateNote(store.getState().notes[0].id, { title: 'Note A' })
      store.getState().addNote()
      store.getState().setSearchQuery('')
      expect(store.getState().getFilteredNotes()).toHaveLength(2)
    })

    it('is case-insensitive', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().updateNote(id, { title: 'Important Doc' })
      store.getState().setSearchQuery('important')
      expect(store.getState().getFilteredNotes()).toHaveLength(1)
    })
  })

  describe('setCurrentNote', () => {
    it('sets the current note by id', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().setCurrentNote(id)
      expect(store.getState().currentNoteId).toBe(id)
    })
  })

  // --- Realtime sync handlers (Task 9) ---
  describe('handleRealtimeInsert', () => {
    it('adds a new note from realtime event', () => {
      const remote = makeNote({ id: 'n-r1', title: 'Remote note' })
      store.getState().handleRealtimeInsert(remote)
      expect(store.getState().notes).toHaveLength(1)
      expect(store.getState().notes[0].title).toBe('Remote note')
    })

    it('does not add duplicate note', () => {
      const remote = makeNote({ id: 'n-r1' })
      store.getState().handleRealtimeInsert(remote)
      store.getState().handleRealtimeInsert(remote)
      expect(store.getState().notes).toHaveLength(1)
    })
  })

  describe('handleRealtimeUpdate', () => {
    it('updates an existing note from realtime', () => {
      const note = makeNote({ id: 'n-1', title: 'Old' })
      store.setState({ notes: [note] })

      store.getState().handleRealtimeUpdate({ id: 'n-1', title: 'New', content: 'updated' } as Note)
      expect(store.getState().notes[0].title).toBe('New')
      expect(store.getState().notes[0].content).toBe('updated')
    })

    it('ignores update for non-existent id', () => {
      store.getState().handleRealtimeUpdate({ id: 'ghost', title: 'Ghost' } as Note)
      expect(store.getState().notes).toHaveLength(0)
    })
  })

  describe('handleRealtimeDelete', () => {
    it('removes a note by id from realtime', () => {
      const note = makeNote({ id: 'n-1' })
      store.setState({ notes: [note] })

      store.getState().handleRealtimeDelete('n-1')
      expect(store.getState().notes).toHaveLength(0)
    })

    it('does nothing for unknown id', () => {
      const note = makeNote({ id: 'n-1' })
      store.setState({ notes: [note] })

      store.getState().handleRealtimeDelete('unknown')
      expect(store.getState().notes).toHaveLength(1)
    })
  })

  describe('getCurrentNote', () => {
    it('returns the current note', () => {
      store.getState().addNote()
      const id = store.getState().notes[0].id
      store.getState().setCurrentNote(id)
      const current = store.getState().getCurrentNote()
      expect(current).toBeDefined()
      expect(current!.id).toBe(id)
    })

    it('returns null when no note is selected', () => {
      expect(store.getState().getCurrentNote()).toBeNull()
    })
  })
})
