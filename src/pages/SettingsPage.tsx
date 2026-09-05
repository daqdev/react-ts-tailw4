import { PageHeader } from '@/components/layout/page-header'
import { ThemeSwitch } from '@/components/theme/theme-switch'
import { useTheme } from '@/components/theme/use-theme'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { Theme } from '@/components/theme/theme-context'

export default function SettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <>
      <PageHeader title="Settings" description="Appearance preferences persist in localStorage." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose a theme or follow your operating system.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label htmlFor="theme-select">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Currently rendering <Badge variant="secondary">{resolvedTheme}</Badge>
              </p>
            </div>
            <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
              <SelectTrigger id="theme-select" className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="settings-theme-switch">Quick toggle</Label>
              <p className="text-sm text-muted-foreground">Flip straight between light and dark.</p>
            </div>
            <ThemeSwitch id="settings-theme-switch" />
          </div>
        </CardContent>
      </Card>
    </>
  )
}
