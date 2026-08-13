<script setup lang="ts">
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import { Tick02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string; value: string; disabled?: boolean }>()
</script>

<template>
  <SelectItem
    data-slot="select-item"
    :value="props.value"
    :disabled="props.disabled"
    :class="cn(
      'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
      props.class
    )"
  >
    <SelectItemText class="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
      <slot />
    </SelectItemText>
    <SelectItemIndicator class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
      <HugeIcon :icon="Tick02Icon" :stroke-width="2" class="pointer-events-none" />
    </SelectItemIndicator>
  </SelectItem>
</template>
