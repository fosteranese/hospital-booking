const API_BASE = '/api'
const REQUEST_TIMEOUT = 15_000

export interface ApiAuth {
  getToken(): string
  refresh(): Promise<string>
}

function friendlyError(msg: string): string {
  if (/network|connect|refused|unreachable|econnrefused|enotfound|econnreset|failed to fetch|load failed/i.test(msg)) {
    return 'Unable to reach the server. Please check your internet connection and try again.'
  }
  return msg
}

function hasBearerToken(headers?: HeadersInit): boolean {
  if (!headers) return false
  const h = headers as Record<string, string>
  return !!h['Authorization']?.startsWith('Bearer ')
}

export interface Doctor {
  id: string
  first_name: string
  last_name: string
  specialization: string
}

export interface TimeSlot {
  id: string
  slot_date: string
  start_time: string
  end_time: string
  is_booked?: boolean
  is_blocked?: boolean
  doctor_id?: string
  doctor_name?: string
  specialization?: string
}

export interface Patient {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
}

export interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  slot_id: string
  status: string
  notes: string
  attended: boolean | null
  cancellation_reason: string
  created_at: string
}

export interface AppointmentHistoryItem {
  id: string
  patient_id: string
  patient_name: string
  patient_email: string
  patient_phone: string | null
  doctor_id: string
  doctor_name: string
  specialization: string
  slot_date: string
  start_time: string
  end_time: string
  status: string
  notes: string
  attended: boolean | null
  minutes_late: number | null
  cancellation_reason: string
}

export interface LastDoctorInfo {
  doctor_id: string
  doctor_name: string
  specialization: string
  last_appointment_date: string
  last_appointment_time: string
}

export interface UpcomingAppointment {
  id: string
  doctor_id: string
  doctor_name: string
  specialization: string
  slot_date: string
  start_time: string
  end_time: string
  status: string
  notes: string
}

export interface MaxDateResponse {
  max_date: string | null
}

export interface AvailableDatesResponse {
  dates: string[]
}

export interface SettingResponse {
  id: string
  group_name: string
  name: string
  value: string
  is_sensitive: boolean
  description: string
  value_type: string
}

