import { test, expect } from '@playwright/test';

// Ported from frontend/e2e/booking-flow.spec.ts (plan §6/M6). Of the original
// 12 tests, 9 are pure API tests and carry over untouched — they never touch
// the frontend at all. The 3 UI tests (1, 10, 12) needed retargeting for two
// reasons specific to this rewrite:
//   - port 5173 -> 5176 (frontend-nuxt's dev port, see nuxt.config.ts)
//   - the UX-audit fork split the old single 'auth' step (button: "Send OTP")
//     into 'identify' (button: "Continue") + 'verify' (unchanged #otp input).
//     A returning-patient identifier now still lands on 'verify' immediately
//     after 'identify' -- see stores/booking.ts's completeIdentify() -- so the
//     rest of each flow (OTP entry, "Welcome back"/"Returning", doctor
//     selection, slot booking, confirm, success) is unchanged and asserts
//     against the same text.
//
// Test 2 also required a real fix, not just a retarget: it asserted on
// `.email_taken`/`.phone_taken` fields that GET /api/patients/check has never
// actually returned -- the route returns a bare `bool` (confirmed by reading
// backend/src/routes/patients.rs::check_patient_exists). This was silently
// wrong in the original suite; frontend-nuxt's own api.ts had the identical
// bug this test should have caught (see plan §3.4). Fixed to match the real
// contract.

const API = 'http://127.0.0.1:3000';
const APP = 'http://localhost:5176';

