import { useState, type FormEvent } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  FolderKanban,
  Import,
  MoreHorizontal,
  Plus,
  Search,
} from 'lucide-react'
import { db } from './db'
import { ImportListDialog } from './ImportListDialog.tsx'
import { dateKey, parseTaskInput, type ProjectFolder, type Task, type TaskAction, type TaskList, type TaskSection } from './domain'

interface ListWorkspaceProps {
  lists: TaskList[]
  sections: TaskSection[]
  projects: ProjectFolder[]
  tasks: Task[]
  initialListId?: string
  initialProjectId?: string
  onLocationChange: (listId?: string, projectId?: string) => void
  onManage: (task: Task, action: TaskAction) => Promise<void>
  onEdit: (taskId: string) => void
}

export function ListWorkspace({
  lists,
  sections,
  projects,
  tasks,
  initialListId,
  initialProjectId,
  onLocationChange,
  onManage,
  onEdit,
}: ListWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [creationMode, setCreationMode] = useState<'section' | 'project'>()
  const [creationName, setCreationName] = useState('')
  const activeList = lists.find((list) => list.id === initialListId)
  const activeProject = projects.find((project) => project.id === initialProjectId)

  if (!activeList) {
    return <ListIndex lists={lists} tasks={tasks} projects={projects} onOpen={(listId) => onLocationChange(listId)} />
  }

  const activeListId = activeList.id
  const listSections = sections
    .filter((section) => section.listId === activeListId)
    .filter((section) => activeProject ? section.projectId === activeProject.id : !section.projectId)
    .sort((a, b) => a.position - b.position)
  const listProjects = projects.filter((project) => project.listId === activeListId && !project.archived).sort((a, b) => a.position - b.position)
  const scopedTasks = tasks
    .filter((task) => task.listId === activeListId && !task.archived)
    .filter((task) => activeProject ? task.projectId === activeProject.id : !task.projectId)
    .filter((task) => task.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position)

  async function createContainer(event: FormEvent) {
    event.preventDefault()
    const name = creationName.trim()
    if (!name || !creationMode) return
    const id = crypto.randomUUID()
    if (creationMode === 'section') {
      await db.sections.add({ id, listId: activeListId, projectId: activeProject?.id, name, position: Date.now() })
    } else {
      await db.projects.add({ id, listId: activeListId, name, position: Date.now(), archived: false })
      onLocationChange(activeListId, id)
    }
    setCreationName('')
    setCreationMode(undefined)
  }

  return (
    <section className="list-workspace">
      <div className="list-breadcrumbs">
        <button type="button" onClick={() => onLocationChange()}><ArrowLeft size={17} /> Lists</button>
        <ChevronRight size={15} />
        <button type="button" onClick={() => onLocationChange(activeList.id)}>{activeList.name}</button>
        {activeProject && <><ChevronRight size={15} /><strong>{activeProject.name}</strong></>}
      </div>

      <div className="list-titlebar">
        <div>
          <p className="date-label">{activeProject ? 'Project folder' : 'Task list'}</p>
          <h2>{activeProject?.name ?? activeList.name}</h2>
          <span>{scopedTasks.length} visible tasks</span>
        </div>
        <div className="list-title-actions">
          {!activeProject && <button type="button" onClick={() => setCreationMode('project')}><FolderKanban size={17} /> New project</button>}
          <button type="button" onClick={() => setCreationMode('section')}><Plus size={17} /> New section</button>
        </div>
      </div>

      {creationMode && (
        <form className="inline-create" onSubmit={createContainer}>
          {creationMode === 'project' ? <FolderKanban size={18} /> : <Plus size={18} />}
          <input autoFocus value={creationName} onChange={(event) => setCreationName(event.target.value)} placeholder={creationMode === 'project' ? 'Project folder name' : 'Section name'} aria-label={creationMode === 'project' ? 'Project folder name' : 'Section name'} />
          <button type="submit" disabled={!creationName.trim()}>Create</button>
          <button type="button" onClick={() => setCreationMode(undefined)}>Cancel</button>
        </form>
      )}

      <div className="list-toolbar">
        <Search size={18} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter this list" aria-label="Filter this list" />
      </div>

      {!activeProject && listProjects.length > 0 && (
        <div className="project-strip">
          {listProjects.map((project) => {
            const projectTasks = tasks.filter((task) => task.projectId === project.id && !task.archived)
            return (
              <button type="button" key={project.id} onClick={() => onLocationChange(activeList.id, project.id)}>
                <FolderKanban size={19} />
                <span><strong>{project.name}</strong><small>{projectTasks.length} tasks</small></span>
                <ChevronRight size={17} />
              </button>
            )
          })}
        </div>
      )}

      <SheetSection
        name="Todo"
        tasks={scopedTasks.filter((task) => !task.sectionId || !listSections.some((section) => section.id === task.sectionId))}
        listId={activeList.id}
        projectId={activeProject?.id}
        onManage={onManage}
        onEdit={onEdit}
      />
      {listSections.map((section) => (
        <SheetSection
          key={section.id}
          name={section.name}
          tasks={scopedTasks.filter((task) => task.sectionId === section.id)}
          listId={activeList.id}
          sectionId={section.id}
          projectId={activeProject?.id}
          onManage={onManage}
          onEdit={onEdit}
        />
      ))}
    </section>
  )
}

