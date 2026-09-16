import { addDays, dateKey, type Task } from '../domain.ts'

export interface GoogleSheetsImportOptions {
  listName: string
  year?: number
}

export interface ImportedTask extends Pick<Task, 'title' | 'effort' | 'intervalDays' | 'fixedInterval' | 'nextDueAt' | 'scheduledForPlanner' | 'lastCompletedAt' | 'archived'> {
  sourceRow: number
}

export interface ImportedSection {
  name: string
  category?: string
  tasks: ImportedTask[]
}

export interface GoogleSheetsImportPreview {
  listName: string
  sections: ImportedSection[]
  taskCount: number
  warnings: string[]
}

const ACTION_WORDS = new Set([
  'air', 'check', 'clean', 'drop', 'dry', 'fold', 'hang', 'match', 'off', 'pick',
  'pickup', 'put', 'replace', 'return', 'store', 'wash',
])

export function parseGoogleSheetsTsv(text: string, options: GoogleSheetsImportOptions): GoogleSheetsImportPreview {
  const lines = text.replace(/\r/g, '').split('\n')
  const headerLineIndex = lines.findIndex((line) => line.split('\t').some((cell) => cell.trim().toLowerCase() === 'task'))
  if (headerLineIndex < 0) throw new Error('No Task column was found in the pasted data.')

  const headers = lines[headerLineIndex].split('\t').map((header) => header.trim().toLowerCase())
  const column = (name: string) => headers.indexOf(name.toLowerCase())
  const taskColumn = column('task')
  const intervalColumn = column('interval')
  const isDueColumn = column('is-due')
  const lastDoneColumn = column('last done')
  const effortColumn = column('effort')
  const completedColumn = column('earliest completed')
  const archiveColumn = column('archive')
  const warnings: string[] = []
  const unsupportedColumns = ['range start', 'range end', 'start task at', 'sync due']
    .map((name) => ({ name, index: column(name) }))
    .filter((item) => item.index >= 0)
  const unsupportedCounts = new Map<string, number>()
  const chunks: Array<Array<{ cells: string[]; sourceRow: number }>> = []
  let chunk: Array<{ cells: string[]; sourceRow: number }> = []

  for (let index = headerLineIndex + 1; index < lines.length; index += 1) {
    const cells = lines[index].split('\t')
    const title = cells[taskColumn]?.trim() ?? ''
    if (!title) {
      if (chunk.length) chunks.push(chunk)
      chunk = []
      continue
    }
    for (const unsupported of unsupportedColumns) {
      if (cells[unsupported.index]?.trim()) unsupportedCounts.set(unsupported.name, (unsupportedCounts.get(unsupported.name) ?? 0) + 1)
    }
    chunk.push({ cells, sourceRow: index + 1 })
  }
  if (chunk.length) chunks.push(chunk)

  let category: string | undefined
  const sections: ImportedSection[] = []
  const detectedCategories: string[] = []
  for (const [chunkIndex, rows] of chunks.entries()) {
    const firstTitle = rows[0].cells[taskColumn].trim()
    if (isCategoryHeading(rows, taskColumn, chunkIndex < chunks.length - 1)) {
      category = firstTitle
      detectedCategories.push(firstTitle)
      continue
    }

    const sectionName = inferSectionName(rows.map((row) => row.cells[taskColumn].trim()), sections.length + 1)
    const name = category && !normalize(sectionName).includes(normalize(category)) ? `${category} · ${sectionName}` : sectionName
    sections.push({
      name,
      category,
      tasks: rows.map(({ cells, sourceRow }) => {
        const interval = parseInterval(cells[intervalColumn])
        const isDue = normalize(cells[isDueColumn] ?? '') === 'true'
        const lastDone = parseSheetDate(cells[lastDoneColumn], options.year)
        const effort = Number.parseInt(cells[effortColumn] ?? '', 10)
        const completed = parseSheetDate(cells[completedColumn], options.year)
        const archived = normalize(cells[archiveColumn] ?? '') === 'true'
        return {
          title: cells[taskColumn].trim(),
          effort: Number.isFinite(effort) && effort > 0 ? effort : 1,
          intervalDays: interval.days,
          fixedInterval: interval.fixed,
          nextDueAt: inferNextDue(lastDone, interval.days, isDue),
          scheduledForPlanner: interval.days ? undefined : isDue,
          lastCompletedAt: completed?.toISOString(),
          archived,
          sourceRow,
        }
      }),
    })
  }

  for (const [name, count] of unsupportedCounts) {
    warnings.push(`${titleCase(name)} has ${count} populated ${count === 1 ? 'row' : 'rows'} and is not imported yet.`)
  }
  if (detectedCategories.length) warnings.push(`Detected category headings: ${detectedCategories.join(', ')}.`)
  if (!sections.length) warnings.push('No task groups were found after the header.')
  return {
    listName: options.listName.trim() || 'Imported list',
    sections,
    taskCount: sections.reduce((count, section) => count + section.tasks.length, 0),
    warnings,
  }
}

function isCategoryHeading(
  rows: Array<{ cells: string[] }>,
  taskColumn: number,
  hasFollowingChunk: boolean,
): boolean {
  if (rows.length !== 1 || !hasFollowingChunk) return false
  const cells = rows[0].cells
  const titleWords = (cells[taskColumn] ?? '').split(/\s+/).map(normalize).filter(Boolean)
  if (titleWords.length !== 1 || ACTION_WORDS.has(titleWords[0])) return false
  return cells.every((cell, index) => index === taskColumn || ['', 'false', '0'].includes(normalize(cell)))
}

function parseInterval(value = ''): { days?: number; fixed: boolean } {
  const match = value.trim().match(/^(\d+)d?(!)?$/i)
  if (!match) return { fixed: false }
  const days = Number(match[1])
  return { days: days > 0 ? days : undefined, fixed: days > 0 && Boolean(match[2]) }
}

function parseSheetDate(value = '', fallbackYear = new Date().getFullYear()): Date | undefined {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!match) return undefined
  let year = match[3] ? Number(match[3]) : fallbackYear
  if (year < 100) year += 2000
  const result = new Date(year, Number(match[1]) - 1, Number(match[2]), 12)
  return Number.isNaN(result.getTime()) ? undefined : result
}

function inferNextDue(lastDone: Date | undefined, intervalDays: number | undefined, isDue: boolean): string {
  const today = new Date()
  if (isDue || !lastDone) return dateKey(today)
  if (!intervalDays) return dateKey(today)
  return dateKey(addDays(lastDone, intervalDays))
}

function inferSectionName(titles: string[], index: number): string {
  const phrases = titles.map((title) => title
    .replace(/\badhoc\b/i, 'Adhoc')
    .split(/\s+/)
    .filter((word) => !ACTION_WORDS.has(normalize(word)))
    .join(' ')
    .trim())
  const tokenCounts = new Map<string, number>()
  for (const phrase of phrases) {
    for (const token of new Set(phrase.split(/\s+/).map(normalize).filter(Boolean))) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
    }
  }
  const threshold = Math.max(2, Math.ceil(titles.length / 2))
  const common = phrases[0]?.split(/\s+/).filter((token) => (tokenCounts.get(normalize(token)) ?? 0) >= threshold) ?? []
  if (titles.some((title) => /\badhoc\b/i.test(title)) && !common.some((token) => normalize(token) === 'adhoc')) common.push('Adhoc')
  if (common.length) return titleCase(common.join(' '))
  const first = phrases[0]
  if (first && titles.length <= 4) return titleCase(first)
  return `Group ${index}`
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|\s)\w/g, (match) => match.toUpperCase())
}