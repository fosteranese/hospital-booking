<script setup lang="ts">
import { motion } from 'motion-v'
import {
  Mail01Icon,
  CallIcon,
  Appointment01Icon,
  ArrowRight02Icon,
  Time02Icon,
  Edit01Icon,
} from '@hugeicons/core-free-icons'
import type { Patient, LastDoctorInfo, UpcomingAppointment, AppointmentHistoryItem } from '@/lib/api'

const props = defineProps<{
  patient: Patient
  lastDoctor: LastDoctorInfo | null
  doctorCount: number
  upcomingAppointments: UpcomingAppointment[]
  upcomingLoading?: boolean
  upcomingError?: string
}>()

const emit = defineEmits<{
  retryUpcoming: []
  rebookWithLastDoctor: [doctorId: string, doctorName: string]
  changeDoctor: []
  rescheduleTime: [appt: UpcomingAppointment]
  rescheduleDoctor: [appt: UpcomingAppointment]
  cancelAppointment: [appointmentId: string, reason?: string]
  patientUpdated: [patient: Patient]
}>()

const auth = useAuthStore()
const api = useApi()

const cancellingId = ref<string | null>(null)
const pendingCancelId = ref<string | null>(null)
const isCancelling = ref(false)
const showAllModal = ref(false)
const showEditModal = ref(false)
const history = ref<AppointmentHistoryItem[]>([])
const historyLoading = ref(false)
const historyError = ref('')
const showHistoryModal = ref(false)

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function fetchHistory() {
  historyLoading.value = true
  historyError.value = ''
  api
    .getAppointmentHistory(props.patient.id, auth.token)
    .then((data) => { history.value = data; historyError.value = '' })
    .catch((err: Error) => { history.value = []; historyError.value = err.message })
    .finally(() => { historyLoading.value = false })
}

watch(showHistoryModal, (open) => { if (open) fetchHistory() })

const cancellingAppt = computed(() => props.upcomingAppointments.find((a) => a.id === pendingCancelId.value) ?? null)

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

async function handleMarkAttendance(appointmentId: string, attended: boolean) {
  await api.markAttendance(appointmentId, { attended }, auth.token)
  history.value = history.value.map((h) => (h.id === appointmentId ? { ...h, attended } : h))
}

const soonest = computed(() => (props.upcomingAppointments.length > 0 ? props.upcomingAppointments[0]! : null))
const restCount = computed(() => props.upcomingAppointments.length - 1)
const rebookDoctor = computed(() => soonest.value ?? props.lastDoctor)
</script>

