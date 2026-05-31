# HospitalBooking — Project Context

## Overview
Full-stack self-service hospital appointment booking system. Patients book doctor appointments through a multi-step wizard: OTP verification → personal details → doctor selection (or auto-assign) → date/time picker → confirmation. Handles returning patient detection, enforces minimum gaps between same-patient appointments, and dynamically generates slots from configurable clinic hours.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Vega), Framer Motion |
| Backend | Rust, Axum 0.7, SQLx 0.8 |
| Database | PostgreSQL 16 |
| Auth | JWT (jsonwebtoken), SHA-256 hashed OTPs |
| Email/SMS | SMTP via lettre, mock SMS |
| Tests | Playwright e2e (12 tests) |

---

## Quick Start

```bash
# Backend (port 3000)
cd backend && cargo run

# Frontend (port 5173, proxies /api → :3000)
cd frontend && npm install && npm run dev
```

Or `make dev` to run both concurrently.

---

## Environment Variables (backend/.env)

Copy `.env.example` → `.env` and fill in your values.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `DEV_MODE` | Set `true` to use dev OTP code `123456` |
| `SETTINGS_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM encryption |

---

## Project Structure

```
hospital-booking/
├── backend/
│   ├── migrations/          # 16 SQLx migrations (patients, doctors, slots, appointments, OTP, settings, etc.)
│   ├── src/
│   │   ├── main.rs          # Server entry point — loads settings, state, routes, slot generation
│   │   ├── state.rs         # AppState struct (pool, email/sms services, jwt, settings)
│   │   ├── db.rs            # Database connection and migration runner
│   │   ├── error.rs         # AppError enum
│   │   ├── models/mod.rs    # Database models and response types
│   │   ├── routes/
│   │   │   ├── auth.rs      # OTP request/verify, token refresh
│   │   │   ├── patients.rs  # CRUD, lookup, history, upcoming, last doctor
│   │   │   ├── doctors.rs   # List, availability, max-date, available dates
│   │   │   ├── appointments.rs  # Create, get, cancel, reschedule, change-doctor, mark-attendance
│   │   │   └── settings.rs  # Get/update settings groups
│   │   ├── services/
│   │   │   ├── otp.rs       # OTP generation and hashing
│   │   │   ├── jwt.rs       # JWT create/verify/refresh
│   │   │   ├── email.rs     # SMTP via lettre
│   │   │   ├── sms.rs       # Mock SMS service
│   │   │   ├── slots.rs     # Dynamic slot generation + hourly regeneration
│   │   │   └── settings.rs  # SettingsService with AES-256-GCM encryption for sensitive values
│   │   └── middleware/
│   │       └── auth.rs      # JWT auth middleware
│   └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── main.tsx         # React entry
│   │   ├── App.tsx          # BrowserRouter, single route "/" → BookAppointment
│   │   ├── index.css        # Global styles, Tailwind CSS v4
│   │   ├── pages/
│   │   │   └── BookAppointment.tsx  # Main wizard orchestrator
│   │   ├── components/
│   │   │   ├── AuthFlow.tsx            # Step 1 — OTP auth with phone/email
│   │   │   ├── PatientForm.tsx         # New patient details form
│   │   │   ├── DoctorSelect.tsx        # Doctor list with auto-assign
│   │   │   ├── BookingForm.tsx         # Date/time slot picker
│   │   │   ├── AppointmentSummary.tsx  # Pre-confirmation review
│   │   │   ├── LeftPanel.tsx           # Sidebar with branding + step progress
│   │   │   ├── ExistingPatientReview.tsx  # Returning patient dashboard
│   │   │   ├── EditProfileModal.tsx    # Edit patient name/email/phone
│   │   │   ├── HistoryModal.tsx        # Past appointments table (paginated >10)
│   │   │   ├── AppointmentDetailModal.tsx  # Single appointment detail view (uses useClinic)
│   │   │   ├── cancel-appointment-dialog.tsx  # Cancel confirmation (reason required)
│   │   │   ├── AddToCalendar.tsx       # Google/Apple/Outlook calendar links
│   │   │   ├── loading-overlay.tsx     # Spinner overlay
│   │   │   └── ui/                     # shadcn/ui components
│   │   ├── contexts/
│   │   │   ├── auth-context.tsx    # AuthProvider — token, role, identifier
│   │   │   └── clinic-context.tsx  # ClinicProvider — name, address, minAdvanceDays
│   │   ├── lib/
│   │   │   ├── api.ts         # API client with token auto-refresh
│   │   │   ├── booking-storage.ts  # sessionStorage persistence
│   │   │   ├── calendar.ts    # ICS + calendar URL generation
│   │   │   ├── country-codes.ts
│   │   │   └── utils.ts       # cn() utility
│   │   └── hooks/
│   │       ├── use-mobile.ts
│   │       └── use-toast.ts
│   ├── e2e/
│   │   └── booking-flow.spec.ts  # 12 Playwright tests
│   ├── playwright.config.ts
│   └── vite.config.ts          # /api proxy to :3000
├── Makefile                   # dev-api, dev-web, dev, db-migrate, build, lint
└── README.md
```

---

## API Routes

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/request-otp` | Request OTP (email or phone) |
| POST | `/api/auth/verify-otp` | Verify OTP, returns JWT |
| POST | `/api/auth/refresh` | Refresh expired JWT (7-day grace, rejected if blacklisted) |
| POST | `/api/auth/invalidate` | Invalidate a token (adds SHA-256 hash to blacklist) |

