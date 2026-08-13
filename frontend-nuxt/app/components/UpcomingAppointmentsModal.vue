<script setup lang="ts">
import { getAvatarColor } from '@/lib/avatar'
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
      <div class="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10">
            <tr class="bg-muted/20 border-b border-foreground/5">
              <th class="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Doctor</th>
              <th class="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Date</th>
              <th class="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Time</th>
              <th class="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="appt in paginatedAppointments"
              :key="appt.id"
              class="border-b border-foreground/5 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
              @click="selectedAppointment = appt"
            >
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-2.5">
                  <Avatar size="default">
                    <AvatarFallback :class="`text-sm font-semibold ${getAvatarColor(appt.doctor_name).bg} ${getAvatarColor(appt.doctor_name).text}`">
                      {{ appt.doctor_name.split(' ').map((n) => n[0]).join('') }}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p class="font-medium text-foreground text-sm">Dr. {{ appt.doctor_name }}</p>
                    <p class="text-[11px] text-muted-foreground">{{ appt.specialization }}</p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3.5 text-foreground">{{ appt.slot_date }}</td>
              <td class="px-5 py-3.5 text-muted-foreground">{{ appt.start_time?.slice(0, 5) }}</td>
              <td class="px-5 py-3.5 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="text-xs sm:text-sm font-medium text-primary underline-offset-2 hover:underline transition-colors py-1.5 px-1"
                    @click.stop="emit('rescheduleTime', appt)"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    :disabled="cancellingId === appt.id"
                    class="text-xs sm:text-sm font-medium text-destructive underline-offset-2 hover:underline transition-colors disabled:opacity-40 py-1.5 px-1 inline-flex items-center gap-1"
                    @click.stop="pendingCancelId = appt.id"
                  >
                    <template v-if="cancellingId === appt.id"><Spinner /><span>Cancelling...</span></template>
                    <template v-else>Cancel</template>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