<template>
  <motion.div :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.3, ease: 'easeOut' }">
    <Card class="w-full mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader class="px-0">
        <CardTitle class="text-xl text-foreground">Welcome back, {{ patient.first_name }}</CardTitle>
        <CardDescription>Great to see you again — here's your information</CardDescription>
      </CardHeader>
      <CardContent class="px-0 space-y-5">
        <Card size="sm" class="shadow-sm shadow-black/[0.03] border">
          <CardContent>
            <div class="flex items-center gap-3">
              <Avatar class="size-11 shrink-0">
                <AvatarFallback class="bg-slate-200 text-sm font-semibold text-slate-700">
                  {{ getInitials(patient.first_name, patient.last_name) }}
                </AvatarFallback>
              </Avatar>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm font-semibold leading-tight">{{ patient.first_name }} {{ patient.last_name }}</h3>
                  <Badge variant="secondary" class="text-[10px] px-1.5 py-0 leading-4">Returning</Badge>
                </div>
                <div class="flex items-center gap-3 flex-wrap mt-0.5 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1 min-w-0">
                    <HugeIcon :icon="Mail01Icon" :stroke-width="2" class="size-3 shrink-0" />
                    <span class="truncate">{{ patient.email }}</span>
                  </span>
                  <span class="flex items-center gap-1 shrink-0">
                    <HugeIcon :icon="CallIcon" :stroke-width="2" class="size-3 shrink-0" />
                    {{ patient.phone }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <Button variant="outline" size="sm" class="h-7 px-2 text-xs" @click="showEditModal = true">
                  <HugeIcon :icon="Edit01Icon" :stroke-width="2" class="size-3.5" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" class="h-7 px-2 text-xs" @click="showHistoryModal = true">History</Button>
              </div>
            </div>

            <div v-if="lastDoctor" class="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-foreground/5 text-xs">
              <div class="flex items-center gap-1.5 flex-wrap min-w-0 text-muted-foreground">
                <HugeIcon :icon="Appointment01Icon" :stroke-width="2" class="size-3.5 text-primary shrink-0" />
                <span class="shrink-0">Last visit</span>
                <span class="text-foreground font-medium">Dr. {{ lastDoctor.doctor_name }}</span>
                <span class="shrink-0 whitespace-nowrap">&middot; {{ lastDoctor.last_appointment_date }} &middot; {{ lastDoctor.last_appointment_time?.slice(0, 5) }}</span>
              </div>
              <Badge variant="outline" class="text-[10px] font-normal shrink-0">{{ lastDoctor.specialization }}</Badge>
            </div>
          </CardContent>
        </Card>

        <div class="mt-6">
          <div class="space-y-3">
            <div v-if="upcomingAppointments.length > 0" class="flex items-center justify-between gap-4 min-h-5 mt-2">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <HugeIcon :icon="Time02Icon" :stroke-width="2" class="size-3.5 text-primary shrink-0" />
                Upcoming appointments
                <span class="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{{ upcomingAppointments.length }}</span>
              </p>
              <button
                v-if="restCount > 0"
                type="button"
                class="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors shrink-0"
                @click="showAllModal = true"
              >
                View all ({{ upcomingAppointments.length }})
              </button>
            </div>

            <div v-if="upcomingLoading" class="flex items-center justify-center gap-2.5 py-5">
              <Spinner />
              <span class="text-xs text-muted-foreground">Loading appointments...</span>
            </div>
            <template v-else>
              <AppointmentCard
                v-if="soonest"
                :key="soonest.id"
                :appointment="soonest"
                :cancelling="cancellingId === soonest.id"
                @reschedule-time="emit('rescheduleTime', soonest)"
                @reschedule-doctor="emit('rescheduleDoctor', soonest)"
                @cancel="pendingCancelId = soonest.id"
              />

              <div v-if="upcomingError" class="flex flex-col items-center gap-4 rounded-xl bg-amber-50/70 border border-amber-200/50 py-10 px-6">
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
                  <p class="text-xs text-amber-600/80 max-w-xs mx-auto">{{ upcomingError }}</p>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100/80 hover:bg-amber-200/60 rounded-lg px-4 py-2 transition-colors"
                  @click="emit('retryUpcoming')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                  Try again
                </button>
              </div>
              <div v-else-if="upcomingAppointments.length === 0" class="flex flex-col items-center gap-2 rounded-xl bg-white border-2 border-dashed border-foreground/10 py-10 px-4">
                <HugeIcon :icon="Appointment01Icon" :stroke-width="2" class="size-6 text-muted-foreground/40 shrink-0" />
                <p class="text-xs text-muted-foreground">No upcoming appointments</p>
                <button
                  type="button"
                  class="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors mt-1"
                  @click="showHistoryModal = true"
                >
                  View past appointments
                </button>
              </div>
            </template>
          </div>
        </div>

        <div v-if="!upcomingLoading && upcomingAppointments.length >= 3" class="flex flex-col items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/60 py-4 px-4 text-center">
          <p class="text-xs font-medium text-amber-800">
            You have {{ upcomingAppointments.length }} upcoming appointments — the maximum allowed.
          </p>
          <p class="text-[11px] text-amber-700/70">Please cancel or reschedule an existing appointment to book a new one.</p>
        </div>

        <div v-else-if="!upcomingLoading && upcomingAppointments.length < 3 && rebookDoctor" class="flex flex-col gap-3">
          <Button class="w-full h-11 text-base gap-2 shadow-xs" @click="emit('rebookWithLastDoctor', rebookDoctor.doctor_id, rebookDoctor.doctor_name)">
            Rebook with Dr. {{ rebookDoctor.doctor_name }}
            <HugeIcon :icon="ArrowRight02Icon" :stroke-width="2" class="size-4" />
          </Button>
          <Button variant="outline" class="w-full h-11 text-base bg-white" @click="emit('changeDoctor')">Choose a different doctor</Button>
        </div>

        <Button
          v-else-if="!upcomingLoading && upcomingAppointments.length === 0"
          class="w-full h-11 text-base gap-2 shadow-xs"
          @click="emit('changeDoctor')"
        >
          {{ doctorCount > 1 ? 'Book an appointment' : 'Continue' }}
          <HugeIcon :icon="ArrowRight02Icon" :stroke-width="2" class="size-4" />
        </Button>
      </CardContent>
    </Card>

    <UpcomingAppointmentsModal
      v-if="showAllModal"
      :appointments="upcomingAppointments"
      @close="showAllModal = false"
      @reschedule-time="(a) => emit('rescheduleTime', a)"
      @reschedule-doctor="(a) => emit('rescheduleDoctor', a)"
      @cancel-appointment="(id, reason) => emit('cancelAppointment', id, reason)"
    />

    <CancelAppointmentDialog
      :open="pendingCancelId !== null"
      @update:open="(v) => { if (!v) pendingCancelId = null }"
      :appointment="cancellingAppt"
      :is-cancelling="isCancelling"
      @confirm="confirmCancel"
    />

    <HistoryModal
      v-if="showHistoryModal"
      :history="history"
      :loading="historyLoading"
      :error="historyError"
      :on-retry="fetchHistory"
      :on-mark-attendance="handleMarkAttendance"
      @close="showHistoryModal = false"
    />

    <EditProfileModal
      v-if="showEditModal"
      :patient="patient"
      @close="showEditModal = false"
      @saved="(p) => emit('patientUpdated', p)"
    />
  </motion.div>
</template>
