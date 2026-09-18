import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'User' })).toBeVisible()
})

test('customizes and persists the header name', async ({ page }) => {
  await page.getByRole('button', { name: 'Change name User' }).click()
  const name = page.getByRole('textbox', { name: 'Header name' })
  await name.fill('Alex')
  await name.press('Enter')
  await expect(page.getByRole('heading', { name: 'Alex' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Alex' })).toBeVisible()

  await page.getByRole('button', { name: 'Change name Alex' }).click()
  await page.getByRole('textbox', { name: 'Header name' }).fill('Discarded')
  await page.getByRole('textbox', { name: 'Header name' }).press('Escape')
  await expect(page.getByRole('heading', { name: 'Alex' })).toBeVisible()
})

test('renders Start New Day when an open page crosses midnight', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 8, 18, 23, 59, 59) })
  await page.reload()
  await expect(page.getByRole('button', { name: /Start new day/ })).not.toBeVisible()

  await page.clock.runFor(2_000)
  await expect(page.getByRole('button', { name: /Start new day/ })).toBeVisible()
})

test('creates a future-dated task from its subject and edits it with the date picker', async ({ page }) => {
  const now = new Date()
  const month = 4
  const day = 20
  const candidate = new Date(now.getFullYear(), month - 1, day, 12)
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)) candidate.setFullYear(candidate.getFullYear() + 1)
  const expectedDate = `${candidate.getFullYear()}-04-20`

  const entry = page.getByRole('textbox', { name: 'New task' })
  await expect(page.getByRole('option', { name: 'Me', exact: true })).toBeAttached()
  await entry.fill('E2E dated task 4/20 2:30p')
  await entry.press('Enter')

  await page.getByLabel('Planning range').getByRole('button', { name: 'Lists' }).click()
  await page.locator('.list-grid').getByRole('button', { name: /^Me\b/ }).click()
  await expect(page.getByRole('button', { name: 'E2E dated task', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Options for E2E dated task' }).click()

  await expect(page.getByLabel('Due date')).toHaveValue(expectedDate)
  await expect(page.getByLabel('Weekday time')).toHaveValue('14:30')
  await page.getByLabel('Due date').fill(`${candidate.getFullYear()}-12-12`)
  await page.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Options for E2E dated task' }).click()
  await expect(page.getByLabel('Due date')).toHaveValue(`${candidate.getFullYear()}-12-12`)
})

test('constrains a task due date with multiple calendar filters', async ({ page }) => {
  const entry = page.getByRole('textbox', { name: 'New task' })
  await entry.fill('Filtered due task')
  await entry.press('Enter')

  await page.getByLabel('Planning range').getByRole('button', { name: 'Lists' }).click()
  await page.locator('.list-grid').getByRole('button', { name: /^Me\b/ }).click()
  await page.getByRole('button', { name: 'Options for Filtered due task' }).click()

  const filters = page.getByLabel('Due filters')
  await expect(filters).toHaveAttribute('rows', '2')
  await page.getByLabel('Due date').fill('2026-09-17')
  await filters.fill('monday, q4')
  await page.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Options for Filtered due task' }).click()
  await expect(page.getByLabel('Due date')).toHaveValue('2026-10-05')
  await expect(page.getByLabel('Due filters')).toHaveValue('monday, q4')
})

test('sorts lists and section options while persisting section display preferences', async ({ page }) => {
  await page.getByLabel('Planning range').getByRole('button', { name: 'Lists' }).click()
  const names = await page.locator('.list-grid strong').allTextContents()
  const sortedNames = [...names].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }))
  expect(names).toEqual(sortedNames)

  await page.locator('.list-grid').getByRole('button', { name: /^Home\b/ }).click()
  await page.getByRole('button', { name: 'New section' }).click()
  await page.getByRole('textbox', { name: 'Section name' }).fill('Persistent section')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'Collapse Persistent section' }).click()
  await expect(page.getByRole('button', { name: 'Expand Persistent section' })).toBeVisible()

  await page.getByRole('button', { name: 'New section' }).click()
  await page.getByRole('textbox', { name: 'Section name' }).fill('Alpha 10')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'New section' }).click()
  await page.getByRole('textbox', { name: 'Section name' }).fill('Alpha 2')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'Move Alpha 2 up' }).click()

  const sectionNames = page.locator('.raw-section-heading > strong')
  await expect(sectionNames).toHaveText(['Todo', 'Persistent section', 'Alpha 2', 'Alpha 10'])

  const todoEntry = page.getByRole('textbox', { name: 'Add task to Todo' })
  await todoEntry.fill('Section option test')
  await todoEntry.press('Enter')
  await page.getByRole('button', { name: 'Options for Section option test' }).click()
  await expect(page.getByLabel('Section', { exact: true }).locator('option')).toHaveText(['Todo', 'Alpha 2', 'Alpha 10', 'Persistent section'])
  await page.getByRole('button', { name: 'Done' }).click()

  await page.reload()
  await page.getByLabel('Planning range').getByRole('button', { name: 'Lists' }).click()
  await page.locator('.list-grid').getByRole('button', { name: /^Home\b/ }).click()
  await expect(page.getByRole('button', { name: 'Expand Persistent section' })).toBeVisible()
  await expect(page.locator('.raw-section-heading > strong')).toHaveText(['Todo', 'Persistent section', 'Alpha 2', 'Alpha 10'])
})

