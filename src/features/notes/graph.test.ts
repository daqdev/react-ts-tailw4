import { describe, expect, it } from 'vitest'
import { buildGraph, noteLabel, relatedNotes, summarizeTopics } from './graph'
import type { Note } from './types'

function note(overrides: Partial<Note> & { id: string; topic: string }): Note {
  return {
    text: `Note ${overrides.id}`,
    topicKey: overrides.topic.toLowerCase().replace(/\s+/g, '-'),
    deadline: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildGraph', () => {
  it('hangs each note off its topic hub', () => {
    const graph = buildGraph([note({ id: 'a', topic: 'design' }), note({ id: 'b', topic: 'design' })])

    expect(graph.nodes.filter((n) => n.kind === 'topic')).toHaveLength(1)
    expect(graph.nodes.filter((n) => n.kind === 'note')).toHaveLength(2)
    expect(graph.links).toHaveLength(2)
    expect(graph.links.every((link) => link.source === 'topic:design')).toBe(true)
  })

  it('connects notes that share a topic through the hub', () => {
    const graph = buildGraph([note({ id: 'a', topic: 'design' }), note({ id: 'b', topic: 'design' })])
    const hub = graph.nodes.find((n) => n.kind === 'topic')!

    expect(hub.weight).toBe(2)
    const neighbours = graph.links.filter((l) => l.source === hub.id).map((l) => l.target)
    expect(neighbours).toEqual(['note:a', 'note:b'])
  })

  it('nests topic paths so hubs link to hubs', () => {
    const graph = buildGraph([
      note({ id: 'a', topic: 'Product/Onboarding', topicKey: 'product/onboarding' }),
      note({ id: 'b', topic: 'Product/Billing', topicKey: 'product/billing' }),
    ])

    const topicIds = graph.nodes.filter((n) => n.kind === 'topic').map((n) => n.id)
    expect(topicIds).toContain('topic:product')
    expect(topicIds).toContain('topic:product/onboarding')
    expect(topicIds).toContain('topic:product/billing')

    // The two sub-topics are joined through their shared parent.
    expect(graph.links).toContainEqual({ source: 'topic:product', target: 'topic:product/onboarding' })
    expect(graph.links).toContainEqual({ source: 'topic:product', target: 'topic:product/billing' })
  })

  it('labels a nested hub with its own segment, not the full path', () => {
    const graph = buildGraph([
      note({ id: 'a', topic: 'Product/Onboarding', topicKey: 'product/onboarding' }),
    ])
    expect(graph.nodes.find((n) => n.id === 'topic:product/onboarding')!.label).toBe('Onboarding')
    expect(graph.nodes.find((n) => n.id === 'topic:product')!.label).toBe('Product')
  })

  it('never emits a duplicate link', () => {
    const graph = buildGraph([
      note({ id: 'a', topic: 'Product/Onboarding', topicKey: 'product/onboarding' }),
      note({ id: 'b', topic: 'Product/Onboarding', topicKey: 'product/onboarding' }),
    ])
    const ids = graph.links.map((link) => `${link.source}->${link.target}`)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('skips notes whose topic normalises to nothing', () => {
    expect(buildGraph([note({ id: 'a', topic: '!!!', topicKey: '' })]).nodes).toHaveLength(0)
  })

  it('returns an empty graph for an empty base', () => {
    expect(buildGraph([])).toEqual({ nodes: [], links: [] })
  })
})

describe('noteLabel', () => {
  it('uses the first line and truncates long ones', () => {
    expect(noteLabel(note({ id: 'a', topic: 't', text: 'Title\nbody' }))).toBe('Title')
    expect(noteLabel(note({ id: 'a', topic: 't', text: 'x'.repeat(60) })).length).toBe(48)
  })

  it('falls back for an empty note', () => {
    expect(noteLabel(note({ id: 'a', topic: 't', text: '   ' }))).toBe('Untitled note')
  })
})

describe('summarizeTopics', () => {
  it('counts notes, tracks the nearest deadline and overdue notes', () => {
    const topics = summarizeTopics(
      [
        note({ id: 'a', topic: 'design', deadline: '2026-09-01' }),
        note({ id: 'b', topic: 'design', deadline: '2026-12-01' }),
        note({ id: 'c', topic: 'ops' }),
      ],
      '2026-09-09',
    )

    expect(topics.map((topic) => topic.key)).toEqual(['design', 'ops'])
    expect(topics[0]).toMatchObject({
      noteCount: 2,
      nextDeadline: '2026-09-01',
      overdueCount: 1,
    })
    expect(topics[1]).toMatchObject({ noteCount: 1, nextDeadline: null, overdueCount: 0 })
  })

  it('prefers the most recently used spelling of a topic', () => {
    const topics = summarizeTopics(
      [
        note({ id: 'a', topic: 'design system', topicKey: 'design-system' }),
        note({
          id: 'b',
          topic: 'Design System',
          topicKey: 'design-system',
          updatedAt: '2026-06-01T00:00:00.000Z',
        }),
      ],
      '2026-09-09',
    )

    expect(topics).toHaveLength(1)
    expect(topics[0].label).toBe('Design System')
  })
})

describe('relatedNotes', () => {
  it('returns the note neighbours, excluding itself', () => {
    const a = note({ id: 'a', topic: 'design' })
    const b = note({ id: 'b', topic: 'design' })
    const c = note({ id: 'c', topic: 'ops' })

    expect(relatedNotes([a, b, c], a)).toEqual([b])
    expect(relatedNotes([a, b, c], c)).toEqual([])
  })
})
