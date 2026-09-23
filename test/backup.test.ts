import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBackup, type BackupFile } from '../src/backup.ts'
import { provider, task } from './records.ts'
import { inspectImport } from '../src/parse-config.ts'

function backup(): BackupFile {
  const route = inspectImport('modelRoles:\n  default: deepseek/model')
  assert.ok(route.ok)
  return { format: 'omp-control-room', version: 1, exportedAt: '2026-09-23T12:00:00.000Z',
    snapshots: [{ id: 'config', importedAt: '2026-09-23T12:00:00.000Z', source: 'paste', active: true, parsed: route.parsed }],
    tasks: [task()], providers: [provider()], prices: [], escalations: [],
  }
}
test('backup accepts a complete application export with missing providers for reseeding', () => {
  const value = backup()
  assert.deepEqual(parseBackup(JSON.stringify(value)), { ok: true, backup: value })
})
test('backup rejects foreign format, unsupported version, providers and malformed records', () => {
  const value = backup()
  assert.deepEqual(parseBackup(JSON.stringify({ ...value, format: 'foreign' })), { ok: false, error: 'Backup format is not omp-control-room.' })
  assert.deepEqual(parseBackup(JSON.stringify({ ...value, version: 2 })), { ok: false, error: 'Backup version is not 1.' })
  for (const changed of [
    { ...value, providers: [{ ...provider(), id: 'foreign' }] },
    { ...value, tasks: [{ ...task(), inputTokens: -1 }] },
    { ...value, tasks: [task(), task()] },
    { ...value, snapshots: [{ ...value.snapshots[0], parsed: {} }] },
  ]) assert.equal(parseBackup(JSON.stringify(changed)).ok, false)
})
test('backup rejects orphaned and noncontiguous escalation records', () => {
  const value = backup()
  const step = { id: 'step', taskId: 'missing', order: 0, model: '', role: 'default', reasoningLevel: 'unknown', helped: null, note: '' }
  assert.equal(parseBackup(JSON.stringify({ ...value, escalations: [step] })).ok, false)
  assert.equal(parseBackup(JSON.stringify({ ...value, escalations: [{ ...step, taskId: 'task', order: 2 }] })).ok, false)
})
