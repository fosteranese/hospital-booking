<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    message: string
    variant?: 'simple' | 'bordered'
    class?: string
  }>(),
  { variant: 'simple' }
)
</script>

<template>
  <div
    :class="cn(
      props.variant === 'simple'
        ? 'rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'
        : 'rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive text-center',
      props.class
    )"
  >
    {{ message }}
  </div>
</template>
