# Hospital Booking — Developer Context

## Project Structure
- `backend/` — Rust Axum API on :3000
- `frontend/` — Patient portal (React + Vite) on :5173 — **current production app**
- `frontend-admin/` — Staff dashboard (React + Vite) on :5174
- `frontend-nuxt/` — Patient portal rewrite (Nuxt 4 + Vue 3, SSR) on :5176 — feature-complete parallel build, not yet cut over. See `frontend-nuxt/README.md`. Includes an identify/verify UX-audit fork (new patients browse doctor/datetime before verifying; returning patients verify first, unchanged) not present in `frontend/`.

## Dev Credentials

### Staff Dashboard (http://localhost:5174)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hospital.com | staff1234 |
| Doctor | doctor@hospital.com | staff1234 |
| Scheduler | scheduler@hospital.com | staff1234 |

All staff have email MFA pre-configured. Dev OTP code: `123456`.

### Patient Portal (http://localhost:5173, or :5176 for frontend-nuxt)
No pre-seeded credentials. Enter any phone/email, use OTP code `123456`.

## Auth Flow
- **Patients**: OTP only (request OTP → verify OTP → JWT)
- **Staff**: Email + password → auto-send email OTP (or switch to SMS/authenticator) → verify code → JWT
- Staff MFA is mandatory once password is set
- `DEV_MODE=true` makes all OTP codes `123456`

## Build & Run
```bash
# Backend
cd backend && cargo run

# Patient portal (current)
cd frontend && npm run dev

# Patient portal (Nuxt rewrite, parallel build — not yet cut over)
cd frontend-nuxt && npm run dev

# Staff dashboard
cd frontend-admin && npm run dev
```

## Tech Stack
- Backend: Rust, Axum, SQLx, PostgreSQL
- Patient frontend: React 19, shadcn/ui, Tailwind CSS v4
- Patient frontend rewrite (`frontend-nuxt/`): Nuxt 4, Vue 3, reka-ui, Tailwind CSS v4, SSR
- Admin frontend: React 19, shadcn/ui Vega components, Tailwind CSS v4
