<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, getApiData, getPatient, type Patient } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'

const route = useRoute()
const patient = ref<Patient | null>(null)
interface AppointmentRecord {
  appointment_id: number
  appt_date: string
  appt_time: string
  status: string
  service_name: string
  dentist: string
  payment_status: string | null
  created_at: string
}
const appointments = ref<AppointmentRecord[]>([])
const error = ref('')
const loading = ref(true)

async function loadPatient() {
  loading.value = true
  error.value = ''
  try {
    const patientId = String(route.params.id)
    const [patientRecord, appointmentRecords] = await Promise.all([
      getPatient(patientId),
      getApiData<AppointmentRecord[]>(`/api/patients/${patientId}/appointments`),
    ])
    patient.value = patientRecord
    appointments.value = appointmentRecords
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load this patient record.'
  } finally {
    loading.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Not provided'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(value))
}

function formatAppointmentDate(date: string, time: string) {
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} ${time}`
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

onMounted(loadPatient)
watch(() => route.params.id, loadPatient)
</script>

<template>
  <div class="detail-back"><RouterLink class="text-link" to="/patients">← Back to patients</RouterLink></div>

  <SkeletonLoader v-if="loading" variant="profile" label="Loading patient record" />
  <div v-else-if="error" class="alert alert-error" role="alert">
    {{ error }} <RouterLink v-if="error.includes('not found')" class="text-link" to="/patients">Return to directory</RouterLink>
  </div>
  <template v-else-if="patient">
    <section class="detail-hero surface">
      <div class="detail-avatar" aria-hidden="true">{{ patient.first_name.slice(0, 1) }}{{ patient.last_name.slice(0, 1) }}</div>
      <div class="detail-title">
        <p class="eyebrow">PATIENT #{{ patient.id }}</p>
        <h1>{{ patient.first_name }} {{ patient.last_name }}</h1>
        <span class="status-badge" :class="`status-${patient.status}`">{{ patient.status }}</span>
      </div>
    </section>

    <section class="surface detail-card">
      <div class="section-heading">
        <div>
          <h2>Contact information</h2>
          <p class="muted">Patient directory details</p>
        </div>
      </div>
      <dl class="detail-grid">
        <div><dt>Email</dt><dd>{{ patient.email || 'Not provided' }}</dd></div>
        <div><dt>Phone</dt><dd>{{ patient.phone || 'Not provided' }}</dd></div>
        <div><dt>Date of birth</dt><dd>{{ formatDate(patient.date_of_birth) }}</dd></div>
        <div><dt>Gender</dt><dd>{{ patient.gender.replaceAll('_', ' ') }}</dd></div>
        <div class="detail-full"><dt>Address</dt><dd>{{ patient.address || 'Not provided' }}</dd></div>
        <div><dt>Record created</dt><dd>{{ formatDate(patient.created_at) }}</dd></div>
        <div><dt>Last updated</dt><dd>{{ formatDate(patient.updated_at) }}</dd></div>
      </dl>
      <p class="form-note">This prototype is for fictitious demonstration records only.</p>
    </section>

    <section class="surface detail-card appointment-history-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">CARE TIMELINE</p>
          <h2>Appointment records &amp; history</h2>
          <p class="muted">Track when this patient requested, attended, or completed appointments.</p>
        </div>
        <span class="result-count">{{ appointments.length }} {{ appointments.length === 1 ? 'record' : 'records' }}</span>
      </div>
      <div v-if="appointments.length" class="appointment-history-list">
        <article v-for="appointment in appointments" :key="appointment.appointment_id" class="appointment-history-item">
          <div class="appointment-history-date">
            <strong>{{ appointment.appt_date }}</strong>
            <small>{{ appointment.appt_time }}</small>
          </div>
          <div class="appointment-history-main">
            <strong>{{ appointment.service_name }}</strong>
            <span>Appointment #{{ appointment.appointment_id }} · {{ formatAppointmentDate(appointment.appt_date, appointment.appt_time) }}</span>
            <small>Created {{ formatDate(appointment.created_at) }} · Dentist: {{ appointment.dentist }}</small>
          </div>
          <div class="appointment-history-meta">
            <span class="status-badge" :class="`status-${appointment.status}`">{{ statusLabel(appointment.status) }}</span>
            <span v-if="appointment.payment_status" class="payment-history-status">Payment: {{ statusLabel(appointment.payment_status) }}</span>
          </div>
        </article>
      </div>
      <div v-else class="empty-inline">
        <strong>No appointment records yet</strong>
        <p>This patient has no appointment history.</p>
      </div>
    </section>
  </template>

</template>

<style scoped>
  .appointment-history-card {
    margin-top: 20px;
  }

  .appointment-history-list {
    display: grid;
    gap: 10px;
  }

  .appointment-history-item {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr) auto;
    align-items: center;
    gap: 18px;
    padding: 15px 16px;
    border: 1px solid #dfe9e5;
    border-radius: 12px;
    background: #fbfdfc;
  }

  .appointment-history-date {
    display: grid;
    gap: 4px;
    color: #26745c;
  }

  .appointment-history-date strong {
    font-size: 13px;
  }

  .appointment-history-date small,
  .appointment-history-main span,
  .appointment-history-main small {
    color: #71858a;
    font-size: 11px;
  }

  .appointment-history-main {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .appointment-history-main > strong {
    color: #254653;
    font-size: 14px;
  }

  .appointment-history-meta {
    display: grid;
    justify-items: end;
    gap: 6px;
  }

  .payment-history-status {
    color: #71858a;
    font-size: 10.5px;
    text-transform: capitalize;
  }

  :global(:root[data-theme='dark']) .appointment-history-item {
    border-color: #3b5148;
    background: #202f29;
  }

  :global(:root[data-theme='dark']) .appointment-history-main > strong {
    color: #e6f0eb;
  }

  :global(:root[data-theme='dark']) .appointment-history-date small,
  :global(:root[data-theme='dark']) .appointment-history-main span,
  :global(:root[data-theme='dark']) .appointment-history-main small,
  :global(:root[data-theme='dark']) .payment-history-status {
    color: #a9bdb3;
  }

  @media (max-width: 700px) {
    .appointment-history-item {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .appointment-history-date {
      grid-column: 1 / -1;
    }

    .appointment-history-meta {
      justify-items: start;
    }
  }
</style>
