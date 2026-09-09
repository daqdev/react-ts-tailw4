import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NotesProvider } from '@/features/notes/notes-provider'
import { notesStore } from '@/features/notes/storage'
import NotesPage from './NotesPage'

function renderPage() {
  return render(
    <NotesProvider>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<NotesPage />} />
        </Routes>
      </MemoryRouter>
    </NotesProvider>,
  )
}

async function addNote(
  user: ReturnType<typeof userEvent.setup>,
  { topic, text, deadline }: { topic: string; text: string; deadline?: string },
) {
  await user.clear(screen.getByLabelText('Topic'))
  await user.type(screen.getByLabelText('Topic'), topic)
  await user.type(screen.getByLabelText('Note'), text)
  if (deadline) {
    await user.type(screen.getByLabelText('Deadline'), deadline)
  }
  await user.click(screen.getByRole('button', { name: 'Add note' }))
}

describe('NotesPage', () => {
  it('starts with an empty base and an invitation to write', async () => {
    renderPage()
    expect(await screen.findByText(/No notes yet/)).toBeInTheDocument()
  })

  it('captures a note and shows it in the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/No notes yet/)

    await addNote(user, { topic: 'Product/Onboarding', text: 'Welcome email\nNeeds a rewrite.' })

    const card = await screen.findByTestId('note-card')
    expect(within(card).getByText('Welcome email')).toBeInTheDocument()
    expect(within(card).getByText('Product/Onboarding')).toBeInTheDocument()
    expect(within(card).getByText('Needs a rewrite.')).toBeInTheDocument()
  })

  it('persists the note to IndexedDB', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/No notes yet/)

    await addNote(user, { topic: 'Ops', text: 'Rotate keys' })
    await screen.findByTestId('note-card')

    await waitFor(async () => {
      const stored = await notesStore.all()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({ topic: 'Ops', topicKey: 'ops', text: 'Rotate keys' })
    })
  })

  it('refuses an empty note and says why', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/No notes yet/)

    await user.click(screen.getByRole('button', { name: 'Add note' }))

    expect(await screen.findByText(/A topic is what links this note/)).toBeInTheDocument()
    expect(screen.getByText('Write something.')).toBeInTheDocument()
    expect(screen.queryByTestId('note-card')).not.toBeInTheDocument()
  })

  it('keeps the topic after submitting so a run of notes stays fast', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/No notes yet/)

    await addNote(user, { topic: 'Ops', text: 'First' })
    await screen.findByTestId('note-card')

    expect(screen.getByLabelText('Topic')).toHaveValue('Ops')
    expect(screen.getByLabelText('Note')).toHaveValue('')
  })

  it('groups notes into topic hubs and counts them', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/No notes yet/)

    await addNote(user, { topic: 'Ops', text: 'First' })
    await screen.findByTestId('note-card')
    await addNote(user, { topic: 'Ops', text: 'Second' })
    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(2))

    expect(screen.getByText('2 notes · 1 topics')).toBeInTheDocument()
    const topicButton = screen.getByRole('button', { name: /^Ops/ })
    expect(within(topicButton).getByText('2')).toBeInTheDocument()
  })

  it('filters the list by topic hub', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/No notes yet/)

    await addNote(user, { topic: 'Ops', text: 'Rotate keys' })
    await screen.findByTestId('note-card')
    await addNote(user, { topic: 'Design', text: 'Pick a palette' })
    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(2))

    await user.click(screen.getByRole('button', { name: /^Design/ }))

    const cards = screen.getAllByTestId('note-card')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByText('Pick a palette')).toBeInTheDocument()
  })

  it('searches across note text and topics', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/No notes yet/)

    await addNote(user, { topic: 'Ops', text: 'Rotate keys' })
    await screen.findByTestId('note-card')
    await addNote(user, { topic: 'Design', text: 'Pick a palette' })
    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(2))

    await user.type(screen.getByLabelText('Search notes'), 'palette')

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1))
    expect(screen.getByText('Pick a palette')).toBeInTheDocument()
  })
})
