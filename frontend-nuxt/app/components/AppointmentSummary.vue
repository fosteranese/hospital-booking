<script setup lang="ts">
import { motion } from 'motion-v'
import { UserIcon, Doctor01Icon, Calendar01Icon, Clock01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { formatDate, formatTime } from '@/lib/format'

defineProps<{
  doctorName: string
  specialization?: string
  date: string
  time: string
  patientName: string
  loading: boolean
  error?: string
}>()

const emit = defineEmits<{ confirm: [] }>()
const notes = defineModel<string>('notes', { default: '' })
</script>

<template>
  <motion.div :initial="{ opacity: 0, y: 10 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.25 }">
    <Card class="w-full mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader class="px-0">
        <CardTitle class="text-foreground">Almost there</CardTitle>
      </CardHeader>
      <CardContent class="px-0 space-y-6">
        <div class="rounded-xl bg-white shadow-sm shadow-black/[0.03] border overflow-hidden">
          <div class="relative bg-gradient-to-br from-amber-50 via-rose-50/50 to-primary/8 px-5 py-5 flex items-center gap-3.5 overflow-hidden">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,oklch(0.75_0.08_50/0.12),transparent_60%)]" />
            <motion.div
              :initial="{ scale: 0, rotate: -30 }"
              :animate="{ scale: 1, rotate: 0 }"
              :transition="{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }"
              class="relative size-11 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-xs"
            >
              <HugeIcon :icon="CheckmarkCircle02Icon" :stroke-width="2" class="size-5.5 text-white" />
            </motion.div>
            <div class="relative">
              <p class="text-sm font-semibold text-primary">Appointment Summary</p>
              <p class="text-xs text-muted-foreground/60 mt-0.5">Give it a quick look before we lock it in</p>
            </div>
          </div>
          <div class="divide-y divide-foreground/5">
            <div class="flex items-center gap-3.5 px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
              <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                <HugeIcon :icon="UserIcon" :stroke-width="2" class="size-4.5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Patient</p>
                <p class="text-sm font-medium text-foreground mt-0.5">{{ patientName }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3.5 px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
              <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                <HugeIcon :icon="Doctor01Icon" :stroke-width="2" class="size-4.5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Doctor</p>
                <p class="text-sm font-medium text-foreground mt-0.5">{{ doctorName }}</p>
                <p v-if="specialization" class="text-xs text-muted-foreground/60 mt-0.5">{{ specialization }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3.5 px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
              <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                <HugeIcon :icon="Calendar01Icon" :stroke-width="2" class="size-4.5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Date</p>
                <p class="text-sm font-medium text-foreground mt-0.5">{{ formatDate(date) }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3.5 px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
              <div class="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                <HugeIcon :icon="Clock01Icon" :stroke-width="2" class="size-4.5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Time</p>
                <p class="text-sm font-medium text-foreground mt-0.5">{{ formatTime(time) }}</p>
              </div>
            </div>
            <div class="px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
              <div class="space-y-2">
                <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Reason for visit (optional)</p>
                <textarea
                  v-model="notes"
                  placeholder="Briefly describe your reason for visit..."
                  class="w-full min-h-[80px] resize-none rounded-lg border border-foreground/10 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-colors"
                  :disabled="loading"
                />
              </div>
            </div>
          </div>
        </div>

        <ErrorMessage v-if="error" :message="error" />

        <div class="flex flex-col gap-3 pt-1">
          <Button class="w-full h-11 text-base shadow-xs" :disabled="loading" @click="emit('confirm')">
            <span v-if="loading" class="flex items-center gap-2">
              <Spinner />
              Booking...
            </span>
            <template v-else>Confirm Booking</template>
          </Button>
        </div>
      </CardContent>
    </Card>
  </motion.div>
</template>
