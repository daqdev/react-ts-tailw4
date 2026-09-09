import { createZip, type ZipEntry } from '@/lib/zip'
import { summarizeTopics } from './graph'
import { cleanTopic, TOPIC_SEPARATOR, topicSegments } from './topic'
import { SCHEMA_VERSION, type Note } from './types'

export interface NotesExport {
  schemaVersion: number
  exportedAt: string
  noteCount: number
  notes: Note[]
}

export function toJSON(notes: Note[], now = new Date()): string {
  const payload: NotesExport = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    noteCount: notes.length,
    notes: [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

/** Strip characters that are illegal in file names on Windows or macOS. */
function safeFileName(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'note'
}

function titleOf(note: Note): string {
  const firstLine = note.text.trim().split('\n')[0] ?? ''
  return firstLine.length > 60 ? firstLine.slice(0, 60).trim() : firstLine || 'Untitled note'
}

/** One note as a Markdown file with YAML frontmatter, Obsidian-style. */
export function noteToMarkdown(note: Note): string {
  const frontmatter = [
    '---',
    `id: ${note.id}`,
    `topic: "${cleanTopic(note.topic).replace(/"/g, '\\"')}"`,
    `topicKey: ${note.topicKey}`,
    `deadline: ${note.deadline ?? 'null'}`,
    `created: ${note.createdAt}`,
    `updated: ${note.updatedAt}`,
    '---',
  ].join('\n')

  // The topic link is what makes the vault a graph when opened in Obsidian.
  const topicLink = `Topic: [[${cleanTopic(note.topic)}]]`
  return `${frontmatter}\n\n# ${titleOf(note)}\n\n${topicLink}\n\n${note.text.trim()}\n`
}

/** An index page per topic, listing and linking its notes. */
function topicToMarkdown(label: string, notes: Note[]): string {
  const lines = notes
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((note) => {
      const due = note.deadline ? ` - due ${note.deadline}` : ''
      return `- [[${safeFileName(titleOf(note))}]]${due}`
    })
  return `# ${label}\n\n${notes.length} note${notes.length === 1 ? '' : 's'}.\n\n${lines.join('\n')}\n`
}

/**
 * The whole base as a folder of Markdown files: one file per note under a
 * folder per topic, plus a topic index. Unzips straight into an Obsidian
 * vault, and is equally readable by an agent walking the directory.
 */
export function toVaultEntries(notes: Note[]): ZipEntry[] {
  const entries: ZipEntry[] = []
  const byTopic = new Map<string, Note[]>()
  const usedNames = new Set<string>()

  for (const note of notes) {
    const label = cleanTopic(note.topic) || 'Inbox'
    const bucket = byTopic.get(label)
    if (bucket) bucket.push(note)
    else byTopic.set(label, [note])
  }

  for (const [label, topicNotes] of byTopic) {
    const folder = topicSegments(label).map(safeFileName).join('/') || 'Inbox'
    entries.push({ name: `${folder}/_index.md`, content: topicToMarkdown(label, topicNotes) })

    for (const note of topicNotes) {
      let name = `${folder}/${safeFileName(titleOf(note))}.md`
      // Two notes can share a first line; keep both by suffixing the id.
      if (usedNames.has(name)) {
        name = `${folder}/${safeFileName(titleOf(note))} (${note.id.slice(0, 6)}).md`
      }
      usedNames.add(name)
      entries.push({ name, content: noteToMarkdown(note) })
    }
  }

  entries.push({ name: 'README.md', content: vaultReadme(notes) })
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

function vaultReadme(notes: Note[]): string {
  const topics = summarizeTopics(notes, '9999-12-31')
  return [
    '# Knowledge base export',
    '',
    `${notes.length} notes across ${topics.length} topics.`,
    '',
    'Each note is a Markdown file with YAML frontmatter. Notes live in a folder',
    `named after their topic; nested topics use "${TOPIC_SEPARATOR}" in the topic field`,
    'and become nested folders. `_index.md` in each folder links that topic\'s notes.',
    '',
    '## Topics',
    '',
    ...topics.map((topic) => `- ${topic.label} - ${topic.noteCount} notes`),
    '',
  ].join('\n')
}

export function toVaultZip(notes: Note[], now = new Date()): Blob {
  return createZip(toVaultEntries(notes), now)
}

/**
 * A single plain-text digest of the whole base, shaped for pasting into an
 * AI agent's context: schema first, then every note grouped by topic.
 */
export function toAgentDigest(notes: Note[], today: string): string {
  const topics = summarizeTopics(notes, today)
  const byKey = new Map<string, Note[]>()
  for (const note of notes) {
    const bucket = byKey.get(note.topicKey)
    if (bucket) bucket.push(note)
    else byKey.set(note.topicKey, [note])
  }

  const header = [
    '# Knowledge base',
    '',
    `Schema version ${SCHEMA_VERSION}. ${notes.length} notes, ${topics.length} topics. Today is ${today}.`,
    '',
    'Each note has: topic (a "/"-separated path), text, and an optional deadline',
    '(ISO yyyy-mm-dd). Notes are connected through shared topics; a topic path',
    'nests one hub inside another. Deadlines in the past are overdue.',
    '',
  ]

  const body = topics.flatMap((topic) => {
    const topicNotes = (byKey.get(topic.key) ?? [])
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const overdue = topic.overdueCount ? `, ${topic.overdueCount} overdue` : ''
    return [
      `## ${topic.label}  (${topic.noteCount} notes${overdue})`,
      '',
      ...topicNotes.flatMap((note) => [
        `- [${note.id.slice(0, 8)}] deadline: ${note.deadline ?? 'none'}`,
        ...note.text
          .trim()
          .split('\n')
          .map((line) => `  ${line}`),
      ]),
      '',
    ]
  })

  return [...header, ...body].join('\n')
}
