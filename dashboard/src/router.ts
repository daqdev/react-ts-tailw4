import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import OverviewView from './views/OverviewView.vue'
import PlaceholderView from './views/PlaceholderView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    icon: string
    /** What the screen shows, from SPEC §11. */
    summary: string
    /** Milestone that delivers the screen (SPEC §14). */
    milestone: string
  }
}

const screen = (
  path: string,
  title: string,
  icon: string,
  milestone: string,
  summary: string,
): RouteRecordRaw => ({
  path,
  name: title,
  component: PlaceholderView,
  meta: { title, icon, milestone, summary },
})

// The screens of SPEC §11, in menu order.
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Overview',
    component: OverviewView,
    meta: {
      title: 'Overview',
      icon: 'pi pi-home',
      milestone: 'M2',
      summary:
        'Mode, kill switch, worker health; Available vs Managed USDT; realized profit; next settlement; open offers.',
    },
  },
  screen('/offers', 'Offers', 'pi pi-inbox', 'M4', 'Buy Low offers with an amount field and flip offers per cycle; approve or decline.'),
  screen('/cycles', 'Cycles', 'pi pi-sync', 'M5', 'Open cycles: state, size, entry strike, days in BTC and in HODL, release action.'),
  screen('/positions', 'Positions', 'pi pi-list', 'M2', 'Open positions with days left, distance to strike and projected payout in both scenarios.'),
  screen('/history', 'History', 'pi pi-history', 'M2', 'Closed cycles and settled positions with outcome and received amounts; CSV export.'),
  screen('/market', 'Market', 'pi pi-chart-line', 'M2', 'Buy Low candidates, Sell High quote at each entry strike, APR over time.'),
  screen('/statistics', 'Statistics', 'pi pi-chart-bar', 'M5', 'Realized profit, annualised return, assignment rate, time in BTC and HODL, benchmarks.'),
  screen('/decisions', 'Decisions', 'pi pi-directions', 'M3', 'Every tick, per cycle: what was chosen or why it was skipped.'),
  screen('/config', 'Config', 'pi pi-cog', 'M3', 'Edit the strategy config; every change is versioned.'),
  screen('/backtest', 'Backtest', 'pi pi-calculator', 'M6', 'Run form, run list, equity curve vs benchmarks, run comparison, APR model fit.'),
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = `${to.meta.title} · Dual Investment Bot`
})
