<script setup lang="ts">
// Ported onto vue-input-otp (vs React's input-otp behind the old ui/input-otp.tsx).
// Unlike the React version, vue-input-otp exposes slot state directly via the
// default slot's render props (no separate OTPInputContext + per-slot
// sub-components needed) — so this is one component instead of four
// (InputOTP/InputOTPGroup/InputOTPSlot/InputOTPSeparator), since AuthFlow is
// the only consumer and always renders a fixed 6-digit grouped layout.
import { OTPInput } from 'vue-input-otp'
import { MinusSignIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    id?: string
    length?: number
    inputSize?: 'xl' | 'default'
    modelValue?: string
    autofocus?: boolean
    disabled?: boolean
  }>(),
  { length: 6, inputSize: 'default' }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
  complete: [value: string]
}>()

const slotClass = (size: 'xl' | 'default') =>
  cn(
    'relative flex items-center justify-center border-y border-r border-input shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50',
    size === 'xl' ? 'size-10 sm:size-12 text-base sm:text-lg' : 'size-9 text-sm'
  )
</script>

<template>
  <OTPInput
    :id="props.id"
    data-slot="input-otp"
    :data-size="props.inputSize"
    :maxlength="props.length"
    :model-value="props.modelValue"
    :autofocus="props.autofocus"
    :disabled="props.disabled"
    inputmode="numeric"
    spellcheck="false"
    :container-class="cn('cn-input-otp flex items-center has-disabled:opacity-50', props.inputSize === 'xl' && 'gap-2 sm:gap-5')"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @complete="(v) => emit('complete', v)"
  >
    <template #default="{ slots }">
      <!-- Mobile: single ungrouped row -->
      <div class="flex items-center sm:hidden">
        <div
          v-for="(slot, i) in slots"
          :key="i"
          data-slot="input-otp-slot"
          :data-active="slot.isActive"
          :class="slotClass(props.inputSize)"
        >
          {{ slot.char }}
          <div v-if="slot.hasFakeCaret" class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div :class="cn('w-px animate-caret-blink bg-foreground duration-1000', props.inputSize === 'xl' ? 'h-6' : 'h-4')" />
          </div>
        </div>
      </div>
      <!-- sm+: grouped in pairs with separators -->
      <div class="hidden sm:flex items-center gap-0">
        <template v-for="group in 3" :key="group">
          <div class="flex items-center">
            <div
              v-for="i in [ (group - 1) * 2, (group - 1) * 2 + 1 ]"
              :key="i"
              data-slot="input-otp-slot"
              :data-active="slots[i]?.isActive"
              :class="slotClass(props.inputSize)"
            >
              {{ slots[i]?.char }}
              <div v-if="slots[i]?.hasFakeCaret" class="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div :class="cn('w-px animate-caret-blink bg-foreground duration-1000', props.inputSize === 'xl' ? 'h-6' : 'h-4')" />
              </div>
            </div>
          </div>
          <div
            v-if="group < 3"
            data-slot="input-otp-separator"
            role="separator"
            :class="cn('flex items-center', props.inputSize === 'xl' && 'px-1')"
          >
            <HugeIcon :icon="MinusSignIcon" :stroke-width="2" :class="props.inputSize === 'xl' ? 'size-6' : 'size-4'" />
          </div>
        </template>
      </div>
    </template>
  </OTPInput>
</template>
