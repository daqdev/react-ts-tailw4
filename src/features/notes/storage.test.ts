import { describe, expect, it } from 'vitest'
import { notesStore, storageAvailable } from './storage'
import { draftToNote } from './draft'

function make(topic: string, text: string) {
  return draftToNote({ topic, text, deadline: null })
}

describe('notesStore', () => {
  it('reports storage availability', () => {
    expect(storageAvailable()).toBe(true)
  })

  it('starts empty', async () => {
    await expect(notesStore.all()).resolves.toEqual([])
  })

  it('round-trips a note through IndexedDB', async () => {
    const note = make('design', 'A note')
    await notesStore.put(note)

    const stored = await notesStore.all()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toEqual(note)
  })

  it('overwrites on a second put with the same id', async () => {
    const note = make('design', 'First')
    await notesStore.put(note)
    await notesStore.put({ ...note, text: 'Second' })

    const stored = await notesStore.all()
    expect(stored).toHaveLength(1)
    expect(stored[0].text).toBe('Second')
  })

  it('deletes a single note', async () => {
    const keep = make('design', 'Keep')
    const drop = make('design', 'Drop')
    await notesStore.put(keep)
    await notesStore.put(drop)

    await notesStore.remove(drop.id)

    const stored = await notesStore.all()
    expect(stored.map((note) => note.id)).toEqual([keep.id])
  })

  it('clears everything', async () => {
    await notesStore.put(make('design', 'One'))
    await notesStore.put(make('ops', 'Two'))

    await notesStore.clear()

    await expect(notesStore.all()).resolves.toEqual([])
  })

  it('replaces the whole base in one transaction', async () => {
    await notesStore.put(make('old', 'Gone'))
    const incoming = [make('new', 'Kept A'), make('new', 'Kept B')]

    await notesStore.replaceAll(incoming)

    const stored = await notesStore.all()
    expect(stored).toHaveLength(2)
    expect(stored.map((note) => note.text).sort()).toEqual(['Kept A', 'Kept B'])
  })
})

describe('draftToNote', () => {
  it('derives the topic key and trims the text', () => {
    const note = draftToNote({ topic: '  Design  System ', text: '  hello  ', deadline: '' })
    expect(note.topic).toBe('Design System')
    expect(note.topicKey).toBe('design-system')
    expect(note.text).toBe('hello')
    expect(note.deadline).toBeNull()
  })

  it('keeps the original id and creation time when editing', () => {
    const original = draftToNote({ topic: 'design', text: 'first', deadline: null })
    const edited = draftToNote({ topic: 'ops', text: 'second', deadline: '2026-10-01' }, original)

    expect(edited.id).toBe(original.id)
    expect(edited.createdAt).toBe(original.createdAt)
    expect(edited.topicKey).toBe('ops')
    expect(edited.deadline).toBe('2026-10-01')
  })
})
