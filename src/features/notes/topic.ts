export const TOPIC_SEPARATOR = '/'

/**
 * Topics are what wire this knowledge base together: two notes are connected
 * when they normalise to the same topic key, so "Design System",
 * "design system" and " design  system " all land on one hub.
 *
 * A topic may also be a path — "Design/Tokens/Color" — which nests hubs
 * inside each other. That is what turns a pile of separate stars into one
 * navigable network, without asking for a fourth input on the form.
 */
export function topicSegments(topic: string): string[] {
  return topic
    .split(TOPIC_SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function slugSegment(segment: string): string {
  return segment
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Stable identity for a topic path, e.g. "Design / Tokens" -> "design/tokens". */
export function topicKey(topic: string): string {
  return topicSegments(topic).map(slugSegment).filter(Boolean).join(TOPIC_SEPARATOR)
}

/** Collapse whitespace and normalise separators, keeping the author's casing. */
export function cleanTopic(topic: string): string {
  return topicSegments(topic)
    .map((segment) => segment.replace(/\s+/g, ' '))
    .join(TOPIC_SEPARATOR)
}

/** Every ancestor key of a topic path, outermost first, excluding itself. */
export function ancestorKeys(key: string): string[] {
  const parts = key.split(TOPIC_SEPARATOR).filter(Boolean)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join(TOPIC_SEPARATOR))
}

/** The last segment of a topic path — what a graph node is labelled with. */
export function topicLeaf(label: string): string {
  const segments = topicSegments(label)
  return segments[segments.length - 1] ?? label
}
