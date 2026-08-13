// Both source endpoints (settings/appointment, settings/clinic) are public,
// so this is resolved via useAsyncData in app.vue and genuinely renders on
// the server — unlike the old React app's client-only fetch, this gives the
// SSR'd auth screen real clinic content instead of a blank placeholder.
// sessionStorage is kept only as a client-side fast path, not the primary
// mechanism (Nuxt's own payload cache already covers same-session re-fetch).

const STORAGE_KEY = 'clinic_config'

interface ClinicConfig {
  clinicName: string
  clinicAddress: string
  clinicLocationUrl: string
  minAdvanceDays: number
}

export const useClinicStore = defineStore('clinic', () => {
  const clinicName = ref('')
  const clinicAddress = ref('')
  const clinicLocationUrl = ref('')
  const minAdvanceDays = ref(1)

  function hydrateFromCache() {
    if (!import.meta.client) return
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const cfg = JSON.parse(raw) as ClinicConfig
      if (!clinicName.value) {
        clinicName.value = cfg.clinicName
        clinicAddress.value = cfg.clinicAddress
        clinicLocationUrl.value = cfg.clinicLocationUrl
        minAdvanceDays.value = cfg.minAdvanceDays
      }
    } catch {}
  }

  function cache() {
    if (!import.meta.client) return
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          clinicName: clinicName.value,
          clinicAddress: clinicAddress.value,
          clinicLocationUrl: clinicLocationUrl.value,
          minAdvanceDays: minAdvanceDays.value,
        })
      )
    } catch {}
  }

  async function load() {
    if (clinicName.value) return
    // Uses $fetch directly rather than the shared api.ts client: that client's
    // request() does a raw relative-URL fetch(), which only resolves in a
    // browser (no location context server-side, so it throws during SSR).
    // $fetch is context-aware and resolves relative URLs on both server and
    // client — this is the one call in the app that genuinely needs to work
    // during SSR, per plan §2.1/§2.2.
    //
    // Hits our own /clinic-config route (server/routes/clinic-config.get.ts),
    // not the backend's /api/settings/* directly — found in M7's Lighthouse
    // pass that those two backend endpoints take ~350ms each, which
    // useAsyncData's blocking await turned into real per-request SSR TTFB.
    // /clinic-config wraps the same two calls behind a 60s server-side cache.
    try {
      const cfg = await $fetch<ClinicConfig>('/clinic-config')
      clinicName.value = cfg.clinicName
      clinicAddress.value = cfg.clinicAddress
      clinicLocationUrl.value = cfg.clinicLocationUrl
      minAdvanceDays.value = cfg.minAdvanceDays
      cache()
    } catch {
      // Defensive, matches the old ClinicProvider: a config-fetch failure
      // should not block the app — it just renders with empty/default values.
    }
  }

  return { clinicName, clinicAddress, clinicLocationUrl, minAdvanceDays, load, hydrateFromCache }
})
