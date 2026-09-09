import { CalendarClock, Hash } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { deadlineStatus, formatDeadline, type DeadlineStatus } from './deadline'
import { noteLabel } from './graph'
import type { Note } from './types'

const DEADLINE_VARIANT: Record<DeadlineStatus, 'secondary' | 'destructive' | 'warning'> = {
  none: 'secondary',
  overdue: 'destructive',
  today: 'warning',
  soon: 'warning',
  later: 'secondary',
}

export interface NoteCardProps {
  note: Note
  today: string
  /** Highlighted when the note is the current selection in the graph. */
  active?: boolean
}

export function NoteCard({ note, today, active = false }: NoteCardProps) {
  const status = deadlineStatus(note.deadline, today)
  const body = note.text.trim()
  const rest = body.split('\n').slice(1).join(' ').trim()

  return (
    <Card
      data-testid="note-card"
      className={cn(
        'gap-3 py-4 transition-colors hover:border-ring/60',
        active && 'border-ring ring-[3px] ring-ring/30',
      )}
    >
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Hash className="size-3" aria-hidden />
            {note.topic}
          </Badge>
          {note.deadline && (
            <Badge variant={DEADLINE_VARIANT[status]} className="gap-1">
              <CalendarClock className="size-3" aria-hidden />
              {formatDeadline(note.deadline, today)}
            </Badge>
          )}
        </div>

        <Link to={`/notes/${note.id}`} className="block focus-visible:outline-none">
          <h3 className="font-medium underline-offset-4 hover:underline">{noteLabel(note)}</h3>
          {rest && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{rest}</p>}
        </Link>
      </CardContent>
    </Card>
  )
}
