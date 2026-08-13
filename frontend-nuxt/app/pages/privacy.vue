<script setup lang="ts">
import { ArrowLeft01Icon, Shield01Icon } from '@hugeicons/core-free-icons'

// Audit finding #2 (plan §follow-up): the booking flow collected name,
// phone, email, and appointment history with no privacy policy or terms
// link anywhere in the app. This page and the link to it (IdentifyStep.vue,
// ExistingPatientReview.vue) close that gap structurally.
//
// The copy below is a reasonable, standard-shape placeholder — what data is
// collected, why, who can see it, how to ask questions — written so the page
// isn't literally empty, NOT reviewed or approved legal content. Swap it for
// the clinic's actual policy before this is a real production surface.
const clinic = useClinicStore()
onMounted(() => { clinic.load() })
</script>

<template>
  <div class="min-h-screen bg-background">
    <div class="max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
      <NuxtLink to="/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
        <HugeIcon :icon="ArrowLeft01Icon" :stroke-width="2" class="size-4" />
        Back to booking
      </NuxtLink>

      <div class="inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-4 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/[0.08] mb-5">
        <HugeIcon :icon="Shield01Icon" :stroke-width="2" class="size-4" />
        {{ clinic.clinicName || 'Mediport' }}
      </div>

      <h1 class="text-3xl font-semibold tracking-tight text-foreground mb-2">Privacy &amp; how we handle your information</h1>
      <p class="text-sm text-muted-foreground/70 mb-10">
        This is a plain-language summary, not a substitute for a full legal privacy policy — ask us directly if anything here isn't clear.
      </p>

      <div class="space-y-8">
        <section>
          <h2 class="text-base font-semibold text-foreground mb-2">What we collect</h2>
          <p class="text-sm text-muted-foreground leading-relaxed">
            To book and manage an appointment, we collect your name, phone number and/or email address, the doctor and time
            you select, and any notes you choose to add about your visit. If you contact us to reschedule or cancel, we keep
            a record of that too.
          </p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-foreground mb-2">Why we collect it</h2>
          <p class="text-sm text-muted-foreground leading-relaxed">
            Your contact details are used to verify it's really you (via the one-time code sent when you sign in), to
            confirm your appointment, and to reach you if your doctor or clinic needs to reschedule. We don't use your
            information for advertising, and we don't sell it.
          </p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-foreground mb-2">Who can see it</h2>
          <p class="text-sm text-muted-foreground leading-relaxed">
            Your information is visible to the clinical and administrative staff involved in your care — your doctor, and
            the scheduling team who manage the appointment calendar. We don't share it outside the clinic except where
            required by law.
          </p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-foreground mb-2">Your options</h2>
          <p class="text-sm text-muted-foreground leading-relaxed">
            You can review and correct your details at any time from "Edit profile" once you're signed in. If you'd like
            your information removed entirely, contact the clinic directly — we're happy to help.
          </p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-foreground mb-2">Questions</h2>
          <p class="text-sm text-muted-foreground leading-relaxed">
            Reach out to {{ clinic.clinicName || 'the clinic' }} directly using the contact details on our main site, and
            we'll get back to you.
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
