import { describe, expect, it } from 'vitest'
import { layoutBounds, seedNode, simulationStep, type LayoutNode } from './force-layout'
import type { GraphData } from './types'

const OPTIONS = { width: 800, height: 600 }

function distance(a: LayoutNode, b: LayoutNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function nodesFrom(ids: string[]): Map<string, LayoutNode> {
  return new Map(ids.map((id, index) => [id, seedNode(id, index, OPTIONS)]))
}

describe('seedNode', () => {
  it('is deterministic for the same id', () => {
    expect(seedNode('topic:design', 0, OPTIONS)).toEqual(seedNode('topic:design', 0, OPTIONS))
  })

  it('puts different nodes in different places', () => {
    const a = seedNode('topic:design', 0, OPTIONS)
    const b = seedNode('topic:ops', 1, OPTIONS)
    expect(distance(a, b)).toBeGreaterThan(0)
  })
})

describe('simulationStep', () => {
  it('pushes crowded nodes apart', () => {
    const nodes = nodesFrom(['a', 'b'])
    // Start them almost on top of each other; repulsion should win locally.
    nodes.get('a')!.x = 400
    nodes.get('a')!.y = 300
    nodes.get('b')!.x = 405
    nodes.get('b')!.y = 300
    const data: GraphData = { nodes: [], links: [] }

    for (let i = 0; i < 60; i += 1) simulationStep(nodes, data, 1, OPTIONS)

    expect(distance(nodes.get('a')!, nodes.get('b')!)).toBeGreaterThan(40)
  })

  it('settles a loose pair at a stable spread rather than drifting apart', () => {
    const nodes = nodesFrom(['a', 'b'])
    nodes.get('a')!.x = 100
    nodes.get('a')!.y = 300
    nodes.get('b')!.x = 700
    nodes.get('b')!.y = 300

    for (let i = 0; i < 600; i += 1) simulationStep(nodes, { nodes: [], links: [] }, 1, OPTIONS)

    const settled = distance(nodes.get('a')!, nodes.get('b')!)
    expect(settled).toBeGreaterThan(50)
    expect(settled).toBeLessThan(200)
  })

  it('pulls linked nodes towards the link distance', () => {
    const nodes = nodesFrom(['a', 'b'])
    nodes.get('a')!.x = 0
    nodes.get('a')!.y = 300
    nodes.get('b')!.x = 700
    nodes.get('b')!.y = 300
    const data: GraphData = { nodes: [], links: [{ source: 'a', target: 'b' }] }

    for (let i = 0; i < 400; i += 1) simulationStep(nodes, data, 1, OPTIONS)

    const settled = distance(nodes.get('a')!, nodes.get('b')!)
    expect(settled).toBeLessThan(700)
    expect(settled).toBeGreaterThan(20)
  })

  it('holds a pinned node in place while the rest moves', () => {
    const nodes = nodesFrom(['a', 'b'])
    const pinned = nodes.get('a')!
    pinned.pinned = true
    const { x, y } = pinned

    for (let i = 0; i < 30; i += 1) simulationStep(nodes, { nodes: [], links: [] }, 1, OPTIONS)

    expect(pinned.x).toBe(x)
    expect(pinned.y).toBe(y)
  })

  it('survives two nodes sitting on the exact same point', () => {
    const nodes = nodesFrom(['a', 'b'])
    nodes.get('b')!.x = nodes.get('a')!.x
    nodes.get('b')!.y = nodes.get('a')!.y

    simulationStep(nodes, { nodes: [], links: [] }, 1, OPTIONS)

    expect(Number.isFinite(nodes.get('a')!.x)).toBe(true)
    expect(Number.isFinite(nodes.get('b')!.x)).toBe(true)
  })

  it('ignores links pointing at nodes that are gone', () => {
    const nodes = nodesFrom(['a'])
    expect(() =>
      simulationStep(nodes, { nodes: [], links: [{ source: 'a', target: 'ghost' }] }, 1, OPTIONS),
    ).not.toThrow()
  })
})

describe('layoutBounds', () => {
  it('measures the extent of the laid-out nodes', () => {
    const nodes: LayoutNode[] = [
      { id: 'a', x: 10, y: 20, vx: 0, vy: 0, pinned: false },
      { id: 'b', x: 110, y: 220, vx: 0, vy: 0, pinned: false },
    ]
    expect(layoutBounds(nodes)).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 220,
      width: 100,
      height: 200,
    })
  })

  it('returns zeroes for an empty graph', () => {
    expect(layoutBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 })
  })
})
