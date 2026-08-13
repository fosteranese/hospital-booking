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

const titleId = useId()
// motion-v's own composable (auto-imported via its Nuxt module) — reactive
// Ref<boolean> over the OS prefers-reduced-motion setting.
const prefersReduced = useReducedMotion()
let previouslyFocused: HTMLElement | null = null

// Exit fade (audit finding, plan §7.1's Tier 2). Two approaches tried and
// rejected before this one:
//   - motion-v's AnimatePresence: confirmed unreliable earlier in this build
//     (froze the DOM on nested or sequential re-keying — see
//     BookingWizard.vue's comment).
//   - A local `visible` flag driving Vue's native <Transition> for the leave
//     only, with a plain CSS class supplying `opacity: 0`: built, then
//     verified live that it does *nothing* visually — motion-v sets opacity
//     via an inline style once the enter animation settles
//     (`style="opacity: 1"`), which always wins over a class-based rule
//     regardless of transition timing. Caught by sampling
//     getComputedStyle().opacity every 30ms through a real close and seeing
//     it hold at "1" for the entire leave-active window before the element
//     just vanished.
// What actually works: let motion-v itself own the exit, the same way it
// owns the entrance — flip `closing` and hand its own :animate prop a new
// target (opacity 0 / a slight downward slide). motion-v's
// `onAnimationComplete` callback prop fires once that settles, and only
// then does this emit 'close', which is the signal the parent's v-if is
// actually waiting for to unmount this for real. `closing` guards the
// callback so the *entrance* animation's own completion doesn't also
// trigger it. Self-contained to this file: none of the 6 modals that use
// ModalShell need to change.
const closing = ref(false)
function requestClose() {
  if (prefersReduced.value) {
    emit('close')
    return
  }
  closing.value = true
}
function onBackdropAnimComplete() {
  if (closing.value) emit('close')
}

// Queried by titleId rather than a template ref on the motion.div — motion-v
// doesn't document whether its ref forwards to the underlying DOM node or a
// component instance, and this dialog role is already uniquely addressable
// by its own aria-labelledby target, which also correctly scopes to *this*
// instance if a second modal (e.g. CancelAppointmentDialog, z-index 60) is
// stacked on top of another one.
function panelEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[aria-labelledby="${titleId}"]`)
}

function focusableEls(): HTMLElement[] {
  const panel = panelEl()
  if (!panel) return []
  return [...panel.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((el) => el.offsetParent !== null)
}

// Accessibility: a dialog with no focus management is a keyboard/screen-reader
// trap in the other direction — Tab walks straight through into the page
// behind it, and closing never gives focus back to whatever opened it. Both
// are basic WAI-ARIA dialog-pattern requirements, missing here since this
// shell predates the accessibility pass that added them.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    requestClose()
    return
  }
  if (e.key !== 'Tab') return
  const els = focusableEls()
  if (els.length === 0) return
  const first = els[0]!
  const last = els[els.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  previouslyFocused = document.activeElement as HTMLElement | null
  // Let the enter transition mount everything first, then move focus in.
  nextTick(() => focusableEls()[0]?.focus())
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  previouslyFocused?.focus?.()
})
</script>

<template>
  <motion.div
    :initial="{ opacity: 0 }"
    :animate="{ opacity: closing ? 0 : 1 }"
    :transition="{ duration: prefersReduced ? 0 : 0.15 }"
    :on-animation-complete="onBackdropAnimComplete"
    class="fixed inset-0 flex items-end sm:items-center justify-center bg-black/10 backdrop-blur-xs p-0 sm:p-4"
    :style="{ zIndex }"
    @click="requestClose"
  >
    <motion.div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :initial="{ y: prefersReduced ? 0 : 60, opacity: 0 }"
      :animate="{ y: closing && !prefersReduced ? 24 : 0, opacity: closing ? 0 : 1 }"
      :transition="{ duration: prefersReduced ? 0 : (closing ? 0.15 : 0.2), ease: closing ? 'easeIn' : 'easeOut' }"
      class="relative w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden max-h-[85vh]"
      @click.stop
    >
      <div class="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-4 pb-3 border-b border-foreground/5 shrink-0">
        <p :id="titleId" class="text-sm font-semibold text-foreground">{{ title }}</p>
        <button
          type="button"
          :disabled="closeDisabled"
          aria-label="Close"
          class="size-8 sm:size-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors disabled:opacity-40"
          @click="requestClose"
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
