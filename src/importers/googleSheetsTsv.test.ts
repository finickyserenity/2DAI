import { describe, expect, it } from 'vitest'
import { dateKey } from '../domain'
import { parseGoogleSheetsTsv } from './googleSheetsTsv'

describe('parseGoogleSheetsTsv', () => {
  it('rejects data without a Task column', () => {
    expect(() => parseGoogleSheetsTsv('Name\tInterval\nLaundry\t7', { listName: 'Home' })).toThrow('No Task column')
  })

  it('imports task fields, intervals, dates, archive state, and grouped sections', () => {
    const source = [
      'Task\tInterval\tIs-Due\tLast Done\tEffort\tEarliest Completed\tArchive',
      'Wash towels\t7d!\tfalse\t9/1/26\t3\t8/20/26\tfalse',
      'Fold towels\tbad\ttrue\t\t0\t\ttrue',
      '',
      'Call plumber\t30\tfalse\t9/10/26\t2\t\tfalse',
    ].join('\n')

    const result = parseGoogleSheetsTsv(source, { listName: '  Home  ', year: 2026 })

    expect(result.listName).toBe('Home')
    expect(result.taskCount).toBe(3)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].name).toBe('Towels')
    expect(result.sections[0].tasks[0]).toMatchObject({
      title: 'Wash towels',
      effort: 3,
      intervalDays: 7,
      fixedInterval: true,
      nextDueAt: '2026-09-08',
      scheduledForPlanner: undefined,
      archived: false,
      sourceRow: 2,
    })
    expect(result.sections[0].tasks[0].lastCompletedAt).toContain('2026-08-20')
    expect(result.sections[0].tasks[1]).toMatchObject({
      effort: 1,
      intervalDays: undefined,
      fixedInterval: false,
      nextDueAt: dateKey(new Date()),
      scheduledForPlanner: true,
      archived: true,
    })
    expect(result.sections[1].tasks[0]).toMatchObject({ intervalDays: 30, fixedInterval: false, nextDueAt: '2026-10-10' })
  })

  it('detects category headings and reports unsupported populated columns', () => {
    const source = [
      'Task\tInterval\tIs-Due\tRange Start\tSync Due',
      'Home\t\tfalse\t\t',
      '',
      'Clean Kitchen\t1d\tfalse\t9/1\ttrue',
      'Clean Fridge\t1d\tfalse\t\t',
    ].join('\n')

    const result = parseGoogleSheetsTsv(source, { listName: '', year: 2026 })

    expect(result.listName).toBe('Imported list')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]).toMatchObject({ name: 'Home · Kitchen', category: 'Home' })
    expect(result.warnings).toContain('Range Start has 1 populated row and is not imported yet.')
    expect(result.warnings).toContain('Sync Due has 1 populated row and is not imported yet.')
    expect(result.warnings).toContain('Detected category headings: Home.')
  })

  it('warns when no task groups remain after the header', () => {
    const result = parseGoogleSheetsTsv('Task\tInterval\n\t', { listName: 'Empty' })
    expect(result.sections).toEqual([])
    expect(result.taskCount).toBe(0)
    expect(result.warnings).toContain('No task groups were found after the header.')
  })

  it('uses generated group names for larger groups without shared subject words', () => {
    const source = ['Task', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].join('\n')
    const result = parseGoogleSheetsTsv(source, { listName: 'Mixed' })
    expect(result.sections[0].name).toBe('Group 1')
  })
})