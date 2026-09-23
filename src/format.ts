export function dateTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

const pad = (value: number) => String(value).padStart(2, '0')
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function localDateTime(date = new Date()): string {
  return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function inputDateToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && localDateTime(date) === value ? date.toISOString() : null
}

export function money(value: number | null): string {
  if (value === null) return '—'
  return `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`
}

export function rate(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`
}
