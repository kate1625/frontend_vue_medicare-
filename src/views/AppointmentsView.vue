<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Calendar, type EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ApiError, apiRequest, getApiData, getPortalRole } from '../services/api'
import UiIcon from '../components/UiIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

interface Appointment {
  appointment_id: number
  patient_id: number
  service_id?: number
  dentist_id?: number | null
  appt_date: string
  appt_time: string
  end_time?: string | null
  status: string
  service_name: string
  price: number | string
  dentist: string | null
  payment_status: string | null
  payment_id: number | null
  payment_amount: number | string | null
  verified_amount: number | string
  payment_method: string | null
  payment_reference: string | null
  payment_transaction: string | null
  receipt_no: string | null
  created_at: string
  patient?: string
  patient_email?: string | null
  remarks?: string | null
  cancel_reason?: string | null
  reschedule_reason?: string | null
}
interface HistoryEntry { log_id: number; action: string; created_at: string; actor: string }

function formatSubmittedDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

const props = defineProps<{ pageNumber: number }>()
const router = useRouter()
const isPatient = computed(() => getPortalRole() === 'patient')
const showCalendar = computed(() => props.pageNumber === 8 || props.pageNumber === 14)
const calendarElement = ref<HTMLDivElement | null>(null)
let calendar: Calendar | null = null
const appointments = ref<Appointment[]>([])
const showStaffBooking = ref(false)
const staffCatalog = ref<{ services: {service_id:number;service_name:string}[]; dentists:{dentist_id:number;display_name:string}[] } | null>(null)
const staffPatients = ref<{id:number;first_name:string;last_name:string}[]>([])
const staffSlots = ref<string[]>([])
const staffSlotsLoading = ref(false)
const staffBooking = ref({patient_id:0,service_id:0,dentist_id:0,appt_date:'',appt_time:''})
const query = ref('')
const statusFilter = ref('all')
const requestedDateFilter = ref<'all' | 'today' | 'yesterday' | 'last7'>('all')
const loading = ref(true)
const busyId = ref<number | null>(null)
const error = ref('')
const success = ref('')
const cancelTarget = ref<Appointment | null>(null)
const selectedCalendarDate = ref('')
const showCalendarDay = ref(false)
const detailAppointment = ref<Appointment | null>(null)
const detailHistory = ref<HistoryEntry[]>([])
const detailLoading = ref(false)
const showAppointmentDetails = ref(false)
const detailRescheduling = ref(false)
const detailSlotsLoading = ref(false)
const detailSlots = ref<string[]>([])
const detailRescheduleForm = ref({ date: '', time: '', reason: '' })
const detailNotifying = ref(false)
const selectedDayAppointments = computed(() => appointments.value
  .filter((item) => item.appt_date === selectedCalendarDate.value && ['pending', 'confirmed'].includes(item.status))
  .sort((first, second) => first.appt_time.localeCompare(second.appt_time)))
const verifyingPaymentId = ref<number | null>(null)
const today = computed(() => localToday())
const todayAppointments = computed(() => appointments.value.filter((item) =>
  item.appt_date === today.value && ['pending', 'confirmed'].includes(item.status),
))
const visible = computed(() => appointments.value.filter((item) => {
  const matchesStatus = statusFilter.value === 'all' || item.status === statusFilter.value
  const requestedDate = item.created_at ? new Date(item.created_at) : null
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const now = new Date()
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const matchesRequestedDate = requestedDateFilter.value === 'all'
    || (requestedDateFilter.value === 'today' && requestedDate && requestedDate >= todayStart && requestedDate <= now)
    || (requestedDateFilter.value === 'yesterday' && requestedDate && requestedDate >= yesterdayStart && requestedDate < todayStart)
    || (requestedDateFilter.value === 'last7' && requestedDate && requestedDate >= new Date(todayStart.getTime() - 6 * 86400000) && requestedDate <= now)
  const text = `${item.patient ?? ''} ${item.service_name} ${item.dentist ?? ''} ${item.appointment_id} ${item.status}`.toLowerCase()
  return matchesStatus && matchesRequestedDate && text.includes(query.value.trim().toLowerCase())
}))

async function loadAppointments() {
  loading.value = true
  error.value = ''
  try {
    appointments.value = await getApiData<Appointment[]>('/api/appointments')
    refreshCalendarEvents()
  }
  catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not load appointments.' }
  finally { loading.value = false }
}

