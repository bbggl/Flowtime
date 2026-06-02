import { describe, it, expect, beforeEach } from 'vitest'
import { createNotesStore } from './useNotesStore'

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
      store.getState().addNote()
      store.getState().setCurrentNote(firstId)
      store.getState().deleteNote(firstId)
      expect(store.getState().currentNoteId).toBe(store.getState().notes[0].id)
    })
  })

  describe('searchNotes', () => {
    it('returns notes matching the search query in title', () => {
      store.getState().addNote()
      store.getState().addNote()
      const ids = store.getState().notes.map((n) => n.id)
      store.getState().updateNote(ids[0], { title: 'Meeting Notes' })
      store.getState().updateNote(ids[1], { title: 'Shopping List' })

      store.getState().setSearchQuery('Meeting')
      const filtered = store.getState().getFilteredNotes()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Meeting Notes')
    })

    it('returns all notes when query is empty', () => {
      store.getState().addNote()
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
