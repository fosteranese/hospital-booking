const KEY = 'booking'

export function saveBooking(data: unknown): void {
  if (!import.meta.client) return
  try { sessionStorage.setItem(KEY, JSON.stringify(data)) } catch {}
}

export function loadBooking<T = unknown>(): T | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearBooking(): void {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(KEY) } catch {}
}
