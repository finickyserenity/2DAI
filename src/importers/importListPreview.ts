import { db } from '../db.ts'
import type { GoogleSheetsImportPreview } from './googleSheetsTsv.ts'

export async function replaceListFromPreview(preview: GoogleSheetsImportPreview): Promise<string> {
  const existingList = (await db.lists.toArray()).find((list) => list.name.toLowerCase() === preview.listName.toLowerCase())
  const listId = existingList?.id ?? crypto.randomUUID()
  const now = new Date().toISOString()

  await db.transaction('rw', db.lists, db.sections, db.projects, db.tasks, db.events, async () => {
    if (existingList) {
      const oldTasks = await db.tasks.where('listId').equals(listId).toArray()
      if (oldTasks.length) await db.events.where('taskId').anyOf(oldTasks.map((task) => task.id)).delete()
      await db.tasks.where('listId').equals(listId).delete()
      await db.sections.where('listId').equals(listId).delete()
      await db.projects.where('listId').equals(listId).delete()
      await db.lists.update(listId, { name: preview.listName })
    } else {
      await db.lists.add({ id: listId, name: preview.listName, color: '#4d82b8', position: Date.now() })
    }

    let taskPosition = 0
    for (const [sectionPosition, section] of preview.sections.entries()) {
      const sectionId = crypto.randomUUID()
      await db.sections.add({ id: sectionId, listId, name: section.name, position: sectionPosition })
      await db.tasks.bulkAdd(section.tasks.map((task) => ({
        id: crypto.randomUUID(),
        listId,
        sectionId,
        title: task.title,
        position: taskPosition++,
        effort: task.effort,
        intervalDays: task.intervalDays,
        fixedInterval: task.fixedInterval,
        lastCompletedAt: task.lastCompletedAt,
        nextDueAt: task.nextDueAt,
        plannerVisible: task.plannerVisible,
        archived: task.archived,
        createdAt: now,
        updatedAt: now,
      })))
    }
  })

  return listId
}