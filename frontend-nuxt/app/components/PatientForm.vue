<script setup lang="ts">
import { COUNTRY_CODES } from '@/lib/country-codes'
import { cn } from '@/lib/utils'

const props = defineProps<{
  defaultFirstName: string
  defaultLastName: string
  defaultPhone: string
  defaultEmail: string
  otpIdentifier?: string
}>()

const emit = defineEmits<{ complete: [firstName: string, lastName: string, phone: string, email: string] }>()

const api = useApi()

const firstName = ref(props.defaultFirstName)
const lastName = ref(props.defaultLastName)
const countryCode = ref('+233')
const phoneNumber = ref('')
const email = ref(props.defaultEmail)
const emailError = ref('')
const phoneError = ref('')
const checkingEmail = ref(false)
const checkingPhone = ref(false)

let emailTimer: ReturnType<typeof setTimeout> | undefined
let phoneTimer: ReturnType<typeof setTimeout> | undefined

const usedEmail = computed(() => props.otpIdentifier?.includes('@') ?? false)
const usedPhone = computed(() => (props.otpIdentifier ? !props.otpIdentifier.includes('@') : false))

function syncDefaults() {
  firstName.value = props.defaultFirstName
  lastName.value = props.defaultLastName
  email.value = props.defaultEmail
  if (props.defaultPhone) {
    const match = COUNTRY_CODES.find((c) => props.defaultPhone.startsWith(c.code))
    if (match) {
      countryCode.value = match.code
      phoneNumber.value = props.defaultPhone.slice(match.code.length)
    } else {
      phoneNumber.value = props.defaultPhone
    }
  }
}
watch(() => [props.defaultFirstName, props.defaultLastName, props.defaultPhone, props.defaultEmail], syncDefaults, { immediate: true })

watch([email, usedEmail], ([newEmail, isUsed]) => {
  if (isUsed || !newEmail) {
    emailError.value = ''
    return
  }
  clearTimeout(emailTimer)
  emailTimer = setTimeout(() => {
    checkingEmail.value = true
    api
      .checkPatientExists({ email: newEmail.trim().toLowerCase() })
      .then((taken) => { emailError.value = taken ? 'This email is already registered' : '' })
      .catch(() => {})
      .finally(() => { checkingEmail.value = false })
  }, 500)
})

watch([phoneNumber, countryCode, usedPhone], ([newPhone, code, isUsed]) => {
  if (isUsed || !newPhone) {
    phoneError.value = ''
    return
  }
  const phone = `${code}${newPhone.replace(/\D/g, '')}`
  clearTimeout(phoneTimer)
  phoneTimer = setTimeout(() => {
    checkingPhone.value = true
    api
      .checkPatientExists({ phone })
      .then((taken) => { phoneError.value = taken ? 'This phone number is already registered' : '' })
      .catch(() => {})
      .finally(() => { checkingPhone.value = false })
  }, 500)
})

onUnmounted(() => {
  clearTimeout(emailTimer)
  clearTimeout(phoneTimer)
})

const phone = computed(() => (phoneNumber.value ? `${countryCode.value}${phoneNumber.value.replace(/\D/g, '')}` : ''))
const allFilled = computed(() => !!firstName.value && !!lastName.value)
const hasError = computed(() => (!!email.value && !!emailError.value) || (!!phone.value && !!phoneError.value))

function handleSubmit() {
  if (!allFilled.value || hasError.value) return
  emit('complete', firstName.value, lastName.value, phone.value, email.value)
}
</script>

<template>
  <Card class="w-full mx-auto bg-transparent ring-0 shadow-none overflow-visible">
    <CardHeader class="px-0">
      <CardTitle class="text-foreground">Tell us about yourself</CardTitle>
      <CardDescription>We just need a few details to get started</CardDescription>
    </CardHeader>
    <CardContent class="px-0 space-y-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label for="firstName">First Name</Label>
          <Input id="firstName" input-size="xl" placeholder="John" v-model="firstName" class="bg-white data-[size=xl]:pl-4" />
        </div>
        <div class="space-y-2">
          <Label for="lastName">Last Name</Label>
          <Input id="lastName" input-size="xl" placeholder="Doe" v-model="lastName" class="bg-white data-[size=xl]:pl-4" />
        </div>
      </div>

      <div v-if="!usedPhone" class="space-y-2">
        <Label for="phone">Phone</Label>
        <div
          :class="cn(
            'flex border rounded-lg overflow-hidden bg-white focus-within:ring-3 focus-within:ring-ring/50 focus-within:border-ring',
            phoneError ? 'border-destructive' : 'border-input'
          )"
        >
          <Select v-model="countryCode">
            <SelectTrigger size="xl" class="w-[100px] sm:w-[120px] shrink-0 border-0 rounded-none shadow-none bg-white pl-3">
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
          <div class="shrink-0 self-stretch flex flex-col w-px">
            <div class="w-px h-[10px] bg-transparent" />
            <div class="w-px bg-border flex-1" />
            <div class="w-px h-[10px] bg-transparent" />
          </div>
          <div class="flex-1">
            <Input
              id="phone"
              type="tel"
              input-size="xl"
              placeholder="Phone number"
              :model-value="phoneNumber"
              @update:model-value="(v) => (phoneNumber = v.replace(/[^\d\s\-()]/g, ''))"
              class="border-0 rounded-none shadow-none bg-white data-[size=xl]:pl-4"
            />
          </div>
        </div>
        <p v-if="phoneError" class="text-xs text-destructive">{{ checkingPhone ? 'Checking...' : phoneError }}</p>
      </div>

      <div v-if="!usedEmail" class="space-y-2">
        <Label for="email">Email</Label>
        <Input
          id="email"
          type="email"
          input-size="xl"
          placeholder="john@example.com"
          v-model="email"
          :class="cn('bg-white data-[size=xl]:pl-4', emailError && 'border-destructive focus-visible:ring-destructive/30')"
        />
        <p v-if="emailError" class="text-xs text-destructive">{{ checkingEmail ? 'Checking...' : emailError }}</p>
      </div>

      <Button class="w-full h-11 text-base shadow-xs" :disabled="!allFilled || hasError" @click="handleSubmit">
        Continue
      </Button>
    </CardContent>
  </Card>
</template>
