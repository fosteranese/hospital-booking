import type { Patient, LastDoctorInfo, UpcomingAppointment } from '@/lib/api'
import { saveBooking, loadBooking, clearBooking } from '@/lib/booking-storage'

// 'identify' (phone/email entry) and 'verify' (OTP) are two distinct steps —
// they used to be a single 'auth' step, but the UX-audit fork (see plan)
// splits them apart so a *new* patient can browse doctor/datetime between
// them, while a *returning* patient still goes straight from one to the
// other exactly as before. Which path a session takes is decided once, at
// 'identify', by an unauthenticated existence check — see completeIdentify().
export const STEPS = ['identify', 'doctor', 'datetime', 'verify', 'patient', 'review', 'confirm', 'success'] as const
export type Step = (typeof STEPS)[number]

function stepIndex(s: Step) {
  return STEPS.indexOf(s)
}

export interface ReschedulingState {
  appointmentId: string
  doctorId?: string
  doctorName?: string
  excludeDoctorId?: string
}

interface BookingSnapshot {
  token: string
  userRole: string
  otpIdentifier: string
  preBrowsed: boolean
  patientFirstName: string
  patientLastName: string
  patientPhone: string
  patientEmail: string
  notes: string
  existingPatient: Patient | null
  lastDoctor: LastDoctorInfo | null
  doctorCount: number
  doctorId: string | null
  doctorName: string
  slotId: string
  bookDate: string
  bookTime: string
  bookEndTime: string
  rescheduling: ReschedulingState | null
  upcomingAppointments: UpcomingAppointment[]
}

