// Single source of truth for auth/token state, replacing the old React app's
// two-sources-of-truth setup (a module-level TokenStore singleton kept in
// sync with AuthContext via effects running in both directions — the exact
// dual-write pattern that caused a real "logged out after OTP" bug, see
// PROJECT_CONTEXT.md item 37 in the old app). Everything reaches into this
// store directly instead.

const STORAGE_KEY_TOKEN = 'auth_token'
const STORAGE_KEY_ROLE = 'auth_role'
const STORAGE_KEY_ID = 'auth_identifier'

export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const userRole = ref('')
  const otpIdentifier = ref('')

  // Plain (non-reactive) internals, scoped to this store instance — not module
  // scope (would leak across SSR requests) and not refs (mutating them on
  // every token set/clear shouldn't trigger reactivity/watchers).
  let generation = 0
  let refreshing: Promise<string> | null = null

  function persist() {
    if (!import.meta.client) return
    try {
      sessionStorage.setItem(STORAGE_KEY_TOKEN, token.value || '')
      sessionStorage.setItem(STORAGE_KEY_ROLE, userRole.value || '')
      sessionStorage.setItem(STORAGE_KEY_ID, otpIdentifier.value || '')
    } catch {}
  }

  function hydrate() {
    if (!import.meta.client) return
    try {
      token.value = sessionStorage.getItem(STORAGE_KEY_TOKEN) || ''
      userRole.value = sessionStorage.getItem(STORAGE_KEY_ROLE) || ''
      otpIdentifier.value = sessionStorage.getItem(STORAGE_KEY_ID) || ''
    } catch {}
  }

  function setAll(t: string, role: string, identifier: string) {
    token.value = t
    userRole.value = role
    otpIdentifier.value = identifier
    generation++
    persist()
  }

  function setToken(t: string) {
    token.value = t
    generation++
    persist()
  }

  function setUserRole(r: string) {
    userRole.value = r
    persist()
  }

  function setOtpIdentifier(id: string) {
    otpIdentifier.value = id
    persist()
  }

  function clearAuth() {
    token.value = ''
    userRole.value = ''
    otpIdentifier.value = ''
    generation++
    refreshing = null
    persist()
  }

  async function refresh(): Promise<string> {
    if (refreshing) return refreshing

    const gen = generation
    refreshing = (async () => {
      // Bare fetch, not the request() wrapper — routing a failing refresh
      // through request() would recurse into its own 401-retry logic.
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value }),
      })
      if (!res.ok) {
        token.value = ''
        persist()
        throw new Error('Session expired. Please login again.')
      }
      const data = await res.json()
      if (generation !== gen) {
        // Session was reset (logout/new login) while this refresh was in
        // flight — discard the stale result instead of overwriting current state.
        return token.value
      }
      token.value = data.token
      persist()
      return token.value
    })()

    try {
      return await refreshing
    } finally {
      refreshing = null
    }
  }

  return {
    token,
    userRole,
    otpIdentifier,
    setAll,
    setToken,
    setUserRole,
    setOtpIdentifier,
    clearAuth,
    refresh,
    hydrate,
  }
})
