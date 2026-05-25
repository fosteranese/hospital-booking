const KEY = 'booking';

export function saveBooking(data: unknown): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function loadBooking<T = unknown>(): T | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearBooking(): void {
  try { sessionStorage.removeItem(KEY); } catch {}
}