function ListIndex({ lists, tasks, projects, onOpen }: { lists: TaskList[]; tasks: Task[]; projects: ProjectFolder[]; onOpen: (id: string) => void }) {
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [name, setName] = useState('')

  async function addList(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    const id = crypto.randomUUID()
    await db.lists.add({ id, name: cleanName, color: '#4d82b8', position: Date.now() })
    setName('')
    setCreating(false)
    onOpen(id)
  }

  return (
    <section className="list-index">
      <div className="list-titlebar">
        <div><p className="date-label">Task library</p><h2>Lists</h2><span>Browse and organize complete task inventories</span></div>
        <div className="list-index-actions">
          <button type="button" onClick={() => setImporting(true)}><Import size={17} /> Import</button>
          <button type="button" aria-label="New list" onClick={() => setCreating(true)}><Plus size={17} /> New</button>
        </div>
      </div>
      {creating && (
        <form className="inline-create" onSubmit={addList}>
          <Plus size={18} />
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="List name" aria-label="List name" />
          <button type="submit" disabled={!name.trim()}>Create</button>
          <button type="button" onClick={() => setCreating(false)}>Cancel</button>
        </form>
      )}
      <div className="list-grid">
        {lists.map((list) => {
          const count = tasks.filter((task) => task.listId === list.id && !task.archived).length
          const projectCount = projects.filter((project) => project.listId === list.id && !project.archived).length
          return (
            <button type="button" key={list.id} onClick={() => onOpen(list.id)}>
              <i style={{ background: list.color }} />
              <span><strong>{list.name}</strong><small>{count} tasks · {projectCount} projects</small></span>
              <ChevronRight size={19} />
            </button>
          )
        })}
      </div>
      {importing && <ImportListDialog onClose={() => setImporting(false)} onImported={(listId) => { setImporting(false); onOpen(listId) }} />}
    </section>
  )
}

interface SheetSectionProps {
  name: string
  tasks: Task[]
  listId: string
  sectionId?: string
  projectId?: string
  onManage: (task: Task, action: TaskAction) => Promise<void>
  onEdit: (taskId: string) => void
}

function SheetSection({ name, tasks, listId, sectionId, projectId, onManage, onEdit }: SheetSectionProps) {
  const [entry, setEntry] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  async function addRow(event: FormEvent) {
    event.preventDefault()
    const parsed = parseTaskInput(entry)
    if (!parsed.title) return
    const now = new Date().toISOString()
    await db.tasks.add({
      id: crypto.randomUUID(), listId, sectionId, projectId, title: parsed.title,
      preferredTime: parsed.preferredTime, position: Date.now(), effort: 1,
      intervalDays: parsed.intervalDays, fixedInterval: parsed.fixedInterval,
      nextDueAt: dateKey(new Date()), archived: false,
      createdAt: now, updatedAt: now,
    })
    setEntry('')
  }

  async function moveTask(task: Task, offset: -1 | 1) {
    const index = tasks.findIndex((item) => item.id === task.id)
    const other = tasks[index + offset]
    if (!other) return
    await db.transaction('rw', db.tasks, async () => {
      await db.tasks.update(task.id, { position: other.position })
      await db.tasks.update(other.id, { position: task.position })
    })
  }

  return (
    <section className="raw-section">
      <button className="raw-section-heading" type="button" onClick={() => setCollapsed((value) => !value)}>
        <ChevronRight className={collapsed ? '' : 'open'} size={17} /><strong>{name}</strong><span>{tasks.length}</span>
      </button>
      {!collapsed && (
        <>
          <div className="raw-table-heading"><span>Done</span><span>Task</span><span>Due</span><span>Repeat</span><span /></div>
          {tasks.map((task, index) => (
            <div className="raw-task-row" key={task.id}>
              <button className="raw-check" type="button" onClick={() => onManage(task, 'completed')} aria-label={`Complete ${task.title}`}><Check size={16} /></button>
              <button className="raw-task-name" type="button" onClick={() => onEdit(task.id)}>{task.title}</button>
              <span>{shortDate(task.nextDueAt)}</span>
              <span>{task.intervalDays ? `${task.intervalDays}${task.fixedInterval ? '!' : ''}d` : '—'}</span>
              <div className="raw-row-actions">
                <button type="button" disabled={index === 0} onClick={() => moveTask(task, -1)} aria-label={`Move ${task.title} up`}><ArrowUp size={15} /></button>
                <button type="button" disabled={index === tasks.length - 1} onClick={() => moveTask(task, 1)} aria-label={`Move ${task.title} down`}><ArrowDown size={15} /></button>
                <button type="button" onClick={() => onEdit(task.id)} aria-label={`Options for ${task.title}`}><MoreHorizontal size={17} /></button>
              </div>
            </div>
          ))}
          <form className="raw-add-row" onSubmit={addRow}>
            <Plus size={17} />
            <input value={entry} onChange={(event) => setEntry(event.target.value)} placeholder={`Add to ${name}`} aria-label={`Add task to ${name}`} />
            <button type="submit" disabled={!entry.trim()}>Add row</button>
          </form>
        </>
      )}
    </section>
  )
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' }).format(new Date(`${value}T12:00:00`))
}