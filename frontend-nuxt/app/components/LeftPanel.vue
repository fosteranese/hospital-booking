<script setup lang="ts">
// Desktop-only brand/step panel. Ported from the React app's LeftPanel, with
// two deliberate changes: the old version was `hidden xl:flex` (no brand
// presence at all below 1280px); breakpoint moved to `lg` (1024px), with
// MobileHeader.vue covering everything below that. See plan §3.1.
//
// Second change: the step list is now branch-aware. The UX-audit fork lets a
// new patient browse doctor/datetime before verifying, while a returning
// patient still verifies first — so 'verify' lands in a different place in
// each patient's actual journey. Showing one fixed, order-implying bubble
// list would make progress appear to jump backward for whichever branch
// didn't match it (e.g. "Sign In" lighting up again after "Choose Doctor"
// had already been marked complete). Two 5-bubble sequences instead: for a
// returning patient, identify+verify both fall under one "Sign In" bubble
// exactly as the old single 'auth' step did; for a new patient, verify folds
// into "Your Details" instead (verifying who you are is part of confirming
// your details, not a separate destination), keeping the bubble order
// monotonic with the order steps are actually visited in either case.
import { Hospital01Icon, UserIcon, Doctor01Icon, Calendar01Icon, CheckmarkCircle02Icon, LockIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ step: string; preBrowsed?: boolean; wide?: boolean }>(), { wide: false, preBrowsed: false })

const clinic = useClinicStore()

const returningSteps = [
  { label: 'Sign In', match: ['identify', 'verify'], icon: LockIcon, subtitle: 'Verify your identity' },
  { label: 'Your Details', match: ['review', 'patient'], icon: UserIcon, subtitle: 'Confirm your information' },
  { label: 'Choose Doctor', match: ['doctor'], icon: Doctor01Icon, subtitle: 'Select your specialist' },
  { label: 'Date & Time', match: ['datetime'], icon: Calendar01Icon, subtitle: 'Pick your preferred time' },
  { label: 'Confirm', match: ['confirm', 'success'], icon: CheckmarkCircle02Icon, subtitle: 'Review and book' },
]

const newPatientSteps = [
  { label: 'Sign In', match: ['identify'], icon: LockIcon, subtitle: 'Tell us who you are' },
  { label: 'Choose Doctor', match: ['doctor'], icon: Doctor01Icon, subtitle: 'Select your specialist' },
  { label: 'Date & Time', match: ['datetime'], icon: Calendar01Icon, subtitle: 'Pick your preferred time' },
  { label: 'Your Details', match: ['verify', 'patient'], icon: UserIcon, subtitle: 'Verify and confirm your information' },
  { label: 'Confirm', match: ['confirm', 'success'], icon: CheckmarkCircle02Icon, subtitle: 'Review and book' },
]

const displaySteps = computed(() => (props.preBrowsed ? newPatientSteps : returningSteps))

const currentIdx = computed(() =>
  props.step === 'success' ? displaySteps.value.length : displaySteps.value.findIndex((s) => s.match.includes(props.step))
)

function stepStatus(i: number): 'completed' | 'current' | 'upcoming' {
  if (i < currentIdx.value) return 'completed'
  if (i === currentIdx.value) return 'current'
  return 'upcoming'
}
</script>

