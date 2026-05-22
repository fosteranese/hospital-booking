import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

let _toasts: Toast[] = []
let _listeners: ((toasts: Toast[]) => void)[] = []

function notify() {
  _listeners.forEach(l => l([..._toasts]))
}

function addToast(t: Omit<Toast, 'id'>) {
  const toast: Toast = { ...t, id: Math.random().toString(36).slice(2) }
  _toasts = [..._toasts, toast]
  notify()
  setTimeout(() => {
    _toasts = _toasts.filter(x => x.id !== toast.id)
    notify()
  }, 4000)
}

export function useToast() {
  const [, set] = useState(0)
  const subscribe = useCallback((listener: (toasts: Toast[]) => void) => {
    _listeners.push(listener)
    return () => { _listeners = _listeners.filter(l => l !== listener) }
  }, [])

  useState(() => subscribe(() => set(x => x + 1)))

  return {
    toasts: _toasts,
    toast: addToast,
    dismiss: (id: string) => {
      _toasts = _toasts.filter(x => x.id !== id)
      notify()
    },
  }
}
