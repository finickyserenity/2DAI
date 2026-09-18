import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateKey,
  formatFriendlyDate,
  isWeekend,
  nextDueDate,
  parseTaskInput,
  preferredTimeFor,
  type Task,
} from './domain'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    listId: 'list-1',
    title: 'Test task',
    position: 0,
    effort: 1,
    fixedInterval: false,
    nextDueAt: '2026-09-17',
    archived: false,
    createdAt: '2026-09-17T12:00:00.000Z',
    updatedAt: '2026-09-17T12:00:00.000Z',
    ...overrides,
  }
}

describe('parseTaskInput', () => {
  it('keeps a plain title unchanged', () => {
    expect(parseTaskInput('Call the dentist', '2026-09-17')).toEqual({
      title: 'Call the dentist',
      preferredTime: undefined,
      dueDate: undefined,
      intervalDays: undefined,
      fixedInterval: false,
    })
  })

  it.each([
    ['Breakfast 7a', 'Breakfast', '07:00'],
    ['Lunch at 12:15 pm', 'Lunch', '12:15'],
    ['Call Mom 12am', 'Call Mom', '00:00'],
  ])('extracts time from %s', (input, title, preferredTime) => {
    expect(parseTaskInput(input, '2026-09-17')).toMatchObject({ title, preferredTime })
  })

  it('extracts recurrence, fixed scheduling, date, and time together', () => {
    expect(parseTaskInput('Pay bill 4/20 at 2:30p 30d!', '2026-09-17')).toEqual({
      title: 'Pay bill',
      preferredTime: '14:30',
      dueDate: '2027-04-20',
      intervalDays: 30,
      fixedInterval: true,
    })
  })

  it('uses the current year for today or a future month and day', () => {
    expect(parseTaskInput('Same day 9/17', '2026-09-17').dueDate).toBe('2026-09-17')
    expect(parseTaskInput('Later 10/5', new Date(2026, 8, 17, 12)).dueDate).toBe('2026-10-05')
  })

  it('uses next year after the month and day have passed', () => {
    expect(parseTaskInput('Taxes 4/15', '2026-09-17')).toMatchObject({ title: 'Taxes', dueDate: '2027-04-15' })
  })

  it.each(['Bad 2/30', 'Bad 13/1', 'Fraction 4/20th'])('leaves invalid or embedded dates in the title: %s', (input) => {
    expect(parseTaskInput(input, '2026-09-17')).toMatchObject({ title: input, dueDate: undefined })
  })
})

describe('date utilities', () => {
  it('formats local date keys and adds days across month boundaries', () => {
    const date = new Date(2026, 0, 31, 12)
    expect(dateKey(date)).toBe('2026-01-31')
    expect(dateKey(addDays(date, 1))).toBe('2026-02-01')
    expect(dateKey(date)).toBe('2026-01-31')
  })

  it('detects weekends from strings and Date objects', () => {
    expect(isWeekend('2026-09-19')).toBe(true)
    expect(isWeekend(new Date(2026, 8, 20, 12))).toBe(true)
    expect(isWeekend('2026-09-21')).toBe(false)
  })

  it('formats a friendly date', () => {
    expect(formatFriendlyDate(new Date(2026, 8, 17, 12))).toContain('Sep 17')
  })
})

describe('preferredTimeFor', () => {
  it('prefers the matching day type and falls back through legacy values', () => {
    const scheduled = task({
      preferredTime: '11:00',
      weekdayPreferredTime: '08:00',
      weekendPreferredTime: '09:00',
    })
    expect(preferredTimeFor(scheduled, '2026-09-18')).toBe('08:00')
    expect(preferredTimeFor(scheduled, '2026-09-19')).toBe('09:00')
    expect(preferredTimeFor(task({ weekendPreferredTime: '09:00' }), '2026-09-18')).toBe('09:00')
    expect(preferredTimeFor(task({ preferredTime: '11:00' }), '2026-09-19')).toBe('11:00')
    expect(preferredTimeFor(task(), '2026-09-18')).toBeUndefined()
  })
})

describe('nextDueDate', () => {
  const completedAt = new Date(2026, 8, 17, 12)

  it('moves one-off tasks to the following day', () => {
    expect(nextDueDate(task(), completedAt)).toBe('2026-09-18')
  })

  it('schedules flexible recurrence from completion', () => {
    expect(nextDueDate(task({ intervalDays: 7 }), completedAt)).toBe('2026-09-24')
  })

  it('advances fixed recurrence from its prior schedule until it is future', () => {
    expect(nextDueDate(task({ intervalDays: 7, fixedInterval: true, nextDueAt: '2026-09-01' }), completedAt)).toBe('2026-09-22')
  })
})