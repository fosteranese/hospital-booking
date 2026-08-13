<script setup lang="ts">
import { getAvatarColor } from '@/lib/avatar'
import { formatDate, formatTime } from '@/lib/format'
import type { UpcomingAppointment } from '@/lib/api'
import type { AppointmentDetail } from './AppointmentDetailModal.vue'

const props = defineProps<{ appointments: UpcomingAppointment[] }>()
const emit = defineEmits<{
  close: []
  rescheduleTime: [appt: UpcomingAppointment]
  rescheduleDoctor: [appt: UpcomingAppointment]
  cancelAppointment: [appointmentId: string, reason?: string]
}>()

const PER_PAGE = 10
const page = ref(1)
const cancellingId = ref<string | null>(null)
const pendingCancelId = ref<string | null>(null)
const isCancelling = ref(false)
const selectedAppointment = ref<UpcomingAppointment | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(props.appointments.length / PER_PAGE)))
const paginatedAppointments = computed(() => props.appointments.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))

watch(
  () => props.appointments.length,
  (len) => { if (len === 0) emit('close') }
)
watch(() => props.appointments, () => { page.value = 1 })

const cancellingAppt = computed(() => props.appointments.find((a) => a.id === pendingCancelId.value) ?? null)

async function confirmCancel(reason?: string) {
  if (!pendingCancelId.value) return
  const id = pendingCancelId.value
  pendingCancelId.value = null
  isCancelling.value = true
  cancellingId.value = id
  try {
    emit('cancelAppointment', id, reason)
  } finally {
    cancellingId.value = null
    isCancelling.value = false
  }
}

const selectedAsDetail = computed<AppointmentDetail | null>(() => {
  const s = selectedAppointment.value
  if (!s) return null
  return {
    id: s.id,
    doctor_name: s.doctor_name,
    specialization: s.specialization,
    slot_date: s.slot_date,
    start_time: s.start_time,
    end_time: s.end_time,
    status: s.status,
    notes: s.notes,
  }
})
</script>

<template>
  <ModalShell :title="`All upcoming appointments (${appointments.length})`" @close="emit('close')">
    <div class="overflow-y-auto flex-1">
      <div class="divide-y divide-foreground/5 px-2 sm:px-3 py-2">
        <div
          v-for="appt in paginatedAppointments"
          :key="appt.id"
          class="group flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
          @click="selectedAppointment = appt"
        >
          <Avatar size="default" class="shrink-0">
            <AvatarFallback :class="`text-sm font-semibold ${getAvatarColor(appt.doctor_name).bg} ${getAvatarColor(appt.doctor_name).text}`">
              {{ appt.doctor_name.split(' ').map((n) => n[0]).join('') }}
            </AvatarFallback>
          </Avatar>

          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 flex-wrap">
              <p class="font-medium text-foreground text-sm truncate">Dr. {{ appt.doctor_name }}</p>
              <span class="text-xs text-muted-foreground/70 shrink-0">{{ appt.specialization }}</span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{{ formatDate(appt.slot_date) }}</span>
              <span class="text-muted-foreground/30">&middot;</span>
              <span>{{ formatTime(appt.start_time) }}</span>
            </p>
          </div>

          <div class="shrink-0 flex items-center gap-3" @click.stop>
            <span v-if="cancellingId === appt.id" class="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Spinner />
              Cancelling...
            </span>
            <template v-else>
              <button
                type="button"
                class="hidden sm:inline text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors py-1.5"
                @click="emit('rescheduleTime', appt)"
              >
                Reschedule
              </button>
              <button
                type="button"
                class="hidden sm:inline text-xs font-medium text-destructive underline-offset-2 hover:underline transition-colors py-1.5"
                @click="pendingCancelId = appt.id"
              >
                Cancel
              </button>
            </template>
          </div>
        </div>
      </div>
      <div v-if="totalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-foreground/5">
        <p class="text-[11px] text-muted-foreground">Page {{ page }} of {{ totalPages }}</p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="page <= 1"
            class="text-xs sm:text-sm font-medium text-primary underline-offset-2 hover:underline transition-colors disabled:opacity-30 disabled:no-underline py-1.5 px-2"
            @click="page = Math.max(1, page - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            :disabled="page >= totalPages"
            class="text-xs sm:text-sm font-medium text-primary underline-offset-2 hover:underline transition-colors disabled:opacity-30 disabled:no-underline py-1.5 px-2"
            @click="page = Math.min(totalPages, page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </ModalShell>

  <CancelAppointmentDialog
    :open="pendingCancelId !== null"
    @update:open="(v) => { if (!v) pendingCancelId = null }"
    :appointment="cancellingAppt"
    :is-cancelling="isCancelling"
    @confirm="confirmCancel"
  />

  <AppointmentDetailModal
    v-if="selectedAsDetail"
    :appointment="selectedAsDetail"
    :on-reschedule-time="() => { const a = selectedAppointment; selectedAppointment = null; if (a) emit('rescheduleTime', a) }"
    :on-reschedule-doctor="() => { const a = selectedAppointment; selectedAppointment = null; if (a) emit('rescheduleDoctor', a) }"
    :on-cancel="async (id, reason) => emit('cancelAppointment', id, reason)"
    @close="selectedAppointment = null"
  />
</template>
