<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, apiRequest, getApiData } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

interface Appointment { appointment_id:number; patient_id:number; service_id:number; dentist_id:number|null; patient:string; patient_email:string|null; service_name:string; price:number|string; verified_amount:number|string; payment_status:string|null; dentist:string|null; appt_date:string; appt_time:string; end_time:string|null; duration_min:number|string; status:string; remarks:string|null; cancel_reason:string|null; reschedule_reason:string|null }
interface HistoryEntry { log_id:number; action:string; table_name:string; record_id:number; created_at:string; actor:string }
const route = useRoute()
const appointment = ref<Appointment|null>(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const success = ref('')
const notifying = ref(false)
const rescheduling = ref(false)
const slotsLoading = ref(false)
const availableSlots = ref<string[]>([])
const rescheduleForm = ref({ date: '', time: '', reason: '' })
const history = ref<HistoryEntry[]>([])

async function load() {
  loading.value = true; error.value = ''
  try {
    const appointmentId = encodeURIComponent(String(route.params.id))
    appointment.value = await getApiData<Appointment>(`/api/appointments/${appointmentId}`)
    history.value = await getApiData<HistoryEntry[]>(`/api/appointments/${appointmentId}/history`)
  }
  catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) return
    error.value = cause instanceof ApiError ? cause.message : 'Could not load appointment details.'
  }
  finally { loading.value = false }
}

function historyLabel(action: string) {
  return ({ INSERT: 'Appointment created', UPDATE: 'Appointment details updated', DELETE: 'Appointment deleted' } as Record<string, string>)[action] ?? action
}

function formatHistoryDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function setStatus(status: string) {
  if (!appointment.value) return
  if (status === 'confirmed' && !canConfirm(appointment.value)) {
    error.value = 'The full appointment payment must be verified before it can be confirmed.'
    notify.warning(error.value, 'Payment required')
    return
  }
  if (status === 'no_show' && !canMarkNoShow(appointment.value)) {
    error.value = noShowDisabledReason()
    notify.warning(error.value, 'Appointment has not ended')
    return
  }
  if (status === 'completed' && !canComplete(appointment.value)) {
    error.value = canConfirm(appointment.value)
      ? 'An appointment can only be completed after its scheduled end time.'
      : 'The full appointment payment must be verified before it can be completed.'
    notify.warning(error.value, 'Appointment cannot be completed yet')
    return
  }
  busy.value = true; error.value = ''; success.value = ''
  try {
    const result = await apiRequest<{ data: { email_sent: boolean }; message: string }>(`/api/appointments/${appointment.value.appointment_id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
    success.value = result.message
    if (result.data.email_sent) notify.success(success.value, 'Appointment updated')
    else notify.warning(success.value, 'Patient email not sent')
    await load()
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not update appointment status.'; notify.error(error.value, 'Appointment update failed') }
  finally { busy.value = false }
}

async function notifyPatient() {
  if (!appointment.value) return
  notifying.value = true; error.value = ''; success.value = ''
  const current = appointment.value
  try {
    const result = await apiRequest<{ message: string }>(`/api/appointments/${current.appointment_id}/email`, { method: 'POST' })
    success.value = result.message
    notify.success(success.value, 'Email sent')
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not send the appointment email.'; notify.error(error.value, 'Email not sent') }
  finally { notifying.value = false }
}

function canConfirm(item: Appointment) {
  return Number.isFinite(Number(item.verified_amount))
    && Number(item.verified_amount) >= Number(item.price)
}

function canMarkNoShow(item: Appointment) {
  const appointmentEnd = scheduledEnd(item)
  return !Number.isNaN(appointmentEnd.getTime()) && appointmentEnd.getTime() <= Date.now()
}

function noShowDisabledReason() {
  return 'No-show is available after the appointment end time'
}

function canComplete(item: Appointment) {
  return canMarkNoShow(item) && canConfirm(item)
}

function scheduledEnd(item: Appointment) {
  const appointmentEnd = new Date(`${item.appt_date}T${item.end_time || item.appt_time}`)
  if (!item.end_time && !Number.isNaN(appointmentEnd.getTime())) {
    appointmentEnd.setMinutes(appointmentEnd.getMinutes() + Math.max(15, Number(item.duration_min) || 30))
  }
  return appointmentEnd
}

function localToday() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  return date.toISOString().slice(0, 10)
}

async function loadAvailableSlots() {
  availableSlots.value = []
  rescheduleForm.value.time = ''
  if (!appointment.value?.dentist_id || !rescheduleForm.value.date) return
  slotsLoading.value = true
  try {
    const params = new URLSearchParams({
      dentist_id: String(appointment.value.dentist_id),
      service_id: String(appointment.value.service_id),
      date: rescheduleForm.value.date,
    })
    const result = await getApiData<{ slots: string[] }>(`/api/appointments/availability?${params.toString()}`)
    availableSlots.value = result.slots
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not check available reschedule times.'
  } finally {
    slotsLoading.value = false
  }
}

async function rescheduleAppointment() {
  if (!appointment.value || !rescheduleForm.value.date || !rescheduleForm.value.time || !rescheduleForm.value.reason) return
  rescheduling.value = true; error.value = ''; success.value = ''
  try {
    const result = await apiRequest<{ data: { email_sent: boolean }; message: string }>(`/api/appointments/${appointment.value.appointment_id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ appt_date: rescheduleForm.value.date, appt_time: rescheduleForm.value.time, reschedule_reason: rescheduleForm.value.reason }),
    })
    success.value = result.message
    if (result.data.email_sent) notify.success(success.value, 'Appointment rescheduled')
    else notify.warning(success.value, 'Patient email not sent')
    await load()
    rescheduleForm.value = { date: '', time: '', reason: '' }
    availableSlots.value = []
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not reschedule the appointment.'
    notify.error(error.value, 'Rescheduling failed')
  } finally {
    rescheduling.value = false
  }
}

onMounted(load)
watch(() => route.params.id, load)
watch(() => rescheduleForm.value.date, loadAvailableSlots)
</script>

<template>
  <div class="detail-back"><RouterLink class="text-link" to="/staff/appointments">← Back to appointments</RouterLink></div>
  <SkeletonLoader v-if="loading" variant="profile" label="Loading appointment details" />
  <div v-else-if="error" class="alert alert-error" role="alert">{{ error }} <button class="text-button" type="button" @click="load">Retry</button></div>
  <template v-else-if="appointment">
    <section class="page-heading"><div><p class="eyebrow">PAGE 15 · APPOINTMENT #{{ appointment.appointment_id }}</p><h1>Appointment details</h1><p class="muted">Status and visit information from the clinic database.</p></div><span class="status-badge" :class="`status-${appointment.status}`">{{ appointment.status.replace('_',' ') }}</span></section>
    <section class="surface detail-card"><dl class="detail-grid">
      <div><dt>Patient</dt><dd>{{ appointment.patient }} · #{{ appointment.patient_id }}</dd></div>
      <div><dt>Service</dt><dd>{{ appointment.service_name }}</dd></div>
      <div><dt>Date</dt><dd>{{ appointment.appt_date }}</dd></div>
      <div><dt>Time</dt><dd>{{ appointment.appt_time }}<span v-if="appointment.end_time">–{{ appointment.end_time }}</span></dd></div>
      <div><dt>Dentist</dt><dd>{{ appointment.dentist || 'Unassigned' }}</dd></div>
      <div><dt>Fee</dt><dd>{{ Number(appointment.price).toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</dd></div>
      <div><dt>Payment status</dt><dd>{{ appointment.payment_status || 'Unpaid' }}</dd></div>
      <div><dt>Verified payment</dt><dd>{{ Number(appointment.verified_amount).toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }} / {{ Number(appointment.price).toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</dd></div>
      <div v-if="appointment.remarks" class="detail-full"><dt>Remarks</dt><dd>{{ appointment.remarks }}</dd></div>
      <div v-if="appointment.reschedule_reason" class="detail-full update-note"><dt>Schedule update note</dt><dd>{{ appointment.reschedule_reason }}</dd></div>
      <div v-if="appointment.cancel_reason" class="detail-full"><dt>Cancellation reason</dt><dd>{{ appointment.cancel_reason }}</dd></div>
    </dl></section>
    <section class="surface history-card">
      <div class="history-heading"><div><p class="eyebrow">APPOINTMENT HISTORY</p><h2>What changed</h2></div><span class="history-count">{{ history.length }} event{{ history.length === 1 ? '' : 's' }}</span></div>
      <div v-if="history.length" class="history-list">
        <article v-for="entry in history" :key="entry.log_id" class="history-item">
          <span class="history-dot" aria-hidden="true"></span>
          <div><strong>{{ historyLabel(entry.action) }}</strong><p>{{ entry.actor }} · {{ formatHistoryDate(entry.created_at) }}</p></div>
        </article>
      </div>
      <p v-else class="muted">No recorded changes yet.</p>
    </section>
    <section v-if="appointment.dentist_id && appointment.status === 'no_show'" class="surface reschedule-card">
      <div>
        <p class="eyebrow">SCHEDULE MANAGEMENT</p>
        <h2>Reschedule appointment</h2>
        <p class="muted">Choose a new available date and time. The patient will receive an email notification automatically.</p>
      </div>
      <form class="reschedule-form" @submit.prevent="rescheduleAppointment">
        <label>Date<input v-model="rescheduleForm.date" type="date" :min="localToday()" required /></label>
        <label>Available time
          <select v-model="rescheduleForm.time" :disabled="slotsLoading || !availableSlots.length" required>
            <option value="" disabled>{{ slotsLoading ? 'Checking availability…' : availableSlots.length ? 'Choose a time' : 'Choose a date first' }}</option>
            <option v-for="slot in availableSlots" :key="slot" :value="slot">{{ slot }}</option>
          </select>
        </label>
        <label>Reason
          <select v-model="rescheduleForm.reason" required>
            <option value="" disabled>Choose a reason</option>
            <option>Patient did not attend the scheduled time</option>
            <option>Doctor emergency or unavailable</option>
            <option>Clinic schedule changed</option>
            <option>Patient requested a different date</option>
            <option>Other</option>
          </select>
        </label>
        <button class="button button-primary" type="submit" :disabled="rescheduling || slotsLoading || !rescheduleForm.time || !rescheduleForm.reason">
          {{ rescheduling ? 'Rescheduling…' : 'Reschedule & email patient' }}
        </button>
      </form>
    </section>
    <div class="appointment-actions" v-if="['pending','confirmed'].includes(appointment.status)">
      <button class="button button-quiet" :disabled="notifying" type="button" @click="notifyPatient">{{ notifying ? 'Sending…' : 'Email patient' }}</button>
      <button v-if="appointment.status === 'pending'" class="button button-primary" :disabled="busy || !canConfirm(appointment)" :title="canConfirm(appointment) ? 'Confirm appointment' : 'Verify full payment before confirming'" type="button" @click="setStatus('confirmed')">Confirm appointment</button>
      <button v-if="appointment.status === 'confirmed'" class="button button-primary" :disabled="busy || !canComplete(appointment)" :title="canConfirm(appointment) ? 'Mark completed after the scheduled end time' : 'Verify full payment before completing'" type="button" @click="setStatus('completed')">Mark completed</button>
      <button v-if="appointment.status === 'confirmed'" class="button button-quiet" :disabled="busy || !canMarkNoShow(appointment)" :title="canMarkNoShow(appointment) ? 'Mark patient no-show' : noShowDisabledReason()" type="button" @click="setStatus('no_show')">Mark no-show</button>
    </div>
  </template>

</template>

<style scoped>
.reschedule-card{display:grid;gap:18px;margin-top:16px;padding:22px}.reschedule-card h2{margin:4px 0 5px;font-size:18px}.reschedule-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;align-items:end;gap:12px}.reschedule-form label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:700}.reschedule-form input,.reschedule-form select{min-height:42px;border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:var(--surface);color:var(--ink)}.reschedule-form button{white-space:nowrap}.history-card{display:grid;gap:16px;margin-top:16px;padding:22px}.history-heading{display:flex;align-items:center;justify-content:space-between}.history-heading h2{margin:4px 0 0;font-size:18px}.history-count{color:var(--muted);font-size:12px;font-weight:700}.history-list{display:grid;gap:0}.history-item{display:flex;gap:12px;padding:13px 0;border-top:1px solid var(--line)}.history-dot{width:9px;height:9px;margin:6px 0 0;border-radius:50%;background:var(--teal);box-shadow:0 0 0 4px var(--soft-teal);flex:none}.history-item strong{font-size:14px}.history-item p{margin:3px 0 0;color:var(--muted);font-size:12px}.update-note{padding:12px;border:1px solid #cfe8dc;border-radius:10px;background:var(--soft-teal)}.update-note dd{color:var(--teal-dark)}@media(max-width:760px){.reschedule-form{grid-template-columns:1fr}.reschedule-form button{width:100%}}

:global(html[data-theme='dark'] .detail-grid) {
  border-color: #3b5148;
}

:global(html[data-theme='dark'] .detail-grid > div) {
  border-color: #3b5148;
}

:global(html[data-theme='dark'] .detail-grid dt) {
  color: #b2c2bb;
}

:global(html[data-theme='dark'] .detail-grid dd) {
  color: #e6f0eb;
}

:global(html[data-theme='dark'] .update-note) {
  border-color: #426d55;
  background: #263a30;
}

:global(html[data-theme='dark'] .update-note dd) {
  color: #c9ded1;
}

:global(html[data-theme='dark'] .history-card) {
  border-color: #3b5148;
  background: #1d2b26;
}

:global(html[data-theme='dark'] .history-heading h2),
:global(html[data-theme='dark'] .history-item strong) {
  color: #e6f0eb;
}

:global(html[data-theme='dark'] .history-count),
:global(html[data-theme='dark'] .history-item p),
:global(html[data-theme='dark'] .history-card > .muted) {
  color: #b2c2bb;
}

:global(html[data-theme='dark'] .history-item) {
  border-color: #3b5148;
}

:global(html[data-theme='dark'] .history-dot) {
  background: #72b58c;
  box-shadow: 0 0 0 4px #294236;
}

:global(html[data-theme='dark'] .reschedule-card h2) {
  color: #e6f0eb;
}

:global(html[data-theme='dark'] .reschedule-card > div > .muted) {
  color: #b2c2bb;
}

:global(html[data-theme='dark'] .reschedule-form label) {
  color: #c1d0c9;
}

:global(html[data-theme='dark'] .reschedule-form input),
:global(html[data-theme='dark'] .reschedule-form select) {
  border-color: #466056;
  background: #202e2a;
  color: #e6f0eb;
  color-scheme: dark;
}

:global(html[data-theme='dark'] .reschedule-form select:disabled) {
  border-color: #3b5148;
  background: #263630;
  color: #a9bdb3;
  opacity: 1;
}

:global(html[data-theme='dark'] .page-heading .status-confirmed) {
  border: 1px solid #426d55;
  background: #244231;
  color: #a9e0bc;
}

:global(html[data-theme='dark'] .page-heading .status-pending) {
  border: 1px solid #806b3e;
  background: #403821;
  color: #f0d48b;
}

:global(html[data-theme='dark'] .page-heading .status-completed) {
  border: 1px solid #46627a;
  background: #263b4c;
  color: #b3d5f1;
}

:global(html[data-theme='dark'] .page-heading .status-cancelled),
:global(html[data-theme='dark'] .page-heading .status-no_show) {
  border: 1px solid #754849;
  background: #40272a;
  color: #f0a6a6;
}
</style>
