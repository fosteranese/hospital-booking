<script setup lang="ts">
const booking = useBookingStore()

// Server always renders step='identify' (no sessionStorage access possible
// there — this is also exactly the content SSR exists for). onMounted then
// does the real work: decide whether to clear session or rehydrate from a
// resumed URL/sessionStorage snapshot. See plan §2.6.
onMounted(() => {
  booking.hydrate()
})
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <a
      href="#main-content"
      class="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[100] focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground focus-visible:shadow-lg"
    >
      Skip to booking form
    </a>
    <LeftPanel :step="booking.step" :pre-browsed="booking.preBrowsed" :wide="booking.step === 'identify' || booking.step === 'success'" />
    <div class="flex-1 flex flex-col min-w-0">
      <MobileHeader :step="booking.step" :pre-browsed="booking.preBrowsed" />
      <BookingWizard />
    </div>
  </div>
</template>
