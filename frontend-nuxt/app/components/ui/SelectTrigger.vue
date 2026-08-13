<script setup lang="ts">
import { SelectIcon, SelectTrigger } from 'reka-ui'
import { UnfoldMoreIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string; size?: 'sm' | 'default' | 'xl' }>(), { size: 'default' })
</script>

<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="props.size"
    :class="cn(
      'flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=default]:py-2 data-[size=default]:pr-2 data-[size=default]:pl-2.5 data-[size=default]:text-sm data-[size=sm]:h-8 data-[size=xl]:h-12 data-[size=xl]:py-3 data-[size=xl]:pr-3 data-[size=xl]:pl-4 data-[size=xl]:text-base *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
      props.class
    )"
  >
    <slot />
    <SelectIcon as-child>
      <HugeIcon :icon="UnfoldMoreIcon" :stroke-width="2" class="pointer-events-none size-4 text-muted-foreground" />
    </SelectIcon>
  </SelectTrigger>
</template>
