import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useStore } from 'zustand'
import { createNotesStore } from '../stores/useNotesStore'
import { useThemeStore } from '../stores/useThemeStore'
import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { Search, Plus, X } from 'lucide-react'

const notesStore = createNotesStore(null)

function fuzzyMatch(text: string, query: string): boolean {
  if (!query.trim()) return true
  const lower = text.toLowerCase()
  const q = query.toLowerCase().replace(/\s+/g, '')
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

const TAG_COLORS = [
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#3B82F6',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
]

function getTagColor(index: number): string {
  return TAG_COLORS[index % TAG_COLORS.length]
}

export default function Notes() {
  const theme = useThemeStore((s) => s.theme)

  const notes = useStore(notesStore, (s) => s.notes)
  const currentNoteId = useStore(notesStore, (s) => s.currentNoteId)
  const searchQuery = useStore(notesStore, (s) => s.searchQuery)

  const currentNote = useMemo(() => {
    if (!currentNoteId) return null
    return notes.find((n) => n.id === currentNoteId) ?? null
  }, [notes, currentNoteId])

  // Local editing state — synced to store with debounce
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Sync local state when the selected note changes
  const prevNoteIdRef = useRef<string | null>(null)
  useEffect(() => {
    const noteId = currentNote?.id ?? null
    if (noteId !== prevNoteIdRef.current) {
      prevNoteIdRef.current = noteId
      setTitle(currentNote?.title ?? '')
      setContent(currentNote?.content ?? '')
      setTags(currentNote?.tags ?? [])
      setTagInput('')
    }
  }, [currentNote?.id, currentNote?.title, currentNote?.content, currentNote?.tags])

  // Auto-save: debounce 1s after typing
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!currentNote) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      notesStore.getState().updateNote(currentNote.id, {
        title,
        content,
        tags,
      })
    }, 1000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [title, content, tags, currentNote])

  // Default select first note on open
  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    const state = notesStore.getState()
    if (state.notes.length > 0 && !state.currentNoteId) {
      state.setCurrentNote(state.notes[0].id)
    }
  }, [])

  // Filtered notes with fuzzy matching
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes
    return notes.filter((n) => fuzzyMatch(n.title, searchQuery))
  }, [notes, searchQuery])

  // ── Handlers ──

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      notesStore.getState().setSearchQuery(e.target.value)
    },
    [],
  )

  const handleAddNote = useCallback(() => {
    notesStore.getState().addNote()
  }, [])

  const handleSelectNote = useCallback((id: string) => {
    notesStore.getState().setCurrentNote(id)
  }, [])

  const handleDeleteNote = useCallback((id: string) => {
    notesStore.getState().deleteNote(id)
  }, [])

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed])
      setTagInput('')
    }
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddTag()
      }
    },
    [handleAddTag],
  )

  // ── Render ──

  return (
    <div className="flex h-full">
      {/* ── Left sidebar (300px) ── */}
      <aside className="w-[300px] flex-shrink-0 flex flex-col h-full border-r border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card">
        {/* Search box */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
            <input
              type="text"
              placeholder="搜索笔记..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-sm text-light-text dark:text-dark-text placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary focus:outline-none focus:border-primary dark:focus:border-primary-dark transition-colors"
            />
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-2 pb-1">
          {notes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-light-text-secondary dark:text-dark-text-secondary px-4 text-center">
              还没有笔记，写点什么吧！
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-light-text-secondary dark:text-dark-text-secondary px-4 text-center">
              没有找到匹配的笔记
            </div>
          ) : (
            <div className="space-y-0.5 py-1">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    note.id === currentNoteId
                      ? 'bg-primary/10 ring-1 ring-primary/20'
                      : 'hover:bg-light-bg dark:hover:bg-dark-bg'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-light-text dark:text-dark-text">
                      {note.title || '无标题'}
                    </div>
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5 truncate">
                      {note.content
                        ? note.content
                            .replace(/^#+\s+/gm, '')
                            .replace(/[*_~`>[\]#-]/g, '')
                            .trim()
                            .slice(0, 60) || '暂无内容'
                        : '暂无内容'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteNote(note.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded hover:bg-light-border dark:hover:bg-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 dark:hover:text-red-400 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add note button */}
        <div className="p-3 border-t border-light-border dark:border-dark-border">
          <button
            onClick={handleAddNote}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary hover:bg-primary/90 dark:bg-primary-dark dark:hover:bg-primary-dark/90 text-white transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>新建笔记</span>
          </button>
        </div>
      </aside>

      {/* ── Right pane: editor ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-light-card dark:bg-dark-card">
        {currentNote ? (
          <>
            {/* Title input */}
            <div className="px-6 pt-5 pb-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="笔记标题..."
                className="w-full bg-transparent text-light-text dark:text-dark-text placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary focus:outline-none border-none font-bold"
                style={{ fontSize: '24px' }}
              />
            </div>

            {/* Tag bar */}
            <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
              {tags.map((tag, i) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white select-none"
                  style={{ backgroundColor: getTagColor(i) }}
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <div className="inline-flex items-center">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="添加标签..."
                  className="w-20 px-2 py-1 text-xs rounded-md bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary focus:outline-none focus:border-primary dark:focus:border-primary-dark transition-colors"
                />
                <button
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                  className="ml-0.5 p-1 rounded hover:bg-light-border dark:hover:bg-dark-border text-light-text-secondary dark:text-dark-text-secondary disabled:opacity-30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Markdown editor */}
            <div
              className="flex-1 min-h-0"
              data-color-mode={theme === 'dark' ? 'dark' : 'light'}
            >
              <MDEditor
                value={content}
                onChange={(val) => setContent(val ?? '')}
                preview="live"
                visibleDragbar={false}
                style={{ height: '100%' }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-light-text-secondary dark:text-dark-text-secondary">
            选择或创建一篇笔记
          </div>
        )}
      </div>
    </div>
  )
}
