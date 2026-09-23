import { useState } from 'react'
import { deleteTask, saveTask, writeError } from '../db.ts'
import { money } from '../format.ts'
import { taskCost } from '../metrics.ts'
import { pathFor, taskPath } from '../nav.ts'
import { providerLabel, parseSelector } from '../parse-config.ts'
import { NUMERIC_FIELDS, taskDraft, taskFromDraft } from '../task-form.ts'
import { RESULTS, ROLES, THINKING, type EscalationStep, type ModelPrice, type ParsedRoute, type Result, type Role, type TaskRecord, type Thinking } from '../types.ts'

function roleOptions(parsed: ParsedRoute | null): Role[] {
  const imported = parsed?.modelRoles.map(row => row.role).filter((role): role is Role => ROLES.includes(role as Role)) ?? []
  return [...new Set([...imported, ...ROLES])]
}
const capital = (value: string) => value[0].toUpperCase() + value.slice(1)

function TaskEditor({ task, savedSteps, parsed, navigate }: { task?: TaskRecord; savedSteps: EscalationStep[]; parsed: ParsedRoute | null; navigate: (path: string) => void }) {
  const [draft, setDraft] = useState(() => taskDraft(task))
  const [steps, setSteps] = useState(() => savedSteps.slice().sort((a, b) => a.order - b.order))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const roles = roleOptions(parsed)
  const update = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }))
  function updateStep(index: number, changes: Partial<EscalationStep>) {
    setSteps(current => current.map((step, i) => i === index ? { ...step, ...changes } : step))
  }
  function move(index: number, delta: number) {
    setSteps(current => {
      const result = [...current]
      ;[result[index], result[index + delta]] = [result[index + delta], result[index]]
      return result
    })
  }
  return <>
    <div className="page-header"><h1>{task ? 'Edit task' : 'New task'}</h1><button className="quiet" onClick={() => navigate(pathFor('tasks'))}>Back</button></div>
    <form className="stack" noValidate onSubmit={async event => {
      event.preventDefault(); setError('')
      let record: TaskRecord
      try { record = taskFromDraft(draft, task) }
      catch (failure) { setError((failure as Error).message); return }
      setBusy(true)
      try { await saveTask(record, steps); navigate(pathFor('tasks')) }
      catch (failure) { setError(writeError(failure)) }
      finally { setBusy(false) }
    }}>
      <div className="form-grid">
        <label className="full"><span>Title</span><input required value={draft.title} onChange={event => update('title', event.target.value)} /></label>
        <label className="full"><span>Project</span><input value={draft.project} onChange={event => update('project', event.target.value)} /></label>
        <label className="full"><span>Started</span><input type="datetime-local" value={draft.started} onChange={event => update('started', event.target.value)} /></label>
        <label className="full"><span>Role</span><select value={draft.role} onChange={event => {
          const role = event.target.value as Role
          setDraft(current => ({ ...current, role, model: current.model || parsed?.modelRoles.find(row => row.role === role)?.selector || '' }))
        }}>{roles.map(role => <option key={role} value={role}>{role}</option>)}</select></label>
        <label className="full"><span>Model</span><input className="model-id" list="model-selectors" value={draft.model} onChange={event => update('model', event.target.value)} /></label>
        <label className="full"><span>Reasoning</span><select value={draft.reasoning} onChange={event => update('reasoning', event.target.value)}>{THINKING.map(level => <option key={level}>{level}</option>)}</select></label>
        {NUMERIC_FIELDS.map(field => <label key={field.key} className={field.key === 'durationMin' || field.key === 'apiCostUsd' ? 'full' : undefined}>
          <span>{field.label}</span><input inputMode={field.count ? 'numeric' : 'decimal'} value={draft[field.key]} onChange={event => update(field.key, event.target.value)} />
        </label>)}
        <fieldset className="full"><legend>Result</legend><div className="chips">{RESULTS.map(result => <button key={result} type="button" className={result} aria-pressed={draft.result === result} onClick={() => update('result', result)}>{capital(result)}</button>)}</div></fieldset>
        <label className="full"><span>Quality</span><input inputMode="numeric" value={draft.quality} onChange={event => update('quality', event.target.value)} /></label>
        <label className="full"><span>Notes</span><textarea value={draft.notes} onChange={event => update('notes', event.target.value)} /></label>
      </div>
      <datalist id="model-selectors">{parsed?.modelRoles.map(row => <option key={row.role} value={row.selector}>{row.role}</option>)}</datalist>
      <section className="section stack" aria-label="Escalation steps"><div className="row"><h2>Escalation steps</h2><button type="button" onClick={() => setSteps(current => [...current, {
        id: crypto.randomUUID(), taskId: task?.id ?? '', order: current.length, model: '', role: 'default', reasoningLevel: 'unknown', helped: current.length ? 'unclear' : null, note: '',
      }])}>Add step</button></div>
        {steps.map((step, index) => <fieldset className="card stack" key={step.id}><legend>Step {index + 1}</legend>
          <label><span>Model</span><input aria-label={`Step ${index + 1} model`} list="model-selectors" className="model-id" value={step.model} onChange={event => updateStep(index, { model: event.target.value })} /></label>
          <div className="form-grid"><label><span>Role</span><select aria-label={`Step ${index + 1} role`} value={step.role} onChange={event => {
            const role = event.target.value as Role
            updateStep(index, { role, model: step.model || parsed?.modelRoles.find(row => row.role === role)?.selector || '' })
          }}>{roles.map(role => <option key={role}>{role}</option>)}</select></label>
          <label><span>Reasoning</span><select aria-label={`Step ${index + 1} reasoning`} value={step.reasoningLevel} onChange={event => updateStep(index, { reasoningLevel: event.target.value as Thinking })}>{THINKING.map(level => <option key={level}>{level}</option>)}</select></label></div>
          {index > 0 && <label><span>Helped</span><select aria-label={`Step ${index + 1} helped`} value={step.helped ?? 'unclear'} onChange={event => updateStep(index, { helped: event.target.value as EscalationStep['helped'] })}><option>yes</option><option>no</option><option>unclear</option></select></label>}
          <label><span>Note</span><textarea aria-label={`Step ${index + 1} note`} value={step.note} onChange={event => updateStep(index, { note: event.target.value })} /></label>
          <div className="actions"><button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Up</button><button type="button" disabled={index === steps.length - 1} onClick={() => move(index, 1)}>Down</button><button type="button" className="quiet" onClick={() => setSteps(current => current.filter((_, i) => i !== index))}>Remove</button></div>
        </fieldset>)}
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions"><button className="primary" disabled={busy} type="submit">Save</button>{task && <button type="button" className="quiet" disabled={busy} onClick={() => setDeleting(true)}>Delete</button>}</div>
      {deleting && task && <div className="confirm"><p>Delete this task?</p><div className="actions"><button type="button" className="danger" disabled={busy} onClick={async () => {
        setBusy(true)
        try { await deleteTask(task.id); navigate(pathFor('tasks')) } catch (failure) { setError(writeError(failure)) }
        finally { setBusy(false) }
      }}>Delete this task?</button><button type="button" onClick={() => setDeleting(false)}>Cancel</button></div></div>}
    </form>
  </>
}

