import { useContext, useMemo } from 'react'
import { NotesContext, type NotesContextValue } from './notes-context'
import { summarizeTopics } from './graph'
import { todayISO } from './deadline'
import type { Note, TopicSummary } from './types'

export function useNotes(): NotesContextValue {
  const context = useContext(NotesContext)
  if (!context) throw new Error('useNotes must be used within a NotesProvider')
  return context
}

/** Notes newest-first, plus the topic rollup both the list and graph read. */
export function useNotesView(): {
  notes: Note[]
  topics: TopicSummary[]
  today: string
} {
  const { notes } = useNotes()
  const today = todayISO()

  return useMemo(
    () => ({
      notes: [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      topics: summarizeTopics(notes, today),
      today,
    }),
    [notes, today],
  )
}

export function useNote(id: string | undefined): Note | undefined {
  const { notes } = useNotes()
  return useMemo(() => notes.find((note) => note.id === id), [notes, id])
}
