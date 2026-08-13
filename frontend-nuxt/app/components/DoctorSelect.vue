<script setup lang="ts">
import { motion } from 'motion-v'
import type { Doctor } from '@/lib/api'
import { getAvatarGradient } from '@/lib/avatar'
import { formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CalendarBlock02Icon } from '@hugeicons/core-free-icons'

const props = defineProps<{ excludeDoctorId?: string }>()
const emit = defineEmits<{ select: [doctorId: string | null, doctorName?: string] }>()

const api = useApi()
const doctors = ref<Doctor[]>([])
const loading = ref(true)
// undefined = still fetching that doctor's soonest open date, null = fetched
// and there isn't one, string = the date. A secondary, non-blocking fetch —
// the doctor list itself never waits on this.
const nextAvailable = ref<Record<string, string | null>>({})
const unavailableDoctor = ref<Doctor | null>(null)

function handleDoctorClick(doc: Doctor) {
  // Only block on a *confirmed* empty slot list (null) -- if the
  // secondary next-available fetch hasn't resolved yet (undefined), don't
  // make the patient wait on it just to pick a doctor.
  if (nextAvailable.value[doc.id] === null) {
    unavailableDoctor.value = doc
    return
  }
  emit('select', doc.id, `Dr. ${doc.first_name} ${doc.last_name} (${doc.specialization})`)
}

function loadNextAvailable(list: Doctor[]) {
  for (const doc of list) {
    api
      .getAvailableDates(doc.id)
      .then((res) => { nextAvailable.value[doc.id] = res.dates[0] ?? null })
      .catch(() => { nextAvailable.value[doc.id] = null })
  }
}

onMounted(() => {
  api
    .getDoctors()
    .then((data) => {
      const list = props.excludeDoctorId ? data.filter((d) => d.id !== props.excludeDoctorId) : data
      // A "choice" of one option isn't a choice — skip the screen entirely
      // and go straight to the one doctor available, same as if the patient
      // had picked them. Checked before ever setting loading=false, so the
      // list UI never has a chance to flash on screen first.
      if (list.length === 1) {
        const only = list[0]!
        emit('select', only.id, `Dr. ${only.first_name} ${only.last_name} (${only.specialization})`)
        return
      }
      doctors.value = data
      loading.value = false
      loadNextAvailable(list)
    })
    .catch(() => { loading.value = false })
})

const filtered = computed(() => (props.excludeDoctorId ? doctors.value.filter((d) => d.id !== props.excludeDoctorId) : doctors.value))
</script>

<template>
  <Card class="w-full mx-auto bg-transparent ring-0 shadow-none overflow-visible">
    <CardHeader class="px-0">
      <CardTitle class="text-foreground">Choose your specialist</CardTitle>
      <CardDescription>
        {{ excludeDoctorId ? "Let's find you a new doctor" : "Pick a doctor you're comfortable with, or let us auto-assign" }}
      </CardDescription>
    </CardHeader>
    <CardContent class="px-0 space-y-3">
      <div class="space-y-2">
        <motion.div v-if="!excludeDoctorId" :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="{ delay: 0 }">
          <Button
            variant="outline"
            class="w-full justify-start h-auto py-4 px-4 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 bg-white"
            @click="emit('select', null)"
          >
            <div class="flex items-center gap-3.5 w-full min-w-0">
              <div class="size-14 sm:size-16 rounded-2xl shrink-0 flex items-center justify-center border-2 border-dashed border-muted-foreground/30 text-muted-foreground font-semibold">
                AU
              </div>
              <div class="text-left min-w-0">
                <p class="font-medium text-base">Auto-assign</p>
                <p class="text-sm text-muted-foreground text-wrap">We'll match you with the doctor who's best for you</p>
              </div>
            </div>
          </Button>
        </motion.div>

        <template v-if="loading">
          <motion.div
            v-for="i in 3"
            :key="`skel-${i}`"
            :initial="{ opacity: 0, y: 12 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ delay: (i - 1) * 0.06 }"
          >
            <div class="w-full flex items-center gap-3.5 py-4 px-4 rounded-xl bg-white/50 mb-2">
              <div class="size-14 sm:size-16 rounded-2xl bg-muted animate-skeleton shrink-0" />
              <div class="space-y-2 flex-1">
                <div class="h-4 w-2/3 rounded-md bg-muted animate-skeleton" />
                <div class="h-3 w-1/3 rounded-md bg-muted animate-skeleton" />
              </div>
            </div>
          </motion.div>
        </template>

        <template v-else>
          <motion.div
            v-for="(doc, i) in filtered"
            :key="doc.id"
            :initial="{ opacity: 0, y: 12 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ delay: i * 0.06 }"
          >
            <Button
              variant="outline"
              :class="cn(
                'w-full justify-start h-auto py-4 px-4 rounded-xl shadow-sm transition-all duration-200 bg-white',
                nextAvailable[doc.id] === null
                  ? 'opacity-60 hover:opacity-80'
                  : 'hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5'
              )"
              @click="handleDoctorClick(doc)"
            >
              <div class="flex items-center gap-3.5 w-full min-w-0">
                <div
                  :class="`size-14 sm:size-16 rounded-2xl shrink-0 flex items-center justify-center text-white font-semibold text-base shadow-sm bg-gradient-to-br ${getAvatarGradient(`${doc.first_name} ${doc.last_name}`)} ${nextAvailable[doc.id] === null ? 'grayscale' : ''}`"
                >
                  {{ doc.first_name[0] }}{{ doc.last_name[0] }}
                </div>
                <div class="text-left min-w-0">
                  <p class="font-medium text-base">Dr. {{ doc.first_name }} {{ doc.last_name }}</p>
                  <p class="text-sm text-muted-foreground">{{ doc.specialization }}</p>
                  <div class="h-4 mt-1">
                    <div v-if="nextAvailable[doc.id] === undefined" class="h-3 w-24 rounded bg-muted animate-skeleton" />
                    <p v-else-if="nextAvailable[doc.id]" class="text-xs font-semibold text-primary">
                      Next available {{ formatDateShort(nextAvailable[doc.id]!) }}
                    </p>
                    <p v-else class="text-xs text-muted-foreground/50">No upcoming availability</p>
                  </div>
                </div>
              </div>
            </Button>
          </motion.div>
        </template>
      </div>
    </CardContent>
  </Card>

  <ConfirmDialog
    :open="unavailableDoctor !== null"
    :title="unavailableDoctor ? `Dr. ${unavailableDoctor.first_name} ${unavailableDoctor.last_name} isn't taking bookings right now` : ''"
    description="They have no upcoming open slots. Please pick another doctor, or let us auto-assign one for you."
    :icon="CalendarBlock02Icon"
    confirm-label="Choose another doctor"
    hide-cancel
    @update:open="(v) => { if (!v) unavailableDoctor = null }"
    @confirm="unavailableDoctor = null"
  />
</template>
