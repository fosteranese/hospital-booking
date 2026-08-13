<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div
    data-slot="card-title"
    :class="cn('font-heading text-lg leading-normal font-semibold group-data-[size=sm]/card:text-sm', props.class)"
  >
    <slot />
  </div>
</template>
