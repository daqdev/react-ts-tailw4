import { describe, expect, it } from 'vitest'
import { mergeNotes, parseImport } from './import'
import type { Note } from './types'

const VALID = {
  schemaVersion: 1,
  notes: [
    {
      id: 'note-1',
      topic: 'Product/Onboarding',
      topicKey: 'product/onboarding',
      text: 'Welcome email',
      deadline: '2026-09-01',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ],
}

describe('parseImport', () => {
  it('reads an export envelope', () => {
    const { notes, skipped } = parseImport(JSON.stringify(VALID))
    expect(skipped).toEqual([])
    expect(notes).toHaveLength(1)
    expect(notes[0].topicKey).toBe('product/onboarding')
  })

  it('also reads a bare array of notes', () => {
    const { notes } = parseImport(JSON.stringify(VALID.notes))
    expect(notes).toHaveLength(1)
  })

  it('recomputes a missing topic key', () => {
    const { notes } = parseImport(
      JSON.stringify([{ topic: 'Design System', text: 'hi' }]),
    )
    expect(notes[0].topicKey).toBe('design-system')
    expect(notes[0].id).toBeTruthy()
    expect(notes[0].createdAt).toBeTruthy()
  })

  it('drops records without text or topic, and says which', () => {
    const { notes, skipped } = parseImport(
      JSON.stringify([
        { topic: 'a', text: 'keep' },
        { topic: 'a', text: '   ' },
        { topic: '', text: 'no topic' },
        'not an object',
      ]),
    )

    expect(notes).toHaveLength(1)
    expect(skipped).toEqual([
      { index: 1, reason: 'missing text' },
      { index: 2, reason: 'missing topic' },
      { index: 3, reason: 'not an object' },
    ])
  })

  it('nulls a malformed deadline rather than failing the note', () => {
    const { notes } = parseImport(
      JSON.stringify([{ topic: 'a', text: 'hi', deadline: 'next tuesday' }]),
    )
    expect(notes[0].deadline).toBeNull()
  })

  it('de-duplicates repeated ids', () => {
    const { notes } = parseImport(
      JSON.stringify([
        { id: 'same', topic: 'a', text: 'one' },
        { id: 'same', topic: 'a', text: 'two' },
      ]),
    )
    expect(notes).toHaveLength(2)
    expect(notes[0].id).not.toBe(notes[1].id)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseImport('{ nope')).toThrow(/not valid JSON/)
  })

  it('rejects a shape it does not recognise', () => {
    expect(() => parseImport('{"hello":"world"}')).toThrow(/Expected a JSON array/)
  })

  it('refuses a newer schema version rather than guessing', () => {
    expect(() => parseImport(JSON.stringify({ schemaVersion: 99, notes: [] }))).toThrow(
      /schema version 99/,
    )
  })
})

describe('mergeNotes', () => {
  const base: Note = {
    id: 'n1',
    topic: 'a',
    topicKey: 'a',
    text: 'original',
    deadline: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('adds notes that are not present yet', () => {
    const incoming = { ...base, id: 'n2', text: 'new' }
    expect(mergeNotes([base], [incoming])).toHaveLength(2)
  })

  it('lets the newer edit win', () => {
    const newer = { ...base, text: 'updated', updatedAt: '2026-06-01T00:00:00.000Z' }
    expect(mergeNotes([base], [newer])[0].text).toBe('updated')
  })

  it('keeps the local note when the import is older', () => {
    const older = { ...base, text: 'stale', updatedAt: '2025-01-01T00:00:00.000Z' }
    expect(mergeNotes([base], [older])[0].text).toBe('original')
  })
})
