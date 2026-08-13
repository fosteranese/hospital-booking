<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    class?: string
    type?: string
    inputSize?: 'xl' | 'default'
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    id?: string
  }>(),
  { type: 'text', inputSize: 'default' }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <input
    :id="props.id"
    data-slot="input"
    :data-size="props.inputSize ?? 'default'"
    :type="props.type"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :value="props.modelValue"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    :class="cn(
      'w-full min-w-0 rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=default]:px-2.5 data-[size=default]:py-1 data-[size=default]:text-base data-[size=default]:md:text-sm data-[size=default]:pl-9 data-[size=xl]:h-12 data-[size=xl]:px-4 data-[size=xl]:py-3 data-[size=xl]:text-base data-[size=xl]:pl-12',
      props.class
    )"
  />
</template>
