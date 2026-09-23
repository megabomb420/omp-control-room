import { parseSelector, providerLabel } from './parse-config.ts'
import type { EscalationStep, ModelPrice, TaskRecord } from './types.ts'

export interface CostFigure { usd: number | null; kind: 'entered' | 'estimated' | 'unknown' }
export function taskCost(task: TaskRecord, prices: ModelPrice[]): CostFigure {
  if (task.apiCostUsd !== null) return { usd: task.apiCostUsd, kind: 'entered' }
  const selector = task.primaryModel.trim().toLowerCase()
  const model = parseSelector(selector).model
  const full = prices.filter(price => price.modelId.trim().toLowerCase() === selector)
  const matches = full.length ? full : prices.filter(price => parseSelector(price.modelId.trim().toLowerCase()).model === model)
  if (matches.length !== 1) return { usd: null, kind: 'unknown' }
  const price = matches[0]
  const sides = [
    [task.inputTokens, price.inputPerMillion], [task.outputTokens, price.outputPerMillion],
    [task.cacheReadTokens, price.cacheReadPerMillion], [task.cacheWriteTokens, price.cacheWritePerMillion],
  ]
  let usd = 0, computed = false
  for (const [tokens, rate] of sides) {
    if (tokens !== null && rate !== null) { usd += tokens / 1e6 * rate; computed = true }
  }
  return computed ? { usd, kind: 'estimated' } : { usd: null, kind: 'unknown' }
}

export type WindowId = 'today' | '7d' | '30d'
export function inWindow(iso: string, windowId: WindowId, now: Date): boolean {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return false
  if (windowId === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 1)
    return time >= start.getTime() && time < end.getTime()
  }
  return time >= now.getTime() - (windowId === '7d' ? 7 : 30) * 86_400_000 && time <= now.getTime()
}

export interface ShareRow { label: string; count: number }
export interface DashboardMetrics {
  count: number; solved: number; success: number | null
  knownSum: number | null; knownCount: number; excluded: number
  enteredSum: number; enteredCount: number; estimatedSum: number; estimatedCount: number
  averageKnownCost: number | null; costPerSolved: number | null; solvedExcluded: number
  escalationHelp: number | null; unclear: number
  modelShare: ShareRow[]; providerShare: ShareRow[]
}

export function dashboardMetrics(tasks: TaskRecord[], prices: ModelPrice[], steps: EscalationStep[], windowId: WindowId, now: Date): DashboardMetrics {
  const included = tasks.filter(task => inWindow(task.startedAt, windowId, now))
  const taskIds = new Set(included.map(task => task.id))
  const models = new Map<string, number>(), providers = new Map<string, number>()
  let knownSum = 0, knownCount = 0, solved = 0, solvedCost = 0, solvedKnown = 0
  let enteredSum = 0, enteredCount = 0, estimatedSum = 0, estimatedCount = 0
  for (const task of included) {
    models.set(task.primaryModel, (models.get(task.primaryModel) ?? 0) + 1)
    const provider = providerLabel(parseSelector(task.primaryModel).provider)
    providers.set(provider, (providers.get(provider) ?? 0) + 1)
    if (task.result === 'solved') solved++
    const cost = taskCost(task, prices)
    if (cost.usd === null) continue
    knownCount++; knownSum += cost.usd
    if (task.result === 'solved') { solvedCost += cost.usd; solvedKnown++ }
    if (cost.kind === 'entered') { enteredSum += cost.usd; enteredCount++ }
    else { estimatedSum += cost.usd; estimatedCount++ }
  }
  let yes = 0, judged = 0, unclear = 0
  for (const step of steps) {
    if (step.order <= 0 || !taskIds.has(step.taskId)) continue
    if (step.helped === 'yes' || step.helped === 'no') { judged++; if (step.helped === 'yes') yes++ }
    else unclear++
  }
  function shares(map: Map<string, number>): ShareRow[] {
    return Array.from(map, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }
  const allModels = shares(models)
  const modelShare = allModels.slice(0, 6)
  if (allModels.length > 6) modelShare.push({ label: 'Other', count: allModels.slice(6).reduce((sum, row) => sum + row.count, 0) })
  return {
    count: included.length, solved, success: included.length ? solved / included.length : null,
    knownSum: knownCount ? knownSum : null, knownCount, excluded: included.length - knownCount,
    enteredSum, enteredCount, estimatedSum, estimatedCount,
    averageKnownCost: knownCount ? knownSum / knownCount : null,
    costPerSolved: solvedKnown ? solvedCost / solvedKnown : null, solvedExcluded: solved - solvedKnown,
    escalationHelp: judged ? yes / judged : null, unclear, modelShare, providerShare: shares(providers),
  }
}
