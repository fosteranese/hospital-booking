<script setup lang="ts">
import { motion } from 'motion-v'
import type { Doctor } from '@/lib/api'

const props = defineProps<{ excludeDoctorId?: string }>()
const emit = defineEmits<{ select: [doctorId: string | null, doctorName?: string] }>()

const api = useApi()
const doctors = ref<Doctor[]>([])
const loading = ref(true)

onMounted(() => {
  api
    .getDoctors()
    .then((data) => { doctors.value = data })
    .catch(() => {})
    .finally(() => { loading.value = false })
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
            class="w-full justify-start h-auto py-4 px-4 hover:border-primary/50 hover:bg-primary/5 transition-all bg-white/80"
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
              class="w-full justify-start h-auto py-4 px-4 hover:border-primary/50 hover:bg-primary/5 transition-all bg-white/80"
              @click="emit('select', doc.id, `Dr. ${doc.first_name} ${doc.last_name} (${doc.specialization})`)"
            >
              <div class="flex items-center gap-3 w-full min-w-0">
                <Avatar class="border-2 border-primary/10">
                  <AvatarFallback class="bg-primary/10 text-primary text-xs font-semibold">
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
