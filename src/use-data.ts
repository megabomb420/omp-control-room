import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db, openDatabase } from './db.ts'
import type { EscalationStep, ModelPrice, ProviderRecord, RouteSnapshot, TaskRecord } from './types.ts'

export interface LocalData {
  providers: ProviderRecord[]
  prices: ModelPrice[]
  tasks: TaskRecord[]
  steps: EscalationStep[]
  snapshots: RouteSnapshot[]
}

export function useData() {
  const [data, setData] = useState<LocalData | null>(null)
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    let disposed = false
    let unsubscribe = () => {}
    void openDatabase().then(() => {
      if (disposed) return
      const subscription = liveQuery(() => db.transaction('r', db.tables, async () => {
        const [providers, prices, tasks, steps, snapshots] = await Promise.all([
          db.providers.toArray(), db.prices.toArray(), db.tasks.orderBy('startedAt').reverse().toArray(),
          db.escalations.toArray(), db.snapshots.toArray(),
        ])
        return { providers, prices, tasks, steps, snapshots }
      })).subscribe({
        next: records => { if (!disposed) setData(records) },
        error: () => { if (!disposed) setBlocked(true) },
      })
      unsubscribe = () => subscription.unsubscribe()
    }).catch(() => { if (!disposed) setBlocked(true) })
    return () => { disposed = true; unsubscribe() }
  }, [])
  return { data, blocked }
}
