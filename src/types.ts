export type BillingType = 'api' | 'subscription'
export const PROVIDER_IDS = ['deepseek', 'openai', 'xai'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]
export const UNITS = ['usd', 'credits', 'percent', 'requests'] as const
export type Unit = (typeof UNITS)[number]
export type Period = 'weekly' | 'monthly'
export const RESULTS = ['solved', 'partial', 'failed'] as const
export type Result = (typeof RESULTS)[number]
export type Helped = 'yes' | 'no' | 'unclear'
export const ROLES = ['default', 'smol', 'task', 'plan', 'web', 'vision', 'advisor', 'slow', 'commit', 'tiny', 'image', 'speech', 'other'] as const
export type Role = (typeof ROLES)[number]
export const THINKING = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'auto', 'off', 'unknown'] as const
export type Thinking = (typeof THINKING)[number]

export interface Field<T> { present: boolean; value: T | null }
export interface RoleAssignment {
  role: string
  selector: string
  provider: string | null
  model: string
  thinking: string | null
  alias: string | null
}
export interface ParsedRoute {
  modelRoles: RoleAssignment[]
  cycleOrder: Field<string[]>
  fallbackChains: Field<{ key: string; chain: string[] }[]>
  modelFallback: Field<boolean>
  fallbackRevertPolicy: Field<string>
  retryEnabled: Field<boolean>
  maxRetries: Field<number>
  usageAwareFallback: Field<boolean>
  waitForUsageReset: Field<boolean>
  defaultThinkingLevel: Field<string>
  advisorEnabled: Field<boolean>
  advisorSyncBacklog: Field<string | number>
  advisorImmuneTurns: Field<number>
  advisorMaxNotes: Field<number>
  prewalkEnabled: Field<boolean>
  taskPrewalk: Field<boolean>
  agentPrewalk: Field<Record<string, string>>
  taskEager: Field<string>
  taskMaxConcurrency: Field<number>
  taskMaxRecursionDepth: Field<number>
  taskMaxRuntimeMs: Field<number>
  taskSoftRequestBudget: Field<number>
  taskMaxEffort: Field<string>
  taskAgentAdvisor: Field<unknown>
  taskAgentModelOverrides: Field<Record<string, string>>
  compactionEnabled: Field<boolean>
  compactionMethodOrder: Field<string[]>
  compactionThresholdPercent: Field<number>
  compactionReserveTokens: Field<number>
  compactionKeepRecentTokens: Field<number>
  contextPromotionEnabled: Field<boolean>
}
export interface RouteSnapshot {
  id: string
  importedAt: string
  source: 'paste' | 'file'
  parsed: ParsedRoute
  active: boolean
}
export interface ProviderRecord {
  id: ProviderId
  label: string
  billingType: BillingType
  allowanceAmount: number | null
  allowanceUnit: Unit | null
  allowancePeriod: Period | null
  remainingAmount: number | null
  remainingUnit: Unit | null
  remainingUpdatedAt: string | null
  resetAt: string | null
  notes: string
}
export interface ModelPrice {
  id: string
  providerId: ProviderId
  modelId: string
  inputPerMillion: number | null
  outputPerMillion: number | null
  cacheReadPerMillion: number | null
  cacheWritePerMillion: number | null
  currency: 'USD'
  note: string
}
export interface TaskRecord {
  id: string
  title: string
  project: string
  startedAt: string
  primaryModel: string
  role: Role
  reasoningLevel: Thinking
  durationMin: number | null
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  apiCostUsd: number | null
  toolCallCount: number | null
  subagentCount: number | null
  result: Result
  qualityScore: number | null
  notes: string
  createdAt: string
  updatedAt: string
}
export interface EscalationStep {
  id: string
  taskId: string
  order: number
  model: string
  role: Role
  reasoningLevel: Thinking
  helped: Helped | null
  note: string
}
