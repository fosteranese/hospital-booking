<script setup lang="ts">
// OTP entry. Unlike the old single-step AuthFlow (which sent the OTP the
// moment an identifier was entered), this step can now be reached minutes
// after 'identify' — a new patient browses doctor/datetime in between — so
// the code is requested fresh here, on mount, rather than carried over from
// a request that could have gone stale. The shared "Back" button in
// BookingWizard covers returning to the previous step; no separate back
// affordance needed here.
const emit = defineEmits<{ verified: [token: string, identifier: string, role: string] }>()

const auth = useAuthStore()
const api = useApi()

const identifier = computed(() => auth.otpIdentifier)
const isEmail = computed(() => identifier.value.includes('@'))

const otp = ref('')
const loading = ref(false)
const error = ref('')
const resending = ref(false)
const cooldown = ref(0)
const sendingInitial = ref(true)

let cooldownInterval: ReturnType<typeof setInterval> | null = null
let autofocusTimeout: ReturnType<typeof setTimeout> | null = null

function clearCooldownInterval() {
  if (cooldownInterval) {
    clearInterval(cooldownInterval)
    cooldownInterval = null
  }
}

onUnmounted(() => {
  clearCooldownInterval()
  if (autofocusTimeout) clearTimeout(autofocusTimeout)
})

onMounted(async () => {
  try {
    await api.requestOtp(identifier.value)
  } catch (err: any) {
    error.value = err.message
  } finally {
    sendingInitial.value = false
  }
  autofocusTimeout = setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('#otp')
    if (input) input.focus()
  }, 250)
})

async function handleResendOtp() {
  resending.value = true
  error.value = ''
  try {
    await api.requestOtp(identifier.value)
    cooldown.value = 30
    clearCooldownInterval()
    cooldownInterval = setInterval(() => {
      if (cooldown.value <= 1) {
        clearCooldownInterval()
        cooldown.value = 0
      } else {
        cooldown.value -= 1
      }
    }, 1000)
  } catch (err: any) {
    error.value = err.message
  } finally {
    resending.value = false
  }
}

async function handleVerifyOtp() {
  if (otp.value.length !== 6) return
  loading.value = true
  error.value = ''
  try {
    const res = await api.verifyOtp(identifier.value, otp.value)
    emit('verified', res.token, identifier.value, res.role)
  } catch (err: any) {
    error.value = err.message
    otp.value = ''
  } finally {
    loading.value = false
  }
}

function onOtpChange(v: string | undefined) {
  error.value = ''
  otp.value = v ?? ''
}
</script>

<template>
  <Card class="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
    <CardContent class="px-0 space-y-6">
      <div class="space-y-1">
        <p class="text-base font-medium text-foreground">{{ isEmail ? 'Check your email' : 'Check your phone' }}</p>
        <p class="text-sm text-muted-foreground">
          <template v-if="sendingInitial">Sending a code to <span class="font-medium text-foreground/90">{{ identifier }}</span>...</template>
          <template v-else>We sent a code to <span class="font-medium text-foreground/90">{{ identifier }}</span></template>
        </p>
      </div>

      <div class="space-y-5">
        <Label for="otp" class="text-center block text-base font-medium">Enter Verification Code</Label>
        <div class="flex justify-center">
          <InputOtp
            id="otp"
            :length="6"
            input-size="xl"
            :model-value="otp"
            :disabled="sendingInitial"
            autofocus
            @update:model-value="onOtpChange"
            @complete="handleVerifyOtp"
          />
        </div>
      </div>

      <ErrorMessage v-if="error" :message="error" variant="bordered" />

      <div class="text-center text-xs sm:text-sm text-muted-foreground">
        <p v-if="cooldown > 0">Didn't receive the code? <span class="text-foreground/60">Resend in {{ cooldown }}s</span></p>
        <div v-else class="flex items-center justify-center gap-1 flex-wrap">
          <span>Didn't receive the code?</span>
          <button
            type="button"
            :disabled="resending || sendingInitial"
            class="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default py-2 px-1 leading-none"
            @click="handleResendOtp"
          >
            <span v-if="resending" class="flex items-center gap-1"><Spinner /><span>Sending...</span></span>
            <template v-else>Resend</template>
          </button>
        </div>
      </div>

      <Button class="w-full h-11 text-base shadow-xs" :disabled="loading || otp.length !== 6" @click="handleVerifyOtp">
        <span v-if="loading" class="flex items-center gap-2"><Spinner />Verifying...</span>
        <template v-else>Verify</template>
      </Button>
    </CardContent>
  </Card>
</template>
