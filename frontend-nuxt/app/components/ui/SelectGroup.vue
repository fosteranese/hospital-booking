<script setup lang="ts">
import { SelectGroup } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <SelectGroup data-slot="select-group" :class="cn('scroll-my-1 p-1', props.class)">
    <slot />
  </SelectGroup>
</template>
