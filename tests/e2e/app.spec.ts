import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Marcus' })).toBeVisible()
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

test('sorts lists alphabetically and remembers collapsed sections after reload', async ({ page }) => {
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

  await page.reload()
  await page.getByLabel('Planning range').getByRole('button', { name: 'Lists' }).click()
  await page.locator('.list-grid').getByRole('button', { name: /^Home\b/ }).click()
  await expect(page.getByRole('button', { name: 'Expand Persistent section' })).toBeVisible()
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