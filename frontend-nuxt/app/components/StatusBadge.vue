<script setup lang="ts">
import { Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'

defineProps<{ status: string; attended?: boolean | null }>()
</script>

<template>
  <Badge v-if="status === 'cancelled'" variant="outline" class="text-[10px] text-rose-600 border-rose-200 bg-rose-50">Cancelled</Badge>
  <Badge v-else-if="attended === true" variant="outline" class="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-1">
    <HugeIcon :icon="CheckmarkCircle02Icon" :stroke-width="2" class="size-3" /> Attended
  </Badge>
  <Badge v-else-if="attended === false" variant="outline" class="text-[10px] border-rose-300 text-rose-700 bg-rose-50 gap-1">
    <HugeIcon :icon="Cancel01Icon" :stroke-width="2" class="size-3" /> Missed
  </Badge>
  <Badge v-else variant="outline" class="text-[10px] border-amber-300 text-amber-700 bg-amber-50 gap-1">
    <HugeIcon :icon="CheckmarkCircle02Icon" :stroke-width="2" class="size-3" /> Confirmed
  </Badge>
</template>