### Patients (auth required except check)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/patients/check` | Check email/phone uniqueness |
| POST | `/api/patients` | Create patient |
| GET | `/api/patients/lookup` | Lookup by email or phone |
| GET | `/api/patients/:id/last-doctor` | Last visited doctor |
| GET | `/api/patients/:id/upcoming-appointments` | Future confirmed appointments |
| GET | `/api/patients/:id/history` | Past + cancelled appointments |
| PUT | `/api/patients/:id` | Update patient |

### Doctors
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/doctors` | List all doctors |
| GET | `/api/doctors/:id/availability` | Slots for a doctor on a date |
| GET | `/api/availability` | Slots for all doctors on a date |
| GET | `/api/availability/max-date` | Last available date |
| GET | `/api/availability/dates` | All dates with free slots |

### Appointments (auth required)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/appointments` | Create appointment |
| GET | `/api/appointments/:id` | Get appointment |
| PATCH | `/api/appointments/:id/cancel` | Cancel (frees slot) — patient, admin, scheduler |
| PATCH | `/api/appointments/:id/reschedule` | Change time slot (±doctor) — patient, admin, scheduler |
| PATCH | `/api/appointments/:id/change-doctor` | Change doctor only — patient, admin, scheduler |
| PATCH | `/api/appointments/:id/attendance` | Mark attended/missed — admin, scheduler, patient (own) |

