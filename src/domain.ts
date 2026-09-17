export type TaskAction = 'completed' | 'delayed' | 'skipped'

export interface TaskList {
  id: string
  name: string
  color: string
  position: number
}

export interface TaskSection {
  id: string
  listId: string
  projectId?: string
  name: string
  position: number
}

export interface ProjectFolder {
  id: string
  listId: string
  name: string
  position: number
  includeInPlanner?: boolean
  archived: boolean
}

export interface Task {
  id: string
  listId: string
  sectionId?: string
  projectId?: string
  title: string
  position: number
  effort: number
  intervalDays?: number
  fixedInterval: boolean
  preferredTime?: string
  preferredTimeSource?: 'explicit' | 'observed'
  weekdayPreferredTime?: string
  weekdayPreferredTimeSource?: 'explicit' | 'observed'
  weekendPreferredTime?: string
  weekendPreferredTimeSource?: 'explicit' | 'observed'
  lastCompletedAt?: string
  nextDueAt: string
  scheduledForPlanner?: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface TaskEvent {
  id: string
  taskId: string
  action: TaskAction
  effectiveDate: string
  createdAt: string
  previousNextDueAt?: string
  previousLastCompletedAt?: string
  previousArchived?: boolean
  previousPreferredTime?: string
  previousPreferredTimeSource?: 'explicit' | 'observed'
  hasPreferredTimeSnapshot?: boolean
  previousWeekdayPreferredTime?: string
  previousWeekdayPreferredTimeSource?: 'explicit' | 'observed'
  previousWeekendPreferredTime?: string
  previousWeekendPreferredTimeSource?: 'explicit' | 'observed'
  hasDayTypeTimeSnapshot?: boolean
}

export interface AppSetting {
  key: string
  value: string
}

export interface ParsedTaskInput {
  title: string
  preferredTime?: string
  dueDate?: string
  intervalDays?: number
  fixedInterval: boolean
}

const TIME_PATTERN = /(?:^|\s)(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a(?:m)?|p(?:m)?)(?=\s|$)/i
const RECURRENCE_PATTERN = /(?:^|\s)(\d+)d(!)?(?=\s|$)/i
const DATE_PATTERN = /(?:^|\s)(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])(?=\s|$)/

export function parseTaskInput(input: string, referenceDay: Date | string = new Date()): ParsedTaskInput {
  const recurrenceMatch = input.match(RECURRENCE_PATTERN)
  const withoutRecurrence = recurrenceMatch ? input.replace(recurrenceMatch[0], ' ') : input
  const timeMatch = withoutRecurrence.match(TIME_PATTERN)
  const withoutTime = timeMatch ? withoutRecurrence.replace(timeMatch[0], ' ') : withoutRecurrence
  const dateMatch = withoutTime.match(DATE_PATTERN)
  const dueDate = dateMatch ? resolveDueDate(Number(dateMatch[1]), Number(dateMatch[2]), referenceDay) : undefined
  let preferredTime: string | undefined

  if (timeMatch) {
    let hour = Number(timeMatch[1]) % 12
    if (timeMatch[3].toLowerCase().startsWith('p')) hour += 12
    preferredTime = `${String(hour).padStart(2, '0')}:${timeMatch[2] ?? '00'}`
  }

  return {
    title: (dateMatch && dueDate ? withoutTime.replace(dateMatch[0], ' ') : withoutTime).replace(/\s+/g, ' ').trim(),
    preferredTime,
    dueDate,
    intervalDays: recurrenceMatch ? Number(recurrenceMatch[1]) : undefined,
    fixedInterval: Boolean(recurrenceMatch?.[2]),
  }
}

function resolveDueDate(month: number, day: number, referenceDay: Date | string): string | undefined {
  const reference = typeof referenceDay === 'string' ? new Date(`${referenceDay}T12:00:00`) : referenceDay
  const candidate = new Date(reference.getFullYear(), month - 1, day, 12)
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return undefined
  if (dateKey(candidate) < dateKey(reference)) candidate.setFullYear(candidate.getFullYear() + 1)
  return dateKey(candidate)
}

export function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function isWeekend(value: Date | string): boolean {
  const date = typeof value === 'string' ? new Date(`${value}T12:00:00`) : value
  return date.getDay() === 0 || date.getDay() === 6
}

export function preferredTimeFor(task: Task, value: Date | string): string | undefined {
  return isWeekend(value)
    ? task.weekendPreferredTime ?? task.weekdayPreferredTime ?? task.preferredTime
    : task.weekdayPreferredTime ?? task.weekendPreferredTime ?? task.preferredTime
}

export function nextDueDate(task: Task, completedAt: Date): string {
  if (!task.intervalDays) return dateKey(addDays(completedAt, 1))

  if (!task.fixedInterval) {
    return dateKey(addDays(completedAt, task.intervalDays))
  }

  const priorDueDate = new Date(`${task.nextDueAt}T12:00:00`)
  let nextDate = addDays(priorDueDate, task.intervalDays)
  while (nextDate <= completedAt) nextDate = addDays(nextDate, task.intervalDays)
  return dateKey(nextDate)
}

export function formatFriendlyDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}