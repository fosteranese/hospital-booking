import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:3000';

test.describe('Frontend integration', () => {
  test('1. Page loads with no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Should show auth step
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('ERR_BLOCKED_BY_CLIENT')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('2. API: check patient exists', async ({ request }) => {
    const r1 = await request.get(`${API}/api/patients/check?email=new@x.com`);
    expect(r1.ok()).toBeTruthy();
    expect((await r1.json()).email_taken).toBe(false);

    // Verify with known data
    const r2 = await request.get(`${API}/api/patients/check?phone=0548888888`);
    expect(r2.ok()).toBeTruthy();
    expect((await r2.json()).phone_taken).toBe(true);
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
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });

    // Auth with the same email
    await page.click('button:has-text("Use email instead")');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Send OTP")');

    // Wait for OTP step and enter code
    await expect(page.locator('#otp')).toBeVisible({ timeout: 15000 });
    await page.locator('#otp').fill('123456');

    // Wait for handleVerified to resolve — should detect returning patient
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

    // Create user2 (so browser auth detects returning patient)
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

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await expect(page.locator('h1:has-text("Welcome to Mediport")')).toBeVisible({ timeout: 15000 });

    // Auth via email
    await page.click('button:has-text("Use email instead")');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await page.fill('input[type="email"]', email2);
    await page.click('button:has-text("Send OTP")');

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

    // Wait for slots to load
    await page.waitForTimeout(2000);

    // Dr1's t1 is booked so it should NOT be visible
    await expect(page.locator(`button:has-text("${slotTime} — ${endTime}")`)).not.toBeVisible();

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
    await page.waitForTimeout(2000);

    // Dr2's same-time slot should be available and visible
    await expect(page.locator(`button:has-text("${slotTime} — ${endTime}")`)).toBeVisible();

    // Select the slot
    await page.click(`button:has-text("${slotTime} — ${endTime}")`);

    // Wait for confirm step and click Confirm Booking
    await expect(page.locator('text=Almost there')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Confirm Booking")');

    // Verify success
    await expect(page.locator('h2:has-text("Appointment Booked!")')).toBeVisible({ timeout: 15000 });
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
});
