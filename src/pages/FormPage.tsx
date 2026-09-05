import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

/** One schema drives validation *and* the TypeScript type of the form values. */
const projectSchema = z.object({
  name: z.string().min(2, 'Use at least 2 characters.').max(60),
  email: z.email('Enter a valid email address.'),
  environment: z.enum(['development', 'staging', 'production']),
  notes: z.string().max(280, 'Keep it under 280 characters.').optional(),
  acceptTerms: z.literal(true, { message: 'You must accept the terms.' }),
})

type ProjectValues = z.infer<typeof projectSchema>

export default function FormPage() {
  const [submitted, setSubmitted] = useState<ProjectValues | null>(null)

  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      email: '',
      environment: 'development',
      notes: '',
    },
    mode: 'onSubmit',
  })

  return (
    <>
      <PageHeader
        title="Form"
        description="react-hook-form + zod, wired to the accessible field components."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New project</CardTitle>
            <CardDescription>Every field validates on submit and reports via aria.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => setSubmitted(values))}
                className="grid gap-5"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project name</FormLabel>
                      <FormControl>
                        <Input placeholder="acme-web" {...field} />
                      </FormControl>
                      <FormDescription>Shown in the sidebar and page titles.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner email</FormLabel>
                      <FormControl>
                        <Input type="email" inputMode="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="environment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Environment</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pick one" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Anything the team should know…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </FormControl>
                      <div className="grid gap-1">
                        <FormLabel>Accept terms</FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => form.reset()}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    Create project
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submitted values</CardTitle>
            <CardDescription>What a real handler would receive, fully typed.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre
              data-testid="form-output"
              className="overflow-x-auto rounded-md bg-muted p-4 text-xs text-muted-foreground"
            >
              {submitted ? JSON.stringify(submitted, null, 2) : 'Nothing submitted yet.'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