// Replaces BookAppointment.tsx's ~20 useState calls + the step machine. The
// biggest behavioral change from the React version: persistence is imperative
// (persistNow(), called explicitly at the end of every action) instead of a
// reactive "save effect" — the React app had a documented bug (item 37,
// "logged out after OTP") caused by two effects needing to run in a specific
// declaration order; Vue has no equivalent ordering guarantee to lean on, so
// the ordering hazard is removed by not having a second scheduler involved.
// See plan §2.5.
export const useBookingStore = defineStore('booking', () => {
  const step = ref<Step>('identify')
  const direction = ref(1)

  // True for the rest of a session once 'identify' determines the visitor is
  // new (no account found) and routes them to browse doctor/datetime before
  // verifying. False for returning patients and for the reschedule sub-flows
  // (both of which are already authenticated before touching 'doctor').
  // Drives: where handleSlotSelect/handlePatientComplete/goBack send you next,
  // and which of the two step-label sequences LeftPanel displays.
  const preBrowsed = ref(false)

  const patientFirstName = ref('')
  const patientLastName = ref('')
  const patientPhone = ref('')
  const patientEmail = ref('')
  const notes = ref('')
  const existingPatient = ref<Patient | null>(null)
  const lastDoctor = ref<LastDoctorInfo | null>(null)
  const doctorCount = ref(0)
  const doctorId = ref<string | null>(null)
  const doctorName = ref('Auto-assigned')
  const slotId = ref('')
  const bookDate = ref('')
  const bookTime = ref('')
  const bookEndTime = ref('')
  const loading = ref(false)
  const error = ref('')
  const upcomingAppointments = ref<UpcomingAppointment[]>([])
  const upcomingLoading = ref(false)
  const upcomingError = ref('')
  const rescheduling = ref<ReschedulingState | null>(null)
  const prevStepBeforeDatetime = ref<Step | null>(null)

  // Plain internals — guard fetchUpcoming's dedup/refresh-once behavior, not
  // meant to be reactive.
  let fetchedOnMount = false
  let fetchingRef = false

  const isReschedule = computed(() => rescheduling.value !== null)

  const auth = useAuthStore()
  const router = useRouter()

  function persistNow() {
    if (!import.meta.client) return
    if (step.value === 'identify') {
      auth.clearAuth()
      clearBooking()
    } else {
      const snapshot: BookingSnapshot = {
        token: auth.token,
        userRole: auth.userRole,
        otpIdentifier: auth.otpIdentifier,
        preBrowsed: preBrowsed.value,
        patientFirstName: patientFirstName.value,
        patientLastName: patientLastName.value,
        patientPhone: patientPhone.value,
        patientEmail: patientEmail.value,
        notes: notes.value,
        existingPatient: existingPatient.value,
        lastDoctor: lastDoctor.value,
        doctorCount: doctorCount.value,
        doctorId: doctorId.value,
        doctorName: doctorName.value,
        slotId: slotId.value,
        bookDate: bookDate.value,
        bookTime: bookTime.value,
        bookEndTime: bookEndTime.value,
        rescheduling: rescheduling.value,
        upcomingAppointments: upcomingAppointments.value,
      }
      saveBooking(snapshot)
    }
    router.replace({ query: step.value === 'identify' ? {} : { step: step.value } })
  }

  function goToStep(s: Step) {
    direction.value = stepIndex(s) > stepIndex(step.value) ? 1 : -1
    if (s === 'datetime') prevStepBeforeDatetime.value = step.value
    step.value = s
    persistNow()
  }

  function goBack() {
    direction.value = -1
    switch (step.value) {
      case 'doctor':
        if (preBrowsed.value) {
          step.value = 'identify'
        } else if (isReschedule.value || existingPatient.value) {
          step.value = 'review'
        } else {
          // Defensive fallback only — every live path now reaches 'doctor'
          // either pre-browsed (not yet authenticated) or from 'review'
          // (reschedule/change-doctor). Nothing should hit this branch.
          step.value = 'patient'
        }
        rescheduling.value = null
        break
      case 'datetime':
        step.value = prevStepBeforeDatetime.value === 'doctor' ? 'doctor' : 'review'
        rescheduling.value = null
        break
      case 'verify':
        step.value = preBrowsed.value ? 'datetime' : 'identify'
        break
      case 'patient':
        step.value = preBrowsed.value ? 'verify' : 'identify'
        break
      case 'review':
        step.value = 'identify'
        break
      case 'confirm':
        step.value = preBrowsed.value ? 'patient' : 'datetime'
        break
    }
    persistNow()
  }

  function resetAll() {
    clearBooking()
    auth.clearAuth()
    step.value = 'identify'
    direction.value = 1
    preBrowsed.value = false
    patientFirstName.value = ''
    patientLastName.value = ''
    patientPhone.value = ''
    patientEmail.value = ''
    existingPatient.value = null
    lastDoctor.value = null
    doctorCount.value = 0
    doctorId.value = null
    doctorName.value = 'Auto-assigned'
    slotId.value = ''
    bookDate.value = ''
    bookTime.value = ''
    bookEndTime.value = ''
    notes.value = ''
    loading.value = false
    error.value = ''
    upcomingAppointments.value = []
    upcomingLoading.value = false
    upcomingError.value = ''
    rescheduling.value = null
    prevStepBeforeDatetime.value = null
    router.replace({ query: {} })
  }

  // SSR-safe rehydration — server always renders step='identify' (no storage
  // access possible there, which is also exactly the content SSR exists for).
  // Called from onMounted in pages/index.vue. See plan §2.6.
  function clearSession() {
    const oldToken = auth.token
    auth.clearAuth()
    clearBooking()
    step.value = 'identify'
    direction.value = 1
    preBrowsed.value = false
    if (oldToken) {
      useApi().invalidateToken(oldToken).catch(() => {})
    }
    // auth.clearAuth()/clearBooking() above already clear the storage side —
    // this just resets the visible URL to match (found as a real gap in M3:
    // without it, a hard refresh at a stale ?step=... would show the auth
    // screen while the address bar kept the old step, confusing on its own
    // and indistinguishable from an actual bug when debugging).
    router.replace({ query: {} })
  }

  async function hydrate() {
    if (!import.meta.client) return
    // Reads the raw URL instead of useRoute().query — confirmed in M3 that
    // the latter isn't reliably populated yet on the very first client-side
    // onMounted after SSR hydration (a Vue Router hydration race), which
    // made this evaluate as if the step param were missing even when the
    // address bar had it. The React original had the same concern and used
    // window.location.search directly for its equivalent check.
    const s = new URLSearchParams(window.location.search).get('step') as Step | null
    const shouldClear = !s || !STEPS.includes(s) || s === 'identify'

    if (shouldClear) {
      clearSession()
      return
    }

    // A valid, non-identify step with no snapshot to restore (e.g.
    // sessionStorage was cleared, or a previous session ended mid-write) is
    // equivalent to a fresh session — route it through the same cleanup as
    // shouldClear rather than just flipping step.value, which would leave
    // the URL and any stale token unclean (a real gap found in M3: the URL
    // stayed on the old ?step=... and the token was never cleared when this
    // branch didn't fully reset state).
    const data = loadBooking<BookingSnapshot>()
    if (!data) {
      clearSession()
      return
    }

    let resolved: Step = s
    if (s === 'success' || s === 'confirm') {
      if (!data.slotId || !data.doctorId) resolved = 'datetime'
    } else if (s === 'verify') {
      // 'verify' by definition precedes having a token — the only thing it
      // truly needs is knowing who to verify.
      if (!data.otpIdentifier) {
        clearSession()
        return
      }
    } else if (s === 'review' || s === 'patient') {
      if (!data.token) {
        // Same as the shouldClear/no-snapshot cases above: a review/patient
        // URL with no token in the snapshot isn't a state to resume into,
        // it's a stale link — route through the same full cleanup rather
        // than just flipping step.value, which would leave stale storage
        // and the old URL behind while showing the identify screen.
        clearSession()
        return
      }
    }
    // 'doctor'/'datetime' have no extra requirement on top of a valid
    // snapshot existing — a pre-browsed (not-yet-authenticated) new patient
    // reloading mid-browse must be able to resume with no token at all, which
    // is the entire point of letting them browse before verifying.

    step.value = resolved
    direction.value = 0
    preBrowsed.value = data.preBrowsed ?? false
    patientFirstName.value = data.patientFirstName ?? ''
    patientLastName.value = data.patientLastName ?? ''
    patientPhone.value = data.patientPhone ?? ''
    patientEmail.value = data.patientEmail ?? ''
    notes.value = data.notes ?? ''
    existingPatient.value = data.existingPatient ?? null
    lastDoctor.value = data.lastDoctor ?? null
    doctorCount.value = data.doctorCount ?? 0
    doctorId.value = data.doctorId ?? null
    doctorName.value = data.doctorName ?? 'Auto-assigned'
    slotId.value = data.slotId ?? ''
    bookDate.value = data.bookDate ?? ''
    bookTime.value = data.bookTime ?? ''
    bookEndTime.value = data.bookEndTime ?? ''
    rescheduling.value = data.rescheduling ?? null
    upcomingAppointments.value = data.upcomingAppointments ?? []
    if (data.token) auth.setToken(data.token)
    if (data.userRole) auth.setUserRole(data.userRole)
    if (data.otpIdentifier) auth.setOtpIdentifier(data.otpIdentifier)

    // Sync the URL to the resolved step, not the requested one — e.g. a
    // ?step=confirm with no doctorId resolves to 'datetime', and without this
    // the address bar would keep saying ?step=confirm (stale but harmless,
    // since the rendered content is correct either way) until the next
    // action calls persistNow() on its own.
    if (resolved !== s) persistNow()
  }

  // Mirrors the React source's separate effect (`useEffect` on
  // `[step, existingPatient, tokenFromContext]`) that fires whenever `step`
  // becomes 'review' through *any* path — not just the reload/rehydrate case.
  // Missing this exact watcher was a real bug found in M5: a live OTP verify
  // landing on 'review' (via handleVerified -> goToStep('review')) never
  // fetched upcoming appointments, so a returning patient with a real
  // upcoming appointment saw "No upcoming appointments" until their next
  // page reload. This single watcher now covers both the live-navigation
  // and the hydrate()-restores-into-review cases, so hydrate() no longer
  // needs its own explicit call.
  watch(step, (s) => {
    if (s === 'review' && existingPatient.value && auth.token) {
      fetchUpcoming()
    }
  })

  function fetchUpcoming() {
    if (!existingPatient.value || !auth.token || fetchingRef) return
    const api = useApi()

    const doFetch = (useToken: string) => {
      fetchingRef = true
      upcomingLoading.value = true
      upcomingError.value = ''
      api
        .getUpcomingAppointments(existingPatient.value!.id, useToken)
        .then((data) => {
          if (step.value !== 'review') return
          upcomingAppointments.value = data
          upcomingError.value = ''
          persistNow()
        })
        .catch((err: Error) => {
          if (step.value !== 'review') return
          upcomingAppointments.value = []
          if (err.message.includes('expired') || err.message.includes('Invalid')) {
            resetAll()
            return
          }
          upcomingError.value = err.message
        })
        .finally(() => {
          if (step.value === 'review') upcomingLoading.value = false
          fetchingRef = false
        })
    }

    if (!fetchedOnMount) {
      fetchedOnMount = true
      auth
        .refresh()
        .then((newToken) => newToken || auth.token)
        .then((t) => doFetch(t))
        .catch(() => resetAll())
    } else {
      doFetch(auth.token)
    }
  }

  // Called from IdentifyStep once the unauthenticated existence check
  // (GET /patients/check, public) comes back. This is the one decision that
  // drives the whole fork: an existing account goes straight to 'verify'
  // (identical to the old single 'auth' step's behavior); no match sends them
  // to browse doctor/datetime first and defers 'verify' until they've picked
  // a slot worth committing to.
  function completeIdentify(identifier: string, isReturning: boolean) {
    auth.setOtpIdentifier(identifier)
    preBrowsed.value = !isReturning
    goToStep(isReturning ? 'verify' : 'doctor')
  }

  async function handleVerified(newToken: string, identifier: string, role: string) {
    auth.setAll(newToken, role, identifier)
    const api = useApi()

    let patientData: Patient
    try {
      patientData = await api.lookupPatient(identifier, newToken)
    } catch {
      // No account found — expected for the pre-browsed path (that's what
      // routed them here in the first place). Pre-fill whichever contact
      // field they just verified with, then collect the rest.
      if (identifier.includes('@')) patientEmail.value = identifier
      else patientPhone.value = identifier
      goToStep('patient')
      return
    }

    // An account exists after all. If we got here via the pre-browsed path,
    // that means the earlier unauthenticated check was stale (a real but rare
    // race — e.g. booked from another tab in between). The safe move is to
    // discard the doctor/slot they picked blind — it was never gap-filtered
    // or checked against their real upcoming-appointment count — and hand
    // them their actual dashboard instead, same as any returning-patient login.
    if (preBrowsed.value) {
      doctorId.value = null
      doctorName.value = 'Auto-assigned'
      slotId.value = ''
      bookDate.value = ''
      bookTime.value = ''
      bookEndTime.value = ''
      preBrowsed.value = false
    }

    existingPatient.value = patientData
    patientFirstName.value = patientData.first_name
    patientLastName.value = patientData.last_name
    patientPhone.value = patientData.phone
    patientEmail.value = patientData.email

    try {
      const [lastDoc, doctors] = await Promise.all([
        api.getLastDoctor(patientData.id, newToken),
        api.getDoctors(),
      ])
      lastDoctor.value = lastDoc
      doctorCount.value = doctors.length
      if (doctors.length === 1 && doctors[0]) {
        doctorId.value = doctors[0].id
        doctorName.value = `Dr. ${doctors[0].first_name} ${doctors[0].last_name}`
      }
    } catch {
      // secondary lookups failed — show review anyway, user can still book
    }

    goToStep('review')
  }

  function handlePatientComplete(firstName: string, lastName: string, phone: string, email: string) {
    patientFirstName.value = firstName
    patientLastName.value = lastName
    patientPhone.value = phone
    patientEmail.value = email
    // Pre-browsed patients already picked a doctor + slot before verifying —
    // this is the last step, straight to confirm. Anyone else landing here
    // (the lookupPatient-race fallback above) hasn't picked either yet.
    goToStep(preBrowsed.value ? 'confirm' : 'doctor')
  }

  function handleRebookWithLastDoctor(docId: string, docName: string) {
    doctorId.value = docId
    doctorName.value = `Dr. ${docName}`
    goToStep('datetime')
  }

  function handleChangeDoctor() {
    goToStep('doctor')
  }

  function handleRescheduleTime(appt: UpcomingAppointment) {
    rescheduling.value = { appointmentId: appt.id, doctorId: appt.doctor_id }
    doctorId.value = appt.doctor_id
    doctorName.value = `Dr. ${appt.doctor_name}`
    goToStep('datetime')
  }

  function handleRescheduleDoctor(appt: UpcomingAppointment) {
    rescheduling.value = { appointmentId: appt.id, excludeDoctorId: appt.doctor_id }
    goToStep('doctor')
  }

  async function handleCancelAppointment(appointmentId: string, reason?: string) {
    const api = useApi()
    try {
      await api.cancelAppointment(appointmentId, { cancellation_reason: reason || '' }, auth.token)
      upcomingAppointments.value = upcomingAppointments.value.filter((a) => a.id !== appointmentId)
      persistNow()
    } catch (err: any) {
      error.value = err.message || 'Failed to cancel appointment. Please try again.'
    }
  }

  function handlePatientUpdated(updated: Patient) {
    existingPatient.value = updated
    patientFirstName.value = updated.first_name
    patientLastName.value = updated.last_name
    patientPhone.value = updated.phone
    patientEmail.value = updated.email
    persistNow()
  }

  async function handleDoctorSelect(id: string | null, name?: string) {
    doctorId.value = id
    doctorName.value = name || 'Auto-assigned'

    if (isReschedule.value && !rescheduling.value?.doctorId) {
      if (!id) return
      loading.value = true
      error.value = ''
      const api = useApi()
      try {
        await api.changeDoctor(rescheduling.value!.appointmentId, { doctor_id: id }, auth.token)
        rescheduling.value = null
        goToStep('review')
      } catch (err: any) {
        error.value = err.message || 'Failed to change doctor. Please try again.'
      } finally {
        loading.value = false
      }
      return
    }

    goToStep('datetime')
  }

  function handleSlotSelect(id: string, date: string, time: string, endTime: string, selectedDoctorId?: string) {
    slotId.value = id
    bookDate.value = date
    bookTime.value = time
    bookEndTime.value = endTime
    if (selectedDoctorId) doctorId.value = selectedDoctorId
    // Pre-browsed patients haven't verified yet — that's next, not confirm.
    goToStep(preBrowsed.value ? 'verify' : 'confirm')
  }

  async function handleConfirm() {
    loading.value = true
    error.value = ''
    const api = useApi()
    try {
      if (isReschedule.value) {
        await api.rescheduleAppointment(
          rescheduling.value!.appointmentId,
          { slot_id: slotId.value, doctor_id: doctorId.value ?? undefined },
          auth.token
        )
      } else {
        let pid = existingPatient.value?.id
        if (!pid) {
          const created = await api.createPatient(
            { first_name: patientFirstName.value, last_name: patientLastName.value, phone: patientPhone.value, email: patientEmail.value },
            auth.token
          )
          pid = created.id
          // A pre-browsed patient has no existingPatient set until now (they
          // were never looked up — that's the whole point of the fork). Set
          // it here so 'success' -> 'review' (via SuccessStep's "View your
          // bookings") has a real patient to show instead of hitting
          // BookingWizard's `v-else-if="step === 'review' && existingPatient"`
          // guard and rendering nothing. doctorCount stays at its default
          // (0) — ExistingPatientReview's "Book an appointment" vs
          // "Continue" label and rebook shortcut both degrade gracefully
          // with no lastDoctor/doctorCount set, same as any other patient
          // whose secondary lookups haven't run yet.
          existingPatient.value = created
        }
        await api.createAppointment(
          { doctor_id: doctorId.value!, slot_id: slotId.value, patient_id: pid, notes: notes.value || undefined },
          auth.token
        )
      }
      goToStep('success')
    } catch (err: any) {
      error.value = err.message || 'Booking failed. Please try again.'
    } finally {
      loading.value = false
    }
  }

  return {
    step,
    direction,
    preBrowsed,
    patientFirstName,
    patientLastName,
    patientPhone,
    patientEmail,
    notes,
    existingPatient,
    lastDoctor,
    doctorCount,
    doctorId,
    doctorName,
    slotId,
    bookDate,
    bookTime,
    bookEndTime,
    loading,
    error,
    upcomingAppointments,
    upcomingLoading,
    upcomingError,
    rescheduling,
    prevStepBeforeDatetime,
    isReschedule,
    goToStep,
    goBack,
    resetAll,
    hydrate,
    persistNow,
    fetchUpcoming,
    completeIdentify,
    handleVerified,
    handlePatientComplete,
    handleRebookWithLastDoctor,
    handleChangeDoctor,
    handleRescheduleTime,
    handleRescheduleDoctor,
    handleCancelAppointment,
    handlePatientUpdated,
    handleDoctorSelect,
    handleSlotSelect,
    handleConfirm,
  }
})
