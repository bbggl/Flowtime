import { create } from 'zustand'
import type { Note } from '../types'

interface NotesState {
  notes: Note[]
  currentNoteId: string | null
  searchQuery: string

  // Actions
  addNote: () => void
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => void
  deleteNote: (id: string) => void
  setCurrentNote: (id: string) => void
  setSearchQuery: (query: string) => void

  // Computed helpers
  getFilteredNotes: () => Note[]
  getCurrentNote: () => Note | null
}

let idCounter = 0
function nextId(): string {
  return `note_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`
}

export const createNotesStore = (_supabase: unknown) =>
  create<NotesState>((set, get) => ({
    notes: [],
    currentNoteId: null,
    searchQuery: '',

    addNote() {
      const note: Note = {
        id: nextId(),
        user_id: '',
        title: '',
        content: '',
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      set({
        notes: [...get().notes, note],
        currentNoteId: note.id,
      })
    },

    updateNote(id, updates) {
      set({
        notes: get().notes.map((n) => {
          if (n.id !== id) return n
          return { ...n, ...updates, updated_at: new Date().toISOString() }
        }),
      })
    },

    deleteNote(id) {
      const { notes, currentNoteId } = get()
      const filtered = notes.filter((n) => n.id !== id)
      let nextCurrent = currentNoteId

      if (currentNoteId === id) {
        if (filtered.length > 0) {
          nextCurrent = filtered[0].id
        } else {
          nextCurrent = null
        }
      }

      set({ notes: filtered, currentNoteId: nextCurrent })
    },

    setCurrentNote(id) {
      set({ currentNoteId: id })
    },

    setSearchQuery(query) {
      set({ searchQuery: query })
    },

    getFilteredNotes() {
      const { notes, searchQuery } = get()
      if (!searchQuery.trim()) return notes
      const q = searchQuery.toLowerCase()
      return notes.filter((n) => n.title.toLowerCase().includes(q))
    },

    getCurrentNote() {
      const { notes, currentNoteId } = get()
      if (!currentNoteId) return null
      return notes.find((n) => n.id === currentNoteId) ?? null
    },
  }))
