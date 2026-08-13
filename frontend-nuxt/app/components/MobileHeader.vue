<script setup lang="ts">
// Compact mobile equivalent of LeftPanel: mark + wordmark always, plus a
// lightweight step-progress bar once the wizard is past the identify screen.
// See plan §3.1. Branch-aware like LeftPanel — see that file's comment for
// why the new-patient and returning-patient sequences differ.
import { Hospital01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ step: string; preBrowsed?: boolean }>(), { preBrowsed: false })
const clinic = useClinicStore()

const returningSteps = ['identify', 'details', 'doctor', 'datetime', 'confirm'] as const
const newPatientSteps = ['identify', 'doctor', 'datetime', 'details', 'confirm'] as const

const displaySteps = computed(() => (props.preBrowsed ? newPatientSteps : returningSteps))

function displayIndex(step: string): number {
  if (step === 'success') return displaySteps.value.length - 1
  if (props.preBrowsed) {
    if (step === 'doctor') return 1
    if (step === 'datetime') return 2
    if (step === 'verify' || step === 'patient') return 3
    if (step === 'confirm') return 4
    return 0
  }
  if (step === 'review' || step === 'patient' || step === 'verify') return 1
  if (step === 'doctor') return 2
  if (step === 'datetime') return 3
  if (step === 'confirm') return 4
  return 0
}

const showProgress = computed(() => props.step !== 'identify')
const currentIdx = computed(() => displayIndex(props.step))
</script>

<template>
  <header class="lg:hidden bg-gradient-to-r from-green-900 via-green-800 to-green-800 px-4 sm:px-6 py-4">
    <div class="flex items-center gap-2.5">
      <div class="size-8 rounded-lg bg-white/20 flex items-center justify-center shadow-sm">
        <HugeIcon :icon="Hospital01Icon" :stroke-width="2" class="size-4 text-emerald-300" />
      </div>
      <span class="text-base font-extrabold text-white tracking-tight">{{ clinic.clinicName || 'Mediport' }}</span>
    </div>

    <div v-if="showProgress" class="flex items-center gap-1.5 mt-4" role="progressbar" :aria-valuenow="currentIdx + 1" :aria-valuemax="displaySteps.length">
      <div
        v-for="(_, i) in displaySteps"
        :key="i"
        :class="cn(
          'h-1 flex-1 rounded-full transition-colors',
          i <= currentIdx ? 'bg-emerald-400' : 'bg-white/15'
        )"
      />
    </div>

    <!--
      Below lg, LeftPanel's whole warm-welcome pane (tagline + "Since 2010"
      trust marker) never renders at all -- MobileHeader used to show nothing
      but the mark and wordmark here, which is most real traffic (Zocdoc: 70%+
      of bookings are mobile) landing on a compact bar with an empty page
      below it. A short version of the same messaging, shown only on the
      first screen (once the wizard is underway the progress bar earns the
      space instead).
    -->
    <p v-if="!showProgress" class="mt-3 text-sm text-white/75 leading-snug max-w-sm">
      Compassionate fertility care, tailored to your journey.
    </p>
  </header>
</template>
