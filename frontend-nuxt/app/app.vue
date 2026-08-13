<script setup lang="ts">
// Clinic config is public/unauthenticated, so it's resolved here via
// useAsyncData and genuinely renders on the server — this is the actual
// payoff of choosing Nuxt over a plain SPA for this app. See plan §2.2.
const clinic = useClinicStore()
await useAsyncData('clinic-config', async () => {
  clinic.hydrateFromCache()
  await clinic.load()
  return true
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
