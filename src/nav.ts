export const VIEWS = ['overview', 'tasks', 'route', 'models', 'settings'] as const
export type View = (typeof VIEWS)[number]
export const VIEW_LABEL: Record<View, string> = {
  overview: 'Overview', tasks: 'Tasks', route: 'Route', models: 'Models', settings: 'Settings',
}

export function normalizeBase(base: string): string {
  return `/${base.split('/').filter(Boolean).join('/')}${base.split('/').filter(Boolean).length ? '/' : ''}`
}

export function viewFromLocation(pathname: string, base: string): View {
  const prefix = normalizeBase(base)
  const relative = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ''
  const first = relative.split('/')[0]
  return VIEWS.includes(first as View) ? first as View : 'overview'
}

export function pathFor(view: View, base = import.meta.env?.BASE_URL ?? '/'): string {
  return `${normalizeBase(base)}${view}`
}

export function taskPath(id: string): string {
  return `${pathFor('tasks')}/${encodeURIComponent(id)}`
}
