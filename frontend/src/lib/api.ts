const API_BASE = '/api';

class TokenStore {
  private _token = '';
  private _refreshing: Promise<string> | null = null;
  private _generation = 0;

  get token() { return this._token; }

  set(token: string) {
    this._token = token;
    this._generation++;
  }

  clear() {
    this._token = '';
    this._generation++;
    this._refreshing = null;
  }

  async refresh(): Promise<string> {
    if (this._refreshing) return this._refreshing;

    const gen = this._generation;
    this._refreshing = (async () => {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this._token }),
      });
      if (!res.ok) {
        this._token = '';
        throw new Error('Session expired. Please login again.');
      }
      const data = await res.json();
      if (this._generation !== gen) {
        // session was reset during refresh — discard stale result
        return this._token;
      }
      this._token = data.token;
      return this._token;
    })();

    try {
      return await this._refreshing;
    } finally {
      this._refreshing = null;
    }
  }
}

export const tokenStore = new TokenStore();

function friendlyError(msg: string): string {
  if (/network|connect|refused|unreachable|econnrefused|enotfound|econnreset|failed to fetch|load failed/i.test(msg)) {
    return 'Unable to reach the server. Please check your internet connection and try again.';
  }
  return msg;
}

function hasBearerToken(headers?: HeadersInit): boolean {
  if (!headers) return false;
  const h = headers as Record<string, string>;
  return !!h['Authorization']?.startsWith('Bearer ');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) },
    });
  } catch {
    throw new Error('Unable to reach the server. Please check your internet connection and try again.');
  }

  if (res.status === 401 && hasBearerToken(options?.headers) && tokenStore.token) {
    try {
      await tokenStore.refresh();
      const newHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) };
      newHeaders['Authorization'] = `Bearer ${tokenStore.token}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers: newHeaders });
    } catch {
      throw new Error('Session expired. Please login again.');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(friendlyError(body.error || 'Something went wrong. Please try again.'));
  }
  return res.json();
}

export interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  specialization: string;
}

export interface TimeSlot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_booked?: boolean;
  is_blocked?: boolean;
  doctor_id?: string;
  doctor_name?: string;
  specialization?: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_id: string;
  status: string;
  notes: string;
  attended: boolean | null;
  cancellation_reason: string;
  created_at: string;
}

export interface AppointmentHistoryItem {
  id: string;
  doctor_id: string;
  doctor_name: string;
  specialization: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
  attended: boolean | null;
  cancellation_reason: string;
}

export interface LastDoctorInfo {
  doctor_id: string;
  doctor_name: string;
  specialization: string;
  last_appointment_date: string;
  last_appointment_time: string;
}

export interface UpcomingAppointment {
  id: string;
  doctor_id: string;
  doctor_name: string;
  specialization: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
}

export interface MaxDateResponse {
  max_date: string | null;
}

export interface AvailableDatesResponse {
  dates: string[];
}

export interface DoctorUnavailability {
  id: string;
  doctor_id: string;
  slot_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  created_at: string;
}

export interface ClinicConfig {
  clinicName: string;
  clinicAddress: string;
  minAdvanceDays: number;
}

export const api = {
  requestOtp: (identifier: string) =>
    request<{ message: string }>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),

  verifyOtp: (identifier: string, code: string) =>
    request<{ token: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, code }),
    }),

  createPatient: (data: { first_name: string; last_name: string; phone: string; email: string }, token: string) =>
    request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  getMaxAvailabilityDate: (doctorId?: string) =>
    request<MaxDateResponse>(`/availability/max-date${doctorId ? `?doctor_id=${doctorId}` : ''}`),

  getAvailableDates: (doctorId?: string) =>
    request<AvailableDatesResponse>(`/availability/dates${doctorId ? `?doctor_id=${doctorId}` : ''}`),

  getDoctors: () =>
    request<Doctor[]>('/doctors'),

  getAvailability: (doctorId: string, date: string, patientId?: string) => {
    let url = `/doctors/${doctorId}/availability?date=${date}`;
    if (patientId) url += `&patient_id=${patientId}`;
    return request<TimeSlot[]>(url);
  },

  getAllAvailability: (date: string, patientId?: string) => {
    let url = `/availability?date=${date}`;
    if (patientId) url += `&patient_id=${patientId}`;
    return request<TimeSlot[]>(url);
  },

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

  lookupPatient: (identifier: string, token: string) =>
    request<Patient>(`/patients/lookup?identifier=${encodeURIComponent(identifier)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getLastDoctor: (patientId: string, token: string) =>
    request<LastDoctorInfo | null>(`/patients/${patientId}/last-doctor`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getUpcomingAppointments: (patientId: string, token: string) =>
    request<UpcomingAppointment[]>(`/patients/${patientId}/upcoming-appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateAppointment: (id: string, data: { slot_id?: string; doctor_id?: string; status?: string; attended?: boolean; cancellation_reason?: string }, token: string) =>
    request<Appointment>(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  getAppointmentHistory: (patientId: string, token: string) =>
    request<AppointmentHistoryItem[]>(`/patients/${patientId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updatePatient: (id: string, data: { first_name?: string; last_name?: string; phone?: string; email?: string }, token: string) =>
    request<Patient>(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  checkPatientExists: (params: { email?: string; phone?: string }) => {
    const query = new URLSearchParams();
    if (params.email) query.set('email', params.email);
    if (params.phone) query.set('phone', params.phone);
    return request<{ email_taken: boolean; phone_taken: boolean }>(`/patients/check?${query.toString()}`);
  },

  invalidateToken: (token: string) =>
    request<{ message: string }>('/auth/invalidate', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  getAppointmentConfig: () =>
    request<Array<{ name: string; value: string }>>('/settings/appointment'),

  getDoctorUnavailability: (doctorId: string, token: string) =>
    request<DoctorUnavailability[]>(`/doctors/${doctorId}/unavailability`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createDoctorUnavailability: (doctorId: string, data: { slot_date: string; start_time?: string; end_time?: string; reason?: string }, token: string) =>
    request<DoctorUnavailability>(`/doctors/${doctorId}/unavailability`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteDoctorUnavailability: (doctorId: string, unavailId: string, token: string) =>
    request<void>(`/doctors/${doctorId}/unavailability/${unavailId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
};
