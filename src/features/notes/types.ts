/** Schema version written into every export, so an agent can tell shapes apart. */
export const SCHEMA_VERSION = 1

export interface Note {
  id: string
  /** Free text as typed; `topicKey` is the normalised form used for linking. */
  topic: string
  topicKey: string
  text: string
  /** ISO date (yyyy-mm-dd) or null when the note has no deadline. */
  deadline: string | null
  createdAt: string
  updatedAt: string
}

/** What the capture form produces, before ids and timestamps are assigned. */
export interface NoteDraft {
  topic: string
  text: string
  deadline: string | null
}

export interface TopicSummary {
  key: string
  /** The most recently used spelling of the topic. */
  label: string
  noteCount: number
  /** Earliest upcoming deadline across the topic's notes, if any. */
  nextDeadline: string | null
  overdueCount: number
}

export type GraphNodeKind = 'topic' | 'note'

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  label: string
  /** Topic key this node belongs to — its own key for topics. */
  topicKey: string
  /** Notes attached, for topic nodes. */
  weight: number
  noteId?: string
}

export interface GraphLink {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}