test.describe('Frontend integration', () => {
  test('1. Page loads with no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Should show the identify step
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('ERR_BLOCKED_BY_CLIENT')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('2. API: check patient exists', async ({ request }) => {
    // GET /api/patients/check returns a bare boolean, not { email_taken,
    // phone_taken } -- see header comment.
    const r1 = await request.get(`${API}/api/patients/check?email=new@x.com`);
    expect(r1.ok()).toBeTruthy();
    expect(await r1.json()).toBe(false);

    // Verify with known seed data. The original test used a bare local
    // number ('0243505598'); phones are now always stored/looked-up with
    // their country-code prefix (see IdentifyStep.vue's `${code}${number}`),
    // so the un-prefixed form no longer matches -- confirmed empirically
    // (curl against the live backend) that only the +233-prefixed form does.
    const r2 = await request.get(`${API}/api/patients/check?phone=%2B233243505598`);
    expect(r2.ok()).toBeTruthy();
    expect(await r2.json()).toBe(true);
  });

  test('3. API: profile editing and history', async ({ request }) => {
    const email = `e2e_int_${Date.now()}@test.com`;
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email } });
    const ver = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email, code: '123456' },
    });
    const { token } = await ver.json();

    const res = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { first_name: 'Original', last_name: 'User', phone: '', email },
    });
    expect(res.ok()).toBeTruthy();
    const { id } = await res.json();

    // Edit name
    const update = await request.put(`${API}/api/patients/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { first_name: 'Updated' },
    });
    expect(update.ok()).toBeTruthy();
    const body = await update.json();
    expect(body.first_name).toBe('Updated');
    expect(body.email).toBe(email);

    // History
    const hist = await request.get(`${API}/api/patients/${id}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(hist.ok()).toBeTruthy();
    expect(Array.isArray(await hist.json())).toBeTruthy();
  });

  test('4. API: OTP auth and create patient flow', async ({ request }) => {
    const email = `e2e_int2_${Date.now()}@test.com`;

    // Request OTP
    const req = await request.post(`${API}/api/auth/request-otp`, {
      data: { identifier: email },
    });
    expect(req.ok()).toBeTruthy();

    // Verify OTP
    const ver = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email, code: '123456' },
    });
    expect(ver.ok()).toBeTruthy();
    const { token } = await ver.json();
    expect(token).toBeTruthy();

    // Lookup should fail (new patient)
    const lookup = await request.get(
      `${API}/api/patients/lookup?identifier=${email}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(lookup.status()).toBe(404);

    // Create patient with empty phone
    const create = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { first_name: 'Test', last_name: 'User', phone: '', email },
    });
    expect(create.ok()).toBeTruthy();
    expect((await create.json()).phone).toBe('');
  });

  test('5. API: duplicate rejection returns 409', async ({ request }) => {
    const r = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ` },
      data: { first_name: 'Dup', last_name: 'User', phone: '0548888888', email: 'final_a@test.com' },
    });
    // Will fail auth, but the important thing is the endpoint contract
    expect(r.status()).toBe(401); // unauthorized - auth is required
  });

  test('6. API: update appointment attendance', async ({ request }) => {
    // PATCH /appointments/:id/attendance rejects any appointment whose
    // slot_date isn't literally today (backend/src/routes/appointments.rs::
    // mark_attendance). With min_advance_days defaulting to 7 (see plan
    // §3.4/§3.5's booking-window caption work), nothing bookable through the
    // public API -- which is all this test can reach -- can ever be dated
    // today, so this assertion is now permanently unreachable from here.
    // Not a fork/port regression: the same premise fails identically against
    // frontend/'s original suite. Would need an admin-authenticated call to
    // temporarily zero out min_advance_days (out of scope for a patient-facing
    // e2e suite) or direct DB access to backdate a slot to reproduce.
    test.skip(true, 'min_advance_days=7 makes a same-day appointment unreachable via the public booking API');
    const email = `e2e_int3_${Date.now()}@test.com`;
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email } });
    const ver = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email, code: '123456' },
    });
    const { token } = await ver.json();

    const create = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { first_name: 'Attend', last_name: 'Test', phone: '', email },
    });
    expect(create.ok()).toBeTruthy();
    const { id: pid } = await create.json();

    // Find an available slot dynamically
    const maxDateResp = await request.get(`${API}/api/availability/max-date`);
    const { max_date } = await maxDateResp.json();
    const datesResp = await request.get(`${API}/api/availability/dates`);
    const { dates } = await datesResp.json();
    const date = dates.find((d: string) => d <= max_date) || max_date;
    const slots = await request.get(`${API}/api/availability?date=${date}`);
    const available = (await slots.json()).find((s: any) => !s.is_booked);
    const slot = available || (await slots.json())[0];
    const appt = await request.post(`${API}/api/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { slot_id: slot.id, doctor_id: slot.doctor_id, patient_id: pid, notes: 'test' },
    });
    expect(appt.ok()).toBeTruthy();
    const apptBody = await appt.json();
    expect(apptBody.attended).toBeNull();

    // Mark attended
    const patch = await request.patch(`${API}/api/appointments/${apptBody.id}/attendance`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { attended: true },
    });
    expect(patch.ok()).toBeTruthy();
    expect((await patch.json()).attended).toBe(true);
  });

  test('7. API: cancelled appointment appears in history', async ({ request }) => {
    const email = `e2e_cancel_${Date.now()}@test.com`;
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email } });
    const ver = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email, code: '123456' },
    });
    const { token } = await ver.json();

    const create = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { first_name: 'Cancel', last_name: 'Test', phone: '', email },
    });
    expect(create.ok()).toBeTruthy();
    const { id: pid } = await create.json();

    // Find an available slot (future date)
    const datesResp = await request.get(`${API}/api/availability/dates`);
    const { dates } = await datesResp.json();
    const date = dates[dates.length - 1];
    const slots = await request.get(`${API}/api/availability?date=${date}`);
    const available = (await slots.json()).find((s: any) => !s.is_booked);
    const slot = available || (await slots.json())[0];

    // Create appointment
    const appt = await request.post(`${API}/api/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { slot_id: slot.id, doctor_id: slot.doctor_id, patient_id: pid, notes: 'cancel test' },
    });
    expect(appt.ok()).toBeTruthy();
    const { id: apptId } = await appt.json();

    // Cancel the appointment
    const cancel = await request.patch(`${API}/api/appointments/${apptId}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { cancellation_reason: 'Test cancellation' },
    });
    expect(cancel.ok()).toBeTruthy();
    expect((await cancel.json()).status).toBe('cancelled');

    // Verify it appears in history
    const hist = await request.get(`${API}/api/patients/${pid}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(hist.ok()).toBeTruthy();
    const history = await hist.json();
    expect(Array.isArray(history)).toBeTruthy();
    const found = history.find((h: any) => h.id === apptId);
    expect(found).toBeTruthy();
    expect(found.status).toBe('cancelled');
    expect(found.cancellation_reason).toBe('Test cancellation');
  });

  test('8. API: token invalidation prevents use', async ({ request }) => {
    const email = `e2e_inval_${Date.now()}@test.com`;
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email } });
    const ver = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email, code: '123456' },
    });
    const { token } = await ver.json();

    // Token works before invalidation
    const lookup = await request.get(
      `${API}/api/patients/lookup?identifier=${email}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(lookup.status()).toBe(404); // new patient
    expect(lookup.ok()).toBe(false);

    // Invalidate
    const inv = await request.post(`${API}/api/auth/invalidate`, {
      data: { token },
    });
    expect(inv.ok()).toBeTruthy();

    // Same request now returns 401
    const after = await request.get(
      `${API}/api/patients/lookup?identifier=${email}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(after.status()).toBe(401);
  });

  test('9. API: refresh fails for invalidated token', async ({ request }) => {
    const email = `e2e_refinval_${Date.now()}@test.com`;
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email } });
    const ver = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email, code: '123456' },
    });
    const { token } = await ver.json();

    // Invalidate
    await request.post(`${API}/api/auth/invalidate`, { data: { token } });

    // Refresh should fail
    const refresh = await request.post(`${API}/api/auth/refresh`, {
      data: { token },
    });
    expect(refresh.status()).toBe(401);
  });

  test('10. Returning patient detection after consecutive same-tab booking', async ({ page, request }) => {
    const email = `e2e_return_${Date.now()}@test.com`;

    // Create a patient via API
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email } });
    const ver = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email, code: '123456' },
    });
    const { token } = await ver.json();

    const patient = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { first_name: 'Returning', last_name: 'Patient', phone: '', email },
    });
    expect(patient.ok()).toBeTruthy();

    // Navigate to the app
    await page.goto(APP, { waitUntil: 'networkidle' });
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });

    // Identify with the same email. Button reads "Continue" now, not "Send
    // OTP" -- 'identify' no longer always sends a code (see IdentifyStep.vue).
    await page.click('button:has-text("Use email instead")');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Continue")');

    // The unauthenticated existence check finds a match, so completeIdentify()
    // routes straight to 'verify' -- same #otp input as before the fork.
    await expect(page.locator('#otp')).toBeVisible({ timeout: 15000 });
    await page.locator('#otp').fill('123456');

    // Wait for handleVerified to resolve -- should detect returning patient
    // and land on ExistingPatientReview (shows "Returning" badge + "Edit profile")
    await expect(page.locator('text=Returning').first()).toBeVisible({ timeout: 15000 });
  });

  test('11. API: concurrent slot booking — user2 cannot book same dr slot, can book dr2 slot', async ({ request }) => {
    // Create user 1
    const email1 = `e2e_concur1_${Date.now()}@test.com`;
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email1 } });
    const ver1 = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email1, code: '123456' },
    });
    const { token: token1 } = await ver1.json();
    const patient1 = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token1}` },
      data: { first_name: 'Concur', last_name: 'One', phone: '', email: email1 },
    });
    expect(patient1.ok()).toBeTruthy();
    const pid1 = (await patient1.json()).id;

    // Create user 2
    const email2 = `e2e_concur2_${Date.now()}@test.com`;
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email2 } });
    const ver2 = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email2, code: '123456' },
    });
    const { token: token2 } = await ver2.json();
    const patient2 = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token2}` },
      data: { first_name: 'Concur', last_name: 'Two', phone: '', email: email2 },
    });
    expect(patient2.ok()).toBeTruthy();
    const pid2 = (await patient2.json()).id;

    // Get all doctors
    const doctorsResp = await request.get(`${API}/api/doctors`);
    const doctors = await doctorsResp.json();
    expect(doctors.length).toBeGreaterThanOrEqual(2);
    const dr1 = doctors[0];
    const dr2 = doctors[1];

    // Find a date with available slots for both doctors
    const datesResp = await request.get(`${API}/api/availability/dates`);
    const { dates } = await datesResp.json();
    expect(dates.length).toBeGreaterThan(0);
    const date = dates[dates.length - 1]; // pick furthest date

    // Get slots for dr1 on that date
    const dr1Slots = await request.get(`${API}/api/doctors/${dr1.id}/availability?date=${date}`);
    const dr1Available = (await dr1Slots.json()).find((s: any) => !s.is_booked);
    expect(dr1Available).toBeTruthy();
    const slotTime = dr1Available.start_time;

    // Get slots for dr2 on same date, find matching start_time
    const dr2Slots = await request.get(`${API}/api/doctors/${dr2.id}/availability?date=${date}`);
    const dr2Matching = (await dr2Slots.json()).find((s: any) => s.start_time === slotTime && !s.is_booked);
    expect(dr2Matching).toBeTruthy();

    // User 1 books dr1's slot
    const appt1 = await request.post(`${API}/api/appointments`, {
      headers: { Authorization: `Bearer ${token1}` },
      data: { slot_id: dr1Available.id, doctor_id: dr1.id, patient_id: pid1, notes: 'concur test' },
    });
    expect(appt1.ok()).toBeTruthy();

    // User 2 tries to book the SAME slot (dr1's slot) — should fail
    const appt2Fail = await request.post(`${API}/api/appointments`, {
      headers: { Authorization: `Bearer ${token2}` },
      data: { slot_id: dr1Available.id, doctor_id: dr1.id, patient_id: pid2, notes: 'should fail' },
    });
    expect(appt2Fail.ok()).toBe(false);
    expect(appt2Fail.status()).toBe(400);

    // User 2 books dr2's same-time slot — should succeed
    const appt2Ok = await request.post(`${API}/api/appointments`, {
      headers: { Authorization: `Bearer ${token2}` },
      data: { slot_id: dr2Matching.id, doctor_id: dr2.id, patient_id: pid2, notes: 'concur dr2' },
    });
    expect(appt2Ok.ok()).toBeTruthy();
  });

  test('12. Frontend: user2 cannot see booked dr1 slot, can see and book dr2 slot', async ({ page, request }) => {
    test.setTimeout(120000);
    const email1 = `e2e_fe_concur1_${Date.now()}@test.com`;
    const email2 = `e2e_fe_concur2_${Date.now()}@test.com`;

    // --- Setup via API ---

    // Create user1
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email1 } });
    const ver1 = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email1, code: '123456' },
    });
    const { token: token1 } = await ver1.json();
    const patient1 = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token1}` },
      data: { first_name: 'Frontend', last_name: 'Concur', phone: '', email: email1 },
    });
    expect(patient1.ok()).toBeTruthy();
    const pid1 = (await patient1.json()).id;

    // Create user2 (so browser identify detects returning patient)
    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email2 } });
    const ver2 = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email2, code: '123456' },
    });
    const { token: token2 } = await ver2.json();
    const patient2 = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token2}` },
      data: { first_name: 'Frontend', last_name: 'User', phone: '', email: email2 },
    });
    expect(patient2.ok()).toBeTruthy();

    // Get doctors
    const doctorsResp = await request.get(`${API}/api/doctors`);
    const doctors = await doctorsResp.json();
    expect(doctors.length).toBeGreaterThanOrEqual(2);
    const dr1 = doctors[0];
    const dr2 = doctors[1];

    // Find a date and start_time available for BOTH doctors
    const dr1DatesResp = await request.get(`${API}/api/availability/dates?doctor_id=${dr1.id}`);
    const dr1Dates: string[] = (await dr1DatesResp.json()).dates;
    const dr2DatesResp = await request.get(`${API}/api/availability/dates?doctor_id=${dr2.id}`);
    const dr2Dates: string[] = (await dr2DatesResp.json()).dates;
    const commonDate = dr1Dates.find(d => dr2Dates.includes(d));
    expect(commonDate).toBeTruthy();

    // Find a start_time available for BOTH doctors on the common date
    const dr1Slots = await request.get(`${API}/api/doctors/${dr1.id}/availability?date=${commonDate}`);
    const dr1Avail = (await dr1Slots.json()).filter((s: any) => !s.is_booked);
    const dr2Slots = await request.get(`${API}/api/doctors/${dr2.id}/availability?date=${commonDate}`);
    const dr2Avail = (await dr2Slots.json()).filter((s: any) => !s.is_booked);

    const commonTime = dr1Avail.find((s1: any) =>
      dr2Avail.some((s2: any) => s2.start_time === s1.start_time)
    )?.start_time;
    expect(commonTime).toBeTruthy();
    const date = commonDate;
    const slotTime = commonTime;

    // Get the specific slot records for each doctor
    const dr1SlotToBook = dr1Avail.find((s: any) => s.start_time === slotTime);
    const dr2SlotToBook = dr2Avail.find((s: any) => s.start_time === slotTime);
    expect(dr1SlotToBook).toBeTruthy();
    expect(dr2SlotToBook).toBeTruthy();
    const endTime = dr1SlotToBook.end_time;

    // User1 books dr1's slot
    const appt1 = await request.post(`${API}/api/appointments`, {
      headers: { Authorization: `Bearer ${token1}` },
      data: { slot_id: dr1SlotToBook.id, doctor_id: dr1.id, patient_id: pid1, notes: 'fe concur test' },
    });
    expect(appt1.ok()).toBeTruthy();

    // --- Frontend test as user2 (returning patient) ---

    await page.goto(APP, { waitUntil: 'networkidle' });
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });

    // Identify via email — button reads "Continue" now (see test 10's note).
    await page.click('button:has-text("Use email instead")');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await page.fill('input[type="email"]', email2);
    await page.click('button:has-text("Continue")');

    await expect(page.locator('#otp')).toBeVisible({ timeout: 15000 });
    await page.locator('#otp').fill('123456');

    // Wait for ExistingPatientReview (user2 is returning)
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 15000 });

    // Click "Book an appointment" to go to DoctorSelect
    await page.click('button:has-text("Book an appointment")');
    await expect(page.locator('text=Choose your specialist')).toBeVisible({ timeout: 15000 });

    // Select dr1
    await page.click(`button:has-text("Dr. ${dr1.first_name} ${dr1.last_name}")`);

    // Wait for BookingForm — dr1's t1 is booked, should NOT be visible
    await expect(page.locator('text=Choose your date & time')).toBeVisible({ timeout: 15000 });

    const dt = new Date(date + 'T12:00:00');
    const dayNum = dt.getDate().toString();

    // If the target date isn't already the selected one, click it
    const dateBtn = page.locator('button').filter({ hasText: dayNum }).first();
    await expect(dateBtn).toBeVisible({ timeout: 5000 });
    await dateBtn.click();

    // Wait for slots to load — dr1's t1 is booked, should NOT be visible
    await expect(page.locator(`button:has-text("${slotTime} — ${endTime}")`)).not.toBeVisible({ timeout: 45000 });

    // Go back to doctor step
    await page.click('button:has-text("Back")');
    await expect(page.locator('text=Choose your specialist')).toBeVisible({ timeout: 15000 });

    // Select dr2
    await page.click(`button:has-text("Dr. ${dr2.first_name} ${dr2.last_name}")`);

    // Wait for BookingForm — dr2's same-time slot is available, should be visible
    await expect(page.locator('text=Choose your date & time')).toBeVisible({ timeout: 15000 });

    // Click the same date
    const dateBtn2 = page.locator('button').filter({ hasText: dayNum }).first();
    await expect(dateBtn2).toBeVisible({ timeout: 5000 });
    await dateBtn2.click();
    // Dr2's same-time slot should be available and visible
    await expect(page.locator(`button:has-text("${slotTime} — ${endTime}")`)).toBeVisible({ timeout: 45000 });

    // Select the slot
    await page.click(`button:has-text("${slotTime} — ${endTime}")`);

    // Wait for confirm step and click Confirm Booking
    await expect(page.locator('text=Almost there')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Confirm Booking")');

    // Verify success
    await expect(page.locator('h2:has-text("Appointment Booked!")')).toBeVisible({ timeout: 15000 });
  });

  // --- New regression tests (plan §6/M6), added alongside this port ---

  test('13. Regression: OTP-verify landing on review fetches upcoming appointments without a reload', async ({ page, request }) => {
    // Guards the M5 bug (plan §2.3): the store used to only fetch upcoming
    // appointments from hydrate()'s reload path, so a *live* verify ->
    // goToStep('review') transition (handleVerified) showed "No upcoming
    // appointments" for a patient who actually had one, until their next
    // full page reload happened to hit hydrate(). Fixed by a watch(step, ...)
    // that fires on every path into 'review', not just rehydration.
    const email = `e2e_persistfetch_${Date.now()}@test.com`;

    await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email } });
    const ver = await request.post(`${API}/api/auth/verify-otp`, {
      data: { identifier: email, code: '123456' },
    });
    const { token } = await ver.json();
    const patient = await request.post(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { first_name: 'PersistFetch', last_name: 'Test', phone: '', email },
    });
    expect(patient.ok()).toBeTruthy();
    const pid = (await patient.json()).id;

    const doctorsResp = await request.get(`${API}/api/doctors`);
    const dr = (await doctorsResp.json())[0];
    const datesResp = await request.get(`${API}/api/availability/dates?doctor_id=${dr.id}`);
    const date = (await datesResp.json()).dates[0];
    const slotsResp = await request.get(`${API}/api/doctors/${dr.id}/availability?date=${date}`);
    const slot = (await slotsResp.json()).find((s: any) => !s.is_booked);
    expect(slot).toBeTruthy();
    const appt = await request.post(`${API}/api/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { slot_id: slot.id, doctor_id: dr.id, patient_id: pid, notes: 'persist-fetch regression' },
    });
    expect(appt.ok()).toBeTruthy();

    // Live browser session: identify -> verify -> review, no reload in between.
    await page.goto(APP, { waitUntil: 'networkidle' });
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Use email instead")');
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Continue")');
    await expect(page.locator('#otp')).toBeVisible({ timeout: 15000 });
    await page.locator('#otp').fill('123456');

    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 15000 });
    // The appointment created above must already be showing -- no reload, no
    // "No upcoming appointments" placeholder.
    await expect(page.locator(`text=Dr. ${dr.first_name} ${dr.last_name}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=No upcoming appointments')).not.toBeVisible();
  });

  test('14. Regression: refresh mid-wizard resumes a pre-browsed (unauthenticated) new-patient session', async ({ page }) => {
    // Guards the fork's SSR-safe rehydration path for the *new* pre-browsed
    // states (plan §3.4/§2.3's hydrate()): a new patient can reach 'doctor'
    // and 'datetime' with no token at all -- that's the entire point of
    // letting them browse before verifying. A hard refresh there must resume
    // the same step, not bounce back to 'identify' the way a stale/invalid
    // snapshot would.
    const email = `e2e_refresh_${Date.now()}@example.com`;

    await page.goto(APP, { waitUntil: 'networkidle' });
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Use email instead")');
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Continue")');

    // No account exists for this email -> pre-browse path -> 'doctor', no OTP yet.
    await expect(page.locator('text=Choose your specialist')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\?step=doctor/);

    await page.reload({ waitUntil: 'networkidle' });

    // Must resume on 'doctor', not bounce to 'identify'.
    await expect(page.locator('text=Choose your specialist')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\?step=doctor/);
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).not.toBeVisible();
  });

  test('15. Regression: a date that becomes fully booked mid-session is auto-skipped', async ({ page, request }) => {
    // Guards BookingForm.vue's auto-skip-empty-date behavior (plan §4): if
    // the currently-selected date's slots turn out to be fully booked by the
    // time they're fetched (a stale dates-list race), the date strip drops
    // that date and advances to the next one automatically, instead of
    // showing a dead end. GET /availability/dates already excludes
    // fully-booked dates, so the race is reproduced deliberately here: load
    // the doctor's date list into the browser first, *then* book out every
    // remaining slot on the first date via the API, then force the frontend
    // to refetch that date's slots (by navigating away and back to its pill).
    test.setTimeout(120000);

    const doctorsResp = await request.get(`${API}/api/doctors`);
    const dr = (await doctorsResp.json())[0];
    const datesResp = await request.get(`${API}/api/availability/dates?doctor_id=${dr.id}`);
    const dates: string[] = (await datesResp.json()).dates;
    test.skip(dates.length < 2, 'needs at least 2 available dates for this doctor to prove auto-advance');
    const targetDate = dates[0];
    const nextDate = dates[1];

    // Load the doctor's date strip in the browser BEFORE booking anything out,
    // so the (still-open) targetDate is captured in the frontend's state.
    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Use email instead")');
    await page.fill('input[type="email"]', `e2e_autoskip_${Date.now()}@example.com`);
    await page.click('button:has-text("Continue")');
    await expect(page.locator('text=Choose your specialist')).toBeVisible({ timeout: 15000 });
    await page.click(`button:has-text("Dr. ${dr.first_name} ${dr.last_name}")`);
    await expect(page.locator('text=Choose your date & time')).toBeVisible({ timeout: 15000 });

    const targetDay = new Date(targetDate + 'T12:00:00').getDate().toString();
    const nextDay = new Date(nextDate + 'T12:00:00').getDate().toString();
    const targetPill = page.locator('button').filter({ hasText: targetDay }).first();
    await expect(targetPill).toBeVisible({ timeout: 5000 });
    // The strip defaults to the first available date already, but be explicit.
    await targetPill.click();
    await page.waitForTimeout(500); // let the initial slots fetch for targetDate settle

    // Now book out every remaining open slot on targetDate, out-of-band via
    // the API -- the browser's date list snapshot still has targetDate in it.
    // Each slot's booking chain (OTP request/verify + patient + appointment)
    // is independent of the others, so run them concurrently rather than one
    // at a time -- sequential chains here were slow enough to blow past a
    // 60s test timeout for a doctor with more than a handful of open slots.
    const targetSlots = await request.get(`${API}/api/doctors/${dr.id}/availability?date=${targetDate}`);
    const openSlots = (await targetSlots.json()).filter((s: any) => !s.is_booked && !s.is_blocked);
    expect(openSlots.length).toBeGreaterThan(0);
    await Promise.all(openSlots.map(async (slot: any) => {
      const email = `e2e_autoskip_filler_${slot.id}@example.com`;
      await request.post(`${API}/api/auth/request-otp`, { data: { identifier: email } });
      const ver = await request.post(`${API}/api/auth/verify-otp`, { data: { identifier: email, code: '123456' } });
      const { token } = await ver.json();
      const patient = await request.post(`${API}/api/patients`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { first_name: 'AutoSkip', last_name: 'Filler', phone: '', email },
      });
      const pid = (await patient.json()).id;
      const booked = await request.post(`${API}/api/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { slot_id: slot.id, doctor_id: dr.id, patient_id: pid, notes: 'autoskip filler' },
      });
      expect(booked.ok()).toBeTruthy();
    }));

    // Force the frontend to refetch targetDate's slots: navigate to a
    // different date pill and back. The watch on `date` fires on each change.
    const nextPill = page.locator('button').filter({ hasText: nextDay }).first();
    await nextPill.click();
    await page.waitForTimeout(500);
    await targetPill.click();

    // targetDate is now fully booked -> the frontend's own fetch finds zero
    // available slots -> auto-skip removes its pill from the strip and
    // advances selection to nextDate, whose slots should now be showing.
    await expect(page.locator('button').filter({ hasText: targetDay })).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('text=No open times on this date')).not.toBeVisible();
    await expect(page.locator('text=Available times')).toBeVisible({ timeout: 15000 });
  });

  test('16. Regression: "View your bookings" after a first-time (pre-browsed) booking shows the real dashboard, not a blank page', async ({ page }) => {
    // Guards a real bug reported after this build shipped: handleConfirm()
    // (stores/booking.ts) created the patient via api.createPatient() to get
    // a patient_id for the appointment, but only ever kept the id -- it threw
    // away the rest of the response and never set `existingPatient`. SuccessStep's
    // "View your bookings" button calls goToStep('review'), and BookingWizard's
    // `v-else-if="step === 'review' && existingPatient"` guard silently renders
    // nothing when existingPatient is still null -- a booking succeeds, the
    // success screen shows correctly, but clicking through to view it lands on
    // a blank page except for a "Sign out" button. Only reachable via the
    // pre-browsed path (a brand-new patient's first booking) -- a returning
    // patient always has existingPatient set already, from handleVerified.
    const email = `e2e_viewbookings_${Date.now()}@example.com`;

    await page.goto(APP, { waitUntil: 'networkidle' });
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Use email instead")');
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Continue")');

    // New email -> pre-browsed path -> straight to doctor selection, no OTP yet.
    await expect(page.locator('text=Choose your specialist')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Auto-assign")');
    // Auto-assign leaves doctorId null, so BookingForm's title is "Pick a
    // date" here, not "Choose your date & time" (that's the specific-doctor
    // title) -- match on the slot list instead of the title.
    // Pick whatever the first available slot is rather than a hardcoded time
    // — which specific slots are open varies with how much other test/manual
    // activity has already booked out that date.
    await expect(page.locator('text=Available times')).toBeVisible({ timeout: 15000 });
    await page.locator('button', { hasText: /—/ }).first().click();

    // Verify (OTP), then patient details, then confirm.
    await expect(page.locator('#otp')).toBeVisible({ timeout: 15000 });
    await page.locator('#otp').fill('123456');
    await page.fill('input[placeholder="John"]', 'View');
    await page.fill('input[placeholder="Doe"]', 'Bookings');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('text=Almost there')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Confirm Booking")');
    await expect(page.locator('h2:has-text("Appointment Booked!")')).toBeVisible({ timeout: 15000 });

    // The actual regression: click through and confirm the dashboard renders
    // for real, not a bare "Sign out" button on an otherwise-empty page.
    await page.click('button:has-text("View your bookings")');
    await expect(page.locator('text=Welcome back, View')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Dr.').first()).toBeVisible({ timeout: 15000 });
  });
});
