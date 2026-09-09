import { createContext } from 'react'
import type { Note, NoteDraft } from './types'

export interface NotesContextValue {
  notes: Note[]
  /** False until the first read from IndexedDB has resolved. */
  ready: boolean
  /** Set when storage is unavailable or a write failed. */
  error: string | null
  createNote: (draft: NoteDraft) => Promise<Note>
  updateNote: (id: string, draft: NoteDraft) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  replaceAll: (notes: Note[]) => Promise<void>
  clearAll: () => Promise<void>
}

export const NotesContext = createContext<NotesContextValue | undefined>(undefined)
