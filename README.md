# Hospital Booking App

HospitalBooking is a self-service appointment booking system for healthcare facilities. Patients book doctor appointments through a streamlined multi-step wizard: OTP verification → personal details → doctor selection (or auto-assign) → date/time picker → confirmation. The system handles returning patient detection, enforces minimum gaps between same-patient appointments, and dynamically generates slots from configurable clinic hours.

## Features

- **OTP Authentication** — verify via SMS or email (dev code `123456`)
- **Multi-step Booking Wizard** — Auth → Details → Doctor → Date/Time → Confirm
- **Doctor Selection** — browse by specialty with auto-assign option
- **Dynamic Slot Grid** — real-time availability from clinic settings
- **Returning Patient Flow** — auto-loads existing data, quick rebook with last doctor
- **Minimum Gap Enforcement** — configurable min interval between same-patient bookings
- **Encrypted Settings** — SMTP credentials stored with AES-256-GCM
- **Mediport-style UI** — split-screen green theme, shadcn/ui Vega components

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Vega), Framer Motion |
| Backend | Rust, Axum 0.7, SQLx 0.8 |
| Database | PostgreSQL 16 |
| Auth | JWT (jsonwebtoken), SHA-256 hashed OTPs |
| Email/SMS | SMTP via lettre, mock SMS |
| Hosting | Dev — localhost:5173 (Vite) → localhost:3000 (Axum) |

`frontend-nuxt/` is a feature-complete Nuxt 4 (Vue 3, SSR) rewrite of the patient portal, built as a parallel app alongside `frontend/` — not yet the default. It also includes a UX-audit-driven change `frontend/` doesn't have: new patients can browse doctors and times before verifying their identity (an unauthenticated existence check decides the path); returning patients still verify first, unchanged. See `frontend-nuxt/README.md`.

## Prerequisites

- Rust toolchain (latest stable)
- Node.js 18+
- PostgreSQL 14+
- Access to a PostgreSQL instance (local or remote)

## Quick Start

```bash
# Clone and enter the project
git clone https://github.com/fosteranese/hospital-booking.git
cd hospital-booking

# Start backend (runs on :3000, auto-runs migrations on first start)
cd backend && cargo run

# In another terminal, start patient portal (runs on :5173, proxies /api to :3000)
cd frontend && npm install && npm run dev

# In another terminal, start staff dashboard (runs on :5174, proxies /api to :3000)
cd frontend-admin && npm install && npm run dev

# Optional: try the Nuxt patient-portal rewrite instead (runs on :5176, proxies /api to :3000)
cd frontend-nuxt && npm install && npm run dev
```

Or use `make dev` to run patient portal + backend concurrently, or `make dev-web-nuxt` to run the Nuxt rewrite's dev server on its own.

Open http://localhost:5173 (patient) or http://localhost:5174 (staff dashboard) in your browser.

## Environment Variables

Backend expects a `.env` file in `backend/`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `DEV_MODE` | Set `true` to use dev OTP code `123456` |
| `SETTINGS_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM encryption |

Example:

```env
DATABASE_URL=postgres://user:password@host:5432/hospital_booking
JWT_SECRET=change-this-in-production
DEV_MODE=true
SETTINGS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

## Makefile Targets

| Target | Description |
|--------|-------------|
| `make dev-api` | Start backend server |
| `make dev-web` | Start frontend dev server |
| `make dev-web-nuxt` | Start the Nuxt patient-portal rewrite's dev server |
| `make dev` | Run both backend and frontend concurrently |
| `make db-migrate` | Run SQLx database migrations |
| `make build` | Build both backend and frontend |
| `make lint` | Run Clippy and ESLint |
| `make test-web-nuxt` | Run frontend-nuxt's Playwright e2e suite |

## Project Structure

