use chrono::{NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Patient {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub email: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct AvailabilitySlot {
    pub id: Uuid,
    pub doctor_id: Uuid,
    pub slot_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub is_booked: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Appointment {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub slot_id: Uuid,
    pub status: String,
    pub notes: String,
    pub attended: Option<bool>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AppointmentHistoryItem {
    pub id: Uuid,
    pub doctor_id: Uuid,
    pub doctor_name: String,
    pub specialization: String,
    pub slot_date: chrono::NaiveDate,
    pub start_time: chrono::NaiveTime,
    pub end_time: chrono::NaiveTime,
    pub status: String,
    pub notes: String,
    pub attended: Option<bool>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct OtpCode {
    pub id: Uuid,
    pub identifier: String,
    pub code: String,
    pub is_used: bool,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct DoctorWithName {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub specialization: String,
}

#[derive(Debug, Serialize)]
pub struct LastDoctorInfo {
    pub doctor_id: Uuid,
    pub doctor_name: String,
    pub specialization: String,
    pub last_appointment_date: chrono::NaiveDate,
    pub last_appointment_time: chrono::NaiveTime,
}

#[derive(Debug, Serialize, FromRow)]
pub struct UpcomingAppointment {
    pub id: Uuid,
    pub doctor_id: Uuid,
    pub doctor_name: String,
    pub specialization: String,
    pub slot_date: chrono::NaiveDate,
    pub start_time: chrono::NaiveTime,
    pub status: String,
}
