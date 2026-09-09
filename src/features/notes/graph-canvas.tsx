import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deadlineStatus, type DeadlineStatus } from './deadline'
import { layoutBounds } from './force-layout'
import { useForceGraph } from './use-force-graph'
import type { GraphData, GraphNode, Note } from './types'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3

/** Note colour follows its deadline; topics are always the accent colour. */
function noteFill(status: DeadlineStatus): string {
  switch (status) {
    case 'overdue':
      return 'fill-destructive'
    case 'today':
    case 'soon':
      return 'fill-warning'
    default:
      return 'fill-chart-2'
  }
}

function radiusOf(node: GraphNode): number {
  return node.kind === 'topic' ? 9 + Math.min(12, Math.sqrt(node.weight) * 3) : 5.5
}

export interface GraphCanvasProps {
  data: GraphData
  notes: Note[]
  today: string
  selectedId: string | null
  onSelect: (node: GraphNode | null) => void
  height?: number
}

interface Viewport {
  x: number
  y: number
  k: number
}

export function GraphCanvas({
  data,
  notes,
  today,
  selectedId,
  onSelect,
  height = 520,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 800, height })
  const [view, setView] = useState<Viewport>({ x: 0, y: 0, k: 1 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dragRef = useRef<{ id: string | null; pointerId: number; startX: number; startY: number }>({
    id: null,
    pointerId: -1,
    startX: 0,
    startY: 0,
  })

  const options = useMemo(
    () => ({ width: size.width, height: size.height }),
    [size.width, size.height],
  )
  const { nodes: positions, settled, setPosition, setPinned, reheat } = useForceGraph(data, options)

  // Track the container width so the graph fills whatever column it is in.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, entry.contentRect.width)
      setSize((current) => (current.width === width ? current : { width, height }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [height])

  const statusByNoteId = useMemo(() => {
    const map = new Map<string, DeadlineStatus>()
    for (const note of notes) map.set(note.id, deadlineStatus(note.deadline, today))
    return map
  }, [notes, today])

  /** Convert a pointer event to simulation coordinates. */
  const toGraphPoint = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (event.clientX - rect.left - view.x) / view.k,
        y: (event.clientY - rect.top - view.y) / view.k,
      }
    },
    [view],
  )

  const handlePointerDown = (event: React.PointerEvent, nodeId: string | null) => {
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    dragRef.current = {
      id: nodeId,
      pointerId: event.pointerId,
      startX: event.clientX - view.x,
      startY: event.clientY - view.y,
    }
    if (nodeId) setPinned(nodeId, true)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (drag.pointerId !== event.pointerId) return
    if (drag.id) {
      const point = toGraphPoint(event)
      setPosition(drag.id, point.x, point.y)
    } else if (drag.pointerId !== -1) {
      setView((current) => ({
        ...current,
        x: event.clientX - drag.startX,
        y: event.clientY - drag.startY,
      }))
    }
  }

  const endDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (drag.pointerId !== event.pointerId) return
    if (drag.id) {
      setPinned(drag.id, false)
      reheat()
    }
    dragRef.current = { id: null, pointerId: -1, startX: 0, startY: 0 }
  }

  const handleWheel = (event: React.WheelEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    setView((current) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * (event.deltaY < 0 ? 1.12 : 0.89)))
      const ratio = k / current.k
      // Keep the point under the cursor fixed while zooming.
      return { k, x: pointerX - (pointerX - current.x) * ratio, y: pointerY - (pointerY - current.y) * ratio }
    })
  }

  const fitToView = useCallback(() => {
    const bounds = layoutBounds(positions.values())
    if (!bounds.width && !bounds.height) {
      setView({ x: 0, y: 0, k: 1 })
      return
    }
    const padding = 60
    const k = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min(
          size.width / (bounds.width + padding * 2),
          size.height / (bounds.height + padding * 2),
        ),
      ),
    )
    setView({
      k,
      x: size.width / 2 - ((bounds.minX + bounds.maxX) / 2) * k,
      y: size.height / 2 - ((bounds.minY + bounds.maxY) / 2) * k,
    })
  }, [positions, size.width, size.height])

  // Frame the graph once it comes to rest, so it fills the canvas rather than
  // sitting as a small cluster in the middle.
  useEffect(() => {
    if (settled) fitToView()
    // fitToView reads live positions; re-running it on every identity change
    // would fight the user's own pan and zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled])

  const nodeById = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes])
  const neighbourIds = useMemo(() => {
    if (!selectedId) return null
    const ids = new Set<string>([selectedId])
    for (const link of data.links) {
      if (link.source === selectedId) ids.add(link.target)
      if (link.target === selectedId) ids.add(link.source)
    }
    return ids
  }, [data.links, selectedId])

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        role="img"
        aria-label={`Knowledge graph with ${data.nodes.length} nodes`}
        className="touch-none rounded-xl border bg-card select-none"
        onPointerDown={(event) => {
          if (event.target === svgRef.current) {
            handlePointerDown(event, null)
            onSelect(null)
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {data.links.map((link) => {
            const source = positions.get(link.source)
            const target = positions.get(link.target)
            if (!source || !target) return null
            const dimmed = neighbourIds
              ? !(neighbourIds.has(link.source) && neighbourIds.has(link.target))
              : false
            return (
              <line
                key={`${link.source}->${link.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className="stroke-border"
                strokeWidth={1.25}
                opacity={dimmed ? 0.25 : 0.9}
              />
            )
          })}

          {data.nodes.map((node) => {
            const position = positions.get(node.id)
            if (!position) return null
            const radius = radiusOf(node)
            const isSelected = node.id === selectedId
            const isHovered = node.id === hoveredId
            const dimmed = neighbourIds ? !neighbourIds.has(node.id) : false
            const fill =
              node.kind === 'topic'
                ? 'fill-primary'
                : noteFill(statusByNoteId.get(node.noteId ?? '') ?? 'none')

            return (
              <g
                key={node.id}
                transform={`translate(${position.x} ${position.y})`}
                opacity={dimmed ? 0.3 : 1}
                className="cursor-pointer"
                onPointerDown={(event) => {
                  event.stopPropagation()
                  handlePointerDown(event, node.id)
                }}
                onPointerEnter={() => setHoveredId(node.id)}
                onPointerLeave={() => setHoveredId((current) => (current === node.id ? null : current))}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(nodeById.get(node.id) ?? null)
                }}
              >
                {isSelected && (
                  <circle r={radius + 5} className="fill-none stroke-ring" strokeWidth={2} />
                )}
                <circle r={radius} className={`${fill} stroke-card`} strokeWidth={1.5} />
                {(node.kind === 'topic' || isHovered || isSelected) && (
                  <text
                    y={radius + 13}
                    textAnchor="middle"
                    className={
                      node.kind === 'topic'
                        ? 'fill-foreground text-[11px] font-medium'
                        : 'fill-muted-foreground text-[10px]'
                    }
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="absolute top-3 right-3 flex gap-1">
        <button
          type="button"
          onClick={fitToView}
          className="rounded-md border bg-background/90 px-2 py-1 text-xs shadow-xs backdrop-blur hover:bg-accent"
        >
          Fit
        </button>
        <button
          type="button"
          onClick={reheat}
          className="rounded-md border bg-background/90 px-2 py-1 text-xs shadow-xs backdrop-blur hover:bg-accent"
        >
          Re-layout
        </button>
      </div>
    </div>
  )
}
