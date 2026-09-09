import type { GraphData } from './types'

export interface LayoutNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  /** Held in place while the user drags it. */
  pinned: boolean
}

export interface LayoutOptions {
  width: number
  height: number
  /** How hard unconnected nodes push each other apart. */
  repulsion?: number
  /** Rest length of a link. */
  linkDistance?: number
  linkStrength?: number
  /** Pull towards the centre, keeping detached clusters on screen. */
  gravity?: number
  damping?: number
}

const DEFAULTS: Required<Omit<LayoutOptions, 'width' | 'height'>> = {
  repulsion: 5200,
  linkDistance: 90,
  linkStrength: 0.06,
  gravity: 0.015,
  damping: 0.82,
}

/**
 * Deterministic pseudo-random seed from a node id, so the same graph always
 * lays out the same way and tests can assert on it.
 */
function seededAngle(id: string): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 3600) / 3600
}

/** Place a node that has no position yet on a ring around the centre. */
export function seedNode(id: string, index: number, options: LayoutOptions): LayoutNode {
  const angle = seededAngle(id) * Math.PI * 2
  const radius = 40 + (index % 12) * 22
  return {
    id,
    x: options.width / 2 + Math.cos(angle) * radius,
    y: options.height / 2 + Math.sin(angle) * radius,
    vx: 0,
    vy: 0,
    pinned: false,
  }
}

/**
 * One step of a spring-electrical simulation: links pull, every pair pushes,
 * and a weak gravity keeps the whole thing centred. O(n^2) per tick, which is
 * comfortable well past the few hundred notes this app is built for.
 */
export function simulationStep(
  nodes: Map<string, LayoutNode>,
  data: GraphData,
  alpha: number,
  options: LayoutOptions,
): void {
  const config = { ...DEFAULTS, ...options }
  const list = [...nodes.values()]

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]
      const b = list[j]
      let dx = b.x - a.x
      let dy = b.y - a.y
      let distanceSq = dx * dx + dy * dy
      if (distanceSq === 0) {
        // Perfectly coincident nodes would divide by zero; nudge them apart.
        dx = (seededAngle(a.id) - 0.5) * 0.1
        dy = (seededAngle(b.id) - 0.5) * 0.1
        distanceSq = dx * dx + dy * dy || 0.01
      }
      const distance = Math.sqrt(distanceSq)
      const force = (config.repulsion / distanceSq) * alpha
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force
      a.vx -= fx
      a.vy -= fy
      b.vx += fx
      b.vy += fy
    }
  }

  for (const link of data.links) {
    const source = nodes.get(link.source)
    const target = nodes.get(link.target)
    if (!source || !target) continue
    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.sqrt(dx * dx + dy * dy) || 0.01
    const force = (distance - config.linkDistance) * config.linkStrength * alpha
    const fx = (dx / distance) * force
    const fy = (dy / distance) * force
    source.vx += fx
    source.vy += fy
    target.vx -= fx
    target.vy -= fy
  }

  const centerX = config.width / 2
  const centerY = config.height / 2
  // Gravity is stronger along the shorter axis, so the cloud settles into the
  // shape of the canvas instead of a circle floating in a wide, empty box.
  const aspect = config.height > 0 ? config.width / config.height : 1
  const gravityX = config.gravity * (aspect < 1 ? 1 / aspect : 1)
  const gravityY = config.gravity * (aspect > 1 ? aspect : 1)
  for (const node of list) {
    node.vx += (centerX - node.x) * gravityX * alpha
    node.vy += (centerY - node.y) * gravityY * alpha

    if (node.pinned) {
      node.vx = 0
      node.vy = 0
      continue
    }
    node.vx *= config.damping
    node.vy *= config.damping
    node.x += node.vx
    node.y += node.vy
  }
}

/** Bounding box of the laid-out nodes, used to fit the view. */
export function layoutBounds(nodes: Iterable<LayoutNode>) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let count = 0
  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x)
    maxY = Math.max(maxY, node.y)
    count += 1
  }
  if (count === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}
