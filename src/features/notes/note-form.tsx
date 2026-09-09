import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { noteSchema, type NoteFormValues } from './note-schema'
import { TOPIC_SEPARATOR } from './topic'
import type { NoteDraft, TopicSummary } from './types'


export interface NoteFormProps {
  /** Existing topics, offered as suggestions so hubs get reused not re-typed. */
  topics: TopicSummary[]
  defaultValues?: NoteDraft
  submitLabel?: string
  onSubmit: (draft: NoteDraft) => Promise<void> | void
  onCancel?: () => void
  /** Clear the form after a successful submit — used by the capture form. */
  resetOnSubmit?: boolean
}

const EMPTY: NoteFormValues = { topic: '', text: '', deadline: '' }

export function NoteForm({
  topics,
  defaultValues,
  submitLabel = 'Add note',
  onSubmit,
  onCancel,
  resetOnSubmit = false,
}: NoteFormProps) {
  const listId = useId()
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: defaultValues
      ? { ...defaultValues, deadline: defaultValues.deadline ?? '' }
      : EMPTY,
  })

  useEffect(() => {
    if (defaultValues) {
      form.reset({ ...defaultValues, deadline: defaultValues.deadline ?? '' })
    }
  }, [defaultValues, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = noteSchema.parse(values)
    await onSubmit({ topic: parsed.topic, text: parsed.text, deadline: parsed.deadline })
    if (resetOnSubmit) {
      // Keep the topic so a run of notes on one subject stays fast to enter.
      form.reset({ topic: values.topic, text: '', deadline: '' })
      form.setFocus('text')
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic</FormLabel>
                <FormControl>
                  <Input list={listId} placeholder="Product / Onboarding" {...field} />
                </FormControl>
                <datalist id={listId}>
                  {topics.map((topic) => (
                    <option key={topic.key} value={topic.label} />
                  ))}
                </datalist>
                <FormDescription>
                  Reuse a topic to link notes. Nest with{' '}
                  <code className="font-mono">{TOPIC_SEPARATOR}</code>, e.g.{' '}
                  <code className="font-mono">Product{TOPIC_SEPARATOR}Onboarding</code>.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deadline</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormDescription>Optional.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="What did you learn, decide, or need to remember?"
                  className="min-h-32"
                  {...field}
                />
              </FormControl>
              <FormDescription>The first line becomes the note title.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
