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
      if (this._generation !== gen) return this._token;
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

  if (res.status === 401 && tokenStore.token) {
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
    throw new Error(body.error || 'Something went wrong. Please try again.');
  }
  return res.json();
}

export interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  specialization: string;
}

export interface DoctorFull extends Doctor {
  email: string;
  phone: string | null;
  created_at: string;
}

export interface AppointmentHistoryItem {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  specialization: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
  attended: boolean | null;
  minutes_late: number | null;
  cancellation_reason: string;
}

export interface AppointmentResponse {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_id: string;
  status: string;
  notes: string;
  attended: boolean | null;
  minutes_late: number | null;
  cancellation_reason: string;
  created_at: string;
}

export interface AppointmentDetail {
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

export interface DoctorUnavailability {
  id: string;
  doctor_id: string;
  slot_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  created_at: string;
}

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface User {
  identifier: string;
  role: string;
  created_at: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
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

export interface AnalyticsOverview {
  total_appointments: number;
  confirmed: number;
  cancelled: number;
  attended: number;
  missed: number;
  today_total: number;
  today_confirmed: number;
  total_patients: number;
  total_doctors: number;
}

export interface DoctorStat {
  doctor_id: string;
  doctor_name: string;
  specialization: string;
  total_appointments: number;
  attended: number;
  missed: number;
  cancelled: number;
  upcoming: number;
}

export interface LoginResponse {
  session_token?: string;
  mfa_methods: string[];
  default_method: string;
  message: string;
  token?: string;
  role?: string;
}

export interface MfaStatus {
  has_password: boolean;
  mfa_methods: string[];
  has_mfa_secret: boolean;
  email: string;
  phone: string;
}

export interface SetupMfaResponse {
  mfa_methods: string[];
  mfa_secret?: string;
  otpauth_url?: string;
  qr_code_svg?: string;
  message: string;
}

export interface ProfileResponse {
  identifier: string;
  role: string;
  created_at: string;
  doctor_id?: string;
  first_name?: string;
  last_name?: string;
  specialization?: string;
  email?: string;
  phone?: string;
}

export interface DashboardStats {
  today_appointments: number;
  missed_today: number;
  tomorrow_appointments: number;
  this_week_appointments: number;
  this_month_appointments: number;
  total_appointments: number;
}

export const api = {
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

  // --- Staff Password + MFA Login ---
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  mfaChallenge: (sessionToken: string, method: string) =>
    request<{ message: string; method: string; session_token: string }>('/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify({ session_token: sessionToken, method }),
    }),

  mfaVerify: (sessionToken: string, method: string, code: string) =>
    request<{ token: string; role: string }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ session_token: sessionToken, method, code }),
    }),

  setPassword: (currentPassword: string | null, newPassword: string, token: string) =>
    request<{ message: string }>('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  mfaStatus: (token: string) =>
    request<MfaStatus>('/auth/mfa-status', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  setupMfa: (mfaMethods: string[], phone: string | null, token: string) =>
    request<SetupMfaResponse>('/auth/mfa', {
      method: 'PUT',
      body: JSON.stringify({ mfa_methods: mfaMethods, phone }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  // --- Profile ---
  getProfile: (token: string) =>
    request<ProfileResponse>('/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getDashboardStats: (token: string) =>
    request<DashboardStats>('/auth/dashboard-stats', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // --- Forgot Password ---
  forgotPasswordInit: (email: string) =>
    request<{ session_token: string; mfa_methods: string[]; message: string; next_method: string }>('/auth/forgot-password/init', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  forgotPasswordVerify: (sessionToken: string, method: string, code: string) =>
    request<{ session_token?: string; reset_token?: string; message: string; phase: string; next_method?: string }>('/auth/forgot-password/verify', {
      method: 'POST',
      body: JSON.stringify({ session_token: sessionToken, method, code }),
    }),

  forgotPasswordReset: (resetToken: string, newPassword: string) =>
    request<{ message: string }>('/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
    }),

  // --- Doctors ---
  getDoctors: () =>
    request<Doctor[]>('/doctors'),

  getDoctor: (id: string, token: string) =>
    request<DoctorFull>(`/doctors/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createDoctor: (data: { first_name: string; last_name: string; specialization: string; email: string; phone?: string }, token: string) =>
    request<DoctorFull>('/doctors', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateDoctor: (id: string, data: { first_name?: string; last_name?: string; specialization?: string; email?: string; phone?: string }, token: string) =>
    request<DoctorFull>(`/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteDoctor: (id: string, token: string) =>
    request<void>(`/doctors/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  // --- Doctor Schedules ---
  getDoctorSchedules: (doctorId: string, token: string) =>
    request<DoctorSchedule[]>(`/doctors/${doctorId}/schedules`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  setDoctorSchedules: (doctorId: string, schedules: { day_of_week: number; start_time: string; end_time: string }[], token: string) =>
    request<DoctorSchedule[]>(`/doctors/${doctorId}/schedules`, {
      method: 'PUT',
      body: JSON.stringify(schedules),
      headers: { Authorization: `Bearer ${token}` },
    }),

  // --- Appointments ---
  listAppointments: (query: { doctor_id?: string; date?: string; from?: string; to?: string; status?: string }, token: string) => {
    const params = new URLSearchParams();
    if (query.doctor_id) params.set('doctor_id', query.doctor_id);
    if (query.date) params.set('date', query.date);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.status) params.set('status', query.status);
    const qs = params.toString();
    return request<AppointmentHistoryItem[]>(`/appointments${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getAppointment: (id: string, token: string) =>
    request<AppointmentDetail>(`/appointments/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  cancelAppointment: (id: string, data: { cancellation_reason?: string }, token: string) =>
    request<AppointmentDetail>(`/appointments/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  rescheduleAppointment: (id: string, data: { slot_id: string; doctor_id?: string }, token: string) =>
    request<AppointmentDetail>(`/appointments/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  changeDoctor: (id: string, data: { doctor_id: string }, token: string) =>
    request<AppointmentDetail>(`/appointments/${id}/change-doctor`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  markAttendance: (id: string, data: { attended: boolean; minutes_late?: number | null }, token: string) =>
    request<AppointmentResponse>(`/appointments/${id}/attendance`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateAppointment: (id: string, data: { notes?: string }, token: string) =>
    request<AppointmentResponse>(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  rescheduleAppointmentToTime: (id: string, data: { slot_date: string; start_time: string; end_time: string; doctor_id?: string; reason?: string }, token: string) =>
    request<{ id: string; message: string }>(`/appointments/${id}/reschedule-time`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  createAppointment: (data: { patient_id: string; doctor_id: string; slot_date: string; start_time: string; end_time: string; notes?: string }, token: string) =>
    request<AppointmentResponse>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  downloadExportCsv: async (query: { doctor_id?: string; date?: string; from?: string; to?: string; status?: string }, token: string) => {
    const params = new URLSearchParams();
    if (query.doctor_id) params.set('doctor_id', query.doctor_id);
    if (query.date) params.set('date', query.date);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.status) params.set('status', query.status);
    const qs = params.toString();
    const url = `${API_BASE}/appointments/export${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to export appointments');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'appointments.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },

  // --- Unavailability ---
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

  // --- Settings ---
  getSettingsGroup: (group: string) =>
    request<Array<{ id: string; group_name: string; name: string; value: string; is_sensitive: boolean; description: string; value_type: string }>>(`/settings/${group}`),

  updateSetting: (group: string, name: string, value: string, token: string) =>
    request<{ id: string; group_name: string; name: string; value: string; is_sensitive: boolean; description: string; value_type: string }>(`/settings/${group}/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  // --- Users ---
  getUsers: (token: string) =>
    request<User[]>('/users', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateUserRole: (identifier: string, role: string, token: string) =>
    request<User>(`/users/${encodeURIComponent(identifier)}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  // --- Patients ---
  searchPatients: (query: string, token: string) =>
    request<Patient[]>(`/patients/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPatientUpcoming: (patientId: string, token: string) =>
    request<UpcomingAppointment[]>(`/patients/${patientId}/upcoming-appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPatientHistory: (patientId: string, token: string) =>
    request<AppointmentHistoryItem[]>(`/patients/${patientId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // --- Analytics ---
  getAnalyticsOverview: (token: string) =>
    request<AnalyticsOverview>('/analytics/overview', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getDoctorStats: (token: string) =>
    request<DoctorStat[]>('/analytics/doctor-stats', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
