import { describe, expect, it } from 'vitest'
import { noteToMarkdown, toAgentDigest, toJSON, toVaultEntries } from './export'
import { SCHEMA_VERSION, type Note } from './types'

function note(overrides: Partial<Note> & { id: string; topic: string; topicKey: string }): Note {
  return {
    text: 'A note',
    deadline: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const notes: Note[] = [
  note({
    id: 'aaaaaaaa-1111',
    topic: 'Product/Onboarding',
    topicKey: 'product/onboarding',
    text: 'Welcome email\nRewrite the first paragraph.',
    deadline: '2026-09-01',
    createdAt: '2026-02-01T00:00:00.000Z',
  }),
  note({
    id: 'bbbbbbbb-2222',
    topic: 'Product/Onboarding',
    topicKey: 'product/onboarding',
    text: 'Signup funnel',
    createdAt: '2026-03-01T00:00:00.000Z',
  }),
  note({
    id: 'cccccccc-3333',
    topic: 'Ops',
    topicKey: 'ops',
    text: 'Rotate keys',
    deadline: '2026-12-01',
    createdAt: '2026-01-15T00:00:00.000Z',
  }),
]

describe('toJSON', () => {
  it('stamps the schema version and the note count', () => {
    const parsed = JSON.parse(toJSON(notes, new Date('2026-09-09T10:00:00Z')))
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.noteCount).toBe(3)
    expect(parsed.exportedAt).toBe('2026-09-09T10:00:00.000Z')
  })

  it('orders notes oldest first so diffs stay stable', () => {
    const parsed = JSON.parse(toJSON(notes))
    expect(parsed.notes.map((n: Note) => n.id)).toEqual([
      'cccccccc-3333',
      'aaaaaaaa-1111',
      'bbbbbbbb-2222',
    ])
  })
})

describe('noteToMarkdown', () => {
  it('writes YAML frontmatter, a title, and a topic link', () => {
    const markdown = noteToMarkdown(notes[0])
    expect(markdown).toMatch(/^---\n/)
    expect(markdown).toContain('id: aaaaaaaa-1111')
    expect(markdown).toContain('topic: "Product/Onboarding"')
    expect(markdown).toContain('topicKey: product/onboarding')
    expect(markdown).toContain('deadline: 2026-09-01')
    expect(markdown).toContain('# Welcome email')
    expect(markdown).toContain('Topic: [[Product/Onboarding]]')
    expect(markdown).toContain('Rewrite the first paragraph.')
  })

  it('writes null for a missing deadline', () => {
    expect(noteToMarkdown(notes[1])).toContain('deadline: null')
  })
})

describe('toVaultEntries', () => {
  it('folders notes by topic path and adds an index per topic', () => {
    const names = toVaultEntries(notes).map((entry) => entry.name)

    expect(names).toContain('Product/Onboarding/_index.md')
    expect(names).toContain('Product/Onboarding/Welcome email.md')
    expect(names).toContain('Ops/_index.md')
    expect(names).toContain('Ops/Rotate keys.md')
    expect(names).toContain('README.md')
  })

  it('links each topic index to its notes with the deadline', () => {
    const index = toVaultEntries(notes).find((e) => e.name === 'Product/Onboarding/_index.md')!
    expect(index.content).toContain('[[Welcome email]] - due 2026-09-01')
    expect(index.content).toContain('[[Signup funnel]]')
    expect(index.content).toContain('2 notes')
  })

  it('keeps both notes when two share a first line', () => {
    const duplicates = [
      note({ id: 'aaaa1111', topic: 'Ops', topicKey: 'ops', text: 'Same title' }),
      note({ id: 'bbbb2222', topic: 'Ops', topicKey: 'ops', text: 'Same title' }),
    ]
    const names = toVaultEntries(duplicates)
      .map((entry) => entry.name)
      .filter((name) => name.endsWith('.md') && !name.includes('_index') && name !== 'README.md')

    expect(names).toHaveLength(2)
    expect(new Set(names).size).toBe(2)
  })

  it('strips characters that are illegal in file names', () => {
    const awkward = [
      note({ id: 'x', topic: 'Ops', topicKey: 'ops', text: 'a/b:c*d?e "quoted"' }),
    ]
    const file = toVaultEntries(awkward).find((entry) => entry.name.startsWith('Ops/') && !entry.name.includes('_index'))!
    expect(file.name).not.toMatch(/[<>:"|?*]/)
    expect(file.name.split('/')).toHaveLength(2)
  })
})

describe('toAgentDigest', () => {
  it('explains the schema before listing the notes', () => {
    const digest = toAgentDigest(notes, '2026-09-09')
    expect(digest).toContain(`Schema version ${SCHEMA_VERSION}`)
    expect(digest).toContain('3 notes, 2 topics')
    expect(digest).toContain('Today is 2026-09-09')
    expect(digest).toContain('Notes are connected through shared topics')
  })

  it('groups notes under their topic and flags overdue counts', () => {
    const digest = toAgentDigest(notes, '2026-09-09')
    expect(digest).toContain('## Product/Onboarding  (2 notes, 1 overdue)')
    expect(digest).toContain('## Ops  (1 notes)')
    expect(digest).toContain('deadline: 2026-09-01')
    expect(digest).toContain('deadline: none')
  })

  it('indents multi-line note bodies so the structure survives', () => {
    const digest = toAgentDigest(notes, '2026-09-09')
    expect(digest).toContain('  Welcome email')
    expect(digest).toContain('  Rewrite the first paragraph.')
  })
})
