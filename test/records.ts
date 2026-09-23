import type { ModelPrice, ProviderRecord, TaskRecord } from '../src/types.ts'

export function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task', title: 'Task', project: '', startedAt: '2026-09-23T12:00:00.000Z', primaryModel: 'deepseek/model', role: 'default',
    reasoningLevel: 'unknown', durationMin: null, inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null,
    apiCostUsd: null, toolCallCount: null, subagentCount: null, result: 'solved', qualityScore: null, notes: '',
    createdAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', ...overrides,
  }
}
export function price(overrides: Partial<ModelPrice> = {}): ModelPrice {
  return { id: 'price', providerId: 'deepseek', modelId: 'deepseek/model', inputPerMillion: 1, outputPerMillion: 2, cacheReadPerMillion: null, cacheWritePerMillion: null, currency: 'USD', note: '', ...overrides }
}
export function provider(overrides: Partial<ProviderRecord> = {}): ProviderRecord {
  return { id: 'deepseek', label: 'DeepSeek', billingType: 'api', allowanceAmount: null, allowanceUnit: null, allowancePeriod: null, remainingAmount: null, remainingUnit: null, remainingUpdatedAt: null, resetAt: null, notes: '', ...overrides }
}
