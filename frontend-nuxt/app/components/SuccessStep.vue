<script setup lang="ts">
import { motion } from 'motion-v'
import { Doctor01Icon, Calendar01Icon, Clock01Icon } from '@hugeicons/core-free-icons'

const props = defineProps<{
  doctorName: string
  bookDate: string
  bookTime: string
  bookEndTime: string
  patientFirstName: string
  patientLastName: string
  isReschedule: boolean
}>()

const emit = defineEmits<{ viewBookings: [] }>()

const clinic = useClinicStore()

const formattedTime = computed(() => {
  const [h, m] = props.bookTime.split(':').map(Number)
  const p = (h ?? 0) >= 12 ? 'PM' : 'AM'
  return `${(h ?? 0) % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${p}`
})
</script>

<template>
  <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :transition="{ duration: 0.35, ease: 'easeOut' }" class="py-12">
    <div class="flex flex-col items-center gap-8 max-w-lg mx-auto">
      <motion.div
        :initial="{ scale: 0 }"
        :animate="{ scale: 1 }"
        :transition="{ delay: 0.15, type: 'spring', stiffness: 250, damping: 14 }"
        class="mx-auto size-24 rounded-full bg-gradient-to-br from-amber-50 to-primary/15 flex items-center justify-center shadow-lg shadow-primary/8"
      >
        <svg class="size-14 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <motion.path
            d="M20 6L9 17L4 12"
            :initial="{ pathLength: 0 }"
            :animate="{ pathLength: 1 }"
            :transition="{ delay: 0.4, duration: 0.5, ease: 'easeInOut' }"
          />
        </svg>
      </motion.div>

      <div class="text-center space-y-2">
        <h2 class="text-2xl font-bold text-foreground">{{ isReschedule ? 'Appointment Rescheduled!' : 'Appointment Booked!' }}</h2>
        <p class="text-sm text-muted-foreground/70 max-w-xs mx-auto">
          {{ isReschedule ? 'Your appointment has been rescheduled. We look forward to seeing you.' : 'Your appointment is all set. We look forward to seeing you.' }}
        </p>
      </div>

      <div class="w-full rounded-xl bg-white shadow-sm shadow-black/[0.03] border overflow-hidden">
        <div class="divide-y divide-foreground/5">
          <div class="flex items-center gap-3.5 px-5 py-4">
            <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
              <HugeIcon :icon="Doctor01Icon" :stroke-width="2" class="size-4.5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Doctor</p>
              <p class="text-sm font-medium text-foreground mt-0.5">{{ doctorName }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3.5 px-5 py-4">
            <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
              <HugeIcon :icon="Calendar01Icon" :stroke-width="2" class="size-4.5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Date</p>
              <p class="text-sm font-medium text-foreground mt-0.5">
                {{ new Date(bookDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3.5 px-5 py-4">
            <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
              <HugeIcon :icon="Clock01Icon" :stroke-width="2" class="size-4.5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Time</p>
              <p class="text-sm font-medium text-foreground mt-0.5">{{ formattedTime }}</p>
            </div>
          </div>
        </div>
      </div>

      <AddToCalendar
        :title="`Appointment with ${doctorName}`"
        :description="`Patient: ${patientFirstName} ${patientLastName}\nDoctor: ${doctorName}`"
        :location="`${clinic.clinicName}, ${clinic.clinicAddress}`"
        :start-date="bookDate"
        :start-time="bookTime"
        :end-time="bookEndTime"
      />

      <Button class="w-full h-11 text-base shadow-xs" @click="emit('viewBookings')">View your bookings</Button>
    </div>
  </motion.div>
</template>
