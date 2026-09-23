import test from 'node:test'
import assert from 'node:assert/strict'
import { alerts } from '../src/alerts.ts'
import { provider, task } from './records.ts'
import type { EscalationStep, ProviderRecord } from '../src/types.ts'

const now = new Date('2026-09-23T15:00:00.000Z')
test('repeated failures fire at three within rolling seven days', () => {
  const tasks = [1, 2, 3].map(id => task({ id: String(id), result: 'failed' }))
  assert.deepEqual(alerts({ tasks: tasks.slice(0, 2), steps: [], providers: [], now }), [])
  assert.equal(alerts({ tasks, steps: [], providers: [], now })[0].id, 'fail:deepseek/model')
  tasks[0].startedAt = '2026-09-15T12:00:00.000Z'
  assert.deepEqual(alerts({ tasks, steps: [], providers: [], now }), [])
})
test('reset alert requires comparable known units and a future reset within 48 hours', () => {
  const base = provider({ allowanceAmount: 100, allowanceUnit: 'credits', remainingAmount: 40, remainingUnit: 'credits', resetAt: '2026-09-23T16:00:00.000Z' })
  const run = (change: Partial<ProviderRecord>) => alerts({ tasks: [], steps: [], providers: [{ ...base, ...change }], now })
  assert.equal(run({})[0].id, 'reset:deepseek')
  assert.deepEqual(run({ remainingUnit: 'usd' }), [])
  assert.deepEqual(run({ remainingAmount: null }), [])
  assert.deepEqual(run({ resetAt: '2026-09-25T16:00:00.000Z' }), [])
  assert.deepEqual(run({ resetAt: now.toISOString() }), [])
  assert.deepEqual(run({ allowanceUnit: null, remainingUnit: null }), [])
  assert.deepEqual(run({ remainingAmount: 39.99 }), [])
})
test('short-task alert uses entered cost and requires known duration', () => {
  const run = (durationMin: number | null, apiCostUsd = 0.25) => alerts({ tasks: [task({ durationMin, apiCostUsd })], steps: [], providers: [], now })
  assert.deepEqual(run(null), [])
  assert.deepEqual(run(21), [])
  assert.deepEqual(run(20, 0.2499), [])
  assert.equal(run(20)[0].taskId, 'task')
})
test('escalation history attributes outcomes to the previous model, not the next one', () => {
  const tasks = [1, 2, 3].map(id => task({ id: String(id) }))
  const steps: EscalationStep[] = tasks.flatMap((task, index) => [
    { id: `${index}a`, taskId: task.id, order: 0, model: 'primary', role: 'default', reasoningLevel: 'unknown', helped: null, note: '' },
    { id: `${index}b`, taskId: task.id, order: 1, model: 'next', role: 'slow', reasoningLevel: 'unknown', helped: index === 0 ? 'yes' : 'no', note: '' },
  ])
  assert.equal(alerts({ tasks, steps, providers: [], now })[0].id, 'esc:primary')
})
test('limited smol alerts exclude DeepSeek and five-alert limit preserves priority', () => {
  const tasks = Array.from({ length: 6 }, (_, index) => task({ id: String(index), durationMin: 10, apiCostUsd: 1 }))
  tasks.push(task({ id: 'limited', role: 'smol', primaryModel: 'openai-codex/model' }))
  tasks.push(task({ id: 'cheap', role: 'smol' }))
  const result = alerts({ tasks, steps: [], providers: [], now })
  assert.equal(result.length, 5)
  assert.equal(result[0].id, 'trivial:openai-codex/model')
  assert.ok(result.every(row => row.id !== 'trivial:deepseek/model'))
})