test('searches every list and manages archived task results', async ({ page }) => {
  await page.getByRole('textbox', { name: 'New task' }).fill('Archived search target')
  await page.getByRole('textbox', { name: 'New task' }).press('Enter')

  await page.getByLabel('Planning range').getByRole('button', { name: 'Lists' }).click()
  await page.getByRole('textbox', { name: 'Search all tasks' }).fill('laundry')
  const activeResult = page.getByRole('region', { name: 'Task search results' })
  await expect(activeResult.getByRole('button', { name: "Open Return Eve's laundry" })).toContainText('Family')
  await activeResult.getByRole('button', { name: "Open Return Eve's laundry" }).click()
  await expect(page.locator('#task-laundry')).toHaveClass(/focused/)

  await page.locator('.list-breadcrumbs').getByRole('button', { name: 'Lists' }).click()
  await page.locator('.list-grid').getByRole('button', { name: /^Me\b/ }).click()
  await page.getByRole('button', { name: 'Options for Archived search target' }).click()
  await page.getByRole('button', { name: 'Archive task' }).click()
  await page.locator('.list-breadcrumbs').getByRole('button', { name: 'Lists' }).click()

  const search = page.getByRole('textbox', { name: 'Search all tasks' })
  await page.getByRole('checkbox', { name: 'Show archived' }).check()
  await expect(page.getByRole('button', { name: 'Restore Archived search target' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Show archived' }).uncheck()
  await search.fill('Archived search target')
  await expect(page.getByText('No matching tasks.')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Show archived' }).check()
  await expect(page.getByText('Archived search target')).toBeVisible()
  await page.getByRole('button', { name: 'Restore Archived search target' }).click()
  await expect(page.getByRole('button', { name: 'Open Archived search target' })).toBeEnabled()

  await page.getByRole('button', { name: 'Open Archived search target' }).click()
  await page.getByRole('button', { name: 'Options for Archived search target' }).click()
  await page.getByRole('button', { name: 'Archive task' }).click()
  await page.locator('.list-breadcrumbs').getByRole('button', { name: 'Lists' }).click()
  await page.getByRole('textbox', { name: 'Search all tasks' }).fill('Archived search target')
  await page.getByRole('checkbox', { name: 'Show archived' }).check()
  await page.getByRole('button', { name: 'Delete Archived search target permanently' }).click()
  await expect(page.getByText('Archived search target')).not.toBeVisible()
})

test('exports every local data store as a JSON backup', async ({ page }) => {
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('button', { name: 'Close settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export data/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^2dai-backup-\d{4}-\d{2}-\d{2}\.json$/)

  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const backup = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
    format: string
    version: number
    data: Record<string, unknown[]>
  }
  expect(backup).toMatchObject({ format: '2dai-backup', version: 1 })
  expect(Object.keys(backup.data).sort()).toEqual(['events', 'lists', 'projects', 'sections', 'settings', 'tasks'])
  expect(backup.data.lists.length).toBeGreaterThan(0)
  expect(backup.data.tasks.length).toBeGreaterThan(0)
})

test('refreshes the app from Settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Open menu' }).click()
  const loaded = page.waitForEvent('load')
  await page.getByRole('button', { name: /Refresh app/ }).click()
  await loaded
  await expect(page.getByRole('heading', { name: 'User' })).toBeVisible()
})