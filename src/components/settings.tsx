import { useState } from 'react'
import { exportBackup, parseBackup, replaceBackup, type BackupFile } from '../backup.ts'
import { activateSnapshot, db, keepSnapshot, writeError } from '../db.ts'
import { dateTime, localDate } from '../format.ts'
import { inspectImport, SESSION_ERROR } from '../parse-config.ts'
import type { ParsedRoute, RouteSnapshot } from '../types.ts'

export function Settings({ snapshots }: { snapshots: RouteSnapshot[] }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<{ parsed: ParsedRoute; source: RouteSnapshot['source'] } | null>(null)
  const [importError, setImportError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [backup, setBackup] = useState<BackupFile | null>(null)
  const [backupError, setBackupError] = useState('')
  const [busy, setBusy] = useState(false)

  function inspect(value: string, source: RouteSnapshot['source'], fileName = '') {
    setPreview(null); setImportError(''); setNotice('')
    if (/\.jsonl$/i.test(fileName)) { setImportError(SESSION_ERROR); return }
    const result = inspectImport(value)
    if (result.ok) setPreview({ parsed: result.parsed, source })
    else setImportError(result.error)
  }
  async function write(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(message) } catch (failure) { setError(writeError(failure)) }
    finally { setBusy(false) }
  }
  return <>
    <div className="page-header"><h1>Settings</h1></div>
    <div className="stack">
      <section className="card stack" aria-label="Import config">
        <label><span>Config paste</span><textarea aria-describedby={importError ? 'config-error' : undefined} className="mono" placeholder="Paste omp config list --json" value={text} onChange={event => { setText(event.target.value); setPreview(null); setImportError('') }} /></label>
        <div><button onClick={() => inspect(text, 'paste')}>Read paste</button></div>
        <label><span>Config file</span><input type="file" accept=".json,.txt,.yml,.yaml,.jsonl" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''
          if (!file) return
          if (/\.jsonl$/i.test(file.name)) { inspect('', 'file', file.name); return }
          try { inspect(await file.text(), 'file', file.name) } catch { setPreview(null); setImportError('Could not read this file.') }
        }} /></label>
        {importError && <p className="error" id="config-error" role="alert">{importError}</p>}
        {preview && <div className="stack tight divider">
          <p>{preview.parsed.modelRoles.length} roles</p>
          {preview.parsed.cycleOrder.present && <p className="muted">Switcher: {preview.parsed.cycleOrder.value?.join(' → ') ?? 'unreadable'}</p>}
          <div><button className="primary" disabled={busy} onClick={() => void write(async () => {
            await keepSnapshot(preview.parsed, preview.source); setPreview(null); setText('')
          }, 'Config saved.')}>Keep this config</button></div>
        </div>}
      </section>
      <section className="section" aria-label="Saved configs">
        <h2>Saved configs</h2>
        <div className="stack tight">
          {[...snapshots].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).map(snapshot => <div className="card stack tight" key={snapshot.id}>
            <div className="row"><div><p>{dateTime(snapshot.importedAt)}</p><small>{snapshot.source}</small></div>{snapshot.active && <span className="tag">Active</span>}</div>
            <div className="actions">
              {!snapshot.active && <button disabled={busy} onClick={() => void write(() => activateSnapshot(snapshot.id), 'Active config updated.')}>Use this</button>}
              <button className="quiet" onClick={() => setDeleting(snapshot.id)}>Delete</button>
            </div>
            {deleting === snapshot.id && <div className="confirm"><p>Delete this config?</p><div className="actions"><button className="danger" disabled={busy} onClick={() => void write(async () => { await db.snapshots.delete(snapshot.id); setDeleting(null) }, 'Config deleted.')}>Delete this config?</button><button onClick={() => setDeleting(null)}>Cancel</button></div></div>}
          </div>)}
          {snapshots.length === 0 && <p className="muted">No saved configs.</p>}
        </div>
      </section>
      <section className="section stack" aria-label="Backup">
        <h2>Backup</h2>
        <div><button disabled={busy} onClick={() => void write(async () => {
          const blob = new Blob([JSON.stringify(await exportBackup(), null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a'); link.href = url; link.download = `omp-control-room-${localDate()}.json`
          link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        }, 'Backup exported.')}>Export backup</button></div>
        <label><span>Import backup</span><input type="file" accept=".json" disabled={busy} onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''
          if (!file) return
          setBackup(null); setBackupError('')
          try {
            const result = parseBackup(await file.text())
            if (result.ok) setBackup(result.backup)
            else setBackupError(result.error)
          } catch { setBackupError('Backup was not applied.') }
        }} /></label>
        {backup && <div className="confirm"><p>Replace all local data?</p><div className="actions"><button className="danger" disabled={busy} onClick={async () => {
          setBusy(true); setBackupError('')
          try { await replaceBackup(backup); setBackup(null); setPreview(null); setText(''); setNotice('Backup imported.') }
          catch (failure) { setBackupError(writeError(failure) === 'Not enough local storage to save.' ? writeError(failure) : 'Backup was not applied.') }
          finally { setBusy(false) }
        }}>Replace all local data?</button><button onClick={() => setBackup(null)}>Cancel</button></div></div>}
        {backupError && <p className="error" role="alert">{backupError}</p>}
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success-note" role="status">{notice}</p>}
      <p className="muted section">Local only. Nothing is uploaded.</p>
    </div>
  </>
}
