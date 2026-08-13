<script setup lang="ts">
import { Loading03Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <HugeIcon
    :icon="Loading03Icon"
    :stroke-width="2"
    :size="16"
    role="status"
    aria-label="Loading"
    :class="cn('size-4 animate-spin', props.class)"
  />
</template>
