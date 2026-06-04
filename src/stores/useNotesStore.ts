import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Note } from '../types'
import { cacheTable, loadCachedTable, isOnline } from '../lib/offlineDb'

interface NotesState {
  notes: Note[]
  currentNoteId: string | null
  searchQuery: string

  // Actions
  loadNotes: () => Promise<void>
  addNote: () => void
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => void
  deleteNote: (id: string) => void
  setCurrentNote: (id: string) => void
  setSearchQuery: (query: string) => void

  // Computed helpers
  getFilteredNotes: () => Note[]
  getCurrentNote: () => Note | null

  // Realtime handlers (Task 9)
  handleRealtimeInsert: (note: Note) => void
  handleRealtimeUpdate: (note: Note) => void
  handleRealtimeDelete: (id: string) => void
}

let idCounter = 0
function nextId(): string {
  return `note_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`
}

export const createNotesStore = (supabase: SupabaseClient) => {
  const isRealSupabase = typeof (supabase as any)?.from === 'function'

  return create<NotesState>((set, get) => ({
    notes: [],
    currentNoteId: null,
    searchQuery: '',

    // ---- Load from Supabase (with offline fallback) ----
    async loadNotes() {
      if (!isRealSupabase) return

      if (isOnline()) {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .order('updated_at', { ascending: false })

        if (!error && data) {
          const mapped = (data as Note[]).map((n) => ({
            ...n,
            tags: n.tags ?? [],
          }))
          set((state) => ({
            notes: mapped,
            currentNoteId: mapped.some((n) => n.id === state.currentNoteId)
              ? state.currentNoteId
              : (mapped.length > 0 ? mapped[0].id : null),
          }))
          await cacheTable('notes', mapped)
          return
        }
      }

      // Fallback: load from IndexedDB cache
      const cached = await loadCachedTable<Note>('notes')
      if (cached.length > 0) {
        set((state) => ({
          notes: cached as Note[],
          currentNoteId: (cached as Note[]).some((n) => n.id === state.currentNoteId)
            ? state.currentNoteId
            : (cached[0]?.id ?? null),
        }))
      }
    },

    // ---- Mutations ----
    addNote() {
      // 如果已有空笔记，不再新增
      const hasEmpty = get().notes.some(
        (n) => !n.title.trim() && !n.content.trim(),
      )
      if (hasEmpty) return

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

      // 同步写入 Supabase
      if (isRealSupabase) {
        supabase
          .from('notes')
          .insert({ title: '', content: '', tags: [] })
          .select()
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              set({
                notes: get().notes.map((n) => (n.id === note.id ? (data as Note) : n)),
                currentNoteId: (data as Note).id,  // 更新为服务器 ID
              })
            } else if (error) {
              console.warn('Note insert failed:', error.message)
            }
          })
      }
    },

    updateNote(id, updates) {
      const updated_at = new Date().toISOString()

      set({
        notes: get().notes.map((n) => {
          if (n.id !== id) return n
          return { ...n, ...updates, updated_at }
        }),
      })

      // 同步更新 Supabase
      const payload: Record<string, unknown> = { updated_at }
      if (updates.title !== undefined) payload.title = updates.title
      if (updates.content !== undefined) payload.content = updates.content
      if (updates.tags !== undefined) payload.tags = updates.tags

      if (isRealSupabase) {
        supabase
          .from('notes')
          .update(payload)
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('Note update failed:', error.message)
          })
      }
    },

    deleteNote(id) {
      const { notes, currentNoteId } = get()
      const filtered = notes.filter((n) => n.id !== id)
      let nextCurrent = currentNoteId

      if (currentNoteId === id) {
        nextCurrent = filtered.length > 0 ? filtered[0].id : null
      }

      set({ notes: filtered, currentNoteId: nextCurrent })

      if (isRealSupabase) {
        supabase
          .from('notes')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('Note delete failed:', error.message)
          })
      }
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

    // ---- Realtime sync handlers (Task 9) ----
    handleRealtimeInsert(note: Note) {
      if (get().notes.some((n) => n.id === note.id)) return
      set({ notes: [...get().notes, note] })
    },

    handleRealtimeUpdate(note: Note) {
      set({
        notes: get().notes.map((n) => (n.id === note.id ? { ...n, ...note } : n)),
      })
    },

    handleRealtimeDelete(id: string) {
      const { notes, currentNoteId } = get()
      const nextNotes = notes.filter((n) => n.id !== id)
      const nextCurrentId = currentNoteId === id ? (nextNotes[0]?.id ?? null) : currentNoteId
      set({ notes: nextNotes, currentNoteId: nextCurrentId })
    },
  }))
}
