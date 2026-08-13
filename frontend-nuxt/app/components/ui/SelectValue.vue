<script setup lang="ts">
import { SelectValue } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string; placeholder?: string }>()
</script>

<template>
  <SelectValue data-slot="select-value" :placeholder="props.placeholder" :class="cn('flex flex-1 text-left', props.class)">
    <slot />
  </SelectValue>
</template>
