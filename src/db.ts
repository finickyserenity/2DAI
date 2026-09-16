import Dexie, { type EntityTable } from 'dexie'
import type { AppSetting, ProjectFolder, Task, TaskEvent, TaskList, TaskSection } from './domain'
import { dateKey } from './domain'

class TwoDaiDatabase extends Dexie {
  lists!: EntityTable<TaskList, 'id'>
  sections!: EntityTable<TaskSection, 'id'>
  projects!: EntityTable<ProjectFolder, 'id'>
  tasks!: EntityTable<Task, 'id'>
  events!: EntityTable<TaskEvent, 'id'>
  settings!: EntityTable<AppSetting, 'key'>

  constructor() {
    super('2dai-local')
    this.version(1).stores({
      lists: 'id, position',
      tasks: 'id, listId, nextDueAt, archived, position, updatedAt',
      events: 'id, taskId, effectiveDate, createdAt',
      settings: 'key',
    })
    this.version(2).stores({
      lists: 'id, position',
      sections: 'id, listId, [listId+position]',
      projects: 'id, listId, archived, [listId+position]',
      tasks: 'id, listId, sectionId, projectId, nextDueAt, archived, position, updatedAt',
      events: 'id, taskId, effectiveDate, createdAt',
      settings: 'key',
    })
    this.version(3).stores({
      lists: 'id, position',
      sections: 'id, listId, projectId, [listId+position]',
      projects: 'id, listId, archived, [listId+position]',
      tasks: 'id, listId, sectionId, projectId, nextDueAt, archived, position, updatedAt',
      events: 'id, taskId, effectiveDate, createdAt',
      settings: 'key',
    })
    this.version(4).stores({
      lists: 'id, position',
      sections: 'id, listId, projectId, [listId+position]',
      projects: 'id, listId, archived, [listId+position]',
      tasks: 'id, listId, sectionId, projectId, nextDueAt, archived, position, updatedAt',
      events: 'id, taskId, effectiveDate, createdAt',
      settings: 'key',
    }).upgrade(async (transaction) => {
      await transaction.table('tasks').toCollection().modify((task: Task & { plannerVisible?: boolean }) => {
        delete task.plannerVisible
      })
      await transaction.table('projects').toCollection().modify((project: ProjectFolder) => {
        if (project.includeInPlanner === undefined) project.includeInPlanner = true
      })
    })

    this.on('populate', () => {
      const now = new Date().toISOString()
      const today = dateKey(new Date())

      return this.transaction('rw', this.lists, this.tasks, this.settings, async () => {
        await this.lists.bulkAdd([
          { id: 'personal', name: 'Me', color: '#4d82b8', position: 0 },
          { id: 'home', name: 'Home', color: '#5b8f7a', position: 1 },
          { id: 'family', name: 'Family', color: '#b57a52', position: 2 },
        ])
        await this.tasks.bulkAdd([
          makeTask('coffee', 'personal', 'Coffee 1', 0, today, now, { preferredTime: '07:30', intervalDays: 1 }),
          makeTask('calendar', 'personal', 'Check mobile calendar', 1, today, now, { preferredTime: '08:00', intervalDays: 1 }),
          makeTask('desk', 'home', 'Clear desk', 2, today, now, { intervalDays: 1, effort: 2 }),
          makeTask('laundry', 'family', "Return Eve's laundry", 3, today, now, { intervalDays: 10, fixedInterval: true, effort: 3 }),
          makeTask('haircut', 'personal', 'Schedule haircut', 4, dateKey(new Date(Date.now() + 4 * 86_400_000)), now, { intervalDays: 42, effort: 2 }),
        ])
        await this.settings.add({ key: 'activeDay', value: today })
        await this.settings.add({ key: 'userName', value: 'Marcus' })
      })
    })
  }
}

function makeTask(
  id: string,
  listId: string,
  title: string,
  position: number,
  nextDueAt: string,
  now: string,
  options: Partial<Task> = {},
): Task {
  return {
    id,
    listId,
    title,
    position,
    effort: 1,
    fixedInterval: false,
    nextDueAt,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  }
}

export const db = new TwoDaiDatabase()