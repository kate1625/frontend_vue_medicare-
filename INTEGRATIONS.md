# MediCare+ integration map

Use this page to find where each third-party integration is used in the Vue app and API.

## 1. FullCalendar — appointment calendars

- **Patient booking calendar:** `src/views/BookAppointmentView.vue`
  - Creates the calendar with day, week, and day views.
  - Loads open appointment slots from `/api/appointments/calendar` and selects a date/time for booking.
- **Clinic appointment calendar:** `src/views/AppointmentsView.vue`
  - Shows and manages clinic appointment schedules.
- **Packages:** `package.json` (`@fullcalendar/core`, `daygrid`, `timegrid`, `interaction`).

## 2. Chart.js — dashboard and report charts

- **Patient visit history:** `src/views/PatientDashboardView.vue` — monthly appointment bar chart.
- **Clinic dashboards:** `src/views/ClinicDashboardView.vue` — appointment status, revenue, service, and staff activity charts.
- **Admin reports:** `src/views/ReportsView.vue` — report charts, plus PDF export below.
- **Package:** `package.json` (`chart.js`).

## 3. EmailJS — account emails

- **Patient registration and verification email:** `BackEnd_lava_MediCare+/app/controllers/Auth.php`
  - `register()`, `resendVerificationEmail()`, and `sendVerificationEmail()`.
- **Password reset email:** `BackEnd_lava_MediCare+/app/controllers/Auth.php`
  - `requestPasswordReset()` calls `sendPasswordResetEmail()` to send the expiring reset link.
- **Backend template settings:** `BackEnd_lava_MediCare+/.env` (private local configuration) and `.env.example` (names/documentation). Password reset needs `EMAILJS_SERVICE_ID`, `EMAILJS_PASSWORD_RESET_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, and `FRONTEND_URL` configured on the backend. The EmailJS reset template must use `{{to_email}}`, `{{to_name}}`, `{{reset_url}}`, `{{app_name}}`, and `{{expires_in_minutes}}`. A password reset link is only accepted after its emailed token is validated; the API never returns a test token to the browser.

## 4. Brevo — clinic and patient email alerts

- **Admin alerts:** new bookings, patient cancellations, submitted payments, and verified online payments are emailed to `ADMIN_NOTIFICATION_EMAIL` (defaults to the clinic admin address). Each alert has a button to open the login page.
- **Patient emails:** appointment requests/updates, payment submissions and verification outcomes, and newly recorded prescriptions are emailed to the patient's saved email address when valid. Payment emails show the plan, submitted/verified amount, and remaining balance. Prescription emails intentionally contain no medicine details; patients must sign in to view those securely.
- **Appointment updates:** the staff **Email patient** action in `src/views/AppointmentDetailView.vue` calls `POST /api/appointments/{id}/email`. Booking, rescheduling, cancellation, and status changes also send a server-side Brevo message and write to `email_notifications`.
- **Same-day reminder:** `POST /api/internal/appointment-reminders` sends one reminder for each pending/confirmed appointment scheduled for today. It is protected by `X-Brevo-Reminder-Token` and should be called by Windows Task Scheduler every 15 minutes (or by cron on Linux). The endpoint is idempotent because it checks the notification log before sending.
- **Backend settings:** configure `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `ADMIN_NOTIFICATION_EMAIL`, `FRONTEND_URL`, and a long random `BREVO_REMINDER_TOKEN` in `BackEnd_lava_MediCare+/.env`. No Brevo key belongs in the Vue environment. Verify the sender address in Brevo before sending.
- **Brevo free plan setup:** in Brevo, go to **Senders & IP → Senders → Add a sender**, verify the sender email, then go to **SMTP & API → API Keys → Create a new API key** and copy it once into the backend `.env`. The free plan is sufficient for transactional email within Brevo's daily limit; use a real verified sender and monitor the transactional log.
- **Task Scheduler request (Windows PowerShell):**

  ```powershell
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8083/api/internal/appointment-reminders" -Headers @{ "X-Brevo-Reminder-Token" = "YOUR_BREVO_REMINDER_TOKEN" }
  ```

  Save this as a `.ps1` file, run it using `powershell.exe -ExecutionPolicy Bypass -File ...`, and configure a task to run every 15 minutes. Keep the token out of the frontend and source control.

## 5. QRCode — payment instructions and receipts

- **Payment instructions:** `src/views/PaymentView.vue` — generates a QR code for the selected payment account.
- **Payment receipt:** `src/views/ReceiptView.vue` — generates a receipt QR code.
- **Type declaration:** `src/types/qrcode.d.ts`.
- **Package:** `package.json` (`qrcode`).

## 6. PayMongo — test checkout

- **Patient checkout:** `src/views/PaymentView.vue` starts a PayMongo Checkout Session from the backend and checks the session status after the patient returns. Card and e-wallet payments must use PayMongo; clinic-review submission is only for cash and bank transfers.
- **Backend API:** `BackEnd_lava_MediCare+/app/controllers/Clinic_operations.php` creates and verifies sessions. PHP verifies PayMongo's TLS certificate using the bundled `app/config/certs/mozilla-cacert.pem`; the secret key is used only by PHP and the Vue app never receives it.
- **Configuration:** in the PayMongo Dashboard, switch to test mode and create/copy a **secret** test API key (starts with `sk_test_`, not the publishable `pk_test_` key). In `BackEnd_lava_MediCare+/.env`, set `PAYMONGO_MODE=test`, put the key in `PAYMONGO_SECRET_KEY`, and set `PAYMONGO_PAYMENT_METHOD_TYPES=gcash,card` (or only methods enabled for the account). Restart the PHP backend after saving `.env`; it loads these settings at startup. Never put the secret in the Vue frontend, commit it, or paste it into chat. If the key was exposed, revoke it and create a replacement in the dashboard.
- **Testing:** use a patient appointment with an active card/e-wallet payment method, then select it and click **Pay online · PayMongo test**. Payment is checked against PayMongo when the patient returns to MediCare+; failed or unavailable online checkout must be retried or paid with cash/bank transfer, not submitted for clinic review.
- **Official docs:** [Checkout Sessions](https://docs.paymongo.com/reference/checkout-sessions) and [Webhooks](https://docs.paymongo.com/reference/webhooks).

## 7. jsPDF and AutoTable — downloadable PDFs

- **Patient medical history:** `src/views/PatientProfileView.vue` — exports treatment history as a table.
- **Payment receipt:** `src/views/ReceiptView.vue` — exports the receipt and includes its QR code.
- **Admin reports:** `src/views/ReportsView.vue` — exports charts’ report data as tables.
- **Audit logs:** `src/views/AuditLogsView.vue` — exports audit entries in landscape format.
- **Packages:** `package.json` (`jspdf`, `jspdf-autotable`).

## Quick search

From the frontend root in PowerShell, find integration imports and call sites with:

```powershell
rg -n "@fullcalendar|new Calendar|chart.js|new Chart|emailjs|sendAppointmentEmail|QRCode|toDataURL|jsPDF|autoTable" src package.json
```
