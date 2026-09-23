import test from 'node:test'
import assert from 'node:assert/strict'
import { taskCost, dashboardMetrics, inWindow } from '../src/metrics.ts'
import { money } from '../src/format.ts'
import { price, task } from './records.ts'

const now = new Date('2026-09-23T15:00:00.000Z')
test('unknown costs are excluded from sums and denominators but not task success', () => {
  const result = dashboardMetrics([task({ id: 'a', apiCostUsd: 1.5 }), task({ id: 'b', result: 'failed' })], [], [], '7d', now)
  assert.equal(result.knownSum, 1.5)
  assert.equal(result.excluded, 1)
  assert.equal(result.success, 0.5)
  assert.equal(result.averageKnownCost, 1.5)
  assert.equal(result.costPerSolved, 1.5)
})
test('entered zero wins over a price, and unknown totals never become zero', () => {
  assert.deepEqual(taskCost(task({ apiCostUsd: 0, inputTokens: 1e6 }), [price()]), { usd: 0, kind: 'entered' })
  assert.deepEqual(taskCost(task({ apiCostUsd: 1.25, inputTokens: 1e6 }), [price()]), { usd: 1.25, kind: 'entered' })
  assert.equal(dashboardMetrics([task()], [], [], '7d', now).knownSum, null)
  assert.equal(dashboardMetrics([task({ apiCostUsd: 0 })], [], [], '7d', now).knownSum, 0)
  assert.equal(money(0), '$0.00')
  assert.equal(money(0.0012), '$0.0012')
})
test('ambiguous segment matches are unknown while an exact full selector wins', () => {
  const rows = [price(), price({ id: 'other', providerId: 'xai', modelId: 'xai/model' })]
  assert.equal(taskCost(task({ primaryModel: 'model', inputTokens: 1e6 }), rows).kind, 'unknown')
  assert.deepEqual(taskCost(task({ primaryModel: 'DEEPSEEK/MODEL', inputTokens: 1e6 }), rows), { usd: 1, kind: 'estimated' })
})
test('unpriced known token sides prevent a partial underestimate', () => {
  assert.equal(taskCost(task({ inputTokens: 1e6, cacheReadTokens: 100 }), [price()]).kind, 'unknown')
  assert.deepEqual(taskCost(task({ inputTokens: 1e6, outputTokens: 2e6 }), [price()]), { usd: 5, kind: 'estimated' })
})
test('solved unknown costs and unjudged escalation steps use distinct denominators', () => {
  const tasks = [task({ id: 'a', apiCostUsd: 2 }), task({ id: 'b' }), task({ id: 'c', result: 'partial', apiCostUsd: 10 })]
  const steps = [null, 'yes', 'no', 'unclear', null].map((helped, order) => ({ id: String(order), taskId: 'a', order, model: '', role: 'default' as const, reasoningLevel: 'unknown' as const, helped: helped as 'yes' | 'no' | 'unclear' | null, note: '' }))
  const result = dashboardMetrics(tasks, [], steps, '7d', now)
  assert.equal(result.costPerSolved, 2)
  assert.equal(result.solvedExcluded, 1)
  assert.equal(result.success, 1 / 3 * 2)
  assert.equal(result.escalationHelp, 0.5)
  assert.equal(result.unclear, 2)
})
test('rolling window includes its lower boundary and excludes future timestamps', () => {
  assert.equal(inWindow('2026-09-16T15:00:00.000Z', '7d', now), true)
  assert.equal(inWindow('2026-09-16T14:59:59.999Z', '7d', now), false)
  assert.equal(inWindow('2026-09-24T15:00:00.000Z', '7d', now), false)
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0)
  assert.equal(inWindow(midnight.toISOString(), 'today', now), true)
  assert.equal(inWindow(new Date(midnight.getTime() - 1).toISOString(), 'today', now), false)
})
