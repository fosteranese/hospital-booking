import type { ApiClient } from '@/lib/api'

export const useApi = (): ApiClient => useNuxtApp().$api as ApiClient
