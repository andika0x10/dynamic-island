export function clock(seconds: number) {
  const value = Math.max(0, Math.ceil(seconds))
  const hours = Math.floor(value / 3600)
  return `${hours ? `${hours}:` : ''}${hours ? String(Math.floor(value / 60) % 60).padStart(2, '0') : Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}
