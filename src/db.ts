import Dexie, { type Table } from 'dexie'
import type { EscalationStep, ModelPrice, ParsedRoute, ProviderRecord, RouteSnapshot, TaskRecord } from './types.ts'

export const db = new Dexie('omp-control-room') as Dexie & {
  providers: Table<ProviderRecord, string>
  prices: Table<ModelPrice, string>
  tasks: Table<TaskRecord, string>
  escalations: Table<EscalationStep, string>
  snapshots: Table<RouteSnapshot, string>
}
db.version(1).stores({
  providers: 'id', prices: 'id, providerId', tasks: 'id, startedAt, project, result',
  escalations: 'id, taskId', snapshots: 'id, active',
})

export async function seedProviders(): Promise<void> {
  const defaults: Pick<ProviderRecord, 'id' | 'label' | 'billingType'>[] = [
    { id: 'deepseek', label: 'DeepSeek', billingType: 'api' },
    { id: 'openai', label: 'OpenAI Codex', billingType: 'subscription' },
    { id: 'xai', label: 'xAI / SuperGrok', billingType: 'subscription' },
  ]
  await db.transaction('rw', db.providers, async () => {
    for (const provider of defaults) {
      if (!await db.providers.get(provider.id)) await db.providers.add({
        ...provider, allowanceAmount: null, allowanceUnit: null, allowancePeriod: null,
        remainingAmount: null, remainingUnit: null, remainingUpdatedAt: null, resetAt: null, notes: '',
      })
    }
  })
}

export async function openDatabase(): Promise<void> {
  await db.open()
  await seedProviders()
}

export async function keepSnapshot(parsed: ParsedRoute, source: RouteSnapshot['source']): Promise<void> {
  await db.transaction('rw', db.snapshots, async () => {
    await db.snapshots.toCollection().modify({ active: false })
    await db.snapshots.add({ id: crypto.randomUUID(), importedAt: new Date().toISOString(), source, parsed, active: true })
  })
}

export async function activateSnapshot(id: string): Promise<void> {
  await db.transaction('rw', db.snapshots, async () => {
    if (!await db.snapshots.get(id)) throw new Error('Config no longer exists.')
    await db.snapshots.toCollection().modify({ active: false })
    await db.snapshots.update(id, { active: true })
  })
}

export async function saveTask(task: TaskRecord, steps: EscalationStep[]): Promise<void> {
  await db.transaction('rw', db.tasks, db.escalations, async () => {
    await db.tasks.put(task)
    await db.escalations.where('taskId').equals(task.id).delete()
    await db.escalations.bulkAdd(steps.map((step, order) => ({ ...step, taskId: task.id, order, helped: order === 0 ? null : step.helped ?? 'unclear' })))
  })
}

export async function deleteTask(id: string): Promise<void> {
  await db.transaction('rw', db.tasks, db.escalations, async () => {
    await db.escalations.where('taskId').equals(id).delete()
    await db.tasks.delete(id)
  })
}

export function writeError(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('name' in error && error.name === 'QuotaExceededError') return 'Not enough local storage to save.'
    if ('inner' in error && error.inner) return writeError(error.inner)
    if ('cause' in error && error.cause) return writeError(error.cause)
  }
  return 'Could not save local data.'
}