async function createStaffBooking() {
  busyId.value = -1; error.value = ''; success.value = ''
  try {
    await apiRequest('/api/appointments', { method:'POST', body:JSON.stringify(staffBooking.value) })
    showStaffBooking.value = false
    staffBooking.value = {patient_id:0,service_id:0,dentist_id:0,appt_date:'',appt_time:''}
    success.value = 'Appointment confirmed and added to the clinic schedule.'
    await loadAppointments()
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not book the appointment.' }
  finally { busyId.value = null }
}
async function loadStaffSlots() {
  staffSlots.value = []
  staffBooking.value.appt_time = ''
  const { dentist_id, service_id, appt_date } = staffBooking.value
  if (!dentist_id || !service_id || !appt_date) return
  staffSlotsLoading.value = true
  try {
    const params = new URLSearchParams({ dentist_id:String(dentist_id), service_id:String(service_id), date:appt_date })
    const result = await getApiData<{slots:string[]}>(`/api/appointments/availability?${params.toString()}`)
    staffSlots.value = result.slots
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not check available appointment times.' }
  finally { staffSlotsLoading.value = false }
}
function localToday() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  return date.toISOString().slice(0, 10)
}

function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function canCancel(item: Appointment) {
  const appointmentDate = new Date(`${item.appt_date}T${item.appt_time}`)
  return ['pending', 'confirmed'].includes(item.status)
    && !Number.isNaN(appointmentDate.getTime())
    && appointmentDate.getTime() > Date.now()
}

function statusColor(status: string) {
  return ({ pending: '#c48730', confirmed: '#379a6b', completed: '#5484c1', cancelled: '#bd4b53', no_show: '#8b6ea8' } as Record<string, string>)[status] ?? '#168d8c'
}

function eventItems(): EventInput[] {
  return appointments.value.filter((item) => ['pending', 'confirmed'].includes(item.status)).map((item) => ({
    id: String(item.appointment_id),
    title: '',
    start: `${item.appt_date}T${item.appt_time}`,
    end: item.appt_date && item.end_time ? `${item.appt_date}T${item.end_time}` : undefined,
    display: 'none',
    backgroundColor: statusColor(item.status),
    borderColor: statusColor(item.status),
    extendedProps: { appointmentId: item.appointment_id },
  }))
}

function refreshCalendarEvents() {
  if (!calendar) return
  calendar.getEventSources().forEach((source) => source.remove())
  calendar.addEventSource(eventItems())
}

function formatCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(date)
}

function paymentLabel(status: string | null) {
  if (status === 'verified') return 'Payment verified'
  if (status === 'pending') return 'Pending verification'
  if (status === 'rejected') return 'Payment rejected'
  return 'Unpaid'
}

function paymentClass(status: string | null) {
  return status ? `payment-${status}` : 'payment-unpaid'
}

function openCalendarDay(date: string) {
  selectedCalendarDate.value = date
  showCalendarDay.value = true
}

async function openAppointmentDetails(item: Appointment) {
  detailAppointment.value = item
  detailHistory.value = []
  showAppointmentDetails.value = true
  detailLoading.value = true
  try {
    detailHistory.value = await getApiData<HistoryEntry[]>(`/api/appointments/${item.appointment_id}/history`)
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load appointment history.'
  } finally {
    detailLoading.value = false
  }

}

async function loadDetailSlots() {
  detailSlots.value = []
  detailRescheduleForm.value.time = ''
  const item = detailAppointment.value
  if (!item?.dentist_id || !detailRescheduleForm.value.date) return
  detailSlotsLoading.value = true
  try {
    const params = new URLSearchParams({ dentist_id: String(item.dentist_id), service_id: String(item.service_id), date: detailRescheduleForm.value.date })
    const result = await getApiData<{ slots: string[] }>(`/api/appointments/availability?${params.toString()}`)
    detailSlots.value = result.slots
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not check available reschedule times.'
  } finally { detailSlotsLoading.value = false }
}

async function rescheduleFromDetails() {
  const item = detailAppointment.value
  if (!item || !detailRescheduleForm.value.date || !detailRescheduleForm.value.time || !detailRescheduleForm.value.reason) return
  detailRescheduling.value = true; error.value = ''
  try {
    await apiRequest(`/api/appointments/${item.appointment_id}/reschedule`, { method: 'POST', body: JSON.stringify({ appt_date: detailRescheduleForm.value.date, appt_time: detailRescheduleForm.value.time, reschedule_reason: detailRescheduleForm.value.reason }) })
    success.value = 'Appointment rescheduled. A confirmation email was sent to the patient.'
    detailRescheduleForm.value = { date: '', time: '', reason: '' }; detailSlots.value = []
    await loadAppointments()
    detailAppointment.value = appointments.value.find((appointment) => appointment.appointment_id === item.appointment_id) ?? item
    detailHistory.value = await getApiData<HistoryEntry[]>(`/api/appointments/${item.appointment_id}/history`)
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not reschedule the appointment.'
  } finally { detailRescheduling.value = false }
}

