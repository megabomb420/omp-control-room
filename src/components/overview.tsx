import { useEffect, useState } from 'react'
import { dateTime, money, rate } from '../format.ts'
import { dashboardMetrics, type ShareRow, type WindowId } from '../metrics.ts'
import { pathFor, taskPath } from '../nav.ts'
import type { LocalData } from '../use-data.ts'
import { alerts } from '../alerts.ts'

const WINDOWS: { id: WindowId; label: string }[] = [{ id: 'today', label: 'Today' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }]
const UNIT_LABEL = { usd: 'USD', credits: 'credits', percent: 'percent', requests: 'requests' }

function Shares({ rows, total }: { rows: ShareRow[]; total: number }) {
  const max = Math.max(1, ...rows.map(row => row.count))
  return rows.length ? rows.map(row => <div className="metric-row" key={row.label}>
    <div className="row"><span className="model-id">{row.label || 'Unknown'}</span><span className="mono">{row.count} · {rate(row.count / total)}</span></div>
    <div className="bar-track" aria-hidden="true"><div className="bar-fill" style={{ width: `${row.count / max * 100}%` }} /></div>
  </div>) : <p className="muted">No tasks in this window.</p>
}

export function Overview({ data, navigate }: { data: LocalData; navigate: (path: string) => void }) {
  const [windowId, setWindowId] = useState<WindowId>(() => {
    try { const saved = localStorage.getItem('ocr.period'); return WINDOWS.some(window => window.id === saved) ? saved as WindowId : '7d' }
    catch { return '7d' }
  })
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  if (data.tasks.length === 0 && data.snapshots.length === 0) return <>
    <div className="page-header"><h1>Overview</h1></div><div className="empty"><p>Import a config and log a task.</p><div className="actions"><button onClick={() => navigate(pathFor('settings'))}>Import config</button><button className="primary" onClick={() => navigate(taskPath('new'))}>New task</button></div></div>
  </>
  const metrics = dashboardMetrics(data.tasks, data.prices, data.steps, windowId, now)
  const remaining = data.providers.filter(provider => provider.remainingAmount !== null)
  const insights = alerts({ tasks: data.tasks, steps: data.steps, providers: data.providers, now })
  const costSubtitle = metrics.enteredCount && metrics.estimatedCount
    ? `${money(metrics.enteredSum)} entered · ${money(metrics.estimatedSum)} estimated`
    : metrics.enteredCount ? 'entered' : metrics.estimatedCount ? 'estimated' : ''
  return <>
    <div className="page-header"><h1>Overview</h1></div>
    <div className="chips" style={{ marginBottom: 18 }}>{WINDOWS.map(window => <button key={window.id} aria-pressed={windowId === window.id} onClick={() => {
      setWindowId(window.id); setNow(new Date())
      try { localStorage.setItem('ocr.period', window.id) } catch { /* The view still works if preference storage is blocked. */ }
    }}>{window.label}</button>)}</div>
    <div className="stat-grid">
      <div className="card"><p className="stat-label">Entered + estimated</p><p className="stat-value">{money(metrics.knownSum)}</p>{costSubtitle && <small>{costSubtitle}</small>}{(metrics.excluded > 0 || metrics.knownSum === null) && <small>{metrics.excluded} tasks excluded (cost unknown)</small>}</div>
      <div className="card"><p className="stat-label">Tasks</p><p className="stat-value">{metrics.count}</p><small>{WINDOWS.find(window => window.id === windowId)?.label}</small></div>
      <div className="card"><p className="stat-label">Success</p><p className="stat-value">{rate(metrics.success)}</p><small>{metrics.solved} solved · {metrics.count} total</small></div>
      <div className="card"><p className="stat-label">Escalation help</p><p className="stat-value">{rate(metrics.escalationHelp)}</p><small>{metrics.unclear} unclear</small></div>
    </div>
    <section className="section"><h2>Model share</h2><div className="card"><Shares rows={metrics.modelShare} total={metrics.count} /></div></section>
    <section className="section"><h2>By provider</h2><div className="card"><Shares rows={metrics.providerShare} total={metrics.count} /></div></section>
    <div className="form-grid section">
      <section className="card"><p className="stat-label">Avg known cost</p><p className="stat-value">{money(metrics.averageKnownCost)}</p><small>{metrics.knownCount} known-cost tasks</small></section>
      <section className="card"><p className="stat-label">Cost per solved task</p><p className="stat-value">{money(metrics.costPerSolved)}</p>{metrics.solvedExcluded > 0 && <small>{metrics.solvedExcluded} solved excluded</small>}</section>
    </div>
    {remaining.length > 0 && <section className="section"><h2>Remaining</h2><div className="card">
      {remaining.map(provider => {
        const ratio = provider.allowanceAmount !== null && provider.allowanceAmount > 0 && provider.remainingUnit !== null && provider.remainingUnit === provider.allowanceUnit ? provider.remainingAmount! / provider.allowanceAmount : null
        return <div className="metric-row" key={provider.id}><div className="row"><span>{provider.label}</span><span className="mono">{provider.remainingAmount} {provider.remainingUnit ? UNIT_LABEL[provider.remainingUnit] : ''}</span></div>
          {provider.resetAt && <small>Resets {dateTime(provider.resetAt)}</small>}
          {ratio !== null && <><div className="bar-track" aria-hidden="true"><div className="bar-fill" style={{ width: `${Math.min(1, ratio) * 100}%` }} /></div><small>{rate(ratio)} of allowance</small></>}
        </div>
      })}
    </div></section>}
    <section className="section"><h2>Insights</h2><div className="card">
      {insights.length ? <ul className="alert-list">{insights.map(alert => <li key={alert.id}>
        {alert.taskId ? <a href={taskPath(alert.taskId)} onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault(); navigate(taskPath(alert.taskId!))
        }}>{alert.text}</a> : alert.text}
      </li>)}</ul> : <p className="muted">No alerts.</p>}
    </div></section>
  </>
}
