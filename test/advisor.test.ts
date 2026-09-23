import test from 'node:test'
import assert from 'node:assert/strict'
import { recommend } from '../src/advisor.ts'
import { inspectImport } from '../src/parse-config.ts'
import type { EscalationStep } from '../src/types.ts'

test('advisor returns only advice, with no config-writing fields', () => {
  const repo = recommend('repo', null, [], [])
  assert.equal(repo.role, 'default')
  assert.equal(repo.model, null)
  assert.equal(recommend('stuck', null, [], []).role, 'slow')
  assert.deepEqual(Object.keys(repo).sort(), ['kind', 'role', 'model', 'thinking', 'explanation', 'historyNote'].sort())
})

test('slow history requires three judged transitions and resolves role aliases', () => {
  const result = inspectImport('modelRoles:\n  slow: p/model:max')
  assert.ok(result.ok)
  const steps: EscalationStep[] = [1, 2, 3].map(order => ({ id: String(order), taskId: 'task', order, model: '@slow', role: 'slow', reasoningLevel: 'max', helped: order === 1 ? 'yes' : 'no', note: '' }))
  assert.equal(recommend('stuck', result.parsed, [], steps.slice(0, 2)).historyNote, 'No tasks logged for this role yet.')
  assert.match(recommend('stuck', result.parsed, [], steps).historyNote, /helped 1 of 3 judged times/)
})