// createApiClient takes the token/refresh dependency by injection rather than
// reaching for a module-level singleton (the old TokenStore) — the single
// source of truth for auth state lives in stores/auth.ts instead.
export function createApiClient(auth: ApiAuth) {
  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    const doFetch = async (signal: AbortSignal): Promise<Response> => {
      const mergedOptions: RequestInit = {
        ...options,
        signal,
        headers: { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) },
      }
      try {
        return await fetch(`${API_BASE}${path}`, mergedOptions)
      } catch (err: any) {
        if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.')
        throw new Error('Unable to reach the server. Please check your internet connection and try again.')
      }
    }

    let res: Response
    try {
      res = await doFetch(controller.signal)
    } catch (e) {
      clearTimeout(timeoutId)
      throw e
    }

    if (res.status === 401 && hasBearerToken(options?.headers) && auth.getToken()) {
      try {
        controller.abort()
        await auth.refresh()
        const newHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) }
        newHeaders['Authorization'] = `Bearer ${auth.getToken()}`
        const retryController = new AbortController()
        const retryTimeout = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT)
        try {
          res = await fetch(`${API_BASE}${path}`, { ...options, headers: newHeaders, signal: retryController.signal })
        } finally {
          clearTimeout(retryTimeout)
        }
      } catch {
        clearTimeout(timeoutId)
        throw new Error('Session expired. Please login again.')
      }
    }

    clearTimeout(timeoutId)

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(friendlyError(body.error || 'Something went wrong. Please try again.'))
    }
    return res.json()
  }

  // Per-instance TTL cache (not module scope — under SSR that would leak
  // across requests; here it's scoped to this client instance).
  let doctorsCache: { data: Doctor[]; expiry: number } | null = null
  const DOCTORS_TTL = 300_000

  return {
    requestOtp: (identifier: string) =>
      request<{ message: string }>('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      }),

    verifyOtp: (identifier: string, code: string) =>
      request<{ token: string; role: string }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier, code }),
      }),

    // Same response shape as verifyOtp plus `identifier` (the verified
    // email) — the caller doesn't already know it the way it does for
    // OTP, since Google/Apple are the ones revealing it.
    oauthGoogle: (idToken: string) =>
      request<{ token: string; role: string; identifier: string }>('/auth/oauth/google', {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken }),
      }),

    oauthApple: (idToken: string) =>
      request<{ token: string; role: string; identifier: string }>('/auth/oauth/apple', {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken }),
      }),

    invalidateToken: (token: string) =>
      request<{ message: string }>('/auth/invalidate', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),

    createPatient: (data: { first_name: string; last_name: string; phone: string; email: string }, token: string) =>
      request<Patient>('/patients', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),

    lookupPatient: (identifier: string, token: string) =>
      request<Patient>(`/patients/lookup?identifier=${encodeURIComponent(identifier)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    updatePatient: (id: string, data: { first_name?: string; last_name?: string; phone?: string; email?: string }, token: string) =>
      request<Patient>(`/patients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),

    checkPatientExists: (params: { email?: string; phone?: string }) => {
      const query = new URLSearchParams()
      if (params.email) query.set('email', params.email)
      if (params.phone) query.set('phone', params.phone)
      return request<boolean>(`/patients/check?${query.toString()}`)
    },

    getLastDoctor: (patientId: string, token: string) =>
      request<LastDoctorInfo | null>(`/patients/${patientId}/last-doctor`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getUpcomingAppointments: (patientId: string, token: string) =>
      request<UpcomingAppointment[]>(`/patients/${patientId}/upcoming-appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getAppointmentHistory: (patientId: string, token: string) =>
      request<AppointmentHistoryItem[]>(`/patients/${patientId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getDoctors: () => {
      if (doctorsCache && doctorsCache.expiry > Date.now()) return Promise.resolve(doctorsCache.data)
      return request<Doctor[]>('/doctors').then((data) => {
        doctorsCache = { data, expiry: Date.now() + DOCTORS_TTL }
        return data
      })
    },

    getAvailability: (doctorId: string, date: string, patientId?: string) => {
      let url = `/doctors/${doctorId}/availability?date=${date}`
      if (patientId) url += `&patient_id=${patientId}`
      return request<TimeSlot[]>(url)
    },

    getAllAvailability: (date: string, patientId?: string) => {
      let url = `/availability?date=${date}`
      if (patientId) url += `&patient_id=${patientId}`
      return request<TimeSlot[]>(url)
    },

    getMaxAvailabilityDate: (doctorId?: string) =>
      request<MaxDateResponse>(`/availability/max-date${doctorId ? `?doctor_id=${doctorId}` : ''}`),

    getAvailableDates: (doctorId?: string) =>
      request<AvailableDatesResponse>(`/availability/dates${doctorId ? `?doctor_id=${doctorId}` : ''}`),

    createAppointment: (data: { doctor_id: string; slot_id: string; patient_id?: string; notes?: string }, token: string) =>
      request<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),

    getAppointment: (id: string, token: string) =>
      request<Appointment>(`/appointments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    cancelAppointment: (id: string, data: { cancellation_reason?: string }, token: string) =>
      request<Appointment>(`/appointments/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),

    rescheduleAppointment: (id: string, data: { slot_id: string; doctor_id?: string }, token: string) =>
      request<Appointment>(`/appointments/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),

    changeDoctor: (id: string, data: { doctor_id: string }, token: string) =>
      request<Appointment>(`/appointments/${id}/change-doctor`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),

    markAttendance: (id: string, data: { attended: boolean }, token: string) =>
      request<Appointment>(`/appointments/${id}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),

    getAppointmentConfig: () =>
      request<Array<{ name: string; value: string }>>('/settings/appointment'),

    getSettingsGroup: (group: string) =>
      request<SettingResponse[]>(`/settings/${group}`),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
