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
    <LeftPanel :step="booking.step" :pre-browsed="booking.preBrowsed" :wide="booking.step === 'identify' || booking.step === 'success'" />
    <div class="flex-1 flex flex-col min-w-0">
      <MobileHeader :step="booking.step" :pre-browsed="booking.preBrowsed" />
      <BookingWizard />
    </div>
  </div>
</template>
