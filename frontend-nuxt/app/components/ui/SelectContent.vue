<script setup lang="ts">
import { SelectContent, SelectPortal, SelectViewport } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{ class?: string; side?: 'top' | 'bottom'; sideOffset?: number; align?: 'start' | 'center' | 'end' }>(),
  { side: 'bottom', sideOffset: 4, align: 'center' }
)
</script>

<template>
  <SelectPortal>
    <SelectContent
      data-slot="select-content"
      position="popper"
      :side="props.side"
      :side-offset="props.sideOffset"
      :align="props.align"
      :class="cn(
        'relative isolate z-50 max-h-(--reka-select-content-available-height) w-(--reka-select-trigger-width) min-w-36 overflow-x-hidden overflow-y-auto rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
        props.class
      )"
    >
      <SelectViewport class="p-1">
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
