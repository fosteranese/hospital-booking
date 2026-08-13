<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuPortal } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{ class?: string; align?: 'start' | 'center' | 'end'; alignOffset?: number; side?: 'top' | 'bottom' | 'left' | 'right'; sideOffset?: number }>(),
  { align: 'start', alignOffset: 0, side: 'bottom', sideOffset: 4 }
)
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      :align="props.align"
      :align-offset="props.alignOffset"
      :side="props.side"
      :side-offset="props.sideOffset"
      :class="cn(
        'z-50 max-h-(--reka-dropdown-menu-content-available-height) min-w-32 overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
        props.class
      )"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
