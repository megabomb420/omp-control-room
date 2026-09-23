import test from 'node:test'
import assert from 'node:assert/strict'
import { taskDraft, taskFromDraft } from '../src/task-form.ts'
import { inputDateToIso } from '../src/format.ts'
import { pathFor, viewFromLocation } from '../src/nav.ts'

test('task form distinguishes missing, negative, fractional and zero numeric input', () => {
  const draft = { ...taskDraft(), title: 'Task', result: 'solved' as const }
  assert.equal(taskFromDraft(draft).inputTokens, null)
  assert.equal(taskFromDraft({ ...draft, inputTokens: '0' }).inputTokens, 0)
  assert.throws(() => taskFromDraft({ ...draft, inputTokens: '-1' }), /Enter a number/)
  assert.throws(() => taskFromDraft({ ...draft, inputTokens: '1.5' }), /Enter a number/)
  assert.throws(() => taskFromDraft({ ...draft, result: '' }), /Pick a result/)
  assert.throws(() => taskFromDraft({ ...draft, quality: '6' }), /Quality is 1 to 5/)
  assert.throws(() => taskFromDraft({ ...draft, title: '  ' }), /Title is required/)
})
test('invalid calendar dates never roll into a different day', () => {
  assert.equal(inputDateToIso('2026-02-30T12:00'), null)
  assert.equal(inputDateToIso(''), null)
})
test('base-aware navigation keeps task deep links and rejects unknown views', () => {
  assert.equal(pathFor('tasks', '/omp-control-room/'), '/omp-control-room/tasks')
  assert.equal(pathFor('overview', '/'), '/overview')
  assert.equal(viewFromLocation('/omp-control-room/tasks/new', '/omp-control-room/'), 'tasks')
  assert.equal(viewFromLocation('/omp-control-room/tasks/uuid', '/omp-control-room/'), 'tasks')
  assert.equal(viewFromLocation('/omp-control-room/unknown', '/omp-control-room/'), 'overview')
})
