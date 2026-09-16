import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FolderKanban,
  LibraryBig,
  ListTodo,
  MoreHorizontal,
  Plus,
  RotateCcw,
  SkipForward,
} from 'lucide-react'
import { db } from './db'
import { ListWorkspace } from './ListWorkspace'
import {
  addDays,
  dateKey,
  formatFriendlyDate,
  nextDueDate,
  parseTaskInput,
  type Task,
  type TaskAction,
  type TaskEvent,
} from './domain'
import './App.css'

type PlannerView = 'today' | 'week' | 'month'
type View = PlannerView | 'sheets'

const viewLabels: Record<View, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  sheets: 'Lists',
}

function App() {
  const [view, setView] = useState<View>('today')
  const [entry, setEntry] = useState('')
  const [entryListId, setEntryListId] = useState('personal')
  const [selectedTaskId, setSelectedTaskId] = useState<string>()
  const [lastCompletedDraft, setLastCompletedDraft] = useState('')
  const [lastCompletedTouched, setLastCompletedTouched] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [sheetListId, setSheetListId] = useState<string>()
  const [sheetProjectId, setSheetProjectId] = useState<string>()

  const snapshot = useLiveQuery(async () => {
    const [tasks, lists, sections, projects, activeDaySetting, userNameSetting, events] = await Promise.all([
      db.tasks.toArray(),
      db.lists.orderBy('position').toArray(),
      db.sections.toArray(),
      db.projects.toArray(),
      db.settings.get('activeDay'),
      db.settings.get('userName'),
      db.events.toArray(),
    ])
    return { tasks, lists, sections, projects, events, activeDay: activeDaySetting?.value ?? dateKey(new Date()), userName: userNameSetting?.value ?? 'Marcus' }
  }, [], { tasks: [], lists: [], sections: [], projects: [], events: [], activeDay: dateKey(new Date()), userName: 'Marcus' })

  const today = dateKey(new Date())
  const activeDate = new Date(`${snapshot.activeDay}T12:00:00`)
  const isNewDayAvailable = snapshot.activeDay < today
  const managedEvents = snapshot.events
    .filter((event) => event.effectiveDate === snapshot.activeDay)
    .reduce((events, event) => {
      const existing = events.get(event.taskId)
      if (!existing || existing.createdAt < event.createdAt) events.set(event.taskId, event)
      return events
    }, new Map<string, TaskEvent>())
  const completedIds = new Set([...managedEvents].filter(([, event]) => event.action === 'completed').map(([taskId]) => taskId))
  const managedIds = new Set(managedEvents.keys())
  const visibleTasks = view === 'sheets' ? [] : tasksForView(snapshot.tasks, view, activeDate, managedIds, showCompleted)
  const dueProjects = view === 'today' ? snapshot.projects
    .filter((project) => !project.archived)
    .map((project) => ({
      project,
      tasks: snapshot.tasks.filter((task) => task.projectId === project.id && !task.archived && task.nextDueAt <= snapshot.activeDay && !completedIds.has(task.id)),
    }))
    .filter((group) => group.tasks.length > 0) : []
  const listById = new Map(snapshot.lists.map((list) => [list.id, list]))
  const effort = visibleTasks.reduce((sum, task) => sum + task.effort, 0)
    + dueProjects.flatMap((group) => group.tasks).reduce((sum, task) => sum + task.effort, 0)
  const selectedTask = snapshot.tasks.find((task) => task.id === selectedTaskId)

  async function addTask(event: FormEvent) {
    event.preventDefault()
    const parsed = parseTaskInput(entry)
    if (!parsed.title) return

    const now = new Date().toISOString()
    await db.transaction('rw', db.lists, db.tasks, async () => {
      if (!await db.lists.get(entryListId)) return
      await db.tasks.add({
        id: crypto.randomUUID(),
        listId: entryListId,
        title: parsed.title,
        preferredTime: parsed.preferredTime,
        intervalDays: parsed.intervalDays,
        position: Date.now(),
        effort: 1,
        fixedInterval: parsed.fixedInterval,
        nextDueAt: snapshot.activeDay,
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
    })
    setEntry('')
  }

  async function manageTask(task: Task, action: TaskAction) {
    const now = new Date()
    const effectiveDate = snapshot.activeDay
    await db.transaction('rw', db.tasks, db.events, async () => {
      if (!await db.tasks.get(task.id)) return
      const existingEvent = managedEvents.get(task.id)
      if (existingEvent) {
        if (existingEvent.action !== action) return
        const previousCompletion = snapshot.events
          .filter((event) => event.taskId === task.id && event.action === 'completed' && event.createdAt < existingEvent.createdAt)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
        await db.events.delete(existingEvent.id)
        await db.tasks.update(task.id, {
          nextDueAt: existingEvent.previousNextDueAt ?? existingEvent.effectiveDate,
          lastCompletedAt: existingEvent.previousLastCompletedAt ?? previousCompletion?.createdAt,
          archived: existingEvent.previousArchived ?? false,
          updatedAt: now.toISOString(),
        })
        return
      }

      await db.events.add({
        id: crypto.randomUUID(),
        taskId: task.id,
        action,
        effectiveDate,
        createdAt: now.toISOString(),
        previousNextDueAt: task.nextDueAt,
        previousLastCompletedAt: task.lastCompletedAt,
        previousArchived: task.archived,
      })

      if (action === 'delayed') {
        await db.tasks.update(task.id, {
          nextDueAt: dateKey(addDays(new Date(`${effectiveDate}T12:00:00`), 1)),
          updatedAt: now.toISOString(),
        })
        return
      }

      await db.tasks.update(task.id, {
        nextDueAt: nextDueDate(task, new Date(`${effectiveDate}T12:00:00`)),
        lastCompletedAt: action === 'completed' ? now.toISOString() : task.lastCompletedAt,
        archived: action === 'completed' && !task.intervalDays,
        updatedAt: now.toISOString(),
      })
    })
  }

  async function startNewDay() {
    await db.settings.put({ key: 'activeDay', value: today })
  }

  async function updateTask(changes: Partial<Task>) {
    if (!selectedTask) return
    await db.transaction('rw', db.lists, db.projects, db.sections, db.tasks, async () => {
      const targetListId = changes.listId ?? selectedTask.listId
      if (!await db.lists.get(targetListId)) return
      if (changes.projectId && !await db.projects.get(changes.projectId)) return
      if (changes.sectionId && !await db.sections.get(changes.sectionId)) return
      await db.tasks.update(selectedTask.id, { ...changes, updatedAt: new Date().toISOString() })
    })
  }

  function openTaskOptions(taskId: string) {
    const task = snapshot.tasks.find((item) => item.id === taskId)
    setLastCompletedDraft(task?.lastCompletedAt ? dateKey(new Date(task.lastCompletedAt)) : '')
    setLastCompletedTouched(false)
    setSelectedTaskId(taskId)
  }

  function closeTaskOptions() {
    setSelectedTaskId(undefined)
    setLastCompletedTouched(false)
  }

  async function saveTaskOptions() {
    if (selectedTask && lastCompletedTouched) {
      if (!lastCompletedDraft) {
        await updateTask({ lastCompletedAt: undefined })
      } else {
        const completedAt = new Date(`${lastCompletedDraft}T12:00:00`)
        await updateTask({
          lastCompletedAt: completedAt.toISOString(),
          ...selectedTask.intervalDays
            ? { nextDueAt: dateKey(addDays(completedAt, selectedTask.intervalDays)), archived: false }
            : {},
        })
      }
    }
    closeTaskOptions()
  }

  function openSheet(listId?: string, projectId?: string) {
    setSheetListId(listId)
    setSheetProjectId(projectId)
    setView('sheets')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">2DAI</div>
        <div>
          <p className="eyebrow">Your day</p>
          <h1>{snapshot.userName}</h1>
        </div>
      </header>

      <main className={view === 'sheets' ? 'lists-main' : ''}>
        {view !== 'sheets' && <section className="day-heading">
          <div>
            <p className="date-label">{formatFriendlyDate(activeDate)}</p>
            <h2>{viewLabels[view]}</h2>
          </div>
          <div className="effort-meter" aria-label={`${effort} effort points`}>
            <span>Effort</span>
            <strong>{effort}</strong>
          </div>
        </section>}

        <nav className="view-tabs" aria-label="Planning range">
          {(['today', 'week', 'month', 'sheets'] as const).map((item) => (
            <button className={view === item ? 'active' : ''} key={item} type="button" onClick={() => setView(item)}>
              {item === 'today' ? <ListTodo size={17} /> : item === 'sheets' ? <LibraryBig size={17} /> : <CalendarDays size={17} />}
              {viewLabels[item]}
            </button>
          ))}
        </nav>

        {view === 'sheets' && (
          <ListWorkspace
            lists={snapshot.lists}
            sections={snapshot.sections}
            projects={snapshot.projects}
            tasks={snapshot.tasks}
            initialListId={sheetListId}
            initialProjectId={sheetProjectId}
            activeDay={snapshot.activeDay}
            managedTaskIds={completedIds}
            onLocationChange={openSheet}
            onManage={manageTask}
            onEdit={openTaskOptions}
          />
        )}

        {view === 'today' && (
          <form className="quick-add" onSubmit={addTask}>
            <Plus size={21} aria-hidden="true" />
            <input value={entry} onChange={(event) => setEntry(event.target.value)} placeholder="Add a task, try ‘Call Mom 2:30p 7d!’" aria-label="New task" />
            <select value={entryListId} onChange={(event) => setEntryListId(event.target.value)} aria-label="Task list">
              {snapshot.lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
            <button type="submit" disabled={!entry.trim()}>Add</button>
          </form>
        )}

        {isNewDayAvailable && view === 'today' && (
          <button className="new-day" type="button" onClick={startNewDay}>
            <span className="new-day-icon"><RotateCcw size={19} /></span>
            <span><strong>Start new day</strong><small>{formatFriendlyDate(new Date())}</small></span>
            <ChevronRight size={20} />
          </button>
        )}

        {view !== 'sheets' && <section className="task-section" aria-live="polite">
          <div className="section-label">
            <span>{view === 'today' ? `${visibleTasks.length + dueProjects.length} items` : 'Upcoming, without daily repeats'}</span>
            {view === 'today' && (
              <label><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Show managed</label>
            )}
          </div>

          <div className="task-list">
            {dueProjects.map(({ project, tasks }) => {
              const list = listById.get(project.listId)
              return (
                <article className="task-row project-rollup" key={project.id}>
                  <span className="project-rollup-icon"><FolderKanban size={19} /></span>
                  <button className="task-copy" type="button" onClick={() => openSheet(project.listId, project.id)}>
                    <span className="task-title">{project.name}</span>
                    <span className="task-meta"><i style={{ background: list?.color }} /> {list?.name} · {tasks.length} due inside</span>
                  </button>
                  <button className="rollup-open" type="button" onClick={() => openSheet(project.listId, project.id)} aria-label={`Open ${project.name}`}><ChevronRight size={19} /></button>
                </article>
              )
            })}
            {visibleTasks.map((task) => {
              const list = listById.get(task.listId)
              const managedAction = managedEvents.get(task.id)?.action
              const isManaged = Boolean(managedAction)
              const isNotDue = task.nextDueAt > snapshot.activeDay
              return (
                <article className={`task-row${isManaged ? ' managed' : ''}${isNotDue ? ' not-due' : ''}`} key={task.id}>
                  <button className="complete-button" type="button" onClick={() => manageTask(task, 'completed')} aria-pressed={managedAction === 'completed'} aria-label={`${managedAction === 'completed' ? 'Uncheck' : 'Complete'} ${task.title}`}><Check size={20} /></button>
                  <button className="task-copy" type="button" onClick={() => openTaskOptions(task.id)}>
                    <span className="task-title">{task.title}</span>
                    <span className="task-meta">
                      <i style={{ background: list?.color }} /> {list?.name ?? 'Unsorted'}
                      {task.preferredTime && <><Clock3 size={13} /> {formatTime(task.preferredTime)}</>}
                      {view !== 'today' && <>Due {formatFriendlyDate(new Date(`${task.nextDueAt}T12:00:00`))}</>}
                    </span>
                  </button>
                  <div className="task-actions">
                    {(!isManaged || managedAction === 'delayed') && <button type="button" onClick={() => manageTask(task, 'delayed')} title={managedAction === 'delayed' ? 'Undo delay' : 'Delay one day'} aria-pressed={managedAction === 'delayed'} aria-label={`${managedAction === 'delayed' ? 'Undo delay for' : 'Delay'} ${task.title}`}><Clock3 size={18} /></button>}
                    {(!isManaged || managedAction === 'skipped') && <button type="button" onClick={() => manageTask(task, 'skipped')} title={managedAction === 'skipped' ? 'Undo skip' : 'Skip this occurrence'} aria-pressed={managedAction === 'skipped'} aria-label={`${managedAction === 'skipped' ? 'Undo skip for' : 'Skip'} ${task.title}`}><SkipForward size={18} /></button>}
                    <button type="button" onClick={() => openTaskOptions(task.id)} title="Task options" aria-label={`Options for ${task.title}`}><MoreHorizontal size={19} /></button>
                  </div>
                </article>
              )
            })}
            {!visibleTasks.length && !dueProjects.length && (
              <div className="empty-state"><Check size={26} /><strong>Nothing waiting here</strong><span>{view === 'today' ? 'Add a task or take the win.' : 'No non-daily tasks are due in this range.'}</span></div>
            )}
          </div>
        </section>}
      </main>

      {selectedTask && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={closeTaskOptions}>
          <section className="options-sheet" role="dialog" aria-modal="true" aria-labelledby="options-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div><p className="eyebrow">Task options</p><h3 id="options-title">{selectedTask.title}</h3></div>
              <button className="text-button" type="button" onClick={saveTaskOptions}>Done</button>
            </div>
            <div className="option-grid">
              <label>List<select value={selectedTask.listId} onChange={(event) => updateTask({ listId: event.target.value })}>{snapshot.lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
              <label>Section<select value={selectedTask.sectionId ?? ''} onChange={(event) => updateTask({ sectionId: event.target.value || undefined })}><option value="">Todo</option>{snapshot.sections.filter((section) => section.listId === selectedTask.listId).map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
              <label>Project<select value={selectedTask.projectId ?? ''} onChange={(event) => updateTask({ projectId: event.target.value || undefined })}><option value="">Top level</option>{snapshot.projects.filter((project) => project.listId === selectedTask.listId && !project.archived).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label>Effort<input type="number" min="1" max="10" value={selectedTask.effort} onChange={(event) => updateTask({ effort: Number(event.target.value) })} /></label>
              <label>Repeat every<input type="number" min="1" placeholder="Days" value={selectedTask.intervalDays ?? ''} onChange={(event) => updateTask({ intervalDays: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <label>Preferred time<input type="time" value={selectedTask.preferredTime ?? ''} onChange={(event) => updateTask({ preferredTime: event.target.value || undefined })} /></label>
              <label>Last completed<input type="date" value={lastCompletedDraft} onClick={() => setLastCompletedTouched(true)} onChange={(event) => { setLastCompletedDraft(event.target.value); setLastCompletedTouched(true) }} /></label>
            </div>
            <label className="toggle-row"><span><strong>Fixed schedule</strong><small>Repeat from the scheduled date, not completion</small></span><input type="checkbox" checked={selectedTask.fixedInterval} onChange={(event) => updateTask({ fixedInterval: event.target.checked })} /></label>
            <button className="archive-button" type="button" onClick={async () => { await updateTask({ archived: true }); closeTaskOptions() }}>Archive task</button>
          </section>
        </div>
      )}
    </div>
  )
}

function tasksForView(tasks: Task[], view: PlannerView, activeDate: Date, managedIds: Set<string>, showCompleted: boolean): Task[] {
  const start = dateKey(activeDate)
  const end = dateKey(addDays(activeDate, view === 'week' ? 7 : 31))
  return tasks
    .filter((task) => task.plannerVisible !== false)
    .filter((task) => !task.projectId)
    .filter((task) => !task.archived || (view === 'today' && showCompleted && managedIds.has(task.id)))
    .filter((task) => {
      if (view === 'today') return managedIds.has(task.id) ? showCompleted : task.nextDueAt <= start
      return task.nextDueAt > start && task.nextDueAt <= end && (task.intervalDays ?? 0) > 1
    })
    .sort((left, right) => view !== 'today'
      ? left.nextDueAt.localeCompare(right.nextDueAt) || left.position - right.position
      : (left.preferredTime ?? '99:99').localeCompare(right.preferredTime ?? '99:99') || left.position - right.position)
}

function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute))
}

export default App