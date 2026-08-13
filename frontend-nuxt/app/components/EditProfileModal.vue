<script setup lang="ts">
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { COUNTRY_CODES } from '@/lib/country-codes'
import { normalizePhone } from '@/lib/phone'
import type { Patient } from '@/lib/api'

const props = defineProps<{ patient: Patient }>()
const emit = defineEmits<{ close: []; saved: [patient: Patient] }>()

const auth = useAuthStore()
const api = useApi()

const firstName = ref(props.patient.first_name)
const lastName = ref(props.patient.last_name)
const email = ref(props.patient.email)

const initialCountryMatch = COUNTRY_CODES.find((c) => props.patient.phone.startsWith(c.code))
const countryCode = ref(initialCountryMatch ? initialCountryMatch.code : '+233')
const phoneNumber = ref(initialCountryMatch ? props.patient.phone.slice(initialCountryMatch.code.length) : props.patient.phone)

const saving = ref(false)
const error = ref('')

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

async function handleSave() {
  if (!firstName.value.trim() || !lastName.value.trim()) {
    error.value = 'First and last name are required'
    return
  }
  saving.value = true
  error.value = ''
  const phone = phoneNumber.value ? normalizePhone(countryCode.value, phoneNumber.value) : ''
  try {
    const updated = await api.updatePatient(
      props.patient.id,
      { first_name: firstName.value.trim(), last_name: lastName.value.trim(), phone, email: email.value.trim() },
      auth.token
    )
    emit('saved', updated)
    emit('close')
  } catch (err: any) {
    error.value = err.message || 'Failed to update profile'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ModalShell title="Edit profile" @close="emit('close')">
    <div class="overflow-y-auto flex-1">
      <div class="relative bg-gradient-to-br from-amber-50 via-rose-50/50 to-primary/8 px-5 py-5 overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,oklch(0.75_0.08_50/0.12),transparent_60%)]" />
        <div class="relative flex items-center gap-3.5">
          <Avatar class="size-12 ring-2 ring-primary/10">
            <AvatarFallback class="bg-primary/10 text-primary text-sm font-semibold">
              {{ getInitials(patient.first_name, patient.last_name) }}
            </AvatarFallback>
          </Avatar>
          <div>
            <p class="text-sm font-semibold text-primary">Personal information</p>
            <p class="text-xs text-muted-foreground/60 mt-0.5">Update your name and contact details</p>
          </div>
        </div>
      </div>

      <div class="p-5 space-y-5">
        <div class="rounded-xl bg-white shadow-sm shadow-black/[0.03] border overflow-hidden divide-y divide-foreground/5">
          <div class="p-5">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Name</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <Label for="edit-first-name" class="text-xs text-muted-foreground">First name</Label>
                <Input id="edit-first-name" input-size="xl" placeholder="First name" v-model="firstName" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-last-name" class="text-xs text-muted-foreground">Last name</Label>
                <Input id="edit-last-name" input-size="xl" placeholder="Last name" v-model="lastName" />
              </div>
            </div>
          </div>

          <div class="p-5">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Contact</p>
            <div class="space-y-4">
              <div class="space-y-1.5">
                <Label for="edit-email" class="text-xs text-muted-foreground">Email</Label>
                <Input id="edit-email" type="email" input-size="xl" placeholder="Email" v-model="email" />
              </div>

              <div class="space-y-1.5">
                <Label for="edit-phone" class="text-xs text-muted-foreground">Phone</Label>
                <div class="flex border rounded-lg overflow-hidden focus-within:ring-3 focus-within:ring-ring/50 focus-within:border-ring border-input">
                  <Select v-model="countryCode">
                    <SelectTrigger size="xl" class="w-[100px] sm:w-[120px] shrink-0 border-0 rounded-none shadow-none pl-3">
                      <SelectValue>
                        <template v-if="COUNTRY_CODES.find((c) => c.code === countryCode)">
                          <span>{{ COUNTRY_CODES.find((c) => c.code === countryCode)?.flag }}</span>
                          <span class="ps-2">{{ countryCode }}</span>
                        </template>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
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
                      id="edit-phone"
                      type="tel"
                      input-size="xl"
                      placeholder="Phone number"
                      :model-value="phoneNumber"
                      @update:model-value="(v) => (phoneNumber = v.replace(/[^\d\s\-()]/g, ''))"
                      class="border-0 rounded-none shadow-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="error" class="px-5">
          <ErrorMessage :message="error" />
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="outline" class="h-11 text-sm" @click="emit('close')">Cancel</Button>
      <Button class="h-11 text-sm gap-1.5" :disabled="saving" @click="handleSave">
        <Spinner v-if="saving" />
        <HugeIcon v-else :icon="CheckmarkCircle02Icon" :stroke-width="2" class="size-4" />
        {{ saving ? 'Saving...' : 'Save' }}
      </Button>
    </template>
  </ModalShell>
</template>
