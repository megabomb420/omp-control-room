export const NUMBER_ERROR = 'Enter a number or leave it blank.'

export function numberOrNull(text: string, integer = false): number | null {
  const value = text.trim()
  if (!value) return null
  const parsed = Number(value)
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isSafeInteger(parsed))) throw new Error(NUMBER_ERROR)
  return parsed
}
