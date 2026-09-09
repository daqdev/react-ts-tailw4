import { Check, Copy, Download, FileJson, FolderTree, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toAgentDigest, toJSON, toVaultZip } from '@/features/notes/export'
import { mergeNotes, parseImport } from '@/features/notes/import'
import { useNotes, useNotesView } from '@/features/notes/use-notes'
import { SCHEMA_VERSION } from '@/features/notes/types'
import { downloadBlob, downloadText, fileStamp } from '@/lib/download'

const SCHEMA_SNIPPET = `{
  "schemaVersion": ${SCHEMA_VERSION},
  "exportedAt": "ISO timestamp",
  "noteCount": 0,
  "notes": [
    {
      "id": "uuid",
      "topic": "Product/Onboarding",   // "/" nests topic hubs
      "topicKey": "product/onboarding", // normalised, this is the link key
      "text": "First line is the title.\\nRest is the body.",
      "deadline": "2026-10-01",         // or null
      "createdAt": "ISO timestamp",
      "updatedAt": "ISO timestamp"
    }
  ]
}`

export default function AgentPage() {
  const { notes, replaceAll } = useNotes()
  const { notes: sorted, topics, today } = useNotesView()
  const fileRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const digest = useMemo(() => toAgentDigest(sorted, today), [sorted, today])

  const copyDigest = async () => {
    try {
      await navigator.clipboard.writeText(digest)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setImportError('The browser blocked clipboard access. Select the text and copy manually.')
    }
  }

  const handleImport = async (file: File) => {
    setImportError(null)
    setImportMessage(null)
    try {
      const result = parseImport(await file.text())
      const merged = mergeNotes(notes, result.notes)
      await replaceAll(merged)
      const skipped = result.skipped.length ? `, ${result.skipped.length} skipped` : ''
      setImportMessage(`Imported ${result.notes.length} notes${skipped}. Base now has ${merged.length}.`)
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : 'Could not read that file.')
    }
  }

  return (
    <>
      <PageHeader
        title="Agent view"
        description="The whole base in the shapes an AI agent can read: a digest to paste, JSON to parse, a Markdown vault to walk."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Knowledge base digest</CardTitle>
            <CardDescription>
              Every note grouped by topic, with the schema explained up front. Paste this into any
              agent and ask it to reorganise, merge duplicates, or propose missing topics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={copyDigest} variant="outline" disabled={notes.length === 0}>
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copied' : 'Copy digest'}
            </Button>
            <pre
              data-testid="agent-digest"
              className="max-h-96 overflow-auto rounded-md bg-muted p-4 font-mono text-xs whitespace-pre-wrap"
            >
              {notes.length === 0 ? 'Add notes and the digest appears here.' : digest}
            </pre>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>
                {notes.length} notes · {topics.length} topics
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button
                variant="outline"
                disabled={notes.length === 0}
                onClick={() => downloadText(toJSON(sorted), `notes-${fileStamp()}.json`, 'application/json')}
              >
                <FileJson />
                Download JSON
              </Button>
              <Button
                variant="outline"
                disabled={notes.length === 0}
                onClick={() => downloadBlob(toVaultZip(sorted), `vault-${fileStamp()}.zip`)}
              >
                <FolderTree />
                Download Markdown vault
              </Button>
              <p className="text-xs text-muted-foreground">
                The vault is one Markdown file per note with YAML frontmatter, foldered by topic —
                unzip it straight into Obsidian.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import</CardTitle>
              <CardDescription>Merge a JSON export back in. Newest edit wins.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Import notes JSON"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleImport(file)
                  event.target.value = ''
                }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload />
                Choose JSON file
              </Button>
              {importMessage && (
                <p role="status" className="text-sm text-muted-foreground">
                  {importMessage}
                </p>
              )}
              {importError && (
                <p role="alert" className="text-sm text-destructive">
                  {importError}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Schema</CardTitle>
          <CardDescription>
            What an agent receives, and the rules it needs to reason about the network.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="json">
            <TabsList>
              <TabsTrigger value="json">
                <Download className="size-4" aria-hidden />
                JSON
              </TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="json">
              <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs">
                {SCHEMA_SNIPPET}
              </pre>
            </TabsContent>
            <TabsContent value="rules">
              <ul className="grid gap-2 text-sm text-muted-foreground">
                <li>
                  <Badge variant="secondary">edges</Badge> Two notes are connected when their{' '}
                  <code className="font-mono">topicKey</code> matches. Notes are never linked
                  directly.
                </li>
                <li>
                  <Badge variant="secondary">hierarchy</Badge> A topic containing{' '}
                  <code className="font-mono">/</code> nests: <code>Product/Onboarding</code> is a
                  child hub of <code>Product</code>.
                </li>
                <li>
                  <Badge variant="secondary">deadlines</Badge> ISO <code>yyyy-mm-dd</code> or null.
                  Earlier than today means overdue.
                </li>
                <li>
                  <Badge variant="secondary">titles</Badge> The first line of{' '}
                  <code className="font-mono">text</code> is the title; the rest is the body.
                </li>
              </ul>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                An agent that rewrites topics only needs to return notes with new{' '}
                <code className="font-mono">topic</code> values — import recomputes every key and
                the graph reshapes itself.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  )
}
