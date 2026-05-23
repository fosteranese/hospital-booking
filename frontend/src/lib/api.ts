const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Request failed');
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
  created_at: string;
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
  status: string;
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

  createAppointment: (data: { doctor_id: string; slot_id: string }, token: string) =>
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

  updateAppointment: (id: string, data: { slot_id?: string; doctor_id?: string; status?: string }, token: string) =>
    request<Appointment>(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),
};
