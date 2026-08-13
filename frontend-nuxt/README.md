# frontend-nuxt

Nuxt 4 (Vue 3, SSR) rewrite of the patient booking portal — a parallel build alongside `../frontend/` (the current React app), not yet cut over. It speaks the exact same `/api` contract against the same Rust/Axum backend; no backend changes were made for this rewrite.

## Why this exists

- **Mobile-first, fully responsive.** The old app's branded sidebar was `hidden xl:flex` — no brand presence at all below 1280px. This rewrite gives every screen size a real branded header/sidebar.
- **SSR.** Clinic name/address and the booking-window setting render server-side, so the landing screen has real content on first paint instead of a blank shell waiting on a client fetch.
- **A UX-audit-driven flow change `frontend/` doesn't have.** The old single "auth" step (identify + verify OTP in one screen) is now two steps: `identify` (phone/email entry, unauthenticated) and `verify` (OTP). An unauthenticated existence check on submit decides the path — a *new* patient browses doctor and time-slot selection before ever verifying; a *returning* patient still verifies immediately, exactly as before. See `stores/booking.ts`'s `completeIdentify()`.

## Running it

Requires the backend running on `:3000` (`cd ../backend && cargo run`).

```bash
npm install
npm run dev        # http://localhost:5176
```

Dev OTP code is always `123456` (see `../AGENTS.md`).

## Production build

```bash
npm run build
PORT=5176 node .output/server/index.mjs
```

Clinic config (`GET /clinic-config`, `server/routes/clinic-config.get.ts`) is cached server-side for 60s — the backend's `/api/settings/*` endpoints are slow enough (~350ms each) that hitting them on every SSR request would otherwise dominate TTFB. Everything else is either client-only or per-user/authenticated, so nothing else needed this.

## Testing

```bash
npm run test        # Playwright e2e suite — needs the backend and :5176 both running
npm run test:ui      # same, with Playwright's UI runner
```

`e2e/booking-flow.spec.ts` is a superset of `../frontend/e2e/booking-flow.spec.ts`, retargeted for this app's port and the identify/verify split, plus three regression tests added for bugs found during this build (see the file's header comment and `../.claude/plans/`'s implementation plan for the full writeup).

## Project layout

- `app/stores/` — Pinia setup stores: `booking.ts` (the step machine), `auth.ts`, `clinic.ts`
- `app/components/` — one component per wizard step (`IdentifyStep`, `VerifyStep`, `DoctorSelect`, `BookingForm`, `PatientForm`, `AppointmentSummary`, `SuccessStep`) plus the returning-patient dashboard (`ExistingPatientReview` and its modals) and shared `ui/` primitives (reka-ui based, ported from the old app's shadcn components)
- `app/pages/index.vue` — the entire wizard lives behind this one route
- `app/lib/api.ts` — typed API client
- `server/routes/` — Nitro server routes that need to run outside the `/api/**` proxy (currently just the cached clinic-config)
- `e2e/` — Playwright suite

## Status

Feature-complete against the original app's scope, plus the identify/verify fork. Not yet the default — cutover (renaming/removing `frontend/`, moving this to port `:5173`) is a separate, later decision.
