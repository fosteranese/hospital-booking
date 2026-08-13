<script setup lang="ts">
// Generic yes/no confirmation, built on the same ModalShell used by the five
// appointment modals. First consumer is BookingWizard's "Sign out" — losing
// an in-progress session (upcoming appointments still loaded, any unsaved
// profile edit) with one accidental click had no confirmation at all.
//
// The icon+copy block matches CancelAppointmentDialog's gradient-card
// pattern (icon badge, title, subtitle grouped in one row) rather than the
// icon floating alone above a disconnected paragraph — the first version of
// this component had exactly that disconnect and read as unfinished.
import { motion } from 'motion-v'

// @hugeicons/core-free-icons doesn't export this type — reconstructed here
// to match structurally, same as HugeIcon.vue does for the same reason.
type IconSvgObject =
  | [string, { [key: string]: string | number }][]
  | readonly (readonly [string, { readonly [key: string]: string | number }])[]

withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    icon?: IconSvgObject
    variant?: 'default' | 'destructive'
    loading?: boolean
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel', variant: 'default', loading: false }
)
const emit = defineEmits<{ 'update:open': [open: boolean]; confirm: [] }>()

function close() {
  emit('update:open', false)
}
</script>

<template>
  <ModalShell v-if="open" :title="title" :close-disabled="loading" @close="close">
    <div class="px-5 pt-5 pb-1">
      <div
        :class="[
          'relative px-4 py-4 rounded-xl overflow-hidden',
          variant === 'destructive'
            ? 'bg-gradient-to-br from-rose-50 via-rose-50/60 to-primary/8'
            : 'bg-gradient-to-br from-amber-50 via-rose-50/50 to-primary/8',
        ]"
      >
        <div
          class="absolute inset-0"
          :style="{
            backgroundImage: `radial-gradient(circle at 30% 50%, oklch(${variant === 'destructive' ? '0.65 0.12 25' : '0.75 0.08 50'} / 0.1), transparent 60%)`,
          }"
        />
        <div class="relative flex items-center gap-3">
          <motion.div
            v-if="icon"
            :initial="{ scale: 0, rotate: variant === 'destructive' ? 30 : -20 }"
            :animate="{ scale: 1, rotate: 0 }"
            :transition="{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }"
            :class="[
              'size-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs',
              variant === 'destructive' ? 'bg-destructive' : 'bg-primary',
            ]"
          >
            <HugeIcon :icon="icon" :stroke-width="2" class="size-5 text-white" />
          </motion.div>
          <div>
            <p :class="['text-sm font-semibold', variant === 'destructive' ? 'text-destructive' : 'text-primary']">{{ title }}</p>
            <p v-if="description" class="text-xs text-muted-foreground/70 mt-0.5">{{ description }}</p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="outline" class="h-11 text-sm" :disabled="loading" @click="close">{{ cancelLabel }}</Button>
      <Button :variant="variant === 'destructive' ? 'destructive' : 'default'" class="h-11 text-sm gap-1.5" :disabled="loading" @click="emit('confirm')">
        <span v-if="loading" class="flex items-center gap-2"><Spinner />Please wait...</span>
        <template v-else>{{ confirmLabel }}</template>
      </Button>
    </template>
  </ModalShell>
</template>
