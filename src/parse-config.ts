import { parse as parseYaml } from 'yaml'
import { ROLES, THINKING, type Field, type ParsedRoute, type RoleAssignment } from './types.ts'
import { isRecord } from './type-guards.ts'

export const SESSION_ERROR = 'Session logs are not imported. Log the task by hand.'
export const CREDENTIAL_ERROR = 'This paste looks like it contains a credential. Use omp config list --json.'

function unwrap(value: unknown): Field<unknown> {
  if (isRecord(value) && Object.hasOwn(value, 'value') && Object.hasOwn(value, 'type')) {
    if (value.redacted === true) return { present: false, value: null }
    return { present: true, value: value.value ?? null }
  }
  return { present: true, value: value ?? null }
}

export function readPath(object: Record<string, unknown>, path: string): Field<unknown> {
  if (Object.hasOwn(object, path)) return unwrap(object[path])
  let current: unknown = object
  for (const part of path.split('.')) {
    if (!isRecord(current) || !Object.hasOwn(current, part)) return { present: false, value: null }
    const field = unwrap(current[part])
    if (!field.present) return field
    current = field.value
  }
  return { present: true, value: current ?? null }
}

export function parseSelector(selector: string, role = ''): RoleAssignment {
  if (selector.startsWith('@')) return { role, selector, provider: null, model: selector, thinking: null, alias: selector.slice(1) }
  const slash = selector.indexOf('/')
  const provider = slash < 0 ? null : selector.slice(0, slash)
  let model = slash < 0 ? selector : selector.slice(slash + 1)
  const colon = model.lastIndexOf(':')
  const suffix = model.slice(colon + 1)
  const thinking = colon >= 0 && THINKING.some(level => level !== 'unknown' && level === suffix) ? suffix : null
  if (thinking !== null) model = model.slice(0, colon)
  return { role, selector, provider, model, thinking, alias: null }
}

export function providerLabel(provider: string | null): string {
  if (provider === 'deepseek') return 'DeepSeek'
  if (provider === 'openai-codex' || provider === 'openai') return 'OpenAI Codex'
  if (provider === 'xai-oauth' || provider === 'xai') return 'xAI'
  return provider || 'Unknown'
}

const stringValue = (v: unknown): v is string => typeof v === 'string'
const booleanValue = (v: unknown): v is boolean => typeof v === 'boolean'
const numberValue = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(stringValue)
const stringRecord = (v: unknown): v is Record<string, string> => isRecord(v) && Object.values(v).every(stringValue)

function parseObject(object: Record<string, unknown>): ParsedRoute {
  function field<T>(path: string, valid: (value: unknown) => value is T): Field<T> {
    const raw = readPath(object, path)
    return { present: raw.present, value: valid(raw.value) ? raw.value : null }
  }
  const roleMap = readPath(object, 'modelRoles').value
  const modelRoles = isRecord(roleMap) ? Object.entries(roleMap)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .sort(([a], [b]) => {
      const order = ROLES.filter(role => role !== 'other') as readonly string[]
      const ai = order.indexOf(a), bi = order.indexOf(b)
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi) || a.localeCompare(b)
    }).map(([role, selector]) => parseSelector(selector, role)) : []
  const fallback = readPath(object, 'retry.fallbackChains')
  return {
    modelRoles,
    cycleOrder: field('cycleOrder', strings),
    fallbackChains: { present: fallback.present, value: isRecord(fallback.value)
      ? Object.entries(fallback.value).filter((entry): entry is [string, string[]] => strings(entry[1])).map(([key, chain]) => ({ key, chain })) : null },
    modelFallback: field('retry.modelFallback', booleanValue),
    fallbackRevertPolicy: field('retry.fallbackRevertPolicy', stringValue),
    retryEnabled: field('retry.enabled', booleanValue),
    maxRetries: field('retry.maxRetries', numberValue),
    usageAwareFallback: field('retry.usageAwareFallback', booleanValue),
    waitForUsageReset: field('retry.waitForUsageReset', booleanValue),
    defaultThinkingLevel: field('defaultThinkingLevel', stringValue),
    advisorEnabled: field('advisor.enabled', booleanValue),
    advisorSyncBacklog: field('advisor.syncBacklog', (v): v is string | number => stringValue(v) || numberValue(v)),
    advisorImmuneTurns: field('advisor.immuneTurns', numberValue),
    advisorMaxNotes: field('advisor.maxNotesPerUpdate', numberValue),
    prewalkEnabled: field('prewalk.enabled', booleanValue),
    taskPrewalk: field('task.prewalk', booleanValue),
    agentPrewalk: field('task.agentPrewalk', stringRecord),
    taskEager: field('task.eager', stringValue),
    taskMaxConcurrency: field('task.maxConcurrency', numberValue),
    taskMaxRecursionDepth: field('task.maxRecursionDepth', numberValue),
    taskMaxRuntimeMs: field('task.maxRuntimeMs', numberValue),
    taskSoftRequestBudget: field('task.softRequestBudget', numberValue),
    taskMaxEffort: field('task.maxEffort', stringValue),
    taskAgentAdvisor: readPath(object, 'task.agentAdvisor'),
    taskAgentModelOverrides: field('task.agentModelOverrides', stringRecord),
    compactionEnabled: field('compaction.enabled', booleanValue),
    compactionMethodOrder: field('compaction.methodOrder', strings),
    compactionThresholdPercent: field('compaction.thresholdPercent', numberValue),
    compactionReserveTokens: field('compaction.reserveTokens', numberValue),
    compactionKeepRecentTokens: field('compaction.keepRecentTokens', numberValue),
    contextPromotionEnabled: field('contextPromotion.enabled', booleanValue),
  }
}

export function inspectImport(text: string): { ok: true; parsed: ParsedRoute } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'Nothing to import.' }
  if (/"type"\s*:\s*"session"/.test(trimmed.split(/\r?\n/, 1)[0])) return { ok: false, error: SESSION_ERROR }
  if (/(api[_-]?key|secret|password)\s*[:=]\s*\S+/i.test(trimmed)
    || /"(?:api[_-]?key|secret|password)"\s*:\s*"[^"\s]+/i.test(trimmed)
    || /sk-[A-Za-z0-9]{10,}/.test(trimmed)) return { ok: false, error: CREDENTIAL_ERROR }
  let object: unknown
  try { object = JSON.parse(trimmed) }
  catch {
    try { object = parseYaml(trimmed) }
    catch { return { ok: false, error: 'Not valid JSON or YAML.' } }
  }
  if (!isRecord(object)) return { ok: false, error: 'Config must be an object.' }
  return { ok: true, parsed: parseObject(object) }
}
