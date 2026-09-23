import { parseSelector } from './parse-config.ts'
import type { EscalationStep, ParsedRoute, TaskRecord } from './types.ts'

export type TaskKind = 'repo' | 'trivial' | 'research' | 'architecture' | 'screenshot' | 'stuck'
export interface Recommendation {
  kind: TaskKind
  role: 'default' | 'smol' | 'web' | 'plan' | 'vision' | 'slow'
  model: string | null
  thinking: string | null
  explanation: string
  historyNote: string
}

export const KINDS: { kind: TaskKind; label: string; role: Recommendation['role']; explanation: string }[] = [
  { kind: 'repo', label: 'Repo work', role: 'default', explanation: 'Normal repository work. Stay on the cheap workhorse.' },
  { kind: 'trivial', label: 'Trivial edit', role: 'smol', explanation: 'Mechanical edit. Do not spend a limited model on this.' },
  { kind: 'research', label: 'Research', role: 'web', explanation: 'Research and source gathering.' },
  { kind: 'architecture', label: 'Architecture', role: 'plan', explanation: 'Large or structural change. Plan first. Do not implement on the planner.' },
  { kind: 'screenshot', label: 'Screenshot / UI', role: 'vision', explanation: 'Screenshot or UI reading.' },
  { kind: 'stuck', label: 'Stuck', role: 'slow', explanation: 'Only after the same task has already failed more than once on the primary model.' },
]

function resolvedModel(selector: string, parsed: ParsedRoute): string | null {
  const visited = new Set<string>()
  let model = parseSelector(selector)
  while (model.alias !== null) {
    if (visited.has(model.alias)) return null
    visited.add(model.alias)
    const assignment = parsed.modelRoles.find(row => row.role === model.alias)
    if (!assignment) return null
    model = parseSelector(assignment.selector)
  }
  return `${model.provider ?? ''}/${model.model}`.toLowerCase()
}

export function recommend(kind: TaskKind, parsed: ParsedRoute | null, tasks: TaskRecord[], steps: EscalationStep[]): Recommendation {
  const rule = KINDS.find(row => row.kind === kind)!
  const assignment = parsed?.modelRoles.find(row => row.role === rule.role)
  const counts = { solved: 0, partial: 0, failed: 0 }
  for (const task of tasks) if (task.role === rule.role) counts[task.result]++
  let historyNote = counts.solved + counts.partial + counts.failed === 0
    ? 'No tasks logged for this role yet.'
    : `Logged on this role: ${counts.solved} solved, ${counts.partial} partial, ${counts.failed} failed.`
  if (kind === 'stuck') {
    const slow = parsed && assignment ? resolvedModel(assignment.selector, parsed) : null
    const judged = steps.filter(step => step.order > 0 && (step.helped === 'yes' || step.helped === 'no')
      && (parsed ? slow !== null && resolvedModel(step.model, parsed) === slow : step.role === 'slow'))
    if (judged.length >= 3) historyNote += ` Escalation to slow helped ${judged.filter(step => step.helped === 'yes').length} of ${judged.length} judged times.`
  }
  return { kind, role: rule.role, model: assignment?.selector ?? null, thinking: assignment?.thinking ?? null, explanation: rule.explanation, historyNote }
}
