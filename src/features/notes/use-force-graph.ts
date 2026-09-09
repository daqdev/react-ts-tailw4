import { useCallback, useEffect, useRef, useState } from 'react'
import { seedNode, simulationStep, type LayoutNode, type LayoutOptions } from './force-layout'
import type { GraphData } from './types'

const ALPHA_START = 1
const ALPHA_DECAY = 0.02
const ALPHA_MIN = 0.02

/**
 * Runs the force simulation on an animation frame loop and re-renders each
 * tick. Positions live in a ref so a frame costs one state bump rather than
 * a new object per node.
 */
export function useForceGraph(data: GraphData, options: LayoutOptions) {
  const nodesRef = useRef(new Map<string, LayoutNode>())
  const alphaRef = useRef(ALPHA_START)
  const frameRef = useRef<number | undefined>(undefined)
  const [, setTick] = useState(0)
  /** Flips to true when the simulation has come to rest for this data. */
  const [settled, setSettled] = useState(false)

  const reheat = useCallback(() => {
    alphaRef.current = ALPHA_START
    setSettled(false)
  }, [])

  // Keep the node map in step with the data, preserving positions of nodes
  // that survived so adding a note nudges the graph instead of rebuilding it.
  useEffect(() => {
    const nodes = nodesRef.current
    const ids = new Set(data.nodes.map((node) => node.id))
    for (const id of [...nodes.keys()]) {
      if (!ids.has(id)) nodes.delete(id)
    }
    data.nodes.forEach((node, index) => {
      if (!nodes.has(node.id)) nodes.set(node.id, seedNode(node.id, index, options))
    })
    alphaRef.current = ALPHA_START
    setSettled(false)
    setTick((tick) => tick + 1)
    // `options` changes identity every render; the layout only needs to react
    // to the data and the canvas size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, options.width, options.height])

  useEffect(() => {
    const step = () => {
      if (alphaRef.current > ALPHA_MIN) {
        simulationStep(nodesRef.current, data, alphaRef.current, options)
        alphaRef.current *= 1 - ALPHA_DECAY
        if (alphaRef.current <= ALPHA_MIN) setSettled(true)
        setTick((tick) => tick + 1)
      }
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, options.width, options.height])

  const setPosition = useCallback((id: string, x: number, y: number) => {
    const node = nodesRef.current.get(id)
    if (!node) return
    node.x = x
    node.y = y
    node.vx = 0
    node.vy = 0
    setTick((tick) => tick + 1)
  }, [])

  const setPinned = useCallback((id: string, pinned: boolean) => {
    const node = nodesRef.current.get(id)
    if (node) node.pinned = pinned
  }, [])

  return { nodes: nodesRef.current, settled, reheat, setPosition, setPinned }
}
