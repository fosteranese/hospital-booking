<script setup lang="ts">
import { Calendar01Icon, Clock01Icon, Location01Icon, Note01Icon, Navigation01Icon } from '@hugeicons/core-free-icons'
import { getAvatarColor } from '@/lib/avatar'
import { formatDate, formatTime } from '@/lib/format'
import type { UpcomingAppointment } from '@/lib/api'

const props = defineProps<{ appointment: UpcomingAppointment; cancelling: boolean }>()
const emit = defineEmits<{ rescheduleTime: []; rescheduleDoctor: []; cancel: [] }>()

const clinic = useClinicStore()
const fullAddress = computed(() => `${clinic.clinicName}, ${clinic.clinicAddress}`)
const directionsUrl = computed(() => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress.value)}`)

const endTime = computed(() => {
  if (props.appointment.end_time) return props.appointment.end_time
  const [h, m] = props.appointment.start_time.split(':').map(Number) as [number, number]
  const total = h * 60 + m + 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
})

function openDirections() {
  window.open(directionsUrl.value, '_blank', 'noopener')
}
</script>

<template>
  <div class="rounded-xl bg-white shadow-sm shadow-black/[0.03] border overflow-hidden">
    <div class="divide-y divide-foreground/5">
      <div class="flex items-center gap-3.5 px-5 py-4">
        <Avatar size="default" class="size-10 ring-2 ring-primary/10">
          <AvatarFallback :class="`text-sm font-semibold ${getAvatarColor(appointment.doctor_name).bg} ${getAvatarColor(appointment.doctor_name).text}`">
            {{ appointment.doctor_name.split(' ').map((n) => n[0]).join('') }}
          </AvatarFallback>
        </Avatar>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Doctor</p>
          <p class="text-sm font-medium text-foreground mt-0.5">Dr. {{ appointment.doctor_name }}</p>
          <p class="text-xs text-muted-foreground/60 mt-0.5">{{ appointment.specialization }}</p>
        </div>
        <Badge variant="outline" class="text-[10px] font-normal shrink-0">{{ appointment.specialization }}</Badge>
      </div>

      <div class="grid grid-cols-2 divide-x divide-foreground/5">
        <div class="flex items-center gap-3.5 px-5 py-4">
          <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
            <HugeIcon :icon="Calendar01Icon" :stroke-width="2" class="size-4.5 text-primary" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Date</p>
            <p class="text-sm font-medium text-foreground mt-0.5">{{ formatDate(appointment.slot_date) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3.5 px-5 py-4">
          <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
            <HugeIcon :icon="Clock01Icon" :stroke-width="2" class="size-4.5 text-primary" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Time</p>
            <p class="text-sm font-medium text-foreground mt-0.5">{{ formatTime(appointment.start_time) }} — {{ formatTime(endTime) }}</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3.5 px-5 py-4">
        <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
          <HugeIcon :icon="Location01Icon" :stroke-width="2" class="size-4.5 text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Location</p>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 underline-offset-2 hover:underline transition-colors"
              @click="openDirections"
            >
              <HugeIcon :icon="Navigation01Icon" :stroke-width="2" class="size-3.5" />
              Get directions
            </button>
          </div>
          <p class="text-sm font-medium text-foreground mt-0.5">{{ clinic.clinicName }}</p>
          <a
            v-if="clinic.clinicLocationUrl"
            :href="clinic.clinicLocationUrl"
            target="_blank"
            rel="noopener"
            class="text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
          >
            {{ clinic.clinicAddress }}
          </a>
          <p v-else class="text-xs text-muted-foreground/60">{{ clinic.clinicAddress }}</p>
        </div>
      </div>

      <div v-if="appointment.notes" class="flex items-start gap-3.5 px-5 py-4">
        <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04] mt-0.5">
          <HugeIcon :icon="Note01Icon" :stroke-width="2" class="size-4.5 text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Notes</p>
          <p class="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{{ appointment.notes }}</p>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-end gap-1 sm:gap-3 px-5 py-3 bg-muted/20 border-t border-foreground/5">
      <button type="button" class="text-xs sm:text-sm font-medium text-primary underline-offset-2 hover:underline transition-colors py-2 px-1.5" @click="emit('rescheduleTime')">
        Reschedule
      </button>
      <span class="text-[10px] text-muted-foreground/30">&middot;</span>
      <button type="button" class="text-xs sm:text-sm font-medium text-primary underline-offset-2 hover:underline transition-colors py-2 px-1.5" @click="emit('rescheduleDoctor')">
        Change doctor
      </button>
      <span class="text-[10px] text-muted-foreground/30">&middot;</span>
      <button
        type="button"
        :disabled="cancelling"
        class="text-xs sm:text-sm font-medium text-destructive underline-offset-2 hover:underline transition-colors disabled:opacity-40 py-2 px-1.5 inline-flex items-center gap-1"
        @click="emit('cancel')"
      >
        <template v-if="cancelling"><Spinner /><span>Cancelling...</span></template>
        <template v-else>Cancel</template>
      </button>
    </div>
  </div>
</template>
