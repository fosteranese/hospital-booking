<script setup lang="ts">
import { CheckmarkCircle02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import type { AppointmentHistoryItem } from '@/lib/api'
import { getAvatarColor } from '@/lib/avatar'
import { formatTime } from '@/lib/format'
import type { AppointmentDetail } from './AppointmentDetailModal.vue'

const props = defineProps<{
  history: AppointmentHistoryItem[]
  loading: boolean
  error?: string
  onRetry?: () => void
  onMarkAttendance: (appointmentId: string, attended: boolean) => Promise<void>
}>()
const emit = defineEmits<{ close: [] }>()

const PER_PAGE = 10
const page = ref(1)
const selectedAppointment = ref<AppointmentHistoryItem | null>(null)
const markingId = ref<string | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(props.history.length / PER_PAGE)))
const paginatedHistory = computed(() => props.history.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))

watch(() => props.history, () => { page.value = 1 })

async function handleMark(id: string, attended: boolean) {
  markingId.value = id
  try {
    await props.onMarkAttendance(id, attended)
  } finally {
    markingId.value = null
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
    attended: s.attended,
    cancellation_reason: s.cancellation_reason,
  }
})
</script>

<template>
  <ModalShell :title="`Appointment history (${history.length})`" @close="emit('close')">
    <div class="overflow-y-auto flex-1">
      <div v-if="loading" class="flex items-center justify-center gap-2.5 py-8">
        <Spinner />
        <span class="text-xs text-muted-foreground">Loading history...</span>
      </div>

      <div v-else-if="error" class="flex flex-col items-center gap-4 py-12 px-6">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
          <rect x="14" y="18" width="44" height="44" rx="6" class="fill-amber-200/70" stroke="#d97706" stroke-width="1.5" stroke-linejoin="round" />
          <line x1="22" y1="30" x2="50" y2="30" class="stroke-amber-300" stroke-width="2" stroke-linecap="round" />
          <line x1="22" y1="38" x2="44" y2="38" class="stroke-amber-300" stroke-width="2" stroke-linecap="round" />
          <line x1="22" y1="46" x2="38" y2="46" class="stroke-amber-300" stroke-width="2" stroke-linecap="round" />
          <circle cx="56" cy="18" r="10" class="fill-amber-100" stroke="#d97706" stroke-width="1.5" />
          <path d="M56 14V18H60" class="stroke-amber-500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="56" cy="18" r="2" class="fill-amber-400" />
        </svg>
        <div class="text-center space-y-1">
          <p class="text-sm font-semibold text-amber-800">Oops! Something went wrong</p>
          <p class="text-xs text-amber-600/80 max-w-xs mx-auto">{{ error }}</p>
        </div>
        <button
          v-if="onRetry"
          type="button"
          class="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100/80 hover:bg-amber-200/60 rounded-lg px-4 py-2 transition-colors"
          @click="onRetry"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Try again
        </button>
      </div>

      <div v-else-if="history.length === 0" class="flex flex-col items-center gap-2 py-10 px-4">
        <p class="text-xs text-muted-foreground">No past appointments</p>
      </div>

      <template v-else>
        <div class="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10">
              <tr class="bg-muted/20 border-b border-foreground/5">
                <th class="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Doctor</th>
                <th class="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Date</th>
                <th class="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Time</th>
                <th class="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in paginatedHistory"
                :key="item.id"
                class="border-b border-foreground/5 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                @click="selectedAppointment = item"
              >
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <Avatar size="default">
                      <AvatarFallback :class="`text-sm font-semibold ${getAvatarColor(item.doctor_name).bg} ${getAvatarColor(item.doctor_name).text}`">
                        {{ item.doctor_name.split(' ').map((n) => n[0]).join('') }}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p class="font-medium text-foreground text-sm">Dr. {{ item.doctor_name }}</p>
                      <p class="text-[11px] text-muted-foreground">{{ item.specialization }}</p>
                      <p v-if="item.notes" class="text-[11px] text-muted-foreground/60 italic mt-0.5 sm:hidden">{{ item.notes }}</p>
                    </div>
                  </div>
                  <p v-if="item.notes" class="text-[11px] text-muted-foreground/60 italic mt-1.5 hidden sm:block">{{ item.notes }}</p>
                </td>
                <td class="px-5 py-3.5 text-foreground">{{ item.slot_date }}</td>
                <td class="px-5 py-3.5 text-muted-foreground">{{ formatTime(item.start_time) }}</td>
                <td class="px-5 py-3.5 text-right">
                  <Badge v-if="item.status === 'cancelled'" variant="outline" class="text-[10px] text-rose-600 border-rose-200 bg-rose-50">Cancelled</Badge>
                  <Badge v-else-if="item.attended === true" variant="outline" class="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-1">
                    <HugeIcon :icon="CheckmarkCircle02Icon" :stroke-width="2" class="size-3" />
                    Attended
                  </Badge>
                  <Badge v-else-if="item.attended === false" variant="outline" class="text-[10px] border-rose-300 text-rose-700 bg-rose-50 gap-1">
                    <HugeIcon :icon="Cancel01Icon" :stroke-width="2" class="size-3" />
                    Missed
                  </Badge>
                  <span v-else-if="markingId === item.id" class="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                    <Spinner />
                    Updating...
                  </span>
                  <div v-else class="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      class="text-xs sm:text-sm font-medium text-emerald-600 underline-offset-2 hover:underline transition-colors py-1.5 px-1"
                      @click.stop="handleMark(item.id, true)"
                    >
                      Attended
                    </button>
                    <button
                      type="button"
                      class="text-xs sm:text-sm font-medium text-rose-600 underline-offset-2 hover:underline transition-colors py-1.5 px-1"
                      @click.stop="handleMark(item.id, false)"
                    >
                      Missed
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
      </template>
    </div>
  </ModalShell>

  <AppointmentDetailModal
    v-if="selectedAsDetail"
    :appointment="selectedAsDetail"
    @close="selectedAppointment = null"
  />
</template>
