import { AlertCircle, Network, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { deadlineStatus } from '@/features/notes/deadline'
import { NoteCard } from '@/features/notes/note-card'
import { NoteForm } from '@/features/notes/note-form'
import { useNotes, useNotesView } from '@/features/notes/use-notes'

type Filter = 'all' | 'overdue' | 'upcoming' | 'no-deadline'

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All notes',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  'no-deadline': 'No deadline',
}

export default function NotesPage() {
  const { createNote, ready, error } = useNotes()
  const { notes, topics, today } = useNotesView()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [topicFilter, setTopicFilter] = useState<string>('all')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return notes.filter((note) => {
      if (topicFilter !== 'all' && note.topicKey !== topicFilter) return false

      const status = deadlineStatus(note.deadline, today)
      if (filter === 'overdue' && status !== 'overdue') return false
      if (filter === 'upcoming' && !['today', 'soon', 'later'].includes(status)) return false
      if (filter === 'no-deadline' && status !== 'none') return false

      if (!needle) return true
      return (
        note.text.toLowerCase().includes(needle) || note.topic.toLowerCase().includes(needle)
      )
    })
  }, [notes, query, filter, topicFilter, today])

  const overdueCount = useMemo(
    () => notes.filter((note) => deadlineStatus(note.deadline, today) === 'overdue').length,
    [notes, today],
  )

  return (
    <>
      <PageHeader
        title="Notes"
        description="Capture a note under a topic. Shared topics are what wire the base together."
        actions={
          <Button asChild variant="outline">
            <Link to="/graph">
              <Network />
              View graph
            </Link>
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4" aria-hidden />
                New note
              </CardTitle>
              <CardDescription>Topic, note, and an optional deadline.</CardDescription>
            </CardHeader>
            <CardContent>
              <NoteForm
                topics={topics}
                onSubmit={async (draft) => {
                  await createNote(draft)
                }}
                resetOnSubmit
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search notes and topics"
                aria-label="Search notes"
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <SelectTrigger aria-label="Filter by deadline" className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FILTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!ready ? (
            <div className="grid gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : visible.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {notes.length === 0
                  ? 'No notes yet. Add the first one above and the graph starts building itself.'
                  : 'No notes match this filter.'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {visible.map((note) => (
                <NoteCard key={note.id} note={note} today={today} />
              ))}
            </div>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Base</CardTitle>
              <CardDescription>
                {notes.length} notes · {topics.length} topics
                {overdueCount > 0 && ` · ${overdueCount} overdue`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant={topicFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTopicFilter('all')}
              >
                All
              </Button>
              {topics.map((topic) => (
                <Button
                  key={topic.key}
                  variant={topicFilter === topic.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTopicFilter(topic.key)}
                >
                  {topic.label}
                  <Badge variant="secondary" className="ml-1">
                    {topic.noteCount}
                  </Badge>
                </Button>
              ))}
              {topics.length === 0 && (
                <p className="text-sm text-muted-foreground">Topics appear as you add notes.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
