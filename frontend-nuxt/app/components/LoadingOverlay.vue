<script setup lang="ts">
import { motion } from 'motion-v'
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{ loading: boolean; message?: string; variant?: 'fullscreen' | 'inset' }>(),
  { message: 'Loading...', variant: 'fullscreen' }
)
</script>

<template>
  <motion.div
    v-if="loading"
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :class="cn(
      variant === 'fullscreen'
        ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/60'
        : 'absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70'
    )"
  >
    <div v-if="variant === 'fullscreen'" class="flex flex-col items-center gap-4">
      <div class="size-10 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
      <p class="text-sm font-medium text-white">{{ message }}</p>
    </div>
    <div v-else class="flex items-center gap-2.5">
      <Spinner />
      <span class="text-sm text-muted-foreground">{{ message }}</span>
    </div>
  </motion.div>
</template>
