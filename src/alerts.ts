import { dateTime, money } from './format.ts'
import { inWindow } from './metrics.ts'
import { parseSelector } from './parse-config.ts'
import type { EscalationStep, ProviderRecord, TaskRecord } from './types.ts'

export interface Alert { id: string; text: string; taskId?: string }
export function alerts(input: { tasks: TaskRecord[]; steps: EscalationStep[]; providers: ProviderRecord[]; now: Date }): Alert[] {
  const { tasks, steps, providers, now } = input
  const result: { priority: number; alert: Alert }[] = []
  const failures = new Map<string, number>(), trivial = new Set<string>()
  for (const task of tasks) {
    if (task.result === 'failed' && inWindow(task.startedAt, '7d', now)) failures.set(task.primaryModel, (failures.get(task.primaryModel) ?? 0) + 1)
    const provider = parseSelector(task.primaryModel).provider
    if (task.role === 'smol' && (provider === 'openai' || provider === 'openai-codex' || provider === 'xai-oauth') && inWindow(task.startedAt, '30d', now)) trivial.add(task.primaryModel)
    if (task.durationMin !== null && task.durationMin <= 20 && (task.toolCallCount === null || task.toolCallCount <= 3) && task.apiCostUsd !== null && task.apiCostUsd >= 0.25) {
      result.push({ priority: 3, alert: { id: `expensive:${task.id}`, taskId: task.id, text: `${task.title} looks like a short task with a high entered cost (${money(task.apiCostUsd)}).` } })
    }
  }
  for (const [model, count] of failures) if (count >= 3) result.push({ priority: 1, alert: { id: `fail:${model}`, text: `${model} failed ${count} tasks in the last 7 days.` } })
  for (const model of trivial) result.push({ priority: 2, alert: { id: `trivial:${model}`, text: `${model} is on the smol role. That is a limited model doing trivial work.` } })

  const taskIds = new Set(tasks.map(task => task.id))
  const byTask = new Map<string, EscalationStep[]>()
  for (const step of steps) {
    if (!taskIds.has(step.taskId)) continue
    const rows = byTask.get(step.taskId) ?? []
    rows.push(step); byTask.set(step.taskId, rows)
  }
  const escalations = new Map<string, { yes: number; judged: number }>()
  for (const rows of byTask.values()) {
    rows.sort((a, b) => a.order - b.order)
    for (let index = 1; index < rows.length; index++) {
      const step = rows[index], previous = rows[index - 1]
      if (step.helped !== 'yes' && step.helped !== 'no') continue
      const count = escalations.get(previous.model) ?? { yes: 0, judged: 0 }
      count.judged++; if (step.helped === 'yes') count.yes++
      escalations.set(previous.model, count)
    }
  }
  for (const [model, count] of escalations) if (count.judged >= 3 && count.yes / count.judged < 0.34) {
    result.push({ priority: 4, alert: { id: `esc:${model}`, text: `Escalations away from ${model} helped ${count.yes} of ${count.judged} judged times.` } })
  }
  for (const provider of providers) {
    if (provider.remainingAmount === null || provider.allowanceAmount === null || provider.allowanceAmount <= 0 || provider.remainingUnit === null || provider.remainingUnit !== provider.allowanceUnit || provider.resetAt === null) continue
    const untilReset = Date.parse(provider.resetAt) - now.getTime()
    const ratio = provider.remainingAmount / provider.allowanceAmount
    if (untilReset > 0 && untilReset <= 48 * 3_600_000 && ratio >= 0.4) result.push({ priority: 5, alert: {
      id: `reset:${provider.id}`, text: `${provider.label} resets ${dateTime(provider.resetAt)} with ${provider.remainingAmount} ${provider.remainingUnit} still entered (${(ratio * 100).toFixed(1)}% of the allowance).`,
    } })
  }
  return result.sort((a, b) => a.priority - b.priority || a.alert.id.localeCompare(b.alert.id)).slice(0, 5).map(row => row.alert)
}
