import { ancestorKeys, cleanTopic, topicKey, topicLeaf, TOPIC_SEPARATOR } from './topic'
import type { GraphData, GraphLink, GraphNode, Note, TopicSummary } from './types'

export function noteNodeId(noteId: string): string {
  return `note:${noteId}`
}

export function topicNodeId(key: string): string {
  return `topic:${key}`
}

/** A short, stable label for a note node in the graph. */
export function noteLabel(note: Note): string {
  const firstLine = note.text.trim().split('\n')[0] ?? ''
  const label = firstLine.length > 48 ? `${firstLine.slice(0, 47)}…` : firstLine
  return label || 'Untitled note'
}

/**
 * Turn the flat note list into the network:
 *
 *   topic hub ── note        every note hangs off its topic
 *   topic hub ── sub-topic   nested paths ("Design/Tokens") link hub to hub
 *
 * Notes sharing a topic are therefore two hops apart, and the whole base ends
 * up connected through the topic tree rather than as separate islands.
 */
export function buildGraph(notes: Note[]): GraphData {
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const seenLinks = new Set<string>()

  const addLink = (source: string, target: string) => {
    const id = `${source}->${target}`
    if (seenLinks.has(id)) return
    seenLinks.add(id)
    links.push({ source, target })
  }

  const ensureTopic = (key: string, label: string) => {
    const id = topicNodeId(key)
    const existing = nodes.get(id)
    if (existing) return existing
    const node: GraphNode = { id, kind: 'topic', label, topicKey: key, weight: 0 }
    nodes.set(id, node)
    return node
  }

  for (const note of notes) {
    const key = note.topicKey || topicKey(note.topic)
    if (!key) continue

    // Materialise the whole ancestor chain so nested topics stay connected.
    const chain = [...ancestorKeys(key), key]
    const labels = cleanTopic(note.topic).split(TOPIC_SEPARATOR)
    chain.forEach((ancestorKey, index) => {
      ensureTopic(ancestorKey, topicLeaf(labels[index] ?? ancestorKey))
      if (index > 0) addLink(topicNodeId(chain[index - 1]), topicNodeId(ancestorKey))
    })

    const topicNode = nodes.get(topicNodeId(key))!
    topicNode.weight += 1

    const id = noteNodeId(note.id)
    nodes.set(id, {
      id,
      kind: 'note',
      label: noteLabel(note),
      topicKey: key,
      weight: 1,
      noteId: note.id,
    })
    addLink(topicNodeId(key), id)
  }

  return { nodes: [...nodes.values()], links }
}

/** Per-topic rollup for the sidebar/topic list, newest spelling wins. */
export function summarizeTopics(notes: Note[], today: string): TopicSummary[] {
  const byKey = new Map<string, TopicSummary & { updatedAt: string }>()

  for (const note of notes) {
    const key = note.topicKey || topicKey(note.topic)
    if (!key) continue
    const current = byKey.get(key)
    const isOverdue = !!note.deadline && note.deadline < today

    if (!current) {
      byKey.set(key, {
        key,
        label: cleanTopic(note.topic),
        noteCount: 1,
        nextDeadline: note.deadline,
        overdueCount: isOverdue ? 1 : 0,
        updatedAt: note.updatedAt,
      })
      continue
    }

    current.noteCount += 1
    if (isOverdue) current.overdueCount += 1
    if (note.deadline && (!current.nextDeadline || note.deadline < current.nextDeadline)) {
      current.nextDeadline = note.deadline
    }
    if (note.updatedAt > current.updatedAt) {
      current.updatedAt = note.updatedAt
      current.label = cleanTopic(note.topic)
    }
  }

  return [...byKey.values()]
    .map((entry): TopicSummary => ({
      key: entry.key,
      label: entry.label,
      noteCount: entry.noteCount,
      nextDeadline: entry.nextDeadline,
      overdueCount: entry.overdueCount,
    }))
    .sort((a, b) => b.noteCount - a.noteCount || a.key.localeCompare(b.key))
}

/** Notes that share a topic with the given note (its neighbours in the graph). */
export function relatedNotes(notes: Note[], note: Note): Note[] {
  return notes.filter((other) => other.id !== note.id && other.topicKey === note.topicKey)
}
