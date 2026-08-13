import { createApiClient } from '@/lib/api'

// Universal plugin (not .client) — the clinic-config useAsyncData call needs
// $api during SSR too. Every authenticated endpoint stays client-only by
// virtue of where it's actually invoked (behind the auth wall).
export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  const api = createApiClient({
    getToken: () => auth.token,
    refresh: () => auth.refresh(),
  })
  return { provide: { api } }
})
