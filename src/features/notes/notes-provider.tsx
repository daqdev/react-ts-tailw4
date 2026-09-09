import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { draftToNote } from './draft'
import { NotesContext } from './notes-context'
import { notesStore, storageAvailable } from './storage'
import type { Note, NoteDraft } from './types'

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!storageAvailable()) {
      setError('This browser has no IndexedDB, so notes will not survive a reload.')
      setReady(true)
      return
    }
    notesStore
      .all()
      .then((stored) => {
        if (!cancelled) setNotes(stored)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not read notes.')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Writes go to IndexedDB first; state only changes once the write resolves,
  // so what is on screen always matches what is on disk.
  const createNote = useCallback(async (draft: NoteDraft) => {
    const note = draftToNote(draft)
    await notesStore.put(note)
    setNotes((current) => [...current, note])
    return note
  }, [])

  const updateNote = useCallback(
    async (id: string, draft: NoteDraft) => {
      const existing = notes.find((note) => note.id === id)
      if (!existing) return
      const updated = draftToNote(draft, existing)
      await notesStore.put(updated)
      setNotes((current) => current.map((note) => (note.id === id ? updated : note)))
    },
    [notes],
  )

  const deleteNote = useCallback(async (id: string) => {
    await notesStore.remove(id)
    setNotes((current) => current.filter((note) => note.id !== id))
  }, [])

  const replaceAll = useCallback(async (incoming: Note[]) => {
    await notesStore.replaceAll(incoming)
    setNotes(incoming)
  }, [])

  const clearAll = useCallback(async () => {
    await notesStore.clear()
    setNotes([])
  }, [])

  const value = useMemo(
    () => ({ notes, ready, error, createNote, updateNote, deleteNote, replaceAll, clearAll }),
    [notes, ready, error, createNote, updateNote, deleteNote, replaceAll, clearAll],
  )

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}
