<script setup lang="ts">
import { GoogleIcon, AppleIcon, CalendarAdd01Icon } from '@hugeicons/core-free-icons'
import { downloadIcs, getGoogleCalendarUrl, getOutlookUrl } from '@/lib/calendar'

const props = defineProps<{
  title: string
  description: string
  location: string
  startDate: string
  startTime: string
  endTime: string
}>()

const event = computed(() => ({
  title: props.title,
  description: props.description,
  location: props.location,
  startDate: props.startDate,
  startTime: props.startTime,
  endTime: props.endTime,
}))

function openGoogle() {
  window.open(getGoogleCalendarUrl(event.value), '_blank', 'noopener')
}
function openOutlook() {
  window.open(getOutlookUrl(event.value), '_blank', 'noopener')
}
function downloadAppleIcs() {
  downloadIcs(event.value)
}
</script>

<template>
  <div class="space-y-2.5">
    <p class="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest text-center">Add to calendar</p>
    <div class="flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" class="gap-1.5 bg-white/80 hover:bg-white px-3" @click="openGoogle">
        <HugeIcon :icon="GoogleIcon" :stroke-width="2" class="size-3.5" />
        <span class="text-xs">Google</span>
      </Button>
      <Button variant="outline" size="sm" class="gap-1.5 bg-white/80 hover:bg-white px-3" @click="downloadAppleIcs">
        <HugeIcon :icon="AppleIcon" :stroke-width="2" class="size-3.5" />
        <span class="text-xs">Apple</span>
      </Button>
      <Button variant="outline" size="sm" class="gap-1.5 bg-white/80 hover:bg-white px-3" @click="openOutlook">
        <HugeIcon :icon="CalendarAdd01Icon" :stroke-width="2" class="size-3.5" />
        <span class="text-xs">Outlook</span>
      </Button>
    </div>
  </div>
</template>