export function Tasks({ tasks, steps, prices, parsed, pathname, navigate }: {
  tasks: TaskRecord[]; steps: EscalationStep[]; prices: ModelPrice[]; parsed: ParsedRoute | null;
  pathname: string; navigate: (path: string) => void;
}) {
  const [filter, setFilter] = useState<Result | 'all'>('all')
  const [search, setSearch] = useState('')
  const relative = pathname.slice(pathFor('tasks').length).replace(/^\//, '').replace(/\/$/, '')
  if (relative === 'new') return <TaskEditor key="new" savedSteps={[]} parsed={parsed} navigate={navigate} />
  if (relative) {
    let id = ''
    try { id = decodeURIComponent(relative) } catch { /* An invalid path is not a task id. */ }
    const task = tasks.find(row => row.id === id)
    return task ? <TaskEditor key={id} task={task} savedSteps={steps.filter(step => step.taskId === id)} parsed={parsed} navigate={navigate} />
      : <div className="empty"><p>Task not found.</p><div><button onClick={() => navigate(pathFor('tasks'))}>Back</button></div></div>
  }
  const query = search.toLowerCase()
  const shown = tasks.filter(task => (filter === 'all' || task.result === filter) && (task.title.toLowerCase().includes(query) || task.project.toLowerCase().includes(query)))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return <>
    <div className="page-header"><h1>Tasks</h1><button className="primary" onClick={() => navigate(taskPath('new'))}>New task</button></div>
    <div className="stack"><label><span>Search</span><input placeholder="Title or project" type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="chips">{(['all', ...RESULTS] as const).map(result => <button key={result} aria-pressed={filter === result} onClick={() => setFilter(result)}>{capital(result)}</button>)}</div>
    </div>
    {shown.map(task => {
      const cost = taskCost(task, prices)
      return <a className="task-row" key={task.id} href={taskPath(task.id)} onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault(); navigate(taskPath(task.id))
      }}><div><p className="title">{task.title}</p><p className="meta">{task.project || '—'} · <span className="model-id">{task.primaryModel || '—'}</span> · <span className={task.result}>{task.result}</span></p><small>{providerLabel(parseSelector(task.primaryModel).provider)}{task.qualityScore !== null && ` · Quality ${task.qualityScore}/5`}</small></div><div className="cost"><p className="mono">{money(cost.usd)}</p>{cost.kind !== 'unknown' && <small>{cost.kind}</small>}</div></a>
    })}
    {shown.length === 0 && <p className="empty muted">{tasks.length ? 'No matching tasks.' : 'No tasks yet.'}</p>}
  </>
}
