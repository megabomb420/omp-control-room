import { db, seedProviders } from './db.ts'
import { isRecord } from './type-guards.ts'
import { PROVIDER_IDS, RESULTS, ROLES, THINKING, UNITS, type EscalationStep, type ModelPrice, type ProviderRecord, type RouteSnapshot, type TaskRecord } from './types.ts'

export interface BackupFile {
  format: 'omp-control-room'
  version: 1
  exportedAt: string
  snapshots: RouteSnapshot[]
  providers: ProviderRecord[]
  prices: ModelPrice[]
  tasks: TaskRecord[]
  escalations: EscalationStep[]
}

type Check = (value: unknown) => boolean
const string: Check = value => typeof value === 'string'
const id: Check = value => typeof value === 'string' && value.length > 0
const boolean: Check = value => typeof value === 'boolean'
const finite: Check = value => typeof value === 'number' && Number.isFinite(value)
const number: Check = value => finite(value) && (value as number) >= 0
const integer: Check = value => number(value) && Number.isInteger(value)
const timestamp: Check = value => typeof value === 'string' && /T.*Z$/.test(value) && Number.isFinite(Date.parse(value))
const oneOf = (values: readonly unknown[]): Check => value => values.includes(value)
const nullable = (check: Check): Check => value => value === null || check(value)
const array = (check: Check): Check => value => Array.isArray(value) && value.every(check)
const shape = (schema: Record<string, Check>): Check => value => isRecord(value)
  && Object.keys(value).length === Object.keys(schema).length
  && Object.entries(schema).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]))
const record: Check = value => isRecord(value) && Object.values(value).every(string)
const field = (check: Check): Check => shape({ present: boolean, value: nullable(check) })

const parsedRoute = shape({
  modelRoles: array(shape({ role: string, selector: string, provider: nullable(string), model: string, thinking: nullable(string), alias: nullable(string) })),
  cycleOrder: field(array(string)), fallbackChains: field(array(shape({ key: string, chain: array(string) }))),
  modelFallback: field(boolean), fallbackRevertPolicy: field(string), retryEnabled: field(boolean), maxRetries: field(finite),
  usageAwareFallback: field(boolean), waitForUsageReset: field(boolean), defaultThinkingLevel: field(string),
  advisorEnabled: field(boolean), advisorSyncBacklog: field(value => string(value) || finite(value)),
  advisorImmuneTurns: field(finite), advisorMaxNotes: field(finite), prewalkEnabled: field(boolean), taskPrewalk: field(boolean),
  agentPrewalk: field(record), taskEager: field(string), taskMaxConcurrency: field(finite), taskMaxRecursionDepth: field(finite),
  taskMaxRuntimeMs: field(finite), taskSoftRequestBudget: field(finite), taskMaxEffort: field(string),
  taskAgentAdvisor: field(() => true), taskAgentModelOverrides: field(record), compactionEnabled: field(boolean),
  compactionMethodOrder: field(array(string)), compactionThresholdPercent: field(finite), compactionReserveTokens: field(finite),
  compactionKeepRecentTokens: field(finite), contextPromotionEnabled: field(boolean),
})
const snapshot = shape({ id, importedAt: timestamp, source: oneOf(['paste', 'file']), parsed: parsedRoute, active: boolean })
const provider = shape({
  id: oneOf(PROVIDER_IDS), label: string, billingType: oneOf(['api', 'subscription']), allowanceAmount: nullable(number),
  allowanceUnit: nullable(oneOf(UNITS)), allowancePeriod: nullable(oneOf(['weekly', 'monthly'])), remainingAmount: nullable(number),
  remainingUnit: nullable(oneOf(UNITS)), remainingUpdatedAt: nullable(timestamp), resetAt: nullable(timestamp), notes: string,
})
const price = shape({ id, providerId: oneOf(PROVIDER_IDS), modelId: id, inputPerMillion: nullable(number), outputPerMillion: nullable(number), cacheReadPerMillion: nullable(number), cacheWritePerMillion: nullable(number), currency: oneOf(['USD']), note: string })
const task = shape({
  id, title: id, project: string, startedAt: timestamp, primaryModel: string, role: oneOf(ROLES), reasoningLevel: oneOf(THINKING),
  durationMin: nullable(number), inputTokens: nullable(integer), outputTokens: nullable(integer), cacheReadTokens: nullable(integer),
  cacheWriteTokens: nullable(integer), apiCostUsd: nullable(number), toolCallCount: nullable(integer), subagentCount: nullable(integer),
  result: oneOf(RESULTS), qualityScore: nullable(value => integer(value) && (value as number) >= 1 && (value as number) <= 5),
  notes: string, createdAt: timestamp, updatedAt: timestamp,
})
const step = shape({ id, taskId: id, order: integer, model: string, role: oneOf(ROLES), reasoningLevel: oneOf(THINKING), helped: nullable(oneOf(['yes', 'no', 'unclear'])), note: string })
const backupShape = shape({ format: oneOf(['omp-control-room']), version: oneOf([1]), exportedAt: timestamp, snapshots: array(snapshot), providers: array(provider), prices: array(price), tasks: array(task), escalations: array(step) })

export function parseBackup(text: string): { ok: true; backup: BackupFile } | { ok: false; error: string } {
  let value: unknown
  try { value = JSON.parse(text) } catch { return { ok: false, error: 'Backup was not applied.' } }
  if (!isRecord(value) || value.format !== 'omp-control-room') return { ok: false, error: 'Backup format is not omp-control-room.' }
  if (value.version !== 1) return { ok: false, error: 'Backup version is not 1.' }
  if (!backupShape(value)) return { ok: false, error: 'Backup was not applied.' }
  const backup = value as unknown as BackupFile
  const tables = [backup.snapshots, backup.providers, backup.prices, backup.tasks, backup.escalations]
  if (tables.some(rows => new Set(rows.map(row => row.id)).size !== rows.length) || backup.snapshots.filter(row => row.active).length > 1)
    return { ok: false, error: 'Backup was not applied.' }
  const taskIds = new Set(backup.tasks.map(row => row.id))
  const byTask = new Map<string, EscalationStep[]>()
  for (const row of backup.escalations) {
    if (!taskIds.has(row.taskId)) return { ok: false, error: 'Backup was not applied.' }
    const rows = byTask.get(row.taskId) ?? []
    rows.push(row)
    byTask.set(row.taskId, rows)
  }
  for (const rows of byTask.values()) {
    rows.sort((a, b) => a.order - b.order)
    if (rows.some((row, index) => row.order !== index || (index === 0 && row.helped !== null)))
      return { ok: false, error: 'Backup was not applied.' }
  }
  return { ok: true, backup }
}

export async function exportBackup(): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => ({
    format: 'omp-control-room', version: 1, exportedAt: new Date().toISOString(),
    snapshots: await db.snapshots.toArray(), providers: await db.providers.toArray(), prices: await db.prices.toArray(),
    tasks: await db.tasks.toArray(), escalations: await db.escalations.toArray(),
  }))
}

export async function replaceBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
    await db.snapshots.bulkAdd(backup.snapshots)
    await db.providers.bulkAdd(backup.providers)
    await db.prices.bulkAdd(backup.prices)
    await db.tasks.bulkAdd(backup.tasks)
    await db.escalations.bulkAdd(backup.escalations)
    await seedProviders()
  })
}
