import { cleanTopic, topicKey } from './topic'
import { SCHEMA_VERSION, type Note } from './types'

export interface ImportResult {
  notes: Note[]
  /** Records that were dropped, with the reason, so nothing fails silently. */
  skipped: { index: number; reason: string }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Parse an exported JSON file back into notes, repairing what is repairable
 * (missing ids, missing topic keys, missing timestamps) and reporting the rest.
 */
export function parseImport(raw: string, now = new Date()): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (isRecord(parsed) && typeof parsed.schemaVersion === 'number') {
    if (parsed.schemaVersion > SCHEMA_VERSION) {
      throw new Error(
        `This file uses schema version ${parsed.schemaVersion}; this app understands ${SCHEMA_VERSION}.`,
      )
    }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.notes)
      ? parsed.notes
      : null

  if (!list) throw new Error('Expected a JSON array of notes, or an export with a "notes" array.')

  const notes: Note[] = []
  const skipped: ImportResult['skipped'] = []
  const seenIds = new Set<string>()
  const timestamp = now.toISOString()

  list.forEach((entry, index) => {
    if (!isRecord(entry)) {
      skipped.push({ index, reason: 'not an object' })
      return
    }
    const text = asString(entry.text)?.trim()
    const topic = cleanTopic(asString(entry.topic) ?? '')
    if (!text) {
      skipped.push({ index, reason: 'missing text' })
      return
    }
    if (!topic) {
      skipped.push({ index, reason: 'missing topic' })
      return
    }

    const deadline = asString(entry.deadline)
    let id = asString(entry.id) ?? newId()
    if (seenIds.has(id)) id = newId()
    seenIds.add(id)

    notes.push({
      id,
      topic,
      topicKey: asString(entry.topicKey) || topicKey(topic),
      text,
      deadline: deadline && ISO_DATE.test(deadline) ? deadline : null,
      createdAt: asString(entry.createdAt) ?? timestamp,
      updatedAt: asString(entry.updatedAt) ?? timestamp,
    })
  })

  return { notes, skipped }
}

/** Merge imported notes into the current base, newest write winning per id. */
export function mergeNotes(current: Note[], incoming: Note[]): Note[] {
  const byId = new Map(current.map((note) => [note.id, note]))
  for (const note of incoming) {
    const existing = byId.get(note.id)
    if (!existing || note.updatedAt >= existing.updatedAt) byId.set(note.id, note)
  }
  return [...byId.values()]
}
