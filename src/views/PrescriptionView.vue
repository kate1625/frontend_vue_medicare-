<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError, apiRequest, getApiData, getPatient, getPatients, getPortalRole, type Patient } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

interface Appointment {
  appointment_id: number
  appt_date: string
  appt_time: string
  end_time: string | null
  status: string
  remarks: string | null
  cancel_reason: string | null
  reschedule_reason: string | null
  created_at: string
  service_name: string
  price: number | string
  dentist: string | null
  payment_status: string | null
}

interface AppointmentEvent {
  log_id: number
  action: string
  created_at: string
  actor: string
}

interface TreatmentRecord {
  record_id: number
  tooth_no: string | null
  diagnosis: string | null
  treatment_done: string | null
  notes: string | null
  created_at: string
}

interface Prescription {
  prescription_id: number
  patient_id: number
  appointment_id: number | null
  patient_name: string
  prescribed_by: string
  medication: string
  directions: string
  status: string
  appt_date: string | null
  service_name: string | null
  created_at: string
}

const isPatient = getPortalRole() === 'patient'
const loading = ref(true)
const detailLoading = ref(false)
const saving = ref(false)
const error = ref('')
const detailError = ref('')
const success = ref('')
const patients = ref<Patient[]>([])
const prescriptions = ref<Prescription[]>([])
const selectedPatient = ref<Patient | null>(null)
const appointments = ref<Appointment[]>([])
const appointmentEvents = ref<AppointmentEvent[]>([])
const treatmentRecords = ref<TreatmentRecord[]>([])
const selectedAppointmentId = ref<number | null>(null)
const search = ref('')
const form = ref({ medication: '', directions: '' })
let detailRequestId = 0
const patientHistory = computed(() => prescriptions.value.filter((item) => item.patient_id === selectedPatient.value?.id))
const selectedAppointment = computed(() =>
  appointments.value.find((appointment) => appointment.appointment_id === selectedAppointmentId.value) ?? null,
)
const filteredPatients = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return patients.value
  return patients.value.filter((patient) =>
    `${patient.first_name} ${patient.last_name} ${patient.email ?? ''} ${patient.phone ?? ''}`.toLowerCase().includes(query),
  )
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [prescriptionRows, patientRows] = await Promise.all([
      getApiData<Prescription[]>('/api/prescriptions'),
      isPatient ? Promise.resolve([] as Patient[]) : getPatients(),
    ])
    prescriptions.value = prescriptionRows
    patients.value = patientRows.filter((patient) => patient.status === 'active')
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load prescription records.'
  } finally {
    loading.value = false
  }
}

async function openPatient(patient: Patient) {
  const requestId = ++detailRequestId
  selectedPatient.value = patient
  appointments.value = []
  selectedAppointmentId.value = null
  appointmentEvents.value = []
  treatmentRecords.value = []
  detailError.value = ''
  success.value = ''
  detailLoading.value = true
  try {
    const [fullPatient, appointmentRows] = await Promise.all([
      getPatient(String(patient.id)),
      getApiData<Appointment[]>(`/api/patients/${patient.id}/appointments`),
    ])
    if (requestId !== detailRequestId) return
    selectedPatient.value = fullPatient
    appointments.value = appointmentRows
  } catch (cause) {
    if (requestId === detailRequestId) {
      detailError.value = cause instanceof ApiError ? cause.message : 'Could not load this patient’s appointments.'
    }
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false
  }
}

async function openAppointment(appointment: Appointment) {
  const requestId = ++detailRequestId
  selectedAppointmentId.value = appointment.appointment_id
  appointmentEvents.value = []
  treatmentRecords.value = []
  detailError.value = ''
  try {
    const [events, treatments] = await Promise.all([
      getApiData<AppointmentEvent[]>(`/api/appointments/${appointment.appointment_id}/history`),
      getApiData<TreatmentRecord[]>(`/api/treatment-records?appointment_id=${appointment.appointment_id}`),
    ])
    if (requestId !== detailRequestId) return
    appointmentEvents.value = events
    treatmentRecords.value = treatments
  } catch (cause) {
    if (requestId === detailRequestId) {
      detailError.value = cause instanceof ApiError ? cause.message : 'Could not load this appointment’s care history.'
    }
  }
}

async function issuePrescription() {
  if (!selectedPatient.value) return

  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const response = await apiRequest<{ data: { prescription_id: number; notification_sent: boolean; email_sent: boolean } }>('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: selectedPatient.value.id,
        appointment_id: selectedAppointmentId.value,
        medication: form.value.medication.trim(),
        directions: form.value.directions.trim(),
      }),
    })
    form.value = { medication: '', directions: '' }
    success.value = response.data.email_sent
      ? 'Prescription saved. The patient was notified by email and in MediCare+.'
      : response.data.notification_sent
        ? 'Prescription saved and the patient was notified in MediCare+. Email could not be sent; verify the patient email and Brevo configuration.'
        : 'Prescription saved, but email delivery could not be confirmed. Check the patient email and Brevo configuration.'
    notify.success(success.value, 'Prescription saved')
    try {
      prescriptions.value = await getApiData<Prescription[]>('/api/prescriptions')
    } catch (cause) {
      error.value = cause instanceof ApiError
        ? `Prescription saved, but history could not be refreshed: ${cause.message}`
        : 'Prescription saved, but history could not be refreshed.'
    }
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not save this prescription.'
    notify.error(error.value, 'Prescription not saved')
  } finally {
    saving.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Not provided'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function formatDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime())
    ? `${date} ${time}`
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

function label(value: string) {
  return value.replaceAll('_', ' ')
}

onMounted(load)
</script>

<template>
  <div class="prescription-workspace">
    <section class="page-heading">
      <div>
        <p class="eyebrow">{{ isPatient ? '' : 'PATIENT CARE · CLINICAL WORKSPACE' }}</p>
        <h1>{{ isPatient ? 'My prescriptions' : 'Prescriptions' }}</h1>
        <p class="muted">{{ isPatient ? 'Review medication instructions recorded by your care team.' : 'Review active patients, visit details, and care history before documenting a prescription.' }}</p>
      </div>
    </section>

    <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

    <SkeletonLoader v-if="loading" :variant="isPatient ? 'list' : 'care'" :rows="4" label="Loading prescriptions" />

    <template v-else-if="isPatient">
      <section class="surface prescription-panel">
        <header class="panel-heading"><div><h2>Prescription history</h2><p>Medication instructions from your clinic</p></div><span class="result-count">{{ prescriptions.length }} records</span></header>
        <div v-if="!prescriptions.length" class="empty-inline"><strong>No prescriptions recorded yet</strong><p>New instructions from your care team will appear here.</p></div>
        <article v-for="prescription in prescriptions" :key="prescription.prescription_id" class="prescription-history-card">
          <div class="prescription-history-heading">
            <div><p class="eyebrow">PRESCRIPTION #{{ prescription.prescription_id }}</p><h3>{{ prescription.medication }}</h3></div>
            <span class="status-badge" :class="`status-${prescription.status}`">{{ label(prescription.status) }}</span>
          </div>
          <p class="prescription-directions">{{ prescription.directions }}</p>
          <p class="prescription-meta">
            {{ formatDate(prescription.created_at) }} · {{ prescription.prescribed_by }}
            <span v-if="prescription.service_name"> · {{ prescription.service_name }} visit</span>
            <span v-if="prescription.appt_date"> · Appointment {{ formatDate(prescription.appt_date) }}</span>
          </p>
        </article>
      </section>
    </template>

    <section v-else class="prescription-layout">
      <aside class="surface patient-picker">
        <header class="panel-heading"><div><h2>Active patients</h2><p>Select a patient to review their care</p></div><span class="result-count">{{ patients.length }}</span></header>
        <label class="patient-search"><span class="sr-only">Search active patients</span><input v-model="search" type="search" placeholder="Search name or contact"></label>
        <div v-if="!filteredPatients.length" class="empty-inline"><strong>{{ patients.length ? 'No patients match your search' : 'No active patients found' }}</strong><p>{{ patients.length ? 'Try another name, email, or phone.' : 'Only active patient records appear here.' }}</p></div>
        <button
          v-for="patient in filteredPatients"
          :key="patient.id"
          class="patient-choice"
          :class="{ selected: selectedPatient?.id === patient.id }"
          type="button"
          @click="openPatient(patient)"
        >
          <span class="patient-avatar">{{ patient.first_name.charAt(0) }}{{ patient.last_name.charAt(0) }}</span>
          <span class="patient-choice-info"><strong>{{ patient.first_name }} {{ patient.last_name }}</strong><small>{{ patient.phone || patient.email || 'No contact details' }}</small></span>
          <span class="status-badge status-active">Active</span>
        </button>
      </aside>

      <section v-if="!selectedPatient" class="surface prescription-overview empty-state">
        <span class="empty-icon">+</span><strong>Choose an active patient</strong><p>Their appointment history and prescription records will appear here.</p>
      </section>

      <section v-else class="prescription-detail">
        <SkeletonLoader v-if="detailLoading" variant="profile" :contained="true" label="Loading patient care history" />
        <template v-else>
          <section class="surface patient-summary">
            <div class="patient-avatar large">{{ selectedPatient.first_name.charAt(0) }}{{ selectedPatient.last_name.charAt(0) }}</div>
            <div class="patient-summary-info">
              <p class="eyebrow">PATIENT #{{ selectedPatient.id }}</p>
              <h2>{{ selectedPatient.first_name }} {{ selectedPatient.last_name }}</h2>
              <p>{{ selectedPatient.email || 'No email recorded' }}<span v-if="selectedPatient.phone"> · {{ selectedPatient.phone }}</span></p>
            </div>
            <span class="status-badge status-active">Active record</span>
          </section>
          <dl class="patient-profile-grid">
            <div><dt>Date of birth</dt><dd>{{ formatDate(selectedPatient.date_of_birth) }}</dd></div>
            <div><dt>Gender</dt><dd>{{ label(selectedPatient.gender) }}</dd></div>
            <div class="full"><dt>Address</dt><dd>{{ selectedPatient.address || 'Not provided' }}</dd></div>
          </dl>

          <div v-if="detailError" class="alert alert-error" role="alert">{{ detailError }}</div>

          <section class="surface care-section">
            <header class="panel-heading"><div><h2>Appointment history</h2><p>Choose a visit to review appointment details and clinical history.</p></div><span class="result-count">{{ appointments.length }} visits</span></header>
            <div v-if="!appointments.length" class="empty-inline"><strong>No appointments recorded</strong><p>A completed appointment is required before documenting a prescription.</p></div>
            <button
              v-for="appointment in appointments"
              :key="appointment.appointment_id"
              class="visit-choice"
              :class="{ selected: selectedAppointmentId === appointment.appointment_id }"
              type="button"
              @click="openAppointment(appointment)"
            >
              <span class="visit-date"><strong>{{ formatDate(appointment.appt_date) }}</strong><small>{{ appointment.appt_time }}</small></span>
              <span class="visit-info"><strong>{{ appointment.service_name }}</strong><small>Appointment #{{ appointment.appointment_id }} · {{ appointment.dentist || 'Dentist unassigned' }}</small></span>
              <span class="status-badge" :class="`status-${appointment.status}`">{{ label(appointment.status) }}</span>
            </button>
          </section>

          <template v-if="selectedAppointment">
            <section class="surface care-section">
              <header class="panel-heading"><div><p class="eyebrow">VISIT #{{ selectedAppointment.appointment_id }}</p><h2>Appointment details</h2></div><span class="status-badge" :class="`status-${selectedAppointment.status}`">{{ selectedAppointment.status === 'completed' ? 'Session completed' : `Session ${label(selectedAppointment.status)}` }}</span></header>
              <dl class="appointment-detail-grid">
                <div><dt>Service</dt><dd>{{ selectedAppointment.service_name }}</dd></div>
                <div><dt>Date &amp; time</dt><dd>{{ formatDateTime(selectedAppointment.appt_date, selectedAppointment.appt_time) }}</dd></div>
                <div><dt>Dentist</dt><dd>{{ selectedAppointment.dentist || 'Unassigned' }}</dd></div>
                <div><dt>Appointment fee</dt><dd>{{ Number(selectedAppointment.price).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) }}</dd></div>
                <div><dt>Payment status</dt><dd>{{ selectedAppointment.payment_status ? label(selectedAppointment.payment_status) : 'No payment record' }}</dd></div>
                <div><dt>Booked</dt><dd>{{ formatDate(selectedAppointment.created_at) }}</dd></div>
                <div v-if="selectedAppointment.remarks" class="full"><dt>Clinic remarks</dt><dd>{{ selectedAppointment.remarks }}</dd></div>
                <div v-if="selectedAppointment.cancel_reason" class="full"><dt>Cancellation reason</dt><dd>{{ selectedAppointment.cancel_reason }}</dd></div>
                <div v-if="selectedAppointment.reschedule_reason" class="full"><dt>Reschedule reason</dt><dd>{{ selectedAppointment.reschedule_reason }}</dd></div>
              </dl>
            </section>

            <section class="surface care-section">
              <header class="panel-heading"><div><h2>Visit care history</h2><p>Recorded treatment and appointment activity</p></div></header>
              <div v-if="treatmentRecords.length" class="clinical-history-list">
                <article v-for="record in treatmentRecords" :key="record.record_id" class="clinical-history-item">
                  <strong>{{ record.tooth_no ? `Tooth ${record.tooth_no}` : 'Clinical note' }} · {{ record.diagnosis || 'Treatment record' }}</strong>
                  <p>{{ record.treatment_done || 'No treatment details recorded.' }}</p>
                  <p v-if="record.notes">{{ record.notes }}</p>
                  <small>Recorded {{ formatDate(record.created_at) }}</small>
                </article>
              </div>
              <div v-else class="empty-inline compact"><p>No treatment notes are linked to this visit.</p></div>
              <div v-if="appointmentEvents.length" class="appointment-event-list">
                <h3>Appointment activity</h3>
                <article v-for="event in appointmentEvents" :key="event.log_id">
                  <span><strong>{{ label(event.action) }}</strong><small>{{ event.actor }}</small></span>
                  <time>{{ formatDate(event.created_at) }}</time>
                </article>
              </div>
              <p v-else class="history-note">No appointment status changes are recorded.</p>
            </section>

            <section class="surface care-section">
              <header class="panel-heading"><div><h2>Prescription history</h2><p>Previously recorded patient instructions</p></div><span class="result-count">{{ patientHistory.length }} records</span></header>
              <div v-if="!patientHistory.length" class="empty-inline compact"><p>No prescriptions have been recorded for this patient.</p></div>
              <article v-for="prescription in patientHistory" :key="prescription.prescription_id" class="prescription-history-card">
                <div class="prescription-history-heading"><div><h3>{{ prescription.medication }}</h3><p v-if="prescription.appointment_id">Appointment #{{ prescription.appointment_id }} · {{ prescription.service_name || 'Clinic visit' }}</p><p v-else>Legacy prescription · no appointment linked</p></div><span class="status-badge" :class="`status-${prescription.status}`">{{ label(prescription.status) }}</span></div>
                <p class="prescription-directions">{{ prescription.directions }}</p>
                <p class="prescription-meta">Recorded {{ formatDate(prescription.created_at) }} · {{ prescription.prescribed_by }}</p>
              </article>
            </section>

          </template>

          <form class="surface prescription-form" @submit.prevent="issuePrescription">
              <header class="panel-heading"><div><p class="eyebrow">PATIENT #{{ selectedPatient.id }}</p><h2>Document prescription</h2><p>Record the medication and directions provided by the treating clinician. Linking an appointment is optional.</p></div></header>
              <label>Appointment (optional)
                <select v-model.number="selectedAppointmentId">
                  <option :value="null">No appointment linked</option>
                  <option v-for="appointment in appointments" :key="appointment.appointment_id" :value="appointment.appointment_id">
                    #{{ appointment.appointment_id }} · {{ formatDate(appointment.appt_date) }} · {{ appointment.service_name }} ({{ label(appointment.status) }})
                  </option>
                </select>
              </label>
              <label>Medication name<input v-model="form.medication" maxlength="190" required placeholder="Medication prescribed by the clinician"></label>
              <label>Directions<textarea v-model="form.directions" maxlength="10000" rows="4" required placeholder="Dose, route, frequency, duration, quantity, refills, and any clinician-provided precautions"></textarea><small>Enter only clinician-approved instructions. This form does not recommend or calculate medication.</small></label>
              <button class="button button-primary" type="submit" :disabled="saving">{{ saving ? 'Saving prescription…' : 'Save prescription' }}</button>
          </form>
        </template>
      </section>
    </section>
  </div>
</template>

<style scoped>
.prescription-workspace { display: grid; gap: 18px; }
.prescription-layout { display: grid; grid-template-columns: minmax(270px, .75fr) minmax(0, 1.65fr); align-items: start; gap: 18px; }
.patient-picker, .prescription-overview, .care-section, .prescription-panel { min-width: 0; padding: 20px; }
.patient-picker { position: sticky; top: 82px; max-height: calc(100vh - 105px); overflow: auto; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 15px; }
.panel-heading h2 { margin: 0; color: var(--ink); font-size: 17px; }
.panel-heading p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.patient-search { display: block; margin-bottom: 10px; }
.patient-search input, .prescription-form input, .prescription-form textarea, .prescription-form select { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; }
.patient-choice { display: flex; width: 100%; align-items: center; gap: 10px; padding: 11px 8px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--ink); text-align: left; cursor: pointer; }
.patient-choice:hover, .patient-choice.selected { border-radius: 10px; background: color-mix(in srgb, #438d75 10%, var(--surface)); }
.patient-choice-info { display: grid; min-width: 0; flex: 1; gap: 3px; }
.patient-choice-info strong, .visit-info strong { overflow: hidden; color: var(--ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.patient-choice-info small, .visit-info small { overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.patient-avatar { display: grid; width: 38px; height: 38px; flex: none; place-items: center; border-radius: 50%; background: #e8f4ec; color: #438d75; font-size: 12px; font-weight: 750; }
.patient-avatar.large { width: 50px; height: 50px; font-size: 15px; }
.prescription-detail { display: grid; min-width: 0; gap: 15px; }
.patient-summary { display: flex; align-items: center; gap: 14px; padding: 18px 20px; }
.patient-summary-info { min-width: 0; flex: 1; }
.patient-summary-info .eyebrow, .panel-heading .eyebrow { margin: 0 0 3px; }
.patient-summary-info h2 { margin: 0; color: var(--ink); font-size: 19px; }
.patient-summary-info p:last-child { margin: 4px 0 0; overflow-wrap: anywhere; color: var(--muted); font-size: 12px; }
.patient-profile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: -7px 0 0; }
.patient-profile-grid > div { min-width: 0; padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px; }
.patient-profile-grid .full { grid-column: 1 / -1; }
.patient-profile-grid dt { color: var(--muted); font-size: 10px; }
.patient-profile-grid dd { margin: 2px 0 0; color: var(--ink); font-size: 11px; overflow-wrap: anywhere; }
.care-section { padding-top: 18px; }
.visit-choice { display: grid; width: 100%; grid-template-columns: 110px minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--ink); text-align: left; cursor: pointer; }
.visit-choice + .visit-choice { margin-top: 8px; }
.visit-choice:hover, .visit-choice.selected { border-color: #78ae91; background: color-mix(in srgb, #438d75 7%, var(--surface)); }
.visit-date, .visit-info { display: grid; gap: 3px; }
.visit-date strong { color: #438d75; font-size: 12px; }
.visit-date small { color: var(--muted); font-size: 11px; }
.appointment-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; }
.appointment-detail-grid > div { min-width: 0; padding: 11px 12px; border-radius: 10px; background: color-mix(in srgb, var(--line) 32%, var(--surface)); }
.appointment-detail-grid dt { color: var(--muted); font-size: 10px; font-weight: 650; }
.appointment-detail-grid dd { margin: 3px 0 0; color: var(--ink); font-size: 12px; overflow-wrap: anywhere; text-transform: capitalize; }
.appointment-detail-grid .full { grid-column: 1 / -1; }
.clinical-history-list { display: grid; gap: 9px; }
.clinical-history-item { padding: 12px; border: 1px solid var(--line); border-radius: 10px; }
.clinical-history-item strong { color: var(--ink); font-size: 12px; }
.clinical-history-item p { margin: 5px 0 0; color: var(--muted); font-size: 12px; white-space: pre-wrap; }
.clinical-history-item small, .prescription-meta { color: var(--muted); font-size: 10px; }
.appointment-event-list { display: grid; gap: 7px; margin-top: 14px; }
.appointment-event-list h3 { margin: 0 0 2px; color: var(--ink); font-size: 12px; }
.appointment-event-list article { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 11px; }
.appointment-event-list article span { display: flex; gap: 8px; }
.appointment-event-list small, .appointment-event-list time, .history-note { color: var(--muted); }
.history-note { margin: 10px 0 0; font-size: 11px; }
.prescription-history-card { padding: 14px 0; border-top: 1px solid var(--line); }
.prescription-history-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.prescription-history-heading h3 { margin: 0; color: var(--ink); font-size: 13px; }
.prescription-history-heading p { margin: 4px 0 0; color: var(--muted); font-size: 10px; }
.prescription-directions { margin: 9px 0 5px; color: var(--ink); font-size: 12px; white-space: pre-wrap; }
.prescription-meta { margin: 0; }
.prescription-form { display: grid; gap: 13px; padding: 20px; }
.prescription-form .panel-heading { margin: 0; }
.prescription-form label { display: grid; gap: 6px; color: var(--ink); font-size: 12px; font-weight: 650; }
.prescription-form textarea { resize: vertical; }
.prescription-form label small { color: var(--muted); font-size: 10px; font-weight: 400; }
.prescription-form .button { justify-self: start; }
.prescription-gate { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; }
.prescription-gate strong { color: var(--ink); font-size: 13px; }
.prescription-gate p, .empty-inline p { margin: 4px 0 0; color: var(--muted); font-size: 11px; }
.empty-inline { padding: 18px 8px; color: var(--ink); text-align: center; }
.empty-inline strong { font-size: 13px; }
.empty-inline.compact { padding: 8px 0; text-align: left; }
.result-count { flex: none; color: var(--muted); font-size: 11px; }
.status-badge { flex: none; padding: 4px 9px; border-radius: 20px; background: #edf1f0; color: #65756f; font-size: 10px; font-weight: 700; text-transform: capitalize; }
.status-active, .status-completed { background: #e6f4eb; color: #28714e; }
.status-confirmed { background: #e8f1fb; color: #3b6c9b; }
.status-pending, .status-review { background: #fff3df; color: #94641f; }
.status-cancelled, .status-no_show { background: #fbeaea; color: #a34a4a; }
.prescription-overview { min-height: 260px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }

:global(:root[data-theme='dark']) .patient-avatar { background: #294337; color: #9bd0ad; }
:global(:root[data-theme='dark']) .status-active,
:global(:root[data-theme='dark']) .status-completed { background: #294337; color: #a9d8b8; }
:global(:root[data-theme='dark']) .status-confirmed { background: #2b3d4c; color: #b6d2e8; }
:global(:root[data-theme='dark']) .status-pending,
:global(:root[data-theme='dark']) .status-review { background: #4a3d2c; color: #efd09a; }
:global(:root[data-theme='dark']) .status-cancelled,
:global(:root[data-theme='dark']) .status-no_show { background: #482f30; color: #e6aeae; }

@media (max-width: 850px) {
  .prescription-layout { grid-template-columns: minmax(0, 1fr); }
  .patient-picker { position: static; max-height: 360px; }
}
@media (max-width: 560px) {
  .patient-picker, .prescription-overview, .care-section, .prescription-panel, .prescription-form { padding: 15px; }
  .visit-choice { grid-template-columns: minmax(0, 1fr) auto; gap: 7px 10px; }
  .visit-date { grid-column: 1 / -1; }
  .appointment-detail-grid { grid-template-columns: minmax(0, 1fr); }
  .appointment-detail-grid .full { grid-column: auto; }
  .patient-profile-grid { grid-template-columns: minmax(0, 1fr); }
  .patient-profile-grid .full { grid-column: auto; }
  .patient-summary { align-items: flex-start; flex-wrap: wrap; }
  .patient-summary > .status-badge { margin-left: 64px; }
  .appointment-event-list article span { display: grid; gap: 2px; }
}
</style>
