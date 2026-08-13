<script setup lang="ts">
// Generic yes/no confirmation, built on the same ModalShell used by the five
// appointment modals. First consumer is BookingWizard's "Sign out" — losing
// an in-progress session (upcoming appointments still loaded, any unsaved
// profile edit) with one accidental click had no confirmation at all.
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
    <div class="px-5 pt-5 pb-1 space-y-4">
      <div v-if="icon" class="flex items-center gap-3">
        <motion.div
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
      </div>
      <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
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
