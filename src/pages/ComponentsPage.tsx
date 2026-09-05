import { Rocket } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const buttonVariants = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const
const badgeVariants = ['default', 'secondary', 'outline', 'success', 'warning', 'destructive'] as const
const tokens = [
  'bg-background text-foreground',
  'bg-card text-card-foreground',
  'bg-primary text-primary-foreground',
  'bg-secondary text-secondary-foreground',
  'bg-muted text-muted-foreground',
  'bg-accent text-accent-foreground',
  'bg-success text-success-foreground',
  'bg-warning text-warning-foreground',
  'bg-destructive text-destructive-foreground',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">{children}</CardContent>
    </Card>
  )
}

/** Kitchen sink: every primitive on one page, so regressions are visible at a glance. */
export default function ComponentsPage() {
  const [checked, setChecked] = useState(true)

  return (
    <>
      <PageHeader
        title="Components"
        description="The primitives this template ships with. All of them are yours to edit under src/components/ui."
      />

      <Tabs defaultValue="controls">
        <TabsList>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="overlays">Overlays</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="grid gap-4">
          <Section title="Buttons">
            {buttonVariants.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
            <Button size="sm">small</Button>
            <Button size="lg">large</Button>
            <Button size="icon" aria-label="Launch">
              <Rocket />
            </Button>
            <Button disabled>disabled</Button>
          </Section>

          <Section title="Badges">
            {badgeVariants.map((variant) => (
              <Badge key={variant} variant={variant}>
                {variant}
              </Badge>
            ))}
          </Section>

          <Section title="Avatar, separator, skeleton">
            <Avatar>
              <AvatarFallback>DQ</AvatarFallback>
            </Avatar>
            <Separator orientation="vertical" className="h-8" />
            <Skeleton className="h-8 w-40" />
          </Section>
        </TabsContent>

        <TabsContent value="inputs" className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Text fields</CardTitle>
              <CardDescription>Sized for touch, 16px text so iOS does not zoom.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="demo-input">Label</Label>
                <Input id="demo-input" placeholder="Placeholder" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="demo-invalid">Invalid</Label>
                <Input id="demo-invalid" aria-invalid defaultValue="not-an-email" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="demo-textarea">Textarea</Label>
                <Textarea id="demo-textarea" placeholder="Grows with its content" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Toggles</CardTitle>
              <CardDescription>Radix primitives, keyboard accessible.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="demo-checkbox"
                  checked={checked}
                  onCheckedChange={(value) => setChecked(value === true)}
                />
                <Label htmlFor="demo-checkbox">Checkbox</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="demo-switch" defaultChecked />
                <Label htmlFor="demo-switch">Switch</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overlays">
          <Section title="Dialog & tooltip">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete project</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. It stays inside the viewport on small screens.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive">Delete</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Tooltips are portalled and theme-aware.</TooltipContent>
            </Tooltip>
          </Section>
        </TabsContent>

        <TabsContent value="tokens">
          <Card>
            <CardHeader>
              <CardTitle>Semantic colours</CardTitle>
              <CardDescription>
                Each swatch reads its value from CSS variables, so it re-paints when the theme flips.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tokens.map((token) => (
                <div
                  key={token}
                  className={`rounded-lg border p-4 font-mono text-xs ${token}`}
                >
                  {token.split(' ')[0]}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