<template>
  <aside
    :class="cn(
      'hidden lg:flex relative h-screen overflow-hidden transition-all duration-500 ease-in-out border-r border-white/5',
      wide ? 'w-[40%]' : 'w-[30%]'
    )"
  >
    <img
      src="https://mediportfertilityservices.com/_nuxt/slider-1.FULWOga4.jpg"
      alt="Mediport Fertility Clinic"
      class="absolute inset-0 w-full h-full object-cover"
    />
    <div class="absolute inset-0 bg-gradient-to-r from-green-900/95 via-green-800/92 to-green-800/90" />
    <div class="relative z-10 flex flex-col h-full px-12 py-10 animate-scale-in">
      <template v-if="step === 'identify' || step === 'success'">
        <div class="flex items-center gap-3 shrink-0">
          <div class="size-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg shadow-black/10">
            <HugeIcon :icon="Hospital01Icon" :stroke-width="2" class="size-5 text-emerald-300" />
          </div>
          <span class="text-xl font-extrabold text-white tracking-tight">{{ clinic.clinicName || 'Mediport' }}</span>
        </div>

        <div class="flex-1 flex items-center">
          <div v-if="step === 'identify'" class="space-y-5">
            <h1 class="font-heading text-4xl font-semibold text-white leading-tight">
              Fertility &amp; Wellness<br />
              <span class="text-emerald-400">Services</span>
            </h1>
            <p class="text-lg text-white max-w-md leading-relaxed">
              Book appointments with our experienced specialists. Compassionate care tailored to your journey.
            </p>
            <div class="flex items-center gap-4 pt-1">
              <div class="h-px w-12 bg-white/20" />
              <span class="text-sm text-white/60 tracking-wider uppercase">Since 2010</span>
              <div class="h-px w-12 bg-white/20" />
            </div>
          </div>
          <div v-else class="space-y-5">
            <h1 class="font-heading text-4xl font-semibold text-white leading-tight">
              Appointment<br />
              <span class="text-emerald-400">Confirmed</span>
            </h1>
            <p class="text-lg text-white max-w-md leading-relaxed">
              Your appointment has been booked successfully. A confirmation message has been sent to your phone and email.
            </p>
            <div class="flex items-center gap-4 pt-1">
              <div class="h-px w-12 bg-white/20" />
              <span class="text-sm text-white/60 tracking-wider uppercase">See you soon</span>
              <div class="h-px w-12 bg-white/20" />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 text-sm text-white/50 shrink-0">
          <span>&copy; 2026 {{ clinic.clinicName || 'Mediport Fertility Services' }}</span>
          <span class="text-white/20">&middot;</span>
          <NuxtLink to="/privacy" target="_blank" class="hover:text-white/80 hover:underline underline-offset-2 transition-colors">Privacy</NuxtLink>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-col flex-1">
          <div class="shrink-0">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg shadow-black/10">
                <HugeIcon :icon="Hospital01Icon" :stroke-width="2" class="size-5 text-emerald-300" />
              </div>
              <span class="text-xl font-extrabold text-white tracking-tight">{{ clinic.clinicName || 'Mediport' }}</span>
            </div>
          </div>

          <div class="flex-1 flex items-center justify-center">
            <div class="space-y-0">
              <div v-for="(s, i) in displaySteps" :key="s.label" class="flex items-start gap-4">
                <div class="flex flex-col items-center">
                  <div
                    v-if="stepStatus(i) === 'completed'"
                    class="size-10 rounded-full bg-white/25 flex items-center justify-center shrink-0"
                  >
                    <HugeIcon :icon="CheckmarkCircle02Icon" :stroke-width="2" class="size-4 text-white/80" />
                  </div>
                  <div
                    v-else-if="stepStatus(i) === 'current'"
                    class="size-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-white/10 ring-2 ring-white/30 shrink-0"
                  >
                    <HugeIcon :icon="s.icon" :stroke-width="2" class="size-6 text-white" />
                  </div>
                  <div v-else class="size-10 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0">
                    <HugeIcon :icon="s.icon" :stroke-width="2" class="size-4 text-white/50" />
                  </div>
                  <div
                    v-if="i < displaySteps.length - 1"
                    :class="cn('w-px h-10', i < currentIdx ? 'bg-white/25' : 'bg-white/10')"
                  />
                </div>
                <div
                  :class="cn(
                    'pt-2',
                    stepStatus(i) === 'current' ? 'text-white' : '',
                    stepStatus(i) === 'completed' ? 'text-white/70' : '',
                    stepStatus(i) === 'upcoming' ? 'text-white/50' : ''
                  )"
                >
                  <div :class="cn('font-medium transition-colors', stepStatus(i) === 'current' ? 'text-lg' : 'text-base')">
                    {{ s.label }}
                  </div>
                  <p v-if="stepStatus(i) === 'current' && s.subtitle" class="text-sm text-white/60 mt-1">{{ s.subtitle }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 text-sm text-white/50 shrink-0">
          <span>&copy; 2026 {{ clinic.clinicName || 'Mediport Fertility Services' }}</span>
          <span class="text-white/20">&middot;</span>
          <NuxtLink to="/privacy" target="_blank" class="hover:text-white/80 hover:underline underline-offset-2 transition-colors">Privacy</NuxtLink>
        </div>
      </template>
    </div>
  </aside>
</template>
