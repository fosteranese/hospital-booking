<script setup lang="ts">
import { motion } from 'motion-v'
import type { TimeSlot } from '@/lib/api'
import { Calendar01Icon, Clock01Icon, CheckmarkCircle01Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{ doctorId: string | null; defaultDate?: string; patientId?: string }>(),
  { defaultDate: '' }
)
const emit = defineEmits<{ selectSlot: [slotId: string, date: string, startTime: string, endTime: string, doctorId?: string] }>()

const api = useApi()
const clinic = useClinicStore()

type Period = 'morning' | 'afternoon' | 'evening'
const periodConfig: Record<Period, { label: string; range: string }> = {
  morning: { label: 'Morning', range: 'Before noon' },
  afternoon: { label: 'Afternoon', range: '12:00 — 16:59' },
  evening: { label: 'Evening', range: '17:00 onwards' },
}

function getPeriod(time: string): Period {
  const h = parseInt(time.split(':')[0]!, 10)
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function groupSlotsByPeriod(slots: TimeSlot[]): { period: Period; slots: TimeSlot[] }[] {
  const groups: Record<Period, TimeSlot[]> = { morning: [], afternoon: [], evening: [] }
  for (const slot of slots) groups[getPeriod(slot.start_time)].push(slot)
  return (Object.keys(periodConfig) as Period[])
    .map((period) => ({ period, slots: groups[period] }))
    .filter((g) => g.slots.length > 0)
}

const date = ref(props.defaultDate)
const slots = ref<TimeSlot[]>([])
const loading = ref(false)
const selectedSlot = ref<string | null>(null)
const availableDates = ref<string[]>([])
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const stripRef = ref<HTMLDivElement | null>(null)

function checkScroll() {
  const el = stripRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 4
}

function scrollStrip(dir: 'left' | 'right') {
  const el = stripRef.value
  if (!el) return
  const card = el.children[0] as HTMLElement | undefined
  const step = (card?.offsetWidth ?? 72) + 8
  el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' })
}

// Available dates for the current doctor (or all doctors, if auto-assign).
watch(
  () => props.doctorId,
  (doctorId, _old, onCleanup) => {
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    api
      .getAvailableDates(doctorId ?? undefined)
      .then((res) => {
        if (abort.signal.aborted) return
        availableDates.value = res.dates
        if (!date.value && res.dates.length > 0) date.value = res.dates[0]!
        setTimeout(checkScroll, 50)
      })
      .catch(() => { if (!abort.signal.aborted) availableDates.value = [] })
  },
  { immediate: true }
)

onMounted(() => {
  const el = stripRef.value
  if (!el) return
  el.addEventListener('scroll', checkScroll, { passive: true })
  checkScroll()
})
onUnmounted(() => {
  stripRef.value?.removeEventListener('scroll', checkScroll)
})

// Slots for the selected date + doctor, with auto-skip of a date that turns
// out to have zero available slots (subtle behavior from the React source —
// removes that date from the strip and advances to the next one).
watch(
  [date, () => props.doctorId, () => props.patientId],
  ([d, doctorId, patientId], _old, onCleanup) => {
    if (!d) return
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    loading.value = true
    selectedSlot.value = null
    const fetchSlots = doctorId ? api.getAvailability(doctorId, d, patientId) : api.getAllAvailability(d, patientId)
    fetchSlots
      .then((fetched) => {
        if (abort.signal.aborted) return
        slots.value = fetched
        const avail = fetched.filter((s) => !s.is_booked && !s.is_blocked)
        if (avail.length === 0 && availableDates.value.length > 1) {
          const dates = availableDates.value
          const idx = dates.indexOf(d)
          availableDates.value = dates.filter((dd) => dd !== d)
          const nextDate = dates.find((_dd, i) => i > idx)
          if (nextDate) date.value = nextDate
        }
      })
      .catch(() => { if (!abort.signal.aborted) slots.value = [] })
      .finally(() => { if (!abort.signal.aborted) loading.value = false })
  }
)

// Center the selected date pill in the scroll strip.
watch([date, availableDates], () => {
  nextTick(() => {
    const el = stripRef.value
    if (!el || !date.value) return
    const idx = availableDates.value.indexOf(date.value)
    if (idx < 0) return
    const child = el.children[idx] as HTMLElement | undefined
    if (!child) return
    const offset = child.offsetLeft - el.offsetLeft - (el.clientWidth - child.offsetWidth) / 2
    el.scrollTo({ left: offset, behavior: 'smooth' })
  })
})

const availableSlots = computed(() => slots.value.filter((s) => !s.is_booked && !s.is_blocked))
const unavailableCount = computed(() => slots.value.length - availableSlots.value.length)
const grouped = computed(() => groupSlotsByPeriod(availableSlots.value))

function handleSlotClick(slot: TimeSlot) {
  selectedSlot.value = slot.id
  emit('selectSlot', slot.id, slot.slot_date, slot.start_time, slot.end_time, slot.doctor_id)
}
</script>

<template>
  <Card class="w-full mx-auto bg-transparent ring-0 shadow-none overflow-visible">
    <CardHeader class="px-0">
      <CardTitle class="text-foreground">{{ doctorId ? 'Choose your date & time' : 'Pick a date' }}</CardTitle>
      <CardDescription v-if="clinic.minAdvanceDays > 0">
        We show times starting {{ clinic.minAdvanceDays }} day{{ clinic.minAdvanceDays === 1 ? '' : 's' }} out, so our team always has time to prepare for your visit.
      </CardDescription>
    </CardHeader>
    <CardContent class="px-0 space-y-5">
      <div v-if="availableDates.length > 0" class="space-y-2">
        <p class="text-xs text-muted-foreground">Select a date</p>
        <div class="relative">
          <div
            ref="stripRef"
            class="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth no-scrollbar pb-1 overscroll-x-contain snap-x snap-mandatory"
          >
            <motion.button
              v-for="d in availableDates"
              :key="d"
              type="button"
              :while-tap="{ scale: 0.93 }"
              @click="date = d"
              :class="cn(
                'flex flex-col items-center gap-0.5 min-w-[56px] sm:min-w-[68px] py-2.5 sm:py-3 px-2 sm:px-2.5 rounded-xl border transition-all shrink-0 snap-center',
                d === date
                  ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                  : 'bg-white text-foreground border-foreground/10 hover:border-primary/40 hover:text-primary'
              )"
            >
              <span class="text-[10px] font-medium uppercase tracking-wider opacity-70">
                {{ new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }) }}
              </span>
              <span class="text-lg sm:text-xl font-semibold leading-tight">{{ new Date(d + 'T12:00:00').getDate() }}</span>
              <span class="text-[10px] font-medium opacity-70">
                {{ new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }) }}
              </span>
            </motion.button>
          </div>
          <button
            type="button"
            :disabled="!canScrollLeft"
            class="absolute left-0 top-0 bottom-1 w-8 sm:w-7 flex items-center justify-center bg-gradient-to-r from-white via-white/90 to-transparent rounded-l-xl disabled:opacity-0 transition-opacity cursor-pointer"
            aria-label="Previous dates"
            @click="scrollStrip('left')"
          >
            <HugeIcon :icon="ArrowLeft01Icon" :stroke-width="2" class="size-4 sm:size-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            :disabled="!canScrollRight"
            class="absolute right-0 top-0 bottom-1 w-8 sm:w-7 flex items-center justify-center bg-gradient-to-l from-white via-white/90 to-transparent rounded-r-xl disabled:opacity-0 transition-opacity cursor-pointer"
            aria-label="Next dates"
            @click="scrollStrip('right')"
          >
            <HugeIcon :icon="ArrowRight01Icon" :stroke-width="2" class="size-4 sm:size-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <!-- No AnimatePresence (see plan §7.1 finding) — plain v-if/else-if chain, each branch keeps its own enter animation. -->
      <motion.div v-if="!date" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" class="flex flex-col items-center gap-2 pt-4 pb-2">
        <HugeIcon :icon="Calendar01Icon" :stroke-width="2" class="size-8 text-muted-foreground/30" />
        <p class="text-xs text-muted-foreground/60">Pick a date to see available times</p>
      </motion.div>

      <motion.div v-else-if="loading" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" class="space-y-2">
        <div class="flex items-center gap-2 mb-3">
          <div class="h-4 w-24 rounded-md bg-muted animate-skeleton" />
          <div class="h-4 w-12 rounded-full bg-muted animate-skeleton" />
        </div>
        <div v-for="i in 4" :key="i" class="h-14 rounded-xl bg-muted animate-skeleton" />
      </motion.div>

      <motion.div v-else-if="availableSlots.length > 0" :initial="{ opacity: 0, y: 8 }" :animate="{ opacity: 1, y: 0 }" class="space-y-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available times</p>
          <Badge variant="secondary" class="text-[10px] px-1.5 py-0 rounded-full">
            {{ availableSlots.length }} slot{{ availableSlots.length > 1 ? 's' : '' }}
          </Badge>
        </div>

        <div v-for="group in grouped" :key="group.period" class="space-y-2">
          <div class="flex items-baseline gap-2">
            <p class="text-sm font-medium text-foreground">{{ periodConfig[group.period].label }}</p>
            <p class="text-[11px] text-muted-foreground">{{ periodConfig[group.period].range }}</p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <motion.button
              v-for="slot in group.slots"
              :key="slot.id"
              type="button"
              layout
              :initial="{ opacity: 0, y: 6 }"
              :animate="{ opacity: 1, y: 0 }"
              :class="cn(
                'relative flex items-center justify-center w-full text-center rounded-xl border px-2 sm:px-2.5 py-2.5 sm:py-2.5 transition-all overflow-hidden',
                selectedSlot === slot.id
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-white text-foreground border-foreground/10 hover:border-primary/40 active:scale-[0.98]'
              )"
              @click="handleSlotClick(slot)"
            >
              <span :class="cn('text-xs font-medium', selectedSlot === slot.id && 'text-white')">
                <span class="sm:hidden">{{ slot.start_time.slice(0, 5) }}</span>
                <span class="hidden sm:inline">{{ slot.start_time.slice(0, 5) }} — {{ slot.end_time.slice(0, 5) }}</span>
              </span>
              <motion.div
                v-if="selectedSlot === slot.id"
                :initial="{ scale: 0 }"
                :animate="{ scale: 1 }"
                class="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-white flex items-center justify-center shadow-xs"
              >
                <HugeIcon :icon="CheckmarkCircle01Icon" :stroke-width="2" class="size-2.5 text-primary" />
              </motion.div>
            </motion.button>
          </div>
        </div>

        <p v-if="unavailableCount > 0" class="text-xs text-muted-foreground/40 text-center pt-1">
          {{ unavailableCount }} of {{ slots.length }} slot{{ slots.length > 1 ? 's' : '' }} already booked
        </p>
      </motion.div>

      <motion.div
        v-else
        :initial="{ opacity: 0, y: 8 }"
        :animate="{ opacity: 1, y: 0 }"
        class="flex flex-col items-center gap-2 rounded-xl bg-white border-2 border-dashed border-foreground/10 py-10 px-4"
      >
        <HugeIcon :icon="Clock01Icon" :stroke-width="2" class="size-8 text-muted-foreground/30" />
        <p class="text-sm text-muted-foreground">No open times on this date</p>
        <p class="text-xs text-muted-foreground/60">Try a nearby date instead</p>
      </motion.div>
    </CardContent>
  </Card>
</template>
