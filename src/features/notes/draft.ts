import { cleanTopic, topicKey } from './topic'
import type { Note, NoteDraft } from './types'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Normalise a draft into a stored note, deriving the topic key used for links. */
export function draftToNote(draft: NoteDraft, base?: Note): Note {
  const topic = cleanTopic(draft.topic)
  const now = new Date().toISOString()
  return {
    id: base?.id ?? newId(),
    topic,
    topicKey: topicKey(topic),
    text: draft.text.trim(),
    deadline: draft.deadline || null,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  }
}