### Settings
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/settings/:group/:name` | Get single setting |
| PUT | `/api/settings/:group/:name` | Update setting |
| GET | `/api/settings/:group` | Get group settings |

---

## AppState

```rust
pub struct AppState {
    pub pool: PgPool,
    pub email_service: Arc<EmailService>,
    pub sms_service: Arc<SmsService>,
    pub jwt_secret: String,
    pub min_gap_minutes: i64,      // between same-patient appointments
    pub min_advance_days: i64,     // days ahead required to book
    pub clinic_name: String,
    pub clinic_address: String,
    pub settings: SettingsService,
}
```

---

## Settings Groups

| Group | Key | Default | Description |
|-------|-----|---------|-------------|
| appointment | `min_advance_days` | `7` | Minimum advance days for booking |
| appointment | `max_upcoming_appointments` | `3` | Max upcoming appointments per patient |
| appointment | `clinic_name` | `MEDIPORT FERTILITY SERVICES` | Clinic name |
| appointment | `clinic_address` | `Bissau Avenue, East-Legon, Accra, Ghana` | Clinic address |
| appointment | `duration_minutes` | `30` | Slot duration |
| appointment | `days_ahead` | `14` | Days ahead to generate slots |
| appointment | `min_gap_minutes` | `180` | Min gap between same-patient bookings |
| appointment | `day_0_hours` .. `day_6_hours` | `09:00-17:00` (weekdays) | Per-day operating hours |
| smtp | `host`, `port`, `username`, `password` | — | SMTP config (password encrypted) |
| otp | `expiry_minutes` | `10` | OTP validity |

Updating appointment settings triggers slot regeneration.

---

## Slot Generation

- Runs on startup and hourly via background tokio task
- Start date = `today + min_advance_days`, end date = `today + days_ahead`
- Trims stale unbooked slots outside the window before generation
- Respects per-day operating hours (day_0..day_6 settings)

---

## E2E Tests (frontend/e2e/booking-flow.spec.ts)

| # | Test | Type |
|---|------|------|
| 1 | Page loads with no errors | Browser |
| 2 | API: check patient exists | API |
| 3 | API: profile editing and history | API |
| 4 | API: OTP auth and create patient flow | API |
| 5 | API: duplicate rejection returns 409 | API |
| 6 | API: mark appointment attendance | API |
| 7 | API: cancelled appointment appears in history | API |
| 8 | API: token invalidation prevents use | API |
| 9 | API: refresh fails for invalidated token | API |
| 10 | Returning patient detection after consecutive same-tab booking | Browser |
| 11 | Concurrent slot booking (user2 cannot book same dr slot) | API |
| 12 | Frontend: user2 cannot see booked dr1 slot, can book dr2 slot | Browser |

Run with: `cd frontend && npx playwright test`

---

## Key Behaviors

### Appointment Limits
- Max upcoming appointments configurable via `appointment/max_upcoming_appointments` setting (default 3)
- Enforced on create and reschedule; checked before slot validation

### Patient Access Verification
- `verify_patient_access` looks up the patient from DB by `auth.sub` (JWT subject = phone/email) and compares against the requested `patient_id`
- Previously relied on `auth.patient_id` from JWT claims, but JWT was always created with `patient_id: None`, causing all patient data endpoints (upcoming, history, last doctor, update) to silently return 401 — the frontend showed 0 appointments

### Cancellation
- Reason is required (textarea, disabled button when empty)
- Cancelled appointments appear in history regardless of date
- Cancellation reason shown in detail modal

### Pagination
- History modal (HistoryModal) and upcoming appointments modal (UpcomingAppointmentsModal) paginate at 10 items per page
- Previous/Next buttons with page indicator
- Page resets to 1 when data changes
- Backend queries cap at 100 items max (`LIMIT 100`)

### Booking Window
- Backend validates `slot_date >= today + min_advance_days` on create and reschedule
- Available dates/slots API respects `min_advance_days` — stale slots before the cutoff are not returned

### Returning Patient Flow
- Detects returning patient during auth (phone/email match)
- Shows profile card with last doctor, upcoming appointment
- Quick rebook with last doctor, or choose different doctor
- View all upcoming appointments (modal with pagination)
- History modal with past and cancelled appointments

---

## Design Conventions
- Modals: custom `motion.div` animation (not shadcn AlertDialog/Dialog), `max-w-2xl`, `max-h-[85vh]`, rounded-2xl, white background
- Buttons: right-aligned in footer, text-xs font-medium, inline text links style with hover:underline
- Table rows: hover:bg-muted/20, cursor-pointer, border-b border-foreground/5
- Colors: emerald/green for primary, rose for destructive, amber/blue/teal/violet for avatars
- Font: Figtree variable font, 10px uppercase tracking-wider for labels
- Icons: @hugeicons/core-free-icons via HugeiconsIcon component

---

## Development Notes

- Backend must be rebuilt and restarted after every Rust change: `cargo build` / `cargo run`
- Frontend dev server hot-reloads TypeScript changes automatically
- Slot generation takes ~25s on startup; wait for "Server starting" log
- OTP dev code: `123456` when `DEV_MODE=true`
- Frontend proxies `/api` to `localhost:3000` via Vite config
- CORS is wide-open for development
- Backend database is hosted remotely (not local)

## Recent Work

1. AppointmentDetailModal refinements — tighter gradient header, right-aligned action buttons, removed unused imports
2. CancelAppointmentDialog — reason is now required with disabled button when empty
3. Added "Change doctor" button to AppointmentDetailModal with onRescheduleDoctor prop
4. Backend: min_advance_days (7), clinic_name, clinic_address settings with defaults
5. Backend: validate min_advance_days on create/update appointment
6. Backend: respect min_advance_days in slot generation (start_date = today + min_advance_days)
7. Backend: trim stale slots before start_date during slot generation
8. Backend: updated email service to use configurable clinic name/address
9. Frontend: getAppointmentConfig in api.ts, ClinicConfig type
10. Frontend: fetch config in BookAppointment, pass to children
11. Frontend: replace hardcoded CLINIC_ADDRESS with config props
12. History query includes cancelled appointments (OR a.status = 'cancelled')
13. History modal re-fetches on every open (removed stale data guard)
14. Added pagination (10 per page) to HistoryModal and UpcomingAppointmentsModal
15. Fixed dates/max-date endpoints to filter by min_advance_days from AppState
16. Added e2e test for cancelled appointments in history
17. Changed `AppState` fields `min_advance_days`, `min_gap_minutes`, `clinic_name`, `clinic_address` to `Arc<RwLock<>>` so settings updates apply live without server restart
18. Settings route updates in-memory `AppState` fields on PUT (not just DB + slot regeneration)
19. Added `LIMIT 100` to upcoming appointments and history SQL queries
20. Fixed RwLockReadGuard Send issue by cloning clinic_name/address before `.await`
21. Enforced max upcoming appointments per patient (configurable via `max_upcoming_appointments` setting, default 3)
22. Split `handleVerified` try-catch in `BookAppointment.tsx` — `lookupPatient` failure → new patient form; secondary API failures (`getLastDoctor`, `getDoctors`) → continue to review step instead of falsely treating patient as new
23. Added `_generation` counter to `TokenStore` to prevent stale in-flight `refresh()` responses from overwriting current session's token after `resetAll()`
24. On `BookAppointment` mount: save stale token, call `POST /api/auth/invalidate`, then sync clear of `tokenStore`, `sessionStorage`, `localStorage` (ref-guarded, first render only), plus async clear of `caches` API
25. On `AuthFlow` mount: same invalidation + clearing via `useEffect` — ensures a fresh start every time the auth screen renders
26. Server-side token blacklist: new `token_blacklist` table (token_hash TEXT PK, expires_at TIMESTAMPTZ), SHA-256 hash of the token string stored with its original expiry
27. `POST /api/auth/invalidate` endpoint: accepts `{ token }`, verifies (ignore expiry), hashes, inserts into blacklist
28. Auth middleware now checks blacklist before accepting any token (returns 401 `Token has been invalidated`)
29. Refresh endpoint also checks blacklist before issuing a new token
30. Expired blacklist entries cleaned up on every invalidation/check and hourly via background task
31. Fixed `verify_patient_access` to look up patient by `auth.sub` (phone/email) from DB — JWT was always created with `patient_id: None` so every patient data endpoint (upcoming, history, last doctor, update) silently returned 401, causing the review page to show 0 appointments
32. Fixed back navigation in `BookAppointment.tsx` `goBack()` — pressing Back from datetime page now goes to 'review' for returning patients (not just reschedules)
33. Added error display with retry buttons for upcoming appointments and history API failures — errors are shown inline with a "Retry" button instead of silently showing empty state; history errors shown in modal
34. RBAC implementation (4 roles: patient, doctor, scheduler, admin) — JWT includes role, middleware `require_role()`, route guarding, admin seeding via `ADMIN_IDENTIFIER` env var, users table migration
35. Security audit: IDOR fixes (appointment/:id ownership check, patient/lookup uses JWT sub), TOCTOU fix (FOR UPDATE in create_appointment), input length validation, mutation rate limiter, OTP rate limiter, sanitized error messages
36. Mobile responsiveness: OTP slots 40px on mobile, overflow-x-auto for tables, touch targets ≥44px, calendar cells 40px on mobile, stacked name fields, reduced avatar (80px), page padding reduced
37. Fixed effect ordering bug (`BookAppointment.tsx`): save/persist useEffect moved before fetch useEffect — was causing "logged out after OTP" because fetch ran before tokenStore was populated
38. Replaced `sessionStorage.clear()`/`localStorage.clear()` with `clearBooking()` — only removes `booking` key, avoids disrupting other apps on same subdomain
39. Created `AuthContext` + `ClinicContext` — provides token/role/clinic-config via hooks instead of prop drilling
40. Refactored `ExistingPatientReview`, `EditProfileModal`, `AppointmentCard`, `UpcomingAppointmentsModal`, `AppointmentDetailModal` to use `useAuth()`/`useClinic()` — removed `token`, `clinicName`, `clinicAddress` from props
41. Fixed pre-existing `StatusBadge` missing component in `AppointmentDetailModal.tsx`
42. Split backend `update_appointment` if-else chain into 4 dedicated endpoints: `PATCH /api/appointments/:id/cancel`, `/reschedule`, `/change-doctor`, `/attendance` — with proper role-based access (patient owns their data, admin/scheduler can act on any appointment)
