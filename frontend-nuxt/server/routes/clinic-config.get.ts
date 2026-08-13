// Found during M7's Lighthouse pass: app.vue's useAsyncData blocks SSR on
// this data, and the backend's /api/settings/* endpoints each take ~350ms
// (confirmed by curl timing them directly) -- slow enough that every fresh
// SSR request was paying that latency in full, making Nuxt's TTFB *worse*
// than the old static SPA's it was supposed to beat. Clinic settings change
// rarely (admin-configured), so a short server-side response cache absorbs
// that cost for every request except the first one per window. This is the
// only endpoint in the app that needs it -- everything else is either
// client-only or per-user/authenticated.
//
// Lives under server/routes/ (-> /clinic-config), not server/api/ (-> /api/*)
// -- routeRules proxies all of /api/** straight to the backend, which would
// shadow a locally-cached handler placed there.
const BACKEND = 'http://localhost:3000'

export default defineCachedEventHandler(async () => {
  const [appt, clinic] = await Promise.all([
    $fetch<Array<{ name: string; value: string }>>(`${BACKEND}/api/settings/appointment`),
    $fetch<Array<{ name: string; value: string }>>(`${BACKEND}/api/settings/clinic`).catch(() => []),
  ])
  const map: Record<string, string> = {}
  appt.forEach((s) => { map[s.name] = s.value })
  clinic.forEach((s) => { map[s.name] = s.value })
  return {
    clinicName: map.clinic_name || 'Clinic',
    clinicAddress: map.clinic_address || '',
    clinicLocationUrl: map.clinic_location_url || '',
    minAdvanceDays: parseInt(map.min_advance_days || '1', 10),
  }
}, { maxAge: 60 })
