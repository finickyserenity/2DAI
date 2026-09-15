import { useState, type ChangeEvent } from 'react'
import { AlertTriangle, ClipboardPaste, FileUp, FlaskConical, X } from 'lucide-react'
import { parseGoogleSheetsTsv, type GoogleSheetsImportPreview } from './importers/googleSheetsTsv.ts'
import { replaceListFromPreview } from './importers/importListPreview.ts'

interface ImportListDialogProps {
  onClose: () => void
  onImported: (listId: string) => void
}

export function ImportListDialog({ onClose, onImported }: ImportListDialogProps) {
  const [listName, setListName] = useState('')
  const [source, setSource] = useState('')
  const [preview, setPreview] = useState<GoogleSheetsImportPreview>()
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  function buildPreview(text = source) {
    if (!listName.trim()) {
      setPreview(undefined)
      setError('Enter a list name before previewing the import.')
      return
    }
    try {
      setPreview(parseGoogleSheetsTsv(text, { listName }))
      setError('')
    } catch (caught) {
      setPreview(undefined)
      setError(caught instanceof Error ? caught.message : 'The pasted data could not be read.')
    }
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setSource(text)
    buildPreview(text)
  }

  async function loadDevelopmentLaundry() {
    const response = await fetch('/data/laundry.tab')
    if (!response.ok) {
      setError('The development Laundry fixture could not be loaded.')
      return
    }
    const text = await response.text()
    setSource(text)
    setPreview(undefined)
    if (!listName.trim()) setError('Enter a list name before previewing the import.')
  }

  async function runImport() {
    if (!preview || !listName.trim()) return
    setImporting(true)
    try {
      const listId = await replaceListFromPreview(preview)
      onImported(listId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The import could not be saved.')
      setImporting(false)
    }
  }

  return (
    <div className="import-backdrop" role="presentation">
      <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header>
          <div><p className="eyebrow">Google Sheets migration</p><h2 id="import-title">Import a list</h2></div>
          <button type="button" onClick={onClose} aria-label="Close import"><X size={20} /></button>
        </header>

        <div className="import-fields">
          <label>List name<input required value={listName} onChange={(event) => { setListName(event.target.value); setPreview(undefined) }} /></label>
        </div>

        <label className="import-source-label"><span><ClipboardPaste size={16} /> Paste the copied tab contents</span>
          <textarea value={source} onChange={(event) => { setSource(event.target.value); setPreview(undefined) }} placeholder="Task    Done    Delay    Skip…" />
        </label>

        <div className="import-source-actions">
          <label className="file-button"><FileUp size={16} /> Choose .tab/.tsv<input type="file" accept=".tab,.tsv,.txt,text/tab-separated-values" onChange={readFile} /></label>
          {import.meta.env.DEV && <button type="button" onClick={loadDevelopmentLaundry}><FlaskConical size={16} /> Load Laundry test export</button>}
          <button className="preview-button" type="button" disabled={!source.trim() || !listName.trim()} onClick={() => buildPreview()}>Preview</button>
        </div>

        {error && <p className="import-error">{error}</p>}
        {preview && (
          <div className="import-preview">
            <div className="import-summary"><strong>{preview.taskCount}</strong><span>tasks</span><strong>{preview.sections.length}</strong><span>sections</span></div>
            <div className="import-section-list">{preview.sections.map((section) => <span key={section.name}>{section.name}<small>{section.tasks.length}</small></span>)}</div>
            {preview.warnings.length > 0 && <ul className="import-warnings">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            <p><AlertTriangle size={16} /> Importing again with the same list name replaces that list's tasks, sections, projects, and task history.</p>
            <button type="button" disabled={importing} onClick={runImport}>{importing ? 'Importing…' : `Import ${preview.taskCount} tasks`}</button>
          </div>
        )}
      </section>
    </div>
  )
}