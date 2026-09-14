import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ListTodo,
  MoreHorizontal,
  Plus,
  RotateCcw,
  SkipForward,
} from 'lucide-react'
import { db } from './db'
import {
  addDays,
  dateKey,
  formatFriendlyDate,
  nextDueDate,
  parseTaskInput,
  type Task,
  type TaskAction,
} from './domain'
import './App.css'

type View = 'today' | 'week' | 'month'

const viewLabels: Record<View, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
}

function App() {
  const [view, setView] = useState<View>('today')
  const [entry, setEntry] = useState('')
  const [entryListId, setEntryListId] = useState('personal')
  const [selectedTaskId, setSelectedTaskId] = useState<string>()
  const [showCompleted, setShowCompleted] = useState(false)

  const snapshot = useLiveQuery(async () => {
    const [tasks, lists, activeDaySetting, events] = await Promise.all([
      db.tasks.toArray(),
      db.lists.orderBy('position').toArray(),
      db.settings.get('activeDay'),
      db.events.toArray(),
    ])
    return { tasks, lists, events, activeDay: activeDaySetting?.value ?? dateKey(new Date()) }
  }, [], { tasks: [], lists: [], events: [], activeDay: dateKey(new Date()) })

  const today = dateKey(new Date())
  const activeDate = new Date(`${snapshot.activeDay}T12:00:00`)
  const isNewDayAvailable = snapshot.activeDay < today
  const completedIds = new Set(
    snapshot.events
      .filter((event) => event.effectiveDate === snapshot.activeDay && event.action !== 'delayed')
      .map((event) => event.taskId),
  )
  const visibleTasks = tasksForView(snapshot.tasks, view, activeDate, completedIds, showCompleted)
  const listById = new Map(snapshot.lists.map((list) => [list.id, list]))
  const effort = visibleTasks.reduce((sum, task) => sum + task.effort, 0)
  const selectedTask = snapshot.tasks.find((task) => task.id === selectedTaskId)

  async function addTask(event: FormEvent) {
    event.preventDefault()
    const parsed = parseTaskInput(entry)
    if (!parsed.title) return

    const now = new Date().toISOString()
    await db.tasks.add({
      id: crypto.randomUUID(),
      listId: entryListId,
      title: parsed.title,
      preferredTime: parsed.preferredTime,
      position: Date.now(),
      effort: 1,
      fixedInterval: false,
      nextDueAt: snapshot.activeDay,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })
    setEntry('')
  }

  async function manageTask(task: Task, action: TaskAction) {
    const now = new Date()
    const effectiveDate = snapshot.activeDay
    await db.transaction('rw', db.tasks, db.events, async () => {
      await db.events.add({
        id: crypto.randomUUID(),
        taskId: task.id,
        action,
        effectiveDate,
        createdAt: now.toISOString(),
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
    await db.tasks.update(selectedTask.id, { ...changes, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">2D</div>
        <div>
          <p className="eyebrow">Your day, locally</p>
          <h1>2Dai</h1>
        </div>
      </header>

      <main>
        <section className="day-heading">
          <div>
            <p className="date-label">{formatFriendlyDate(activeDate)}</p>
            <h2>{viewLabels[view]}</h2>
          </div>
          <div className="effort-meter" aria-label={`${effort} effort points`}>
            <span>Effort</span>
            <strong>{effort}</strong>
          </div>
        </section>

        <nav className="view-tabs" aria-label="Planning range">
          {(['today', 'week', 'month'] as const).map((item) => (
            <button className={view === item ? 'active' : ''} key={item} type="button" onClick={() => setView(item)}>
              {item === 'today' ? <ListTodo size={17} /> : <CalendarDays size={17} />}
              {viewLabels[item]}
            </button>
          ))}
        </nav>

        {view === 'today' && (
          <form className="quick-add" onSubmit={addTask}>
            <Plus size={21} aria-hidden="true" />
            <input value={entry} onChange={(event) => setEntry(event.target.value)} placeholder="Add a task, try ‘Call Mom 2:30p’" aria-label="New task" />
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

        <section className="task-section" aria-live="polite">
          <div className="section-label">
            <span>{view === 'today' ? `${visibleTasks.length} tasks` : 'Upcoming, without daily repeats'}</span>
            {view === 'today' && (
              <label><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Show managed</label>
            )}
          </div>

          <div className="task-list">
            {visibleTasks.map((task) => {
              const list = listById.get(task.listId)
              const isManaged = completedIds.has(task.id)
              return (
                <article className={`task-row ${isManaged ? 'managed' : ''}`} key={task.id}>
                  <button className="complete-button" type="button" onClick={() => manageTask(task, 'completed')} aria-label={`Complete ${task.title}`}><Check size={20} /></button>
                  <button className="task-copy" type="button" onClick={() => setSelectedTaskId(task.id)}>
                    <span className="task-title">{task.title}</span>
                    <span className="task-meta">
                      <i style={{ background: list?.color }} /> {list?.name ?? 'Unsorted'}
                      {task.preferredTime && <><Clock3 size={13} /> {formatTime(task.preferredTime)}</>}
                      {view !== 'today' && <>Due {formatFriendlyDate(new Date(`${task.nextDueAt}T12:00:00`))}</>}
                    </span>
                  </button>
                  <div className="task-actions">
                    <button type="button" onClick={() => manageTask(task, 'delayed')} title="Delay one day" aria-label={`Delay ${task.title}`}><Clock3 size={18} /></button>
                    <button type="button" onClick={() => manageTask(task, 'skipped')} title="Skip this occurrence" aria-label={`Skip ${task.title}`}><SkipForward size={18} /></button>
                    <button type="button" onClick={() => setSelectedTaskId(task.id)} title="Task options" aria-label={`Options for ${task.title}`}><MoreHorizontal size={19} /></button>
                  </div>
                </article>
              )
            })}
            {!visibleTasks.length && (
              <div className="empty-state"><Check size={26} /><strong>Nothing waiting here</strong><span>{view === 'today' ? 'Add a task or take the win.' : 'No non-daily tasks are due in this range.'}</span></div>
            )}
          </div>
        </section>
      </main>

      {selectedTask && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setSelectedTaskId(undefined)}>
          <section className="options-sheet" role="dialog" aria-modal="true" aria-labelledby="options-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div><p className="eyebrow">Task options</p><h3 id="options-title">{selectedTask.title}</h3></div>
              <button className="text-button" type="button" onClick={() => setSelectedTaskId(undefined)}>Done</button>
            </div>
            <div className="option-grid">
              <label>List<select value={selectedTask.listId} onChange={(event) => updateTask({ listId: event.target.value })}>{snapshot.lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
              <label>Effort<input type="number" min="1" max="10" value={selectedTask.effort} onChange={(event) => updateTask({ effort: Number(event.target.value) })} /></label>
              <label>Repeat every<input type="number" min="1" placeholder="Days" value={selectedTask.intervalDays ?? ''} onChange={(event) => updateTask({ intervalDays: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <label>Preferred time<input type="time" value={selectedTask.preferredTime ?? ''} onChange={(event) => updateTask({ preferredTime: event.target.value || undefined })} /></label>
            </div>
            <label className="toggle-row"><span><strong>Fixed schedule</strong><small>Repeat from the scheduled date, not completion</small></span><input type="checkbox" checked={selectedTask.fixedInterval} onChange={(event) => updateTask({ fixedInterval: event.target.checked })} /></label>
            <button className="archive-button" type="button" onClick={async () => { await updateTask({ archived: true }); setSelectedTaskId(undefined) }}>Archive task</button>
          </section>
        </div>
      )}
    </div>
  )
}

function tasksForView(tasks: Task[], view: View, activeDate: Date, completedIds: Set<string>, showCompleted: boolean): Task[] {
  const start = dateKey(activeDate)
  const end = dateKey(addDays(activeDate, view === 'week' ? 7 : 31))
  return tasks
    .filter((task) => !task.archived || (view === 'today' && showCompleted && completedIds.has(task.id)))
    .filter((task) => {
      if (view === 'today') return completedIds.has(task.id) ? showCompleted : task.nextDueAt <= start
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