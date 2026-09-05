import { Activity, ArrowUpRight, CreditCard, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const stats = [
  { label: 'Active users', value: '2,318', delta: '+12.4%', icon: Users },
  { label: 'Revenue', value: '$48,120', delta: '+4.1%', icon: CreditCard },
  { label: 'Requests / min', value: '9,842', delta: '+0.8%', icon: Activity },
  { label: 'Error rate', value: '0.42%', delta: '-0.1%', icon: ArrowUpRight },
]

const activity = [
  { who: 'Ana', what: 'deployed api-gateway', when: '2 min ago' },
  { who: 'Bruno', what: 'merged PR #482', when: '18 min ago' },
  { who: 'Carla', what: 'rotated staging secrets', when: '1 hour ago' },
  { who: 'Diego', what: 'opened incident INC-118', when: '3 hours ago' },
]

/** Example content page: a responsive stat grid plus a two-column body. */
export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An example page showing the grid, cards and spacing scale."
        actions={
          <>
            <Button variant="outline">Export</Button>
            <Button>New project</Button>
          </>
        }
      />

      {/* 1 column on phones, 2 on tablets, 4 on desktop monitors. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-3 py-5">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
              <CardAction>
                <stat.icon className="size-4 text-muted-foreground" aria-hidden />
              </CardAction>
            </CardHeader>
            <CardContent>
              <Badge variant={stat.delta.startsWith('-') ? 'secondary' : 'success'}>
                {stat.delta}
              </Badge>
              <span className="ml-2 text-xs text-muted-foreground">vs last week</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest events across the workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {activity.map((row, index) => (
              <div key={row.what}>
                {index > 0 && <Separator />}
                <div className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{row.who}</span>{' '}
                    <span className="text-muted-foreground">{row.what}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{row.when}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loading state</CardTitle>
            <CardDescription>Skeletons keep layout stable while data arrives.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