async function emailFromDetails() {
  const item = detailAppointment.value
  if (!item) return
  detailNotifying.value = true; error.value = ''
  try {
    const result = await apiRequest<{ message: string }>(`/api/appointments/${item.appointment_id}/email`, { method: 'POST' })
    success.value = result.message
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not send the appointment email.'
  } finally { detailNotifying.value = false }
}

function historyLabel(action: string) {
  return ({ INSERT: 'Appointment created', UPDATE: 'Appointment updated', DELETE: 'Appointment deleted' } as Record<string, string>)[action] ?? action
}

function formatHistoryDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function verifyPayment(item: Appointment) {
  if (!item.payment_id || item.payment_status !== 'pending') return
  verifyingPaymentId.value = item.payment_id
  error.value = ''
  success.value = ''
  try {
    if (item.payment_transaction?.startsWith('paymongo:')) {
      await apiRequest('/api/payments/paymongo/confirm', {
        method: 'POST',
        body: JSON.stringify({ payment_id: item.payment_id }),
      })
    } else {
      await apiRequest(`/api/payments/${item.payment_id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'verified' }),
      })
    }
    success.value = 'Payment verified. The patient confirmation email was sent through Brevo.'
    await loadAppointments()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not verify this payment.'
  } finally {
    verifyingPaymentId.value = null
  }
}

function initializeCalendar() {
  if (!calendarElement.value || !showCalendar.value) return
  calendar = new Calendar(calendarElement.value, {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    height: 'auto',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    editable: !isPatient.value,
    events: eventItems(),
    dateClick: (info) => openCalendarDay(info.dateStr),
    dayCellDidMount: (info) => {
      const count = appointments.value.filter((item) => item.appt_date === calendarDateKey(info.date) && ['pending', 'confirmed'].includes(item.status)).length
      if (count > 0) {
        const badge = document.createElement('span')
        badge.className = 'calendar-appointment-count'
        badge.innerHTML = `<span aria-hidden="true">●</span> ${count} ${count === 1 ? 'appointment' : 'appointments'}`
        badge.title = `${count} ${count === 1 ? 'appointment' : 'appointments'} scheduled`
        info.el.querySelector('.fc-daygrid-day-top')?.appendChild(badge)
      }
    },
    eventClick: (info) => {
      if (!isPatient.value) void router.push(`/staff/appointments/${info.event.id}`)
    },
    eventDrop: async (info) => {
      const date = info.event.start
      if (!date) { info.revert(); return }
      const apptDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const apptTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      try {
        await apiRequest(`/api/appointments/${info.event.id}/reschedule`, { method: 'POST', body: JSON.stringify({ appt_date: apptDate, appt_time: apptTime }) })
        success.value = 'Appointment rescheduled.'
        await loadAppointments()
      } catch (cause) {
        info.revert()
        error.value = cause instanceof ApiError ? cause.message : 'Could not reschedule appointment.'
      }
    },
  })
  calendar.render()
}

async function cancelAppointment(item: Appointment) {
  if (!canCancel(item)) {
    error.value = 'This appointment is in the past or is no longer active, so it cannot be cancelled.'
    success.value = ''
    return
  }
  cancelTarget.value = item
}

async function confirmCancellation(reason: string) {
  const item = cancelTarget.value
  if (!item || !reason) return
  busyId.value = item.appointment_id
  error.value = ''
  success.value = ''
  try {
    await apiRequest(`/api/appointments/${item.appointment_id}/cancel`, { method: 'POST', body: JSON.stringify({ cancel_reason: reason }) })
    success.value = 'Appointment cancelled.'
    await loadAppointments()
    cancelTarget.value = null
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not cancel the appointment.' }
  finally { busyId.value = null }
}

async function updateStatus(item: Appointment, status: string) {
  busyId.value = item.appointment_id
  error.value = ''
  success.value = ''
  try {
    await apiRequest(`/api/appointments/${item.appointment_id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
    success.value = `Appointment marked ${status.replace('_', ' ')}.`
    await loadAppointments()
    if (detailAppointment.value?.appointment_id === item.appointment_id) {
      detailAppointment.value = appointments.value.find((appointment) => appointment.appointment_id === item.appointment_id) ?? detailAppointment.value
      detailHistory.value = await getApiData<HistoryEntry[]>(`/api/appointments/${item.appointment_id}/history`)
    }
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not update appointment status.' }
  finally { busyId.value = null }
}

function money(value: number | string) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value))
}

function canComplete(item: Appointment) {
  const end = item.end_time || item.appt_time
  const appointmentEnd = new Date(`${item.appt_date}T${end}`)
  return appointmentEnd.getTime() <= Date.now() && Number(item.verified_amount) >= Number(item.price)
}

function completeDisabledReason(item: Appointment) {
  if (Number(item.verified_amount) < Number(item.price)) return 'Complete is available after the full payment is verified.'
  return 'Complete is available after the appointment end time.'
}

onMounted(async () => {
  if (!isPatient.value) {
    try {
      staffCatalog.value = await getApiData<typeof staffCatalog.value>('/api/public/overview')
      staffPatients.value = await getApiData<typeof staffPatients.value>('/api/patients')
    } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not load booking options.' }
  }
  await loadAppointments()
  await nextTick()
  initializeCalendar()
})
watch(() => [staffBooking.value.dentist_id, staffBooking.value.service_id, staffBooking.value.appt_date], loadStaffSlots)
watch(() => detailRescheduleForm.value.date, loadDetailSlots)
onBeforeUnmount(() => { calendar?.destroy(); calendar = null })
</script>

<template>
  <section class="page-heading">
    <div><p class="eyebrow">PAGE {{ String(props.pageNumber).padStart(2, '0') }}</p><h1>{{ props.pageNumber === 14 ? 'Appointment Management' : 'My Appointments' }}</h1><p class="muted">Appointments loaded from the clinic database.</p></div>
    <RouterLink v-if="isPatient" to="/patient/book" class="button button-primary">Book appointment</RouterLink>
    <button v-else class="button button-primary" type="button" @click="showStaffBooking=!showStaffBooking"><UiIcon name="plus" /> Add appointment</button>
  </section>
  <section v-if="showStaffBooking" class="surface staff-booking"><h2>Book for a patient</h2><form class="booking-grid" @submit.prevent="createStaffBooking"><label>Patient<select v-model.number="staffBooking.patient_id" required><option :value="0" disabled>Choose a patient</option><option v-for="p in staffPatients" :key="p.id" :value="p.id">{{p.first_name}} {{p.last_name}}</option></select></label><label>Service<select v-model.number="staffBooking.service_id" required><option :value="0" disabled>Choose a service</option><option v-for="s in staffCatalog?.services||[]" :key="s.service_id" :value="s.service_id">{{s.service_name}}</option></select></label><label>Dentist<select v-model.number="staffBooking.dentist_id" required><option :value="0" disabled>Choose a dentist</option><option v-for="d in staffCatalog?.dentists||[]" :key="d.dentist_id" :value="d.dentist_id">{{d.display_name}}</option></select></label><label>Date<input v-model="staffBooking.appt_date" type="date" :min="localToday()" required></label><label>Available time<select v-model="staffBooking.appt_time" required :disabled="staffSlotsLoading||!staffSlots.length"><option value="" disabled>{{staffSlotsLoading?'Checking schedule…':staffSlots.length?'Choose an open time':'Choose a dentist, service, and date first'}}</option><option v-for="slot in staffSlots" :key="slot" :value="slot">{{slot}}</option></select></label><div class="booking-actions"><button class="button button-primary" :disabled="busyId===-1||!staffBooking.appt_time">Confirm booking</button><button class="button button-quiet" type="button" @click="showStaffBooking=false">Close</button></div></form></section>
  <div v-if="error" class="alert alert-error" role="alert">{{ error }} <button class="text-button" type="button" @click="loadAppointments">Retry</button></div>
  <div v-if="success" class="alert alert-success" role="status">{{ success }}</div>
  <div v-if="isPatient && todayAppointments.length" class="alert alert-info appointment-day-reminder" role="status">
    <UiIcon name="bell" />
    <span><strong>Appointment reminder:</strong> you have {{ todayAppointments.length }} appointment{{ todayAppointments.length === 1 ? '' : 's' }} today. Please arrive a little early.</span>
  </div>
  <section class="surface directory-panel">
    <div v-if="showCalendar" class="calendar-panel">
      <div class="calendar-summary">
        <span class="calendar-summary-dot" aria-hidden="true"></span>
        <strong>{{ isPatient ? 'Your scheduled appointments' : 'Scheduled appointments' }}</strong>
        <span>{{ isPatient ? 'Click a date to view your appointment details.' : 'Click a date to view the full schedule and payment status.' }}</span>
      </div>
      <div ref="calendarElement"></div>
    </div>
    <div class="directory-toolbar">
      <label class="search-field"><span class="search-icon"><UiIcon name="search" /></span><input v-model="query" type="search" placeholder="Search appointments" aria-label="Search appointments" /></label>
      <div v-if="!isPatient" class="quick-date-filter" role="group" aria-label="Filter by requested date">
        <button type="button" :class="{ active: requestedDateFilter === 'today' }" @click="requestedDateFilter='today'">Today</button>
        <button type="button" :class="{ active: requestedDateFilter === 'yesterday' }" @click="requestedDateFilter='yesterday'">Yesterday</button>
        <button type="button" :class="{ active: requestedDateFilter === 'last7' }" @click="requestedDateFilter='last7'">Last 7 days</button>
        <button type="button" :class="{ active: requestedDateFilter === 'all' }" @click="requestedDateFilter='all'">All</button>
      </div>
      <select v-model="statusFilter" class="filter-select" aria-label="Filter appointments by status"><option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select>
      <span class="result-count">{{ visible.length }} {{ requestedDateFilter === 'today' ? 'today' : requestedDateFilter === 'yesterday' ? 'yesterday' : requestedDateFilter === 'last7' ? 'recent' : '' }} records</span>
    </div>
    <div v-if="loading" class="empty-state">Loading appointments…</div>
    <div v-else-if="!visible.length" class="empty-state"><strong>No appointments found</strong><p>Try a different search or status filter.</p></div>
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Appointment</th><th>Date &amp; time</th><th v-if="isPatient">Submitted</th><th>Service</th><th v-if="!isPatient">Patient</th><th>Dentist</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="item in visible" :key="item.appointment_id">
            <td><RouterLink v-if="!isPatient" class="patient-name" :to="`/staff/appointments/${item.appointment_id}`">#{{ item.appointment_id }}</RouterLink><span v-else>#{{ item.appointment_id }}</span><small v-if="!isPatient" class="table-secondary">{{ item.patient || `Patient #${item.patient_id}` }}</small><small class="table-secondary">{{ money(item.price) }}</small><small v-if="!isPatient" class="table-secondary">Requested {{ formatSubmittedDate(item.created_at) }}</small></td>
            <td>{{ item.appt_date }}<small class="table-secondary">{{ item.appt_time }}</small></td>
            <td v-if="isPatient">{{ formatSubmittedDate(item.created_at) }}</td>
            <td>{{ item.service_name }}</td><td v-if="!isPatient"><strong>{{ item.patient || `Patient #${item.patient_id}` }}</strong><small class="table-secondary">#{{ item.patient_id }}</small></td><td>{{ item.dentist || 'Unassigned' }}</td>
            <td>{{ item.payment_status || 'Unpaid' }}</td>
            <td><span class="status-badge" :class="`status-${item.status}`">{{ item.status.replace('_', ' ') }}</span></td>
            <td class="actions-cell">
              <button v-if="!isPatient" class="row-action" type="button" @click="openAppointmentDetails(item)">Details</button>
              <button v-if="isPatient && ['pending','confirmed'].includes(item.status)" class="row-action row-action-danger" type="button" :disabled="busyId === item.appointment_id" :title="canCancel(item) ? 'Cancel appointment' : 'Past appointments cannot be cancelled'" @click="cancelAppointment(item)">Cancel</button>
              <template v-else-if="!isPatient && item.status === 'pending'">
                <button class="row-action" type="button" :disabled="busyId === item.appointment_id" @click="updateStatus(item, 'confirmed')">Confirm</button>
                <button class="row-action row-action-danger" type="button" :disabled="busyId === item.appointment_id" :title="canCancel(item) ? 'Cancel appointment' : 'Past appointments cannot be cancelled'" @click="cancelAppointment(item)">Cancel</button>
              </template>
              <template v-else-if="!isPatient && item.status === 'confirmed'">
                <button class="row-action" type="button" :disabled="busyId === item.appointment_id || !canComplete(item)" :title="canComplete(item) ? 'Complete appointment' : completeDisabledReason(item)" @click="updateStatus(item, 'completed')">Complete</button>
                <button class="row-action" type="button" :disabled="busyId === item.appointment_id" @click="updateStatus(item, 'no_show')">No-show</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  <div v-if="showCalendarDay" class="modal-backdrop" @click.self="showCalendarDay=false">
    <section class="form-modal calendar-day-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-day-title">
      <header class="modal-heading">
        <div>
          <p class="eyebrow">{{ isPatient ? 'YOUR APPOINTMENT' : 'DAILY SCHEDULE' }}</p>
          <h2 id="calendar-day-title">{{ formatCalendarDate(selectedCalendarDate) }}</h2>
          <p class="muted">{{ selectedDayAppointments.length }} {{ isPatient ? 'appointment' : 'scheduled appointment' }}{{ selectedDayAppointments.length === 1 ? '' : 's' }}</p>
        </div>
        <button class="text-button" type="button" aria-label="Close daily schedule" @click="showCalendarDay=false">Close</button>
      </header>
      <div v-if="selectedDayAppointments.length" class="calendar-day-list">
        <article v-for="item in selectedDayAppointments" :key="item.appointment_id" class="calendar-day-item">
          <div class="calendar-day-time">{{ item.appt_time }}<small v-if="item.end_time">–{{ item.end_time }}</small></div>
          <div class="calendar-day-info">
            <button v-if="!isPatient" class="patient-name calendar-details-link" type="button" @click="showCalendarDay=false; openAppointmentDetails(item)">
              {{ item.service_name }} · Appointment #{{ item.appointment_id }}
            </button>
            <strong v-else class="patient-name">{{ item.service_name }}</strong>
            <span v-if="isPatient">Dentist: {{ item.dentist || 'To be assigned' }}</span>
            <span v-else>{{ item.patient || `Patient #${item.patient_id}` }} · Patient #{{ item.patient_id }} · Dentist: {{ item.dentist || 'Unassigned' }}</span>
            <small v-if="isPatient" class="calendar-submitted-date">Requested on {{ formatSubmittedDate(item.created_at) }}</small>
          </div>
          <div class="calendar-day-status">
            <span class="status-badge" :class="`status-${item.status}`">{{ item.status.replace('_', ' ') }}</span>
            <template v-if="!isPatient">
              <span class="payment-status" :class="paymentClass(item.payment_status)">{{ paymentLabel(item.payment_status) }}</span>
            </template>
            <template v-if="!isPatient && item.payment_status">
              <small class="calendar-payment-detail">{{ item.payment_method || 'Payment method unavailable' }} · {{ item.payment_amount ? money(item.payment_amount) : 'Amount unavailable' }}</small>
              <small v-if="item.payment_reference" class="calendar-payment-reference">Ref: {{ item.payment_reference }}</small>
              <button
                v-if="item.payment_status === 'pending'"
                class="calendar-verify-button"
                type="button"
                :disabled="verifyingPaymentId === item.payment_id"
                @click="verifyPayment(item)"
              >
                {{ verifyingPaymentId === item.payment_id ? 'Verifying…' : 'Verify payment & email patient' }}
              </button>
            </template>
          </div>
        </article>
      </div>
      <div v-else class="empty-inline">
        <strong>No appointments scheduled</strong>
        <p>This date has no appointment records.</p>
      </div>
    </section>
  </div>
  <div v-if="showAppointmentDetails && detailAppointment" class="modal-backdrop" @click.self="showAppointmentDetails=false">
    <section class="form-modal appointment-details-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-details-title">
      <header class="modal-heading">
        <div><p class="eyebrow">APPOINTMENT DETAILS</p><h2 id="appointment-details-title">Appointment #{{ detailAppointment.appointment_id }}</h2><p class="muted">{{ detailAppointment.patient || `Patient #${detailAppointment.patient_id}` }}</p></div>
        <button class="text-button" type="button" @click="showAppointmentDetails=false">Close</button>
      </header>
      <div class="detail-popup-grid">
        <div><dt>Patient</dt><dd>{{ detailAppointment.patient || `Patient #${detailAppointment.patient_id}` }} · #{{ detailAppointment.patient_id }}</dd></div>
        <div><dt>Service</dt><dd>{{ detailAppointment.service_name }}</dd></div>
        <div><dt>Date &amp; time</dt><dd>{{ detailAppointment.appt_date }} · {{ detailAppointment.appt_time }}</dd></div>
        <div><dt>Dentist</dt><dd>{{ detailAppointment.dentist || 'Unassigned' }}</dd></div>
        <div><dt>Payment</dt><dd>{{ detailAppointment.payment_status || 'Unpaid' }}</dd></div>
        <div><dt>Status</dt><dd><span class="status-badge" :class="`status-${detailAppointment.status}`">{{ detailAppointment.status.replace('_', ' ') }}</span></dd></div>
        <div><dt>Requested</dt><dd>{{ formatSubmittedDate(detailAppointment.created_at) }}</dd></div>
        <div v-if="detailAppointment.reschedule_reason" class="detail-popup-wide"><dt>Reschedule reason</dt><dd>{{ detailAppointment.reschedule_reason }}</dd></div>
      </div>
      <div class="history-popup">
        <div class="history-heading"><div><p class="eyebrow">CHANGE HISTORY</p><h3>What changed</h3></div><span class="history-count">{{ detailHistory.length }} events</span></div>
        <div v-if="detailLoading" class="empty-inline">Loading history…</div>
        <div v-else-if="detailHistory.length" class="history-list">
          <article v-for="entry in detailHistory" :key="entry.log_id" class="history-item"><span class="history-dot" aria-hidden="true"></span><div><strong>{{ historyLabel(entry.action) }}</strong><p>{{ entry.actor }} · {{ formatHistoryDate(entry.created_at) }}</p></div></article>
        </div>
        <p v-else class="muted">No recorded changes yet.</p>
      </div>
      <section v-if="detailAppointment.dentist_id && ['pending','confirmed'].includes(detailAppointment.status)" class="popup-reschedule">
        <div class="popup-section-heading"><div><p class="eyebrow">SCHEDULE MANAGEMENT</p><h3>Reschedule appointment</h3></div><span class="popup-section-note">Patient will be emailed</span></div>
        <form class="popup-reschedule-form" @submit.prevent="rescheduleFromDetails">
          <label>Date<input v-model="detailRescheduleForm.date" type="date" :min="localToday()" required /></label>
          <label>Available time<select v-model="detailRescheduleForm.time" :disabled="detailSlotsLoading || !detailSlots.length" required><option value="" disabled>{{ detailSlotsLoading ? 'Checking availability…' : detailSlots.length ? 'Choose a time' : 'Choose a date first' }}</option><option v-for="slot in detailSlots" :key="slot" :value="slot">{{ slot }}</option></select></label>
          <label class="popup-reason-field">Reason<select v-model="detailRescheduleForm.reason" required><option value="" disabled>Choose a reason</option><option>Patient did not attend the scheduled time</option><option>Doctor emergency or unavailable</option><option>Clinic schedule changed</option><option>Patient requested a different date</option><option>Other</option></select></label>
          <button class="button button-primary" type="submit" :disabled="detailRescheduling || detailSlotsLoading || !detailRescheduleForm.time || !detailRescheduleForm.reason">{{ detailRescheduling ? 'Rescheduling…' : 'Reschedule & email' }}</button>
        </form>
      </section>
      <div class="appointment-actions">
        <button class="button button-quiet" type="button" :disabled="detailNotifying" @click="emailFromDetails">{{ detailNotifying ? 'Sending…' : 'Email patient' }}</button>
        <button v-if="detailAppointment.status === 'pending'" class="button button-primary" type="button" :disabled="busyId === detailAppointment.appointment_id" @click="updateStatus(detailAppointment, 'confirmed')">Confirm appointment</button>
        <button v-if="detailAppointment.status === 'confirmed'" class="button button-primary" type="button" :disabled="busyId === detailAppointment.appointment_id || !canComplete(detailAppointment)" :title="canComplete(detailAppointment) ? 'Mark appointment completed' : completeDisabledReason(detailAppointment)" @click="updateStatus(detailAppointment, 'completed')">Mark completed</button>
        <button v-if="detailAppointment.status === 'confirmed'" class="button button-quiet" type="button" :disabled="busyId === detailAppointment.appointment_id" @click="updateStatus(detailAppointment, 'no_show')">Mark no-show</button>
      </div>
    </section>
  </div>
  <ConfirmDialog
    :open="cancelTarget !== null"
    title="Cancel this appointment?"
    :message="cancelTarget ? `Appointment #${cancelTarget.appointment_id} will be cancelled and removed from the active schedule.` : ''"
    confirm-label="Cancel appointment"
    input-label="Cancellation reason"
    input-placeholder="Tell us why you are cancelling"
    :require-input="true"
    :busy="busyId === cancelTarget?.appointment_id"
    @cancel="cancelTarget = null"
    @confirm="confirmCancellation"
  />
</template>

<style scoped>
.staff-booking{margin:-10px 0 20px;padding:20px}.staff-booking h2{margin:0 0 14px}.booking-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.booking-grid label{display:grid;gap:6px;color:#718793;font-size:13px;font-weight:650}.booking-grid input,.booking-grid select{min-height:40px;border:1px solid #dce8e8;border-radius:10px;padding:9px;background:#fff;color:#26364a}.booking-actions{display:flex;align-items:end;gap:8px}.appointment-day-reminder{display:flex;align-items:center;gap:9px}.appointment-day-reminder svg{flex:none;color:#2c8667}.button-spinner{display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite}.quick-date-filter{display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.quick-date-filter button{border:0;border-radius:7px;padding:7px 10px;background:transparent;color:var(--muted);font-size:12px;font-weight:700;cursor:pointer}.quick-date-filter button.active{background:var(--soft-teal);color:var(--teal-dark)}.appointment-details-modal{width:min(760px,100%);max-height:90vh;overflow:auto}.detail-popup-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:17px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.detail-popup-grid dt{color:var(--muted);font-size:11px;font-weight:700}.detail-popup-grid dd{margin:4px 0 0;color:var(--ink);font-size:14px;font-weight:650}.detail-popup-wide{grid-column:1 / -1}.history-popup,.popup-reschedule{margin-top:16px;padding:17px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.history-popup h3,.popup-reschedule h3{margin:4px 0 0;font-size:16px}.popup-section-heading,.history-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.popup-section-note{color:var(--muted);font-size:11px;font-weight:700}.popup-reschedule-form{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;gap:10px;margin-top:14px}.popup-reschedule-form label{display:grid;gap:5px;color:var(--muted);font-size:11px;font-weight:700}.popup-reschedule-form input,.popup-reschedule-form select{min-height:40px;border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:var(--surface);color:var(--ink)}.popup-reason-field{grid-column:1 / -1}.calendar-details-link{padding:0;border:0;background:transparent;color:var(--teal-dark);font:inherit;font-weight:700;text-align:left;cursor:pointer}@media(max-width:760px){.booking-grid{grid-template-columns:1fr 1fr}.detail-popup-grid,.popup-reschedule-form{grid-template-columns:1fr}.popup-reschedule-form .button{width:100%}.popup-reason-field{grid-column:auto}}@media(max-width:460px){.booking-grid{grid-template-columns:1fr}}
.calendar-summary{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:9px 12px;border:1px solid #dce8e3;border-radius:9px;background:#f7fbf9;color:#6b8085;font-size:11px}.calendar-summary strong{color:#2c6253;font-size:11.5px}.calendar-summary-dot{width:8px;height:8px;border-radius:50%;background:#3a9b70;box-shadow:0 0 0 3px #dcefe4}.calendar-appointment-count{display:flex;align-items:center;width:max-content;max-width:calc(100% - 8px);margin:4px 4px 0;padding:4px 7px;border:1px solid #acd9be;border-radius:999px;background:#e4f4eb;color:#28775b;font-size:10px;font-weight:800;line-height:1.1;white-space:nowrap}.calendar-appointment-count span{margin-right:3px;color:#3a9b70;font-size:8px}.calendar-day-modal{width:min(760px,100%)}.calendar-day-list{display:grid;gap:10px;max-height:58vh;overflow:auto}.calendar-day-item{display:grid;grid-template-columns:80px minmax(0,1fr) auto;align-items:center;gap:14px;padding:14px;border:1px solid #dce8e3;border-radius:12px;background:#fbfdfc}.calendar-day-time{color:#26745c;font-size:14px;font-weight:800}.calendar-day-time small{display:block;color:#71858a;font-size:10px;font-weight:500}.calendar-day-info{display:grid;gap:4px;min-width:0}.calendar-day-info .patient-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.calendar-day-info span{color:#71858a;font-size:11px}.calendar-day-status{display:grid;justify-items:end;gap:6px}.payment-status{font-size:10.5px;font-weight:700}.calendar-payment-detail,.calendar-payment-reference{color:#71858a;font-size:10px;text-align:right}.calendar-verify-button{padding:6px 8px;border:1px solid #afd8bf;border-radius:7px;background:#e4f4eb;color:#28775b;font-size:10px;font-weight:750;cursor:pointer}.calendar-verify-button:disabled{cursor:wait;opacity:.65}.payment-verified{color:#28775b}.payment-pending{color:#a46d1f}.payment-rejected{color:#b44d53}.payment-unpaid{color:#71858a}
:global(:root[data-theme='dark']) .calendar-summary{border-color:#3b5148;background:#202f29;color:#a9bdb3}:global(:root[data-theme='dark']) .calendar-summary strong{color:#c4e0d1}:global(:root[data-theme='dark']) .calendar-appointment-count{border-color:#426d55;background:#244231;color:#a9e0bc}:global(:root[data-theme='dark']) .calendar-day-item{border-color:#3b5148;background:#202f29}:global(:root[data-theme='dark']) .calendar-payment-detail,:global(:root[data-theme='dark']) .calendar-payment-reference{color:#a9bdb3}:global(:root[data-theme='dark']) .calendar-verify-button{border-color:#426d55;background:#244231;color:#a9e0bc}.calendar-day-info span,:global(:root[data-theme='dark']) .calendar-day-info span{color:#a9bdb3}
@media(max-width:760px){.booking-grid{grid-template-columns:1fr 1fr}.calendar-day-item{grid-template-columns:70px minmax(0,1fr)}.calendar-day-status{grid-column:2;justify-items:start}}@media(max-width:460px){.booking-grid{grid-template-columns:1fr}}
</style>
