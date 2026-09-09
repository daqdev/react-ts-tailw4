import { z } from 'zod'

/** The three fields a note is made of. Deadline is optional. */
export const noteSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1, 'A topic is what links this note to the others.')
    .max(120, 'Keep the topic under 120 characters.'),
  text: z.string().trim().min(1, 'Write something.').max(10_000, 'That note is very long.'),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
    .or(z.literal(''))
    .transform((value) => value || null)
    .nullable(),
})

export type NoteFormValues = z.input<typeof noteSchema>