```
hospital-booking/
├── backend/                    # Rust Axum API
│   ├── migrations/             # SQLx migrations
│   ├── src/
│   │   ├── main.rs             # Server entry point (:3000)
│   │   ├── routes/             # API route handlers
│   │   ├── services/           # Business logic (OTP, JWT, email, slots)
│   │   ├── middleware/         # Auth middleware
│   │   ├── models/             # Database models
│   │   └── state.rs            # App state (DB pool)
│   └── Cargo.toml
├── frontend/                   # React + Vite + shadcn/ui (current patient portal)
│   ├── src/
│   │   ├── components/         # UI components (AuthFlow, PatientForm, etc.)
│   │   ├── pages/              # Route pages (BookAppointment)
│   │   ├── lib/                # Utilities, API client
│   │   ├── hooks/              # Custom hooks
│   │   └── index.css           # Global styles, theme variables
│   ├── components.json         # shadcn/ui configuration
│   └── vite.config.ts          # Vite config with /api proxy
├── frontend-nuxt/               # Nuxt 4 + Vue 3 (SSR) rewrite of the patient portal — parallel build, not cut over
│   ├── app/
│   │   ├── components/          # UI components (IdentifyStep, VerifyStep, PatientForm, etc.)
│   │   ├── pages/                # index.vue — the whole booking wizard
│   │   ├── stores/                # Pinia stores (booking, auth, clinic)
│   │   └── lib/                    # Utilities, API client
│   ├── server/routes/               # Nitro server routes (e.g. cached clinic-config)
│   └── e2e/                          # Playwright suite
├── Makefile                    # Dev orchestration
└── README.md
```

## API Overview

All routes are prefixed with `/api`.

| Group | Key Endpoints |
|-------|---------------|
| Auth (patient) | `POST /api/auth/request-otp`, `POST /api/auth/verify-otp` |
| Auth (staff) | `POST /api/auth/login`, `POST /api/auth/mfa/challenge`, `POST /api/auth/mfa/verify` |
| Auth (settings) | `POST /api/auth/set-password`, `GET /api/auth/mfa-status`, `PUT /api/auth/mfa` |
| Patients | `GET /api/patients/search`, `GET /api/patients/:id/history` |
| Doctors | `GET /api/doctors`, `GET /api/doctors/:id`, `POST /api/doctors` |
| Appointments | `GET /api/appointments`, `GET /api/appointments/export`, `GET /api/appointments/:id` |
| Settings | `GET /api/settings/:group`, `PUT /api/settings/:group/:name` |
| Analytics | `GET /api/analytics/overview`, `GET /api/analytics/doctor-stats` |
| Users | `GET /api/users`, `PUT /api/users/:identifier/role` |

## Development Notes

### Ports

| Service | URL |
|---------|-----|
| Patient Portal (Vite) | http://localhost:5173 |
| Patient Portal — Nuxt rewrite (SSR) | http://localhost:5176 |
| Staff Dashboard (Vite) | http://localhost:5174 |
| Backend API (Axum) | http://localhost:3000 |

### Dev Credentials — Staff Dashboard

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@hospital.com` | `staff1234` |
| Doctor | `doctor@hospital.com` | `staff1234` |
| Scheduler | `scheduler@hospital.com` | `staff1234` |

All staff accounts have **email MFA** pre-configured. The OTP code in dev mode is always `123456`.

### Login Flow (Staff)
1. Enter email + password
2. OTP is auto-sent to the staff email (in dev: `123456`)
3. Enter the code (or switch to SMS / authenticator app)

### OTP Dev Mode
- Enter `123456` for any OTP code when `DEV_MODE=true` (works for both patients and staff MFA)

### Staff Dashboard Sections

| Section | URL | Roles |
|---------|-----|-------|
| Appointments | `/dashboard` | admin, scheduler, doctor |
| Unavailability | `/dashboard/unavailability` | admin, scheduler |
| Analytics | `/dashboard/analytics` | admin |
| Doctors | `/dashboard/doctors` | admin |
| Schedules | `/dashboard/schedules` | admin, scheduler |
| Patients | `/dashboard/patients` | admin, scheduler |
| Users | `/dashboard/users` | admin |
| Settings | `/dashboard/settings` | admin |

### General
- Frontend dev servers proxy `/api` requests to `localhost:3000`
- CORS is wide-open for development
- Slot settings (duration, hours per day, days ahead) are stored in the DB `settings` table
- Minimum gap between same-patient appointments defaults to 180 minutes (configurable)

## License

MIT
