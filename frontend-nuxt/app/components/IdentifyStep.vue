<script setup lang="ts">
// First step for every session — phone/email entry only, no OTP sent here.
// On submit this runs an unauthenticated existence check (GET
// /patients/check, public) and branches: a matching account goes straight to
// 'verify' (identical to the old single 'auth' step's behavior); no match
// sends the visitor to browse doctor/datetime first and defers OTP until
// they've picked a slot worth committing to. See booking store's
// completeIdentify() and the plan's UX-audit fork writeup.
import { Mail01Icon, CallIcon, Hospital01Icon } from '@hugeicons/core-free-icons'
import { COUNTRY_CODES } from '@/lib/country-codes'
import { normalizePhone } from '@/lib/phone'

const booking = useBookingStore()
const api = useApi()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidPhone(code: string, number: string): boolean {
  const digits = number.replace(/\D/g, '')
  if (!digits) return false
  const total = code.replace(/\D/g, '') + digits
  return total.length >= 7 && total.length <= 15
}

const method = ref<'phone' | 'email'>('phone')
const email = ref('')
const countryCode = ref('+233')
const phoneNumber = ref('')
const loading = ref(false)
const error = ref('')

function getIdentifier(): string | null {
  if (method.value === 'email') {
    if (!EMAIL_RE.test(email.value.trim())) return null
    return email.value.trim().toLowerCase()
  }
  const code = countryCode.value.trim()
  const number = phoneNumber.value.trim()
  if (!isValidPhone(code, number)) return null
  return normalizePhone(code, number)
}

function getFieldError(): string | null {
  if (method.value === 'email') {
    if (!email.value.trim()) return 'Enter your email address'
    if (!EMAIL_RE.test(email.value.trim())) return 'Invalid email format'
    return null
  }
  if (!phoneNumber.value.trim()) return 'Enter your phone number'
  if (!isValidPhone(countryCode.value, phoneNumber.value.trim())) return 'Invalid phone number'
  return null
}

const identifier = computed(() => getIdentifier())

async function handleContinue() {
  const id = getIdentifier()
  if (!id) {
    error.value = getFieldError() || 'Enter a valid identifier'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const isEmail = method.value === 'email'
    const exists = await api.checkPatientExists(isEmail ? { email: id } : { phone: id })
    booking.completeIdentify(id, exists)
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function switchMethod() {
  method.value = method.value === 'phone' ? 'email' : 'phone'
  error.value = ''
}
</script>

<template>
  <Card class="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
    <CardContent class="px-0 space-y-5">
      <div class="text-center space-y-4">
        <div class="inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-4 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/[0.08]">
          <HugeIcon :icon="Hospital01Icon" :stroke-width="2" class="size-4" />
          Mediport
        </div>
        <h1 class="font-heading text-3xl font-semibold text-foreground">Welcome to Mediport</h1>
        <p class="text-sm text-muted-foreground max-w-sm mx-auto">
          {{ method === 'phone' ? "Enter your phone number to get started" : "Enter your email to get started" }}
        </p>
      </div>

      <div v-if="method === 'phone'" class="space-y-2">
        <Label for="phone">Phone</Label>
        <div class="flex gap-2">
          <Select v-model="countryCode">
            <SelectTrigger size="xl" class="w-[120px] sm:w-[160px] shrink-0 bg-white">
              <SelectValue>
                <template v-if="COUNTRY_CODES.find((c) => c.code === countryCode)">
                  <span>{{ COUNTRY_CODES.find((c) => c.code === countryCode)?.flag }}</span>
                  <span class="ps-2">{{ countryCode }}</span>
                </template>
              </SelectValue>
            </SelectTrigger>
            <SelectContent class="bg-white">
              <SelectGroup>
                <SelectLabel>Countries</SelectLabel>
                <SelectItem v-for="c in COUNTRY_CODES" :key="c.code" :value="c.code">
                  <span class="flex items-center gap-2">
                    <span class="text-base leading-none">{{ c.flag }}</span>
                    <span>{{ c.name }} ({{ c.code }})</span>
                  </span>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div class="relative flex-1">
            <HugeIcon :icon="CallIcon" :stroke-width="2" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="phone"
              type="tel"
              input-size="xl"
              placeholder="Phone number"
              :model-value="phoneNumber"
              @update:model-value="(v) => (phoneNumber = v.replace(/[^\d\s\-()]/g, ''))"
              class="bg-white"
              :aria-invalid="!!error"
              :aria-describedby="error ? 'identify-error' : undefined"
            />
          </div>
        </div>
      </div>
      <div v-else class="space-y-2">
        <Label for="email">Email</Label>
        <div class="relative">
          <HugeIcon :icon="Mail01Icon" :stroke-width="2" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="email"
            type="email"
            input-size="xl"
            placeholder="email@example.com"
            v-model="email"
            class="bg-white"
            :aria-invalid="!!error"
            :aria-describedby="error ? 'identify-error' : undefined"
          />
        </div>
      </div>

      <ErrorMessage v-if="error" id="identify-error" :message="error" />

      <Button class="w-full h-11 text-base shadow-xs" :disabled="loading || !identifier" @click="handleContinue">
        <span v-if="loading" class="flex items-center gap-2"><Spinner /><span>Just a moment...</span></span>
        <template v-else>Continue</template>
      </Button>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button variant="outline" class="w-full h-11 text-base" @click="switchMethod">
        {{ method === 'phone' ? 'Use email instead' : 'Use phone instead' }}
      </Button>

      <p class="text-center text-xs text-muted-foreground/60">
        By continuing, you agree to our
        <NuxtLink to="/privacy" target="_blank" class="text-primary hover:underline underline-offset-2">privacy practices</NuxtLink>.
      </p>
    </CardContent>
  </Card>
</template>
