import { describe, expect, it } from 'vitest'
import { daysUntil, deadlineStatus, formatDeadline, todayISO } from './deadline'

const TODAY = '2026-09-09'

describe('deadlineStatus', () => {
  it('reports no deadline', () => {
    expect(deadlineStatus(null, TODAY)).toBe('none')
  })

  it('separates overdue, today, soon and later', () => {
    expect(deadlineStatus('2026-09-08', TODAY)).toBe('overdue')
    expect(deadlineStatus('2026-09-09', TODAY)).toBe('today')
    expect(deadlineStatus('2026-09-16', TODAY)).toBe('soon')
    expect(deadlineStatus('2026-09-17', TODAY)).toBe('later')
  })
})

describe('daysUntil', () => {
  it('counts whole days across a month boundary', () => {
    expect(daysUntil('2026-10-01', TODAY)).toBe(22)
    expect(daysUntil('2026-08-30', TODAY)).toBe(-10)
  })
})

describe('formatDeadline', () => {
  it('reads naturally around today', () => {
    expect(formatDeadline(null, TODAY)).toBe('No deadline')
    expect(formatDeadline('2026-09-09', TODAY)).toBe('Due today')
    expect(formatDeadline('2026-09-10', TODAY)).toBe('Due tomorrow')
    expect(formatDeadline('2026-09-08', TODAY)).toBe('1 day overdue')
    expect(formatDeadline('2026-09-04', TODAY)).toBe('5 days overdue')
    expect(formatDeadline('2026-09-12', TODAY)).toBe('Due in 3 days')
  })
})

describe('todayISO', () => {
  it('uses the local date, not the UTC one', () => {
    // 23:30 local on the 9th is already the 10th in UTC for negative offsets.
    const late = new Date(2026, 8, 9, 23, 30)
    expect(todayISO(late)).toBe('2026-09-09')
  })
})
