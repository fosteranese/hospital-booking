<script setup lang="ts">
// 'review' (returning-patient dashboard) is real as of Milestone 5. The
// identify/verify split (replacing the old single 'auth' step/AuthFlow.vue)
// is the UX-audit fork: new patients browse doctor/datetime before verifying,
// returning patients verify first exactly as before. See booking store's
// completeIdentify() and the plan's fork writeup for the full reasoning.
import { motion } from 'motion-v'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const booking = useBookingStore()
const auth = useAuthStore()
const api = useApi()

function signOut() {
  if (auth.token) api.invalidateToken(auth.token).catch(() => {})
  booking.resetAll()
}

// Accessibility audit finding: the wizard had no signal at all for
// screen-reader users when a step transition happened — sighted users get
// the slide animation, everyone else got silence. One polite live region,
// updated with a human-readable step name.
const stepAnnouncement: Record<string, string> = {
  identify: 'Sign in',
  doctor: 'Choose your doctor',
  datetime: 'Choose a date and time',
  verify: 'Enter verification code',
  patient: 'Your details',
  review: 'Your appointments',
  confirm: 'Confirm booking',
  success: 'Appointment booked',
}
</script>

<template>
  <main class="flex-1 overflow-y-auto transition-all duration-500 ease-in-out bg-gradient-to-b from-amber-50/30 via-rose-50/10 via-white to-primary/[0.03]">
    <span class="sr-only" role="status" aria-live="polite">{{ stepAnnouncement[booking.step] }}</span>
    <div class="flex min-h-full min-w-0">
      <div
        :class="cn(
          'flex flex-col items-center justify-center flex-1 min-w-0 p-5 sm:p-8 lg:p-10 mx-auto',
          ['identify', 'verify', 'success'].includes(booking.step) ? 'max-w-xl' : 'max-w-2xl'
        )"
      >
        <div class="w-full space-y-2">
          <Button
            v-if="booking.step === 'review'"
            variant="ghost"
            class="h-10 text-muted-foreground hover:text-destructive"
            @click="signOut"
          >
            Sign out
          </Button>
          <Button
            v-else-if="booking.step !== 'identify' && booking.step !== 'success'"
            variant="ghost"
            class="-ml-2 h-10 text-muted-foreground hover:text-foreground"
            @click="booking.goBack"
          >
            <HugeIcon :icon="ArrowLeft01Icon" :stroke-width="2" class="size-4 mr-1" />
            Back
          </Button>

          <!--
            No AnimatePresence here — confirmed in M3 that motion-v's
            AnimatePresence can stall indefinitely on the second+ key change
            (old content frozen in its "center" state, new content never
            mounts; store/URL state is correct throughout, so it's a
            render-layer bug, not a logic bug). Vue's own `:key` on this
            motion.div still forces a clean remount per step (triggering the
            initial->animate enter animation freshly each time); the only
            loss versus AnimatePresence is the coordinated exit-before-enter
            fade on the outgoing panel.
          -->
          <motion.div
            :key="booking.step"
            :initial="{ opacity: 0, x: booking.direction * 24 }"
            :animate="{ opacity: 1, x: 0 }"
            :transition="{ duration: 0.2, ease: 'easeInOut' }"
          >
            <IdentifyStep v-if="booking.step === 'identify'" />

            <VerifyStep v-else-if="booking.step === 'verify'" @verified="booking.handleVerified" />

            <ExistingPatientReview
              v-else-if="booking.step === 'review' && booking.existingPatient"
              :patient="booking.existingPatient"
              :last-doctor="booking.lastDoctor"
              :doctor-count="booking.doctorCount"
              :upcoming-appointments="booking.upcomingAppointments"
              :upcoming-loading="booking.upcomingLoading"
              :upcoming-error="booking.upcomingError"
              @retry-upcoming="booking.fetchUpcoming"
              @rebook-with-last-doctor="booking.handleRebookWithLastDoctor"
              @change-doctor="booking.handleChangeDoctor"
              @reschedule-time="booking.handleRescheduleTime"
              @reschedule-doctor="booking.handleRescheduleDoctor"
              @cancel-appointment="booking.handleCancelAppointment"
              @patient-updated="booking.handlePatientUpdated"
            />

            <PatientForm
              v-else-if="booking.step === 'patient'"
              :default-first-name="booking.patientFirstName"
              :default-last-name="booking.patientLastName"
              :default-phone="booking.patientPhone || (auth.otpIdentifier && !auth.otpIdentifier.includes('@') ? auth.otpIdentifier : '')"
              :default-email="booking.patientEmail || (auth.otpIdentifier && auth.otpIdentifier.includes('@') ? auth.otpIdentifier : '')"
              :otp-identifier="auth.otpIdentifier"
              @complete="booking.handlePatientComplete"
            />

            <div v-else-if="booking.step === 'doctor'" class="space-y-3">
              <div class="relative">
                <DoctorSelect :exclude-doctor-id="booking.rescheduling?.excludeDoctorId" @select="booking.handleDoctorSelect" />
                <LoadingOverlay :loading="booking.loading" message="Updating doctor..." variant="inset" />
              </div>
              <p v-if="booking.isReschedule && !booking.rescheduling?.doctorId" class="text-xs text-muted-foreground text-center">
                Your current time slot will be kept. Only the doctor will change.
              </p>
              <ErrorMessage v-if="booking.error" :message="booking.error" />
            </div>

            <BookingForm
              v-else-if="booking.step === 'datetime'"
              :doctor-id="booking.doctorId"
              :default-date="booking.bookDate"
              :patient-id="booking.existingPatient?.id"
              @select-slot="booking.handleSlotSelect"
            />

            <AppointmentSummary
              v-else-if="booking.step === 'confirm'"
              :doctor-name="booking.doctorName"
              :date="booking.bookDate"
              :time="booking.bookTime"
              :patient-name="`${booking.patientFirstName} ${booking.patientLastName}`"
              v-model:notes="booking.notes"
              :loading="booking.loading"
              :error="booking.error"
              @confirm="booking.handleConfirm"
            />

            <SuccessStep
              v-else-if="booking.step === 'success'"
              :doctor-name="booking.doctorName"
              :book-date="booking.bookDate"
              :book-time="booking.bookTime"
              :book-end-time="booking.bookEndTime"
              :patient-first-name="booking.patientFirstName"
              :patient-last-name="booking.patientLastName"
              :is-reschedule="booking.isReschedule"
              @view-bookings="booking.goToStep('review')"
            />
          </motion.div>
        </div>
      </div>
    </div>
  </main>
</template>
