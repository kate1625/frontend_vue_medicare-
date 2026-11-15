<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, getApiData, getPatient, type Patient } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

async function loadPdf() {
  const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF: jspdfMod.default, autoTable: autoTableMod.default }
}

const route = useRoute()
const patient = ref<Patient | null>(null)
interface AppointmentRecord {
  appointment_id: number
  appt_date: string
  appt_time: string
  status: string
  service_name: string
  dentist: string | null
  payment_status: string | null
  created_at: string
}
const appointments = ref<AppointmentRecord[]>([])
const error = ref('')
const loading = ref(true)
const exportingTimeline = ref(false)
const timelineExportError = ref('')

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

function appointmentDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatTimelineMonth(date: string) {
  const parsed = appointmentDate(date)
  return parsed ? new Intl.DateTimeFormat(undefined, { month: 'short' }).format(parsed) : 'Date'
}

function formatTimelineDay(date: string) {
  const parsed = appointmentDate(date)
  return parsed ? new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(parsed) : date
}

function formatTimelineYear(date: string) {
  const parsed = appointmentDate(date)
  return parsed ? new Intl.DateTimeFormat(undefined, { year: 'numeric' }).format(parsed) : ''
}

function formatAppointmentTime(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  const parsed = new Date(2000, 0, 1, hour, minute)
  return Number.isNaN(parsed.getTime())
    ? time
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(parsed)
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

async function exportTimelinePdf() {
  if (!patient.value) return
  exportingTimeline.value = true
  timelineExportError.value = ''
  try {
    const { jsPDF, autoTable } = await loadPdf()
    const patientRecord = patient.value
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    const generatedAt = new Date().toLocaleString()
    const countStatus = (status: string) => appointments.value.filter((appointment) => appointment.status === status).length
    const summary = [
      { label: 'TOTAL VISITS', value: String(appointments.value.length) },
      { label: 'COMPLETED', value: String(countStatus('completed')) },
      { label: 'CONFIRMED', value: String(countStatus('confirmed')) },
      { label: 'PENDING', value: String(countStatus('pending')) },
    ]

    pdf.setFillColor(25, 74, 78)
    pdf.rect(0, 0, pageWidth, 43, 'F')
    pdf.setFillColor(91, 178, 145)
    pdf.circle(margin + 4, 14, 3.5, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text('MediCare+', margin + 11, 15)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(208, 235, 226)
    pdf.text('TOOTH DOCTOR DENTAL CLINIC  |  CONFIDENTIAL PATIENT RECORD', margin, 27)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor(255, 255, 255)
    pdf.text('Patient Care Timeline', pageWidth - margin, 15, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(208, 235, 226)
    pdf.text(`Generated ${generatedAt}`, pageWidth - margin, 27, { align: 'right' })

    pdf.setFillColor(244, 249, 246)
    pdf.setDrawColor(221, 234, 226)
    pdf.roundedRect(margin, 50, contentWidth, 20, 3, 3, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(91, 117, 105)
    pdf.text('PATIENT', margin + 5, 57)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(35, 67, 57)
    pdf.text(`${patientRecord.first_name} ${patientRecord.last_name}`, margin + 5, 65)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(91, 117, 105)
    pdf.text(`Patient #${patientRecord.id}`, pageWidth - margin - 5, 58, { align: 'right' })
    pdf.text(`${appointments.value.length} appointment record${appointments.value.length === 1 ? '' : 's'}`, pageWidth - margin - 5, 65, { align: 'right' })

    const cardGap = 5
    const cardWidth = (contentWidth - cardGap * (summary.length - 1)) / summary.length
    summary.forEach((item, index) => {
      const x = margin + index * (cardWidth + cardGap)
      pdf.setFillColor(248, 251, 249)
      pdf.setDrawColor(225, 235, 228)
      pdf.roundedRect(x, 77, cardWidth, 19, 2.5, 2.5, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(91, 117, 105)
      pdf.text(item.label, x + 5, 84)
      pdf.setFontSize(13)
      pdf.setTextColor(35, 91, 69)
      pdf.text(item.value, x + 5, 92)
    })

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(35, 67, 57)
    pdf.text('Appointment history', margin, 108)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(103, 122, 113)
    pdf.text('Visit dates, care details, and recorded statuses', margin + 38, 108)

    autoTable(pdf, {
      startY: 112,
      margin: { left: margin, right: margin, bottom: 14 },
      head: [['Visit date', 'Time', 'Appointment', 'Service', 'Dentist', 'Visit status', 'Payment status', 'Record created']],
      body: appointments.value.length
        ? appointments.value.map((appointment) => [
          formatDate(appointment.appt_date),
          formatAppointmentTime(appointment.appt_time),
          `#${appointment.appointment_id}`,
          appointment.service_name,
          appointment.dentist || 'Not assigned',
          statusLabel(appointment.status),
          appointment.payment_status ? statusLabel(appointment.payment_status) : 'Not recorded',
          appointment.created_at,
        ])
        : [['No appointment records are available.', '—', '—', '—', '—', '—', '—', '—']],
      styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak', valign: 'top', textColor: [49, 69, 61], lineColor: [225, 234, 228], lineWidth: 0.2 },
      headStyles: { fillColor: [25, 74, 78], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 249, 246] },
      columnStyles: {
        0: { cellWidth: 31 },
        1: { cellWidth: 20 },
        2: { cellWidth: 25 },
        3: { cellWidth: 49 },
        4: { cellWidth: 37 },
        5: { cellWidth: 34 },
        6: { cellWidth: 36 },
        7: { cellWidth: 37 },
      },
      didDrawPage: ({ pageNumber }) => {
        pdf.setDrawColor(220, 231, 224)
        pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(111, 128, 119)
        pdf.text('MediCare+  |  Confidential patient record', margin, pageHeight - 5)
        pdf.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 5, { align: 'right' })
      },
    })
    const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
    pdf.save(`patient-care-timeline-${patientRecord.id}-${localDate}.pdf`)
    notify.success('Patient care timeline PDF downloaded.', 'PDF ready')
  } catch (cause) {
    const details = cause instanceof Error ? cause.message : String(cause)
    timelineExportError.value = `Could not create the timeline PDF: ${details}`
    notify.error(timelineExportError.value, 'PDF export failed')
  } finally {
    exportingTimeline.value = false
  }
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
      <div class="section-heading appointment-history-heading">
        <div>
          <p class="eyebrow">CARE TIMELINE</p>
          <h2>Appointment records &amp; history</h2>
          <p class="muted">Track when this patient requested, attended, or completed appointments.</p>
        </div>
        <div class="appointment-history-actions">
          <span class="result-count">{{ appointments.length }} {{ appointments.length === 1 ? 'record' : 'records' }}</span>
          <button class="button button-quiet timeline-export-button" type="button" :disabled="exportingTimeline" @click="exportTimelinePdf">
            {{ exportingTimeline ? 'Preparing PDF…' : 'Download timeline PDF' }}
          </button>
        </div>
      </div>
      <p v-if="timelineExportError" class="form-error timeline-export-error" role="alert">{{ timelineExportError }}</p>
      <div v-if="appointments.length" class="appointment-history-list" role="list" aria-label="Appointment history">
        <article v-for="appointment in appointments" :key="appointment.appointment_id" class="appointment-history-item" role="listitem">
          <time
            class="appointment-history-date"
            :datetime="`${appointment.appt_date}T${appointment.appt_time}`"
            :aria-label="`${formatDate(appointment.appt_date)} at ${formatAppointmentTime(appointment.appt_time)}`"
          >
            <span>{{ formatTimelineMonth(appointment.appt_date) }}</span>
            <strong>{{ formatTimelineDay(appointment.appt_date) }}</strong>
            <small>{{ formatTimelineYear(appointment.appt_date) }}</small>
            <small class="appointment-history-time">{{ formatAppointmentTime(appointment.appt_time) }}</small>
          </time>
          <div class="appointment-history-track" aria-hidden="true"><span></span></div>
          <div class="appointment-history-entry">
            <div class="appointment-history-entry-header">
              <div class="appointment-history-title">
                <h3>{{ appointment.service_name }}</h3>
                <span>Appointment #{{ appointment.appointment_id }}</span>
              </div>
            <span class="status-badge" :class="`status-${appointment.status}`">{{ statusLabel(appointment.status) }}</span>
            </div>
            <dl class="appointment-history-details">
              <div>
                <dt>Dentist</dt>
                <dd>{{ appointment.dentist || 'Not assigned' }}</dd>
              </div>
              <div>
                <dt>Record created</dt>
                <dd>{{ formatDate(appointment.created_at) }}</dd>
              </div>
            </dl>
            <div v-if="appointment.payment_status" class="appointment-history-payment">
              <span class="payment-history-status">Payment</span>
              <span class="payment-history-value">{{ statusLabel(appointment.payment_status) }}</span>
            </div>
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
    overflow: hidden;
  }

  .appointment-history-heading .result-count {
    flex: 0 0 auto;
    padding: 6px 10px;
    border: 1px solid #dcebe3;
    border-radius: 999px;
    background: #f2f8f4;
    color: #38745d;
    font-size: 11px;
    font-weight: 700;
  }

  .appointment-history-actions {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 9px;
  }

  .timeline-export-button {
    min-height: 36px;
    white-space: nowrap;
  }

  .timeline-export-error {
    margin: -4px 0 12px;
  }

  .appointment-history-list {
    display: grid;
    gap: 14px;
    margin-top: 22px;
  }

  .appointment-history-item {
    display: grid;
    grid-template-columns: 64px 18px minmax(0, 1fr);
    gap: 0 13px;
    min-width: 0;
  }

  .appointment-history-date {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 17px;
    color: #39775f;
    text-align: center;
  }

  .appointment-history-date strong {
    font-size: 25px;
    font-weight: 750;
    line-height: 1.1;
  }

  .appointment-history-date > span {
    font-size: 10px;
    font-weight: 750;
    letter-spacing: .8px;
    text-transform: uppercase;
  }

  .appointment-history-date > small {
    margin-top: 3px;
    color: #83958c;
    font-size: 10px;
  }

  .appointment-history-date .appointment-history-time {
    margin-top: 8px;
    padding: 4px 7px;
    border-radius: 999px;
    background: #eaf3ed;
    color: #376d57;
    font-size: 10px;
    font-weight: 700;
  }

  .appointment-history-track {
    position: relative;
    display: flex;
    justify-content: center;
    padding-top: 25px;
  }

  .appointment-history-track > span {
    z-index: 1;
    width: 11px;
    height: 11px;
    border: 3px solid #e6f2eb;
    border-radius: 50%;
    background: #438d70;
    box-shadow: 0 0 0 1px #b8d7c5;
  }

  .appointment-history-item:not(:last-child) .appointment-history-track::after {
    position: absolute;
    top: 36px;
    bottom: -14px;
    left: 50%;
    width: 2px;
    background: #dce9e1;
    content: '';
    transform: translateX(-50%);
  }

  .appointment-history-entry {
    min-width: 0;
    padding: 17px 19px 15px;
    border: 1px solid #dfe9e5;
    border-radius: 13px;
    background: linear-gradient(135deg, #fcfefd, #f8fbf9);
  }

  .appointment-history-entry-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .appointment-history-title {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .appointment-history-title h3 {
    margin: 0;
    color: #254653;
    font-size: 15px;
    font-weight: 730;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .appointment-history-title > span {
    color: #71858a;
    font-size: 10.5px;
    font-weight: 600;
  }

  .appointment-history-entry-header .status-badge {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .appointment-history-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 13px 20px;
    margin: 15px 0 0;
    padding-top: 13px;
    border-top: 1px solid #e9efeb;
  }

  .appointment-history-details > div {
    min-width: 0;
  }

  .appointment-history-details dt,
  .payment-history-status {
    margin-bottom: 4px;
    color: #82948c;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: .55px;
    text-transform: uppercase;
  }

  .appointment-history-details dd {
    margin: 0;
    color: #405b61;
    font-size: 11.5px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .appointment-history-payment {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 13px;
    padding-top: 11px;
    border-top: 1px solid #e9efeb;
  }

  .payment-history-status {
    margin: 0;
  }

  .payment-history-value {
    padding: 4px 8px;
    border-radius: 999px;
    background: #eef3f1;
    color: #526a60;
    font-size: 10px;
    font-weight: 700;
    text-transform: capitalize;
  }

  :global(.app-shell[data-theme='dark'] .detail-grid) {
    border-color: #3b5148;
  }

  :global(.app-shell[data-theme='dark'] .detail-grid > div) {
    border-color: #3b5148;
  }

  :global(.app-shell[data-theme='dark'] .detail-grid dt),
  :global(.app-shell[data-theme='dark'] .payment-history-status) {
    color: #a9bdb3;
  }

  :global(.app-shell[data-theme='dark'] .detail-grid dd) {
    color: #d7e5de;
  }

  :global(.app-shell[data-theme='dark'] .detail-avatar) {
    background: #315044;
    color: #b8e3cf;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-item) {
    color: #e0eae4;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-heading .result-count) {
    border-color: #3f5b4c;
    background: #25392f;
    color: #b7dfc6;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-date) {
    color: #b8dfc9;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-date > small) {
    color: #a9bdb3;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-date .appointment-history-time) {
    background: #2a4035;
    color: #c4e6d1;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-track > span) {
    border-color: #263b30;
    background: #72b58c;
    box-shadow: 0 0 0 1px #4e8062;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-item:not(:last-child) .appointment-history-track::after) {
    background: #3b5148;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-entry) {
    border-color: #3b5148;
    background: linear-gradient(135deg, #202f29, #1d2b26);
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-title h3) {
    color: #e6f0eb;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-title > span),
  :global(.app-shell[data-theme='dark'] .appointment-history-details dt) {
    color: #a9bdb3;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-details) {
    border-color: #354a40;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-details dd) {
    color: #d7e5de;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-payment) {
    border-color: #354a40;
  }

  :global(.app-shell[data-theme='dark'] .payment-history-value) {
    background: #2b3c34;
    color: #cbd9d2;
  }

  :global(.app-shell[data-theme='dark'] .detail-hero .status-active),
  :global(.app-shell[data-theme='dark'] .appointment-history-entry-header .status-confirmed) {
    border: 1px solid #426d55;
    background: #244231;
    color: #a9e0bc;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-entry-header .status-pending) {
    border: 1px solid #806b3e;
    background: #403821;
    color: #f0d48b;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-entry-header .status-completed) {
    border: 1px solid #46627a;
    background: #263b4c;
    color: #b3d5f1;
  }

  :global(.app-shell[data-theme='dark'] .appointment-history-entry-header .status-cancelled),
  :global(.app-shell[data-theme='dark'] .appointment-history-entry-header .status-no_show) {
    border: 1px solid #754849;
    background: #40272a;
    color: #f0a6a6;
  }

  :global(html[data-theme='dark'] .appointment-history-entry) {
    border-color: #3b5148;
    background: linear-gradient(135deg, #202f29, #1d2b26);
    color: #d7e5de;
  }

  :global(html[data-theme='dark'] .appointment-history-title h3) {
    color: #e6f0eb;
  }

  :global(html[data-theme='dark'] .appointment-history-title > span),
  :global(html[data-theme='dark'] .appointment-history-heading .muted),
  :global(html[data-theme='dark'] .appointment-history-details dt),
  :global(html[data-theme='dark'] .appointment-history-date > small),
  :global(html[data-theme='dark'] .payment-history-status) {
    color: #a9bdb3;
  }

  :global(html[data-theme='dark'] .appointment-history-details dd) {
    color: #d7e5de;
  }

  :global(html[data-theme='dark'] .appointment-history-details),
  :global(html[data-theme='dark'] .appointment-history-payment) {
    border-color: #354a40;
  }

  :global(html[data-theme='dark'] .payment-history-value) {
    background: #2b3c34;
    color: #cbd9d2;
  }

  :global(html[data-theme='dark'] .appointment-history-entry-header .status-confirmed) {
    border: 1px solid #426d55;
    background: #244231;
    color: #a9e0bc;
  }

  :global(html[data-theme='dark'] .appointment-history-entry-header .status-pending) {
    border: 1px solid #806b3e;
    background: #403821;
    color: #f0d48b;
  }

  :global(html[data-theme='dark'] .appointment-history-entry-header .status-completed) {
    border: 1px solid #46627a;
    background: #263b4c;
    color: #b3d5f1;
  }

  :global(html[data-theme='dark'] .appointment-history-entry-header .status-cancelled),
  :global(html[data-theme='dark'] .appointment-history-entry-header .status-no_show) {
    border: 1px solid #754849;
    background: #40272a;
    color: #f0a6a6;
  }

  :global(html[data-theme='dark'] .appointment-history-heading .result-count) {
    border-color: #3f5b4c;
    background: #25392f;
    color: #b7dfc6;
  }

  :global(html[data-theme='dark'] .appointment-history-date) {
    color: #b8dfc9;
  }

  :global(html[data-theme='dark'] .appointment-history-date .appointment-history-time) {
    background: #2a4035;
    color: #c4e6d1;
  }

  :global(html[data-theme='dark'] .appointment-history-track > span) {
    border-color: #263b30;
    background: #72b58c;
    box-shadow: 0 0 0 1px #4e8062;
  }

  :global(html[data-theme='dark'] .appointment-history-item:not(:last-child) .appointment-history-track::after) {
    background: #3b5148;
  }

  @media (max-width: 700px) {
    .appointment-history-item {
      grid-template-columns: 52px 14px minmax(0, 1fr);
      gap: 0 9px;
    }

    .appointment-history-date {
      padding-top: 16px;
    }

    .appointment-history-date strong {
      font-size: 22px;
    }

    .appointment-history-entry {
      padding: 15px;
    }

    .appointment-history-details {
      gap: 11px 14px;
    }
  }

  @media (max-width: 480px) {
    .appointment-history-heading {
      align-items: flex-start;
    }

    .appointment-history-actions {
      width: 100%;
      justify-content: flex-start;
    }

    .timeline-export-button {
      width: 100%;
    }

    .appointment-history-list {
      gap: 11px;
      margin-top: 17px;
    }

    .appointment-history-item {
      grid-template-columns: 43px 10px minmax(0, 1fr);
      gap: 0 7px;
    }

    .appointment-history-date {
      padding-top: 14px;
    }

    .appointment-history-date > span,
    .appointment-history-date > small {
      font-size: 8px;
    }

    .appointment-history-date strong {
      font-size: 19px;
    }

    .appointment-history-date .appointment-history-time {
      padding: 3px 4px;
      font-size: 8px;
    }

    .appointment-history-track {
      padding-top: 21px;
    }

    .appointment-history-track > span {
      width: 9px;
      height: 9px;
      border-width: 2px;
    }

    .appointment-history-item:not(:last-child) .appointment-history-track::after {
      top: 30px;
    }

    .appointment-history-entry {
      padding: 12px;
    }

    .appointment-history-entry-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 9px;
    }

    .appointment-history-title h3 {
      font-size: 13px;
    }

    .appointment-history-details {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      margin-top: 12px;
      padding-top: 11px;
    }
  }
</style>
