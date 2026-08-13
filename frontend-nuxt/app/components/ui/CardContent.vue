<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div data-slot="card-content" :class="cn('px-6 group-data-[size=sm]/card:px-4', props.class)">
    <slot />
  </div>
</template>
