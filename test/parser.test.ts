import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inspectImport, parseSelector, readPath, CREDENTIAL_ERROR, SESSION_ERROR } from '../src/parse-config.ts'

const json = readFileSync(new URL('./fixtures/config-list.json', import.meta.url), 'utf8')
const yaml = readFileSync(new URL('./fixtures/config.yml', import.meta.url), 'utf8')

test('list-json unwraps the live route and keeps runtime off separate from assigned advisor', () => {
  const result = inspectImport(json)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.parsed.modelRoles[0], {
    role: 'default', selector: 'deepseek/deepseek-flash:max', provider: 'deepseek',
    model: 'deepseek-flash', thinking: 'max', alias: null,
  })
  assert.equal(result.parsed.advisorEnabled.value, false)
  assert.deepEqual(result.parsed.fallbackChains.value, [{ key: 'plan', chain: ['deepseek/deepseek-flash'] }])
  assert.deepEqual(result.parsed.cycleOrder.value, ['smol', 'default', 'slow'])
})

test('nested YAML preserves selectors without inventing absent settings', () => {
  const a = inspectImport(json), b = inspectImport(yaml)
  assert.ok(a.ok && b.ok)
  assert.deepEqual(a.parsed.modelRoles, b.parsed.modelRoles)
  assert.deepEqual(b.parsed.advisorEnabled, { present: false, value: null })
})

test('credential and session input never returns a parsed route', () => {
  assert.deepEqual(inspectImport('apiKey: sk-abcdefghijklmnopqrst'), { ok: false, error: CREDENTIAL_ERROR })
  assert.deepEqual(inspectImport('{"password":"private-password"}'), { ok: false, error: CREDENTIAL_ERROR })
  assert.deepEqual(inspectImport('\n{"type":"session","version":1}\n{}'), { ok: false, error: SESSION_ERROR })
})

test('aliases and non-thinking colons remain intact', () => {
  assert.equal(parseSelector('@smol').alias, 'smol')
  assert.equal(parseSelector('@smol').model, '@smol')
  assert.equal(parseSelector('provider/model:version:high').model, 'model:version')
  assert.equal(parseSelector('model:version').thinking, null)
})

test('flat keys win and redacted values are absent', () => {
  assert.deepEqual(readPath({ 'advisor.enabled': { value: false, type: 'boolean', redacted: true }, advisor: { enabled: true } }, 'advisor.enabled'), { present: false, value: null })
  assert.deepEqual(readPath({ 'advisor.enabled': null, advisor: { enabled: true } }, 'advisor.enabled'), { present: true, value: null })
})

test('malformed fields remain present and valid fallback entries survive', () => {
  const result = inspectImport(JSON.stringify({ modelRoles: { default: 'a/b', bad: 4 }, cycleOrder: ['smol', 3], 'compaction.reserveTokens': { value: null, type: 'number' }, retry: { fallbackChains: { plan: ['a/b'], broken: 5 } } }))
  assert.ok(result.ok)
  assert.deepEqual(result.parsed.cycleOrder, { present: true, value: null })
  assert.deepEqual(result.parsed.compactionReserveTokens, { present: true, value: null })
  assert.deepEqual(result.parsed.fallbackChains.value, [{ key: 'plan', chain: ['a/b'] }])
  assert.equal(result.parsed.modelRoles.length, 1)
})
