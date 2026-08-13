<script setup lang="ts">
import { SelectRoot } from 'reka-ui'

const props = defineProps<{ modelValue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()
</script>

<template>
  <SelectRoot :model-value="props.modelValue" @update:model-value="(v) => emit('update:modelValue', v as string | undefined)">
    <slot />
  </SelectRoot>
</template>
