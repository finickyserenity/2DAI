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
  lastCompletedAt?: string
  nextDueAt: string
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
}

export interface AppSetting {
  key: string
  value: string
}

export interface ParsedTaskInput {
  title: string
  preferredTime?: string
}

const TIME_PATTERN = /(?:^|\s)(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a(?:m)?|p(?:m)?)(?=\s|$)/i

export function parseTaskInput(input: string): ParsedTaskInput {
  const match = input.match(TIME_PATTERN)
  if (!match) return { title: input.trim() }

  let hour = Number(match[1]) % 12
  if (match[3].toLowerCase().startsWith('p')) hour += 12

  return {
    title: input.replace(match[0], ' ').replace(/\s+/g, ' ').trim(),
    preferredTime: `${String(hour).padStart(2, '0')}:${match[2] ?? '00'}`,
  }
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