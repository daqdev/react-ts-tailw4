import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDeadline } from '@/features/notes/deadline'
import { relatedNotes } from '@/features/notes/graph'
import { NoteCard } from '@/features/notes/note-card'
import { NoteForm } from '@/features/notes/note-form'
import { useNote, useNotes, useNotesView } from '@/features/notes/use-notes'

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const note = useNote(id)
  const { updateNote, deleteNote, ready } = useNotes()
  const { notes, topics, today } = useNotesView()
  const [editing, setEditing] = useState(false)

  if (!ready) return null

  if (!note) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">That note no longer exists.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/">Back to notes</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const related = relatedNotes(notes, note)

  return (
    <>
      <PageHeader
        title={note.topic}
        description={`Created ${new Date(note.createdAt).toLocaleString()} · ${formatDeadline(
          note.deadline,
          today,
        )}`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link to="/">
                <ArrowLeft />
                Notes
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Stop editing' : 'Edit'}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this note?</DialogTitle>
                  <DialogDescription>
                    It is removed from the base and from the graph. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await deleteNote(note.id)
                      navigate('/')
                    }}
                  >
                    Delete note
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{editing ? 'Edit note' : 'Note'}</CardTitle>
            <CardDescription>
              <Badge variant="outline">{note.topicKey}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editing ? (
              <NoteForm
                topics={topics}
                defaultValues={{ topic: note.topic, text: note.text, deadline: note.deadline }}
                submitLabel="Save changes"
                onCancel={() => setEditing(false)}
                onSubmit={async (draft) => {
                  await updateNote(note.id, draft)
                  setEditing(false)
                }}
              />
            ) : (
              <p className="whitespace-pre-wrap">{note.text}</p>
            )}
          </CardContent>
        </Card>

        <Card className="content-start">
          <CardHeader>
            <CardTitle>Same topic</CardTitle>
            <CardDescription>
              {related.length === 0
                ? 'No neighbours yet — reuse this topic to connect notes.'
                : `${related.length} connected note${related.length === 1 ? '' : 's'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {related.map((other) => (
              <NoteCard key={other.id} note={other} today={today} />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
