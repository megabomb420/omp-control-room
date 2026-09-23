import { inputDateToIso, localDateTime } from './format.ts'
import { numberOrNull } from './form-values.ts'
import type { Role, TaskRecord, Thinking, Result } from './types.ts'

export const NUMERIC_FIELDS = [
  { key: 'durationMin', label: 'Duration (min)', count: false },
  { key: 'inputTokens', label: 'Input tokens', count: true },
  { key: 'outputTokens', label: 'Output tokens', count: true },
  { key: 'cacheReadTokens', label: 'Cache read', count: true },
  { key: 'cacheWriteTokens', label: 'Cache write', count: true },
  { key: 'apiCostUsd', label: 'Entered cost (USD)', count: false },
  { key: 'toolCallCount', label: 'Tool calls', count: true },
  { key: 'subagentCount', label: 'Subagents', count: true },
] as const

type NumericKey = (typeof NUMERIC_FIELDS)[number]['key']
export interface TaskDraft extends Record<NumericKey, string> {
  title: string; project: string; started: string; role: Role; model: string; reasoning: Thinking;
  result: Result | ''; quality: string; notes: string;
}

export function taskDraft(task?: TaskRecord): TaskDraft {
  return {
    title: task?.title ?? '', project: task?.project ?? '', started: localDateTime(task ? new Date(task.startedAt) : new Date()),
    role: task?.role ?? 'default', model: task?.primaryModel ?? '', reasoning: task?.reasoningLevel ?? 'unknown',
    result: task?.result ?? '', quality: task?.qualityScore?.toString() ?? '', notes: task?.notes ?? '',
    durationMin: task?.durationMin?.toString() ?? '', inputTokens: task?.inputTokens?.toString() ?? '',
    outputTokens: task?.outputTokens?.toString() ?? '', cacheReadTokens: task?.cacheReadTokens?.toString() ?? '',
    cacheWriteTokens: task?.cacheWriteTokens?.toString() ?? '', apiCostUsd: task?.apiCostUsd?.toString() ?? '',
    toolCallCount: task?.toolCallCount?.toString() ?? '', subagentCount: task?.subagentCount?.toString() ?? '',
  }
}

export function taskFromDraft(draft: TaskDraft, original?: TaskRecord): TaskRecord {
  if (!draft.title.trim()) throw new Error('Title is required.')
  const startedAt = inputDateToIso(draft.started)
  if (!startedAt) throw new Error('Started time is not a valid date.')
  const numeric = {} as Record<NumericKey, number | null>
  for (const field of NUMERIC_FIELDS) numeric[field.key] = numberOrNull(draft[field.key], field.count)
  if (!draft.result) throw new Error('Pick a result.')
  let qualityScore: number | null
  try {
    qualityScore = numberOrNull(draft.quality, true)
    if (qualityScore !== null && (qualityScore < 1 || qualityScore > 5)) throw new Error()
  } catch { throw new Error('Quality is 1 to 5, or blank.') }
  const now = new Date().toISOString()
  return {
    id: original?.id ?? crypto.randomUUID(), title: draft.title.trim(), project: draft.project.trim(), startedAt,
    primaryModel: draft.model.trim(), role: draft.role, reasoningLevel: draft.reasoning, ...numeric,
    result: draft.result, qualityScore, notes: draft.notes, createdAt: original?.createdAt ?? now, updatedAt: now,
  }
}
