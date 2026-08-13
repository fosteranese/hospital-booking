<script setup lang="ts">
import { DropdownMenuItem } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string; variant?: 'default' | 'destructive' }>(), { variant: 'default' })
</script>

<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-variant="props.variant"
    :class="cn(
      'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50',
      props.class
    )"
  >
    <slot />
  </DropdownMenuItem>
</template>
