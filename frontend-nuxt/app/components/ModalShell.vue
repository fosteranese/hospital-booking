<script setup lang="ts">
// Shared wrapper for the five modals in this app (Cancel, History, EditProfile,
// AppointmentDetail, UpcomingAppointments), replacing what was five copies of
// near-identical "fixed inset-0 flex items-center..." boilerplate in React.
//
// Two deliberate departures from the React source, both from the plan's
// mobile-first direction (§3.2):
// 1. Bottom sheet on mobile, centered dialog on sm+ — the old app centered
//    a full-width rounded card vertically on every viewport, which isn't the
//    pattern touch users expect. `items-end` + `rounded-t-2xl` below `sm`,
//    `items-center` + full rounding at `sm` and up.
// 2. The Escape key handler. The React version bound `onKeyDown` to the
//    backdrop div — that only fires for keys pressed while the div itself has
//    focus, which a plain non-interactive div never does, so Escape silently
//    never worked. Fixed here with a real document-level listener.
import { motion } from 'motion-v'
import { Cancel01Icon } from '@hugeicons/core-free-icons'

withDefaults(
  defineProps<{ title: string; zIndex?: number; closeDisabled?: boolean }>(),
  { zIndex: 50, closeDisabled: false }
)
const emit = defineEmits<{ close: [] }>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <motion.div
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :transition="{ duration: 0.15 }"
    class="fixed inset-0 flex items-end sm:items-center justify-center bg-black/10 backdrop-blur-xs p-0 sm:p-4"
    :style="{ zIndex }"
    @click="emit('close')"
  >
    <motion.div
      :initial="{ y: 60, opacity: 0 }"
      :animate="{ y: 0, opacity: 1 }"
      :transition="{ duration: 0.2, ease: 'easeOut' }"
      class="relative w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden max-h-[85vh]"
      @click.stop
    >
      <div class="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-4 pb-3 border-b border-foreground/5 shrink-0">
        <p class="text-sm font-semibold text-foreground">{{ title }}</p>
        <button
          type="button"
          :disabled="closeDisabled"
          class="size-8 sm:size-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors disabled:opacity-40"
          @click="emit('close')"
        >
          <HugeIcon :icon="Cancel01Icon" :stroke-width="2" class="size-4 text-muted-foreground" />
        </button>
      </div>

      <slot />

      <div v-if="$slots.footer" class="sticky bottom-0 flex items-center justify-end gap-2 bg-white px-5 py-4 shrink-0">
        <slot name="footer" />
      </div>
    </motion.div>
  </motion.div>
</template>
