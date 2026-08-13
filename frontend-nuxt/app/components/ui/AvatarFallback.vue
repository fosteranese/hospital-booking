<script setup lang="ts">
import { AvatarFallback } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <AvatarFallback
    data-slot="avatar-fallback"
    :class="cn(
      'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
      props.class
    )"
  >
    <slot />
  </AvatarFallback>
</template>
