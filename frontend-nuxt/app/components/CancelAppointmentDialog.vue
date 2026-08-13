<script setup lang="ts">
import { motion } from 'motion-v'
import { Cancel01Icon, Calendar01Icon, Clock01Icon } from '@hugeicons/core-free-icons'
import type { UpcomingAppointment } from '@/lib/api'

const props = defineProps<{
  open: boolean
  appointment: UpcomingAppointment | null
  isCancelling: boolean
}>()
const emit = defineEmits<{ 'update:open': [open: boolean]; confirm: [reason?: string] }>()

const reason = ref('')

watch(
  () => props.open,
  (open) => { if (open) reason.value = '' }
)

function handleConfirm() {
  emit('confirm', reason.value.trim())
}

function handleClose() {
  reason.value = ''
  emit('update:open', false)
}
</script>

<template>
  <ModalShell
    v-if="open"
    title="Cancel appointment"
    :z-index="60"
    :close-disabled="isCancelling"
    @close="handleClose"
  >
    <div class="overflow-y-auto flex-1 px-5 pt-5 pb-0 space-y-5">
      <div class="relative bg-gradient-to-br from-rose-50 via-rose-50/60 to-primary/8 px-4 py-4 rounded-xl overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,oklch(0.65_0.12_25/0.1),transparent_60%)]" />
        <div class="relative flex items-center gap-3">
          <motion.div
            :initial="{ scale: 0, rotate: 30 }"
            :animate="{ scale: 1, rotate: 0 }"
            :transition="{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }"
            class="size-10 rounded-xl bg-destructive flex items-center justify-center shrink-0 shadow-xs"
          >
            <HugeIcon :icon="Cancel01Icon" :stroke-width="2" class="size-5 text-white" />
          </motion.div>
          <div>
            <p class="text-sm font-semibold text-destructive">Cancel appointment</p>
            <p class="text-xs text-muted-foreground/70 mt-0.5">This action cannot be undone</p>
          </div>
        </div>
      </div>

      <div v-if="appointment" class="border-l-2 border-destructive/40 pl-3.5 space-y-1.5">
        <div class="flex items-center gap-2">
          <p class="text-sm font-semibold text-foreground">Dr. {{ appointment.doctor_name }}</p>
          <Badge variant="outline" class="text-[10px] font-normal px-1.5 py-0">{{ appointment.specialization }}</Badge>
        </div>
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <HugeIcon :icon="Calendar01Icon" :stroke-width="2" class="size-3.5 shrink-0" />
            {{ appointment.slot_date }}
          </span>
          <span class="text-muted-foreground/30">&middot;</span>
          <span class="flex items-center gap-1">
            <HugeIcon :icon="Clock01Icon" :stroke-width="2" class="size-3.5 shrink-0" />
            {{ appointment.start_time?.slice(0, 5) }}
          </span>
        </div>
      </div>

      <div class="space-y-1.5">
        <p class="text-xs font-medium text-foreground">Reason for cancellation</p>
        <textarea
          v-model="reason"
          placeholder="Please provide a reason..."
          class="w-full min-h-[72px] resize-none rounded-lg border border-foreground/10 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-colors"
        />
      </div>
    </div>

    <template #footer>
      <Button variant="outline" class="h-11 text-sm" :disabled="isCancelling" @click="handleClose">No, keep it</Button>
      <Button variant="destructive" class="h-11 text-sm gap-1.5" :disabled="!reason.trim() || isCancelling" @click="handleConfirm">
        <span v-if="isCancelling" class="flex items-center gap-2">
          <Spinner />
          Cancelling...
        </span>
        <template v-else>Yes, cancel</template>
      </Button>
    </template>
  </ModalShell>
</template>
