<script setup lang="ts">
import { motion } from 'motion-v'
import type { Doctor } from '@/lib/api'
import { getAvatarColor } from '@/lib/avatar'

const props = defineProps<{ excludeDoctorId?: string }>()
const emit = defineEmits<{ select: [doctorId: string | null, doctorName?: string] }>()

const api = useApi()
const doctors = ref<Doctor[]>([])
const loading = ref(true)

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
            <div class="flex items-center gap-3 w-full min-w-0">
              <Avatar class="border-2 border-dashed border-muted-foreground/30">
                <AvatarFallback class="bg-transparent text-muted-foreground">AU</AvatarFallback>
              </Avatar>
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
            <div class="w-full flex items-center gap-3 py-4 px-4 rounded-4xl bg-white/50 mb-2">
              <div class="size-12 rounded-full bg-muted animate-skeleton shrink-0" />
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
              class="w-full justify-start h-auto py-4 px-4 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 bg-white"
              @click="emit('select', doc.id, `Dr. ${doc.first_name} ${doc.last_name} (${doc.specialization})`)"
            >
              <div class="flex items-center gap-3 w-full min-w-0">
                <Avatar class="border-2 border-white shadow-sm">
                  <AvatarFallback :class="`text-xs font-semibold ${getAvatarColor(`${doc.first_name} ${doc.last_name}`).bg} ${getAvatarColor(`${doc.first_name} ${doc.last_name}`).text}`">
                    {{ doc.first_name[0] }}{{ doc.last_name[0] }}
                  </AvatarFallback>
                </Avatar>
                <div class="text-left min-w-0">
                  <p class="font-medium text-base">Dr. {{ doc.first_name }} {{ doc.last_name }}</p>
                  <p class="text-sm text-muted-foreground">{{ doc.specialization }}</p>
                </div>
              </div>
            </Button>
          </motion.div>
        </template>
      </div>
    </CardContent>
  </Card>
</template>
