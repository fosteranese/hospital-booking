<script setup lang="ts">
import { SelectLabel } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <SelectLabel data-slot="select-label" :class="cn('px-2 py-1.5 text-xs text-muted-foreground', props.class)">
    <slot />
  </SelectLabel>
</template>
