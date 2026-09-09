import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { buildGraph } from '@/features/notes/graph'
import { GraphCanvas } from '@/features/notes/graph-canvas'
import { NoteCard } from '@/features/notes/note-card'
import { useNotesView } from '@/features/notes/use-notes'
import type { GraphNode } from '@/features/notes/types'

export default function GraphPage() {
  const { notes, today } = useNotesView()
  const [selected, setSelected] = useState<GraphNode | null>(null)

  const graph = useMemo(() => buildGraph(notes), [notes])
  // Counts the hubs actually drawn, parent topics included — the sidebar's
  // topic list only counts leaves, so the two numbers legitimately differ.
  const hubCount = useMemo(
    () => graph.nodes.filter((node) => node.kind === 'topic').length,
    [graph.nodes],
  )

  const selectedNote = useMemo(
    () => (selected?.noteId ? notes.find((note) => note.id === selected.noteId) : undefined),
    [selected, notes],
  )
  const selectedTopicNotes = useMemo(
    () =>
      selected?.kind === 'topic'
        ? notes.filter((note) => note.topicKey === selected.topicKey)
        : [],
    [selected, notes],
  )

  return (
    <>
      <PageHeader
        title="Graph"
        description="Every note hangs off its topic; nested topics link hub to hub. Drag a node, scroll to zoom."
        actions={
          <Button asChild variant="outline">
            <Link to="/">Add a note</Link>
          </Button>
        }
      />

      {notes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            The graph builds itself as you add notes.{' '}
            <Link to="/" className="text-primary underline-offset-4 hover:underline">
              Add the first one
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GraphCanvas
              data={graph}
              notes={notes}
              today={today}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary" /> Topic
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-chart-2" /> Note
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warning" /> Due soon
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-destructive" /> Overdue
              </span>
            </div>
          </div>

          <Card className="content-start">
            <CardHeader>
              <CardTitle>{selected ? selected.label : 'Nothing selected'}</CardTitle>
              <CardDescription>
                {selected
                  ? selected.kind === 'topic'
                    ? `Topic hub · ${selectedTopicNotes.length} notes`
                    : 'Note'
                  : `${graph.nodes.length} nodes · ${graph.links.length} links · ${hubCount} hubs`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selected && (
                <p className="text-sm text-muted-foreground">
                  Click a node to see what it holds. Clicking dims everything it is not connected
                  to.
                </p>
              )}

              {selectedNote && (
                <>
                  <NoteCard note={selectedNote} today={today} active />
                  <Separator />
                  <Button asChild variant="outline" className="w-full">
                    <Link to={`/notes/${selectedNote.id}`}>Open note</Link>
                  </Button>
                </>
              )}

              {selected?.kind === 'topic' && (
                <div className="space-y-3">
                  <Badge variant="secondary">{selected.topicKey}</Badge>
                  {selectedTopicNotes.map((note) => (
                    <NoteCard key={note.id} note={note} today={today} />
                  ))}
                  {selectedTopicNotes.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      A parent topic — its notes live in the sub-topics below it.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
