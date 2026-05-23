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

# In another terminal, start frontend (runs on :5173, proxies /api to :3000)
cd frontend && npm install && npm run dev
```

Or use `make dev` to run both concurrently.

Open http://localhost:5173 in your browser.

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
| `make dev` | Run both backend and frontend concurrently |
| `make db-migrate` | Run SQLx database migrations |
| `make build` | Build both backend and frontend |
| `make lint` | Run Clippy and ESLint |

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
├── frontend/                   # React + Vite + shadcn/ui
│   ├── src/
│   │   ├── components/         # UI components (AuthFlow, PatientForm, etc.)
│   │   ├── pages/              # Route pages (BookAppointment)
│   │   ├── lib/                # Utilities, API client
│   │   ├── hooks/              # Custom hooks
│   │   └── index.css           # Global styles, theme variables
│   ├── components.json         # shadcn/ui configuration
│   └── vite.config.ts          # Vite config with /api proxy
├── Makefile                    # Dev orchestration
└── README.md
```

## API Overview

All routes are prefixed with `/api`.

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /api/auth/request-otp`, `POST /api/auth/verify-otp` |
| Patients | `GET /api/patients/:phone` |
| Doctors | `GET /api/doctors`, `GET /api/doctors/:id` |
| Appointments | `GET /api/appointments/availability`, `POST /api/appointments` |
| Settings | `GET /api/settings`, `PUT /api/settings` |

## Development Notes

- OTP dev mode: enter `123456` when `DEV_MODE=true`
- Frontend dev server proxies `/api` requests to `localhost:3000`
- CORS is wide-open for development
- Slot settings (duration, hours per day, days ahead) are stored in the DB `settings` table
- Minimum gap between same-patient appointments defaults to 180 minutes (configurable)

## License

MIT
