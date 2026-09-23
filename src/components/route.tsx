import { useState } from 'react'
import { KINDS, recommend, type TaskKind } from '../advisor.ts'
import { pathFor } from '../nav.ts'
import { providerLabel } from '../parse-config.ts'
import type { EscalationStep, Field, ParsedRoute, TaskRecord } from '../types.ts'

function textValue(value: unknown): string {
  if (value === null) return 'unreadable'
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  if (Array.isArray(value)) return value.join(' → ')
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return 'unreadable' }
  }
  return String(value)
}
function Setting({ label, field }: { label: string; field: Field<unknown> }) {
  return field.present ? <p className="kv"><span>{label}:</span><span>{textValue(field.value)}</span></p> : null
}
function RecordSetting({ label, field }: { label: string; field: Field<Record<string, string>> }) {
  if (!field.present) return null
  return <div className="stack tight"><p className="muted">{label}{field.value === null ? ': unreadable' : ':'}</p>
    {field.value && Object.entries(field.value).map(([role, value]) => <p className="kv" key={role}><span>{role}:</span><span>{value}</span></p>)}
  </div>
}
function ImportedRoute({ parsed: p }: { parsed: ParsedRoute }) {
  const fallbackFields = [p.fallbackChains, p.modelFallback, p.fallbackRevertPolicy, p.retryEnabled, p.maxRetries, p.usageAwareFallback, p.waitForUsageReset]
  const taskFields = [p.taskEager, p.taskMaxConcurrency, p.taskMaxRecursionDepth, p.taskMaxRuntimeMs, p.taskSoftRequestBudget, p.taskMaxEffort, p.taskAgentAdvisor, p.taskAgentModelOverrides]
  const contextFields = [p.compactionEnabled, p.compactionMethodOrder, p.compactionThresholdPercent, p.compactionReserveTokens, p.compactionKeepRecentTokens, p.contextPromotionEnabled]
  return <div className="stack">
    {p.modelRoles.length > 0 && <div className="card">{p.modelRoles.map(row => <div className="role-row" key={row.role}>
      <span className="role-name">{row.role}</span><div><span className="model-id">{row.selector}</span><div className="role-detail">{row.thinking && <span className="tag">{row.thinking}</span>}<span>{providerLabel(row.provider)}</span>{row.alias !== null && <span>alias</span>}</div></div>
    </div>)}</div>}
    <Setting label="Switcher" field={p.cycleOrder} />
    {fallbackFields.some(field => field.present) && <section className="card stack tight"><h2>Fallback</h2>
      {p.fallbackChains.present && (p.fallbackChains.value === null ? <p>unreadable</p> : p.fallbackChains.value.map(row => <p key={row.key} className="kv"><span>{row.key}:</span><span className="model-id">{row.chain.join(' → ')}</span></p>))}
      {p.modelFallback.present && <p className="kv">{p.modelFallback.value === null ? 'Model fallback: unreadable' : `Model fallback is ${p.modelFallback.value ? 'on' : 'off'}.`}</p>}
      <Setting label="Fallback revert policy" field={p.fallbackRevertPolicy} /><Setting label="Retry" field={p.retryEnabled} />
      <Setting label="Max retries" field={p.maxRetries} /><Setting label="Usage-aware fallback" field={p.usageAwareFallback} />
      <Setting label="Wait for usage reset" field={p.waitForUsageReset} />
    </section>}
    <Setting label="Default thinking" field={p.defaultThinkingLevel} />
    <Setting label="Advisor runtime" field={p.advisorEnabled} /><Setting label="Advisor sync backlog" field={p.advisorSyncBacklog} />
    <Setting label="Advisor immune turns" field={p.advisorImmuneTurns} /><Setting label="Advisor max notes" field={p.advisorMaxNotes} />
    <Setting label="Prewalk" field={p.prewalkEnabled} /><Setting label="Task prewalk" field={p.taskPrewalk} />
    <RecordSetting label="Agent prewalk" field={p.agentPrewalk} />
    {taskFields.some(field => field.present) && <section className="card stack tight"><h2>Task</h2>
      <Setting label="Eager" field={p.taskEager} /><Setting label="Max concurrency" field={p.taskMaxConcurrency} />
      <Setting label="Max recursion" field={p.taskMaxRecursionDepth} /><Setting label="Max runtime ms" field={p.taskMaxRuntimeMs} />
      <Setting label="Soft request budget" field={p.taskSoftRequestBudget} /><Setting label="Max effort" field={p.taskMaxEffort} />
      <RecordSetting label="Agent model overrides" field={p.taskAgentModelOverrides} /><Setting label="task.agentAdvisor" field={p.taskAgentAdvisor} />
    </section>}
    {contextFields.some(field => field.present) && <section className="card stack tight"><h2>Context</h2>
      <Setting label="Compaction" field={p.compactionEnabled} /><Setting label="Method order" field={p.compactionMethodOrder} />
      <Setting label="Threshold percent" field={p.compactionThresholdPercent} /><Setting label="Reserve tokens" field={p.compactionReserveTokens} />
      <Setting label="Keep recent tokens" field={p.compactionKeepRecentTokens} /><Setting label="Context promotion" field={p.contextPromotionEnabled} />
    </section>}
  </div>
}

export function Route({ parsed, tasks, steps, navigate }: {
  parsed: ParsedRoute | null; tasks: TaskRecord[]; steps: EscalationStep[]; navigate: (path: string) => void;
}) {
  const [kind, setKind] = useState<TaskKind>('repo')
  const [copyState, setCopyState] = useState('')
  const recommendation = recommend(kind, parsed, tasks, steps)
  return <>
    <div className="page-header"><h1>Route</h1></div>
    {parsed ? <ImportedRoute parsed={parsed} /> : <div className="empty"><p>No config imported.</p><div><button onClick={() => navigate(pathFor('settings'))}>Import config</button></div></div>}
    <section className="section stack" aria-label="Route advisor"><h2>Route advisor</h2>
      <div className="chips">{KINDS.map(item => <button key={item.kind} aria-pressed={item.kind === kind} onClick={() => { setKind(item.kind); setCopyState('') }}>{item.label}</button>)}</div>
      <div className="card stack">
        <p><span className="role-name">{recommendation.role}</span> <span className="muted">→</span> <span className="model-id">{recommendation.model ?? 'not in imported config'}</span></p>
        {recommendation.thinking && <p className="muted">Thinking: {recommendation.thinking}</p>}
        <p>{recommendation.explanation}</p><p className="muted">{recommendation.historyNote}</p>
        <div className="actions"><button onClick={async () => {
          try { await navigator.clipboard.writeText(`${recommendation.role} → ${recommendation.model ?? 'not in imported config'}`); setCopyState('Copied.') }
          catch { setCopyState('Could not copy. Select the role and model above.') }
        }}>Copy</button>{copyState && <small role="status">{copyState}</small>}</div>
      </div>
      <p className="muted">This does not change OMP. Set the role yourself.</p>
    </section>
  </>
}
