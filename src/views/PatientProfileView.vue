<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ApiError, apiRequest, getApiData } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

async function loadPdf() {
  const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF: jspdfMod.default, autoTable: autoTableMod.default }
}
interface Treatment { record_id: number; tooth_no: string | null; diagnosis: string | null; treatment_done: string | null; notes: string | null; follow_up_date: string | null; follow_up_time: string | null; created_at: string; dentist: string | null }
interface ToothCondition { tooth_no: string; condition_name: string; updated_at: string }
interface ProfileData { profile: { first_name: string; last_name: string; birth_date: string | null; sex: string | null; contact_no: string | null; email: string | null; address: string | null; emergency_contact_name: string | null; emergency_contact_no: string | null; allergies: string | null }; treatment_history: Treatment[]; tooth_chart: ToothCondition[] }
const data = ref<ProfileData | null>(null)
const upperTeeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28]
const lowerTeeth = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]
const selectedTooth = ref('')
const selectedToothHistory = computed(() => data.value?.treatment_history.filter((item) => item.tooth_no === selectedTooth.value) ?? [])
const hasToothInformation = computed(() => Boolean(data.value?.tooth_chart.length || data.value?.treatment_history.some((item) => item.tooth_no)))
const form = reactive({ contact_no: '', email: '', address: '', emergency_contact_name: '', emergency_contact_no: '', allergies: '' })
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const exportingHistory = ref(false)
const exportError = ref('')
function formatFollowUpDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
function formatFollowUpTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  const date = new Date(1970, 0, 1, hours, minutes)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function pdfConditionColor(condition: string): [number, number, number] {
  switch (condition.toLowerCase()) {
    case 'healthy': return [225, 243, 232]
    case 'decayed': return [255, 239, 220]
    case 'filled':
    case 'crown': return [237, 232, 252]
    case 'root canal': return [228, 241, 252]
    case 'extracted': return [252, 231, 234]
    default: return [239, 243, 241]
  }
}
function conditionForTooth(tooth: number) {
  return data.value?.tooth_chart.find((item) => item.tooth_no === String(tooth))?.condition_name ?? 'Unrecorded'
}
function treatmentsForTooth(tooth: number) {
  return data.value?.treatment_history.filter((item) => item.tooth_no === String(tooth)) ?? []
}
function toothClasses(tooth: number) {
  const condition = conditionForTooth(tooth)
  return [
    'patient-tooth',
    `condition-${condition.toLowerCase().replace(/\s+/g, '-')}`,
    { selected: selectedTooth.value === String(tooth), 'has-treatment': treatmentsForTooth(tooth).length > 0 },
  ]
}
function toothTooltip(tooth: number) {
  const condition = conditionForTooth(tooth)
  const treatments = treatmentsForTooth(tooth)
  const details = [condition === 'Unrecorded' ? 'No condition recorded' : `Condition: ${condition}`]
  if (treatments.length) {
    const treatment = treatments[0].treatment_done || treatments[0].diagnosis
    details.push(`${treatments.length} treatment ${treatments.length === 1 ? 'record' : 'records'}`)
    if (treatment) details.push(`Includes: ${treatment}`)
  } else {
    details.push('No treatment record')
  }
  return `Tooth ${tooth} - ${details.join('; ')}`
}
function showToothDetails(tooth: number) {
  selectedTooth.value = String(tooth)
}
async function load() {
  loading.value = true; error.value = ''
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    data.value = await getApiData<ProfileData>('/api/patient/profile', controller.signal)
    selectedTooth.value = data.value.treatment_history.find((item) => item.tooth_no)?.tooth_no
      ?? data.value.tooth_chart[0]?.tooth_no
      ?? ''
    Object.assign(form, Object.fromEntries(Object.keys(form).map((key) => [key, data.value?.profile[key as keyof typeof form] ?? ''])))
  } catch (cause) {
    error.value = cause instanceof DOMException && cause.name === 'AbortError'
      ? 'The profile is taking too long to load. Please try again.'
      : cause instanceof ApiError ? cause.message : 'Could not load your profile.'
  } finally {
    window.clearTimeout(timeout)
    loading.value = false
  }
}
async function save() {
  saving.value = true; error.value = ''; success.value = ''
  try { const result = await apiRequest<{ message: string }>('/api/patient/profile', { method: 'PUT', body: JSON.stringify(form) }); success.value = result.message; notify.success(result.message, 'Profile updated'); await load() }
  catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not save your profile.'; notify.error(error.value, 'Profile not saved') }
  finally { saving.value = false }
}
async function exportHistory() {
  const profile = data.value
  if (!profile) return
  exportingHistory.value = true
  exportError.value = ''
  try {
    const { jsPDF, autoTable } = await loadPdf()
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    const generatedAt = new Date().toLocaleString()
    const treatmentTeeth = new Set(profile.treatment_history.map((item) => item.tooth_no).filter((tooth): tooth is string => Boolean(tooth)))
    pdf.setFillColor(25, 74, 78)
    pdf.rect(0, 0, pageWidth, 42, 'F')
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
    pdf.text('Patient Clinical History', pageWidth - margin, 15, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(208, 235, 226)
    pdf.text(`Generated ${generatedAt}`, pageWidth - margin, 27, { align: 'right' })

    pdf.setFillColor(244, 249, 246)
    pdf.setDrawColor(221, 234, 226)
    pdf.roundedRect(margin, 49, contentWidth, 18, 3, 3, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(91, 117, 105)
    pdf.text('PATIENT', margin + 5, 56)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(35, 67, 57)
    pdf.text(`${profile.profile.first_name} ${profile.profile.last_name}`, margin + 5, 63)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(91, 117, 105)
    pdf.text(`${profile.treatment_history.length} treatment record${profile.treatment_history.length === 1 ? '' : 's'}`, pageWidth - margin - 5, 60, { align: 'right' })

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(35, 67, 57)
    pdf.text('Dental chart', margin, 77)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(103, 122, 113)
    pdf.text('FDI tooth numbering  |  Colored teeth show their recorded condition; a green marker indicates treatment history.', margin + 32, 77)

    pdf.setFillColor(250, 252, 251)
    pdf.setDrawColor(221, 234, 226)
    pdf.roundedRect(margin, 81, contentWidth, 59, 3, 3, 'FD')
    const cellGap = 2
    const chartWidth = contentWidth - 8
    const cellWidth = (chartWidth - cellGap * 15) / 16
    const cellHeight = 11
    const drawArch = (teeth: number[], label: string, labelY: number, teethY: number) => {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6)
      pdf.setTextColor(113, 132, 122)
      pdf.text(label, margin + 4, labelY)
      teeth.forEach((tooth, index) => {
        const x = margin + 4 + index * (cellWidth + cellGap)
        const condition = profile.tooth_chart.find((item) => item.tooth_no === String(tooth))?.condition_name ?? 'Unrecorded'
        const fill = pdfConditionColor(condition)
        pdf.setFillColor(...fill)
        pdf.setDrawColor(215, 228, 221)
        pdf.roundedRect(x, teethY, cellWidth, cellHeight, 1.5, 1.5, 'FD')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        pdf.setTextColor(54, 80, 68)
        pdf.text(String(tooth), x + cellWidth / 2, teethY + 7, { align: 'center' })
        if (treatmentTeeth.has(String(tooth))) {
          pdf.setFillColor(38, 124, 92)
          pdf.circle(x + cellWidth - 2, teethY + 2, 1, 'F')
        }
      })
    }
    drawArch(upperTeeth, 'UPPER ARCH', 90, 93)
    drawArch(lowerTeeth, 'LOWER ARCH', 111, 114)

    const legend = [
      { label: 'Unrecorded', color: pdfConditionColor('unrecorded') },
      { label: 'Healthy', color: pdfConditionColor('healthy') },
      { label: 'Decayed', color: pdfConditionColor('decayed') },
      { label: 'Filled / crown', color: pdfConditionColor('filled') },
      { label: 'Root canal', color: pdfConditionColor('root canal') },
      { label: 'Extracted', color: pdfConditionColor('extracted') },
    ]
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6)
    pdf.setTextColor(83, 103, 93)
    let legendX = margin + 4
    const legendY = 133
    legend.forEach((item) => {
      pdf.setFillColor(...item.color)
      pdf.setDrawColor(201, 216, 207)
      pdf.roundedRect(legendX, legendY - 2.2, 3, 3, 0.6, 0.6, 'FD')
      pdf.text(item.label, legendX + 4, legendY)
      legendX += 7 + pdf.getTextWidth(item.label)
    })
    pdf.setFillColor(38, 124, 92)
    pdf.circle(legendX + 1, legendY - 0.8, 1, 'F')
    pdf.text('Treatment saved', legendX + 4, legendY)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(35, 67, 57)
    pdf.text('Treatment history', margin, 151)
    autoTable(pdf, {
      startY: 155,
      margin: { left: margin, right: margin, bottom: 14 },
      head: [['Date recorded', 'Tooth', 'Diagnosis', 'Treatment performed', 'Notes', 'Return visit', 'Dentist']],
      body: profile.treatment_history.length
        ? profile.treatment_history.map((item) => [
          item.created_at,
          item.tooth_no || '—',
          item.diagnosis || '—',
          item.treatment_done || '—',
          item.notes || '—',
          item.follow_up_date ? `${formatFollowUpDate(item.follow_up_date)}${item.follow_up_time ? ` · ${formatFollowUpTime(item.follow_up_time)}` : ''}` : '—',
          item.dentist || 'Clinic team',
        ])
        : [['No treatment records have been recorded yet.', '—', '—', '—', '—', '—', '—']],
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'top', textColor: [49, 69, 61], lineColor: [225, 234, 228], lineWidth: 0.2 },
      headStyles: { fillColor: [25, 74, 78], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 249, 246] },
      columnStyles: {
        0: { cellWidth: 27 },
        1: { cellWidth: 14 },
        2: { cellWidth: 42 },
        3: { cellWidth: 54 },
        4: { cellWidth: 47 },
        5: { cellWidth: 43 },
        6: { cellWidth: 28 },
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
    pdf.save(`patient-clinical-history-${localDate}.pdf`)
    notify.success('Your clinical history PDF is ready.', 'PDF downloaded')
  } catch (cause) {
    const details = cause instanceof Error ? cause.message : String(cause)
    exportError.value = `Could not create the PDF: ${details}`
    notify.error(exportError.value, 'PDF export failed')
  } finally {
    exportingHistory.value = false
  }
}
onMounted(load)
</script>
<template>
  <section class="page-heading">
    <div class="page-heading-copy">
      <p class="eyebrow"></p>
      <h1>Profile &amp; Medical History</h1>
      <p class="muted">Update your contact details and review treatment records.</p>
    </div>
    <button class="button button-quiet" type="button" :disabled="!data || exportingHistory" @click="exportHistory">
      {{ exportingHistory ? 'Preparing PDF…' : 'Download history PDF' }}
    </button>
  </section>
  <p v-if="exportError" class="form-message form-error" role="alert">{{ exportError }}</p>

  <SkeletonLoader v-if="loading" variant="patient-profile" label="Loading your profile and medical history" />
  <section v-else-if="error && !data" class="surface empty-state">
    <strong>Profile unavailable</strong>
    <p>{{ error }}</p>
  </section>

  <template v-else-if="data">
    <form class="surface profile-card" @submit.prevent="save">
      <div class="card-header">
        <div>
          <p class="eyebrow">Patient details</p>
          <h2>{{ data.profile.first_name }} {{ data.profile.last_name }}</h2>
        </div>
        <span class="state-badge">Active</span>
      </div>

      <div class="profile-form-grid">
        <label class="field">
          <span>Contact number</span>
          <input v-model="form.contact_no" maxlength="20" placeholder="Add your phone number" />
        </label>

        <label class="field">
          <span>Email</span>
          <input v-model="form.email" type="email" maxlength="100" placeholder="your@email.com" />
        </label>

        <label class="field field-full">
          <span>Address</span>
          <input v-model="form.address" maxlength="255" placeholder="Street, city, country" />
        </label>

        <label class="field">
          <span>Emergency contact</span>
          <input v-model="form.emergency_contact_name" maxlength="100" placeholder="Full name" />
        </label>

        <label class="field">
          <span>Emergency phone</span>
          <input v-model="form.emergency_contact_no" maxlength="20" placeholder="Contact number" />
        </label>

        <label class="field field-full">
          <span>Allergies</span>
          <textarea v-model="form.allergies" rows="3" maxlength="5000" placeholder="List any allergies or sensitivities" />
        </label>
      </div>

      <div class="form-footer">
        <small class="helper-text">Keep your emergency details up-to-date so the clinic can contact you quickly.</small>
        <button class="button button-primary" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save profile' }}
        </button>
      </div>

      <p v-if="error" class="form-message form-error">{{ error }}</p>
    </form>

    <section class="surface feature-card patient-chart">
      <div class="feature-header">
        <div>
          <h2>Your dental chart</h2>
          <p class="muted">Hover over, focus, or select a tooth to see its condition and saved treatments. This chart is read-only.</p>
        </div>
      </div>

      <div class="patient-tooth-chart">
        <p v-if="!hasToothInformation" class="empty-inline">No tooth conditions or tooth-specific treatments have been recorded yet.</p>
        <div class="tooth-arch-label">UPPER ARCH · FDI NOTATION</div>
        <div class="tooth-chart-scroll">
          <div class="patient-tooth-grid">
            <button
              v-for="tooth in upperTeeth"
              :key="tooth"
              type="button"
              :class="toothClasses(tooth)"
              :aria-label="toothTooltip(tooth)"
              :title="toothTooltip(tooth)"
              :aria-pressed="selectedTooth === String(tooth)"
              @mouseenter="showToothDetails(tooth)"
              @focus="showToothDetails(tooth)"
              @click="showToothDetails(tooth)"
            >
              {{ tooth }}<span v-if="treatmentsForTooth(tooth).length" class="tooth-treatment-marker" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div class="tooth-arch-label">LOWER ARCH · FDI NOTATION</div>
        <div class="tooth-chart-scroll">
          <div class="patient-tooth-grid">
            <button
              v-for="tooth in lowerTeeth"
              :key="tooth"
              type="button"
              :class="toothClasses(tooth)"
              :aria-label="toothTooltip(tooth)"
              :title="toothTooltip(tooth)"
              :aria-pressed="selectedTooth === String(tooth)"
              @mouseenter="showToothDetails(tooth)"
              @focus="showToothDetails(tooth)"
              @click="showToothDetails(tooth)"
            >
              {{ tooth }}<span v-if="treatmentsForTooth(tooth).length" class="tooth-treatment-marker" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div class="tooth-chart-legend">
          <span><i class="legend-tooth"></i> Color shows the recorded tooth condition</span>
          <span><i class="legend-treatment"></i> Treatment record saved</span>
        </div>
      </div>

      <section v-if="selectedTooth" class="selected-tooth-panel" :aria-labelledby="`tooth-history-${selectedTooth}`">
        <div class="selected-tooth-heading">
          <h3 :id="`tooth-history-${selectedTooth}`">Tooth {{ selectedTooth }}</h3>
          <span>{{ conditionForTooth(Number(selectedTooth)) }}</span>
        </div>
        <p v-if="!selectedToothHistory.length" class="empty-inline">
          {{ conditionForTooth(Number(selectedTooth)) === 'Unrecorded'
            ? 'No condition or treatment has been recorded for this tooth yet.'
            : 'No treatment record has been saved for this tooth yet.' }}
        </p>
        <div v-else class="selected-tooth-records">
          <article v-for="item in selectedToothHistory" :key="item.record_id" class="selected-tooth-record">
            <div class="history-top">
              <strong>{{ item.treatment_done || item.diagnosis || 'Treatment record' }}</strong>
              <time>{{ item.created_at }}</time>
            </div>
            <p v-if="item.diagnosis"><strong>Diagnosis:</strong> {{ item.diagnosis }}</p>
            <p v-if="item.treatment_done"><strong>Treatment:</strong> {{ item.treatment_done }}</p>
            <p v-if="item.notes"><strong>Notes:</strong> {{ item.notes }}</p>
            <p v-if="item.follow_up_date" class="selected-tooth-return">
              <strong>Return visit:</strong> {{ formatFollowUpDate(item.follow_up_date) }}<template v-if="item.follow_up_time"> · {{ formatFollowUpTime(item.follow_up_time) }}</template>
            </p>
            <small>Recorded by {{ item.dentist || 'Clinic team' }}</small>
          </article>
        </div>
      </section>
    </section>

    <section class="surface feature-card">
      <div class="feature-header">
        <div>
          <h2>Treatment history</h2>
          <p class="muted">These are clinical records of findings and care documented during your visits.</p>
        </div>
      </div>

      <p v-if="!data.treatment_history.length" class="empty-inline">No treatment records are available yet.</p>
      <div v-else class="history-list">
        <article v-for="item in data.treatment_history" :key="item.record_id" class="history-item">
          <div class="history-top">
            <strong>{{ item.treatment_done || item.diagnosis || 'Treatment record' }}</strong>
            <time>{{ item.created_at }}</time>
          </div>

          <p v-if="item.diagnosis && item.treatment_done" class="history-diagnosis">
            <strong>Diagnosis:</strong> {{ item.diagnosis }}
          </p>

          <div class="history-meta">
            <span>{{ item.dentist || 'Clinic team' }}</span>
            <span>Tooth {{ item.tooth_no || '—' }}</span>
          </div>

          <p v-if="item.notes" class="history-notes">{{ item.notes }}</p>

          <p v-if="item.follow_up_date" class="recommended-return">
            <span>Return visit:</span>
            <strong>{{ formatFollowUpDate(item.follow_up_date) }}<template v-if="item.follow_up_time"> · {{ formatFollowUpTime(item.follow_up_time) }}</template></strong>
            <small>This reminder does not reserve a separate appointment slot. Contact the clinic if you need to change your return time.</small>
          </p>
        </article>
      </div>
    </section>
  </template>
</template>

<style scoped>
.page-heading-copy {
  display: grid;
  gap: 6px;
}

.profile-card,
.feature-card {
  border: 1px solid var(--line);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 16px 40px rgba(30, 53, 73, 0.06);
}

.profile-card {
  padding: 1.5rem 1.45rem 1.2rem;
  margin-bottom: 1.3rem;
}

.card-header,
.feature-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.card-header {
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--line);
}

.card-header h2,
.feature-header h2 {
  margin: 0.2rem 0 0;
  color: #243d4f;
  font-size: clamp(1.4rem, 2vw, 2rem);
  line-height: 1.2;
}

.state-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: #e9f6ef;
  color: #2b7a59;
  font-size: 0.74rem;
  font-weight: 700;
}

.profile-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.1rem 1.4rem;
}

.field {
  display: grid;
  gap: 0.55rem;
  color: #586f7d;
  font-size: 0.78rem;
  font-weight: 700;
}

.field span {
  color: #4d6776;
}

.field input,
.field textarea {
  width: 100%;
  min-height: 46px;
  padding: 0.8rem 0.9rem;
  border: 1px solid #dfe7ec;
  border-radius: 12px;
  background: #fbfcfd;
  color: #1f3b4d;
  font: inherit;
  font-weight: 500;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.field input::placeholder,
.field textarea::placeholder {
  color: #9aaab1;
}

.field textarea {
  min-height: 86px;
  resize: vertical;
}

.field input:focus,
.field textarea:focus {
  border-color: #7dbeb9;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(82, 179, 168, 0.12);
  outline: none;
}

.field-full {
  grid-column: 1 / -1;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.helper-text {
  max-width: 32rem;
  color: #728593;
  line-height: 1.5;
}

.form-message {
  margin: 0.9rem 0 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.form-error {
  color: #b84d57;
}

.form-success {
  color: #2d7c5a;
}

.feature-card {
  padding: 1.4rem 1.4rem 1.1rem;
  margin-bottom: 1.15rem;
}

.feature-header p {
  margin: 0.35rem 0 0;
}

.empty-inline {
  margin: 0;
  padding: 0.85rem 0 0.1rem;
  color: #728593;
}

.patient-tooth-chart {
  padding: 1rem;
  border: 1px solid #e1e9e4;
  border-radius: 14px;
  background: #f8fbf9;
}

.tooth-arch-label {
  margin: 0.8rem 0 0.45rem;
  color: #78889a;
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.tooth-chart-scroll {
  overflow-x: auto;
  padding: 2px;
}

.patient-tooth-grid {
  display: grid;
  min-width: 540px;
  grid-template-columns: repeat(16, minmax(0, 1fr));
  gap: 6px;
}

.patient-tooth {
  position: relative;
  min-width: 0;
  height: 40px;
  border: 1px solid #dce8e1;
  border-radius: 9px;
  background: #eef7f2;
  color: #39745f;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.patient-tooth:focus-visible {
  outline: 3px solid rgb(67 141 117 / 28%);
  outline-offset: 2px;
}

.patient-tooth.condition-unrecorded {
  border-style: dashed;
  background: #f2f4f6;
  color: #8995a4;
}

.patient-tooth.condition-healthy {
  background: #e4f4eb;
  color: #28775b;
}

.patient-tooth.condition-decayed {
  background: #fff0e3;
  color: #9c6436;
}

.patient-tooth.condition-filled,
.patient-tooth.condition-crown {
  background: #eee9ff;
  color: #6956a2;
}

.patient-tooth.condition-root-canal {
  background: #e8f4ff;
  color: #426c93;
}

.patient-tooth.condition-extracted {
  background: #fce9eb;
  color: #a15460;
}

.patient-tooth.selected {
  outline: 2px solid #438d75;
  outline-offset: 1px;
}

.tooth-treatment-marker {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 7px;
  height: 7px;
  border: 1px solid #fff;
  border-radius: 50%;
  background: #267c5c;
}

.tooth-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.2rem;
  margin-top: 0.8rem;
  color: #728593;
  font-size: 0.74rem;
}

.tooth-chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.legend-tooth,
.legend-treatment {
  display: inline-block;
  width: 11px;
  height: 11px;
  border: 1px solid #8da49a;
  border-radius: 3px;
  background: #e4f4eb;
}

.legend-treatment {
  width: 8px;
  height: 8px;
  border: 0;
  border-radius: 50%;
  background: #267c5c;
}

.selected-tooth-panel {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid #e2ebf0;
  border-radius: 14px;
  background: #fbfdff;
}

.selected-tooth-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.65rem;
}

.selected-tooth-heading h3 {
  margin: 0;
  color: #244d64;
  font-size: 1rem;
}

.selected-tooth-heading > span {
  color: #2b7a59;
  font-size: 0.83rem;
  font-weight: 700;
}

.selected-tooth-records {
  display: grid;
  gap: 0.7rem;
}

.selected-tooth-record {
  display: grid;
  gap: 0.45rem;
  padding-top: 0.7rem;
  border-top: 1px solid #e4edf2;
}

.selected-tooth-record p {
  margin: 0;
  color: #5e7584;
  font-size: 0.85rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.selected-tooth-record p strong {
  color: #35495b;
}

.selected-tooth-record small {
  color: #758b96;
}

.selected-tooth-return {
  color: #2c5d49 !important;
}

.history-list {
  display: grid;
  gap: 0.85rem;
  margin-top: 0.95rem;
}

.history-item {
  display: grid;
  gap: 0.7rem;
  padding: 1rem 1rem 0.9rem;
  border: 1px solid #e2ebf0;
  border-radius: 16px;
  background: #fbfdff;
}

.history-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.history-top strong {
  color: #224a5d;
  font-size: 1rem;
}

.history-top time {
  color: #6d8490;
  font-size: 0.78rem;
}

.history-diagnosis {
  margin: 0;
  color: #5e7584;
  font-size: 0.84rem;
  line-height: 1.55;
}

.history-diagnosis strong {
  color: #35495b;
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  color: #5e7584;
  font-size: 0.82rem;
}

.history-notes {
  margin: 0;
  color: #495f6d;
  line-height: 1.6;
}

.recommended-return {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0.7rem 0.8rem;
  border: 1px solid #dceee3;
  border-radius: 12px;
  background: #f3faf6;
  color: #2c5d49;
}

.recommended-return span {
  font-weight: 700;
}

.recommended-return strong {
  font-size: 0.95rem;
}

.recommended-return small {
  color: #6a7b85;
  line-height: 1.45;
}

:global(.app-shell[data-theme='dark'] .profile-card),
:global(.app-shell[data-theme='dark'] .feature-card) {
  border-color: #354741;
  background: #1d2b26;
  color: #d7e5de;
}

:global(.app-shell[data-theme='dark'] .card-header) {
  border-color: #354741;
}

:global(.app-shell[data-theme='dark'] .card-header h2),
:global(.app-shell[data-theme='dark'] .feature-header h2),
:global(.app-shell[data-theme='dark'] .history-top strong),
:global(.app-shell[data-theme='dark'] .selected-tooth-heading h3) {
  color: #e4ede9;
}

:global(.app-shell[data-theme='dark'] .profile-card .eyebrow),
:global(.app-shell[data-theme='dark'] .field),
:global(.app-shell[data-theme='dark'] .field span),
:global(.app-shell[data-theme='dark'] .helper-text),
:global(.app-shell[data-theme='dark'] .feature-header .muted),
:global(.app-shell[data-theme='dark'] .empty-inline),
:global(.app-shell[data-theme='dark'] .history-meta),
:global(.app-shell[data-theme='dark'] .history-diagnosis),
:global(.app-shell[data-theme='dark'] .history-notes),
:global(.app-shell[data-theme='dark'] .tooth-chart-legend) {
  color: #b2c2bb;
}
:global(.app-shell[data-theme='dark'] .history-diagnosis strong) { color: #e4ede9; }

:global(.app-shell[data-theme='dark'] .field input),
:global(.app-shell[data-theme='dark'] .field textarea) {
  border-color: #40534b;
  background: #202f29;
  color: #e4ede9;
  color-scheme: dark;
}

:global(.app-shell[data-theme='dark'] .field input::placeholder),
:global(.app-shell[data-theme='dark'] .field textarea::placeholder) {
  color: #a3b3ae;
  opacity: 1;
}

:global(.app-shell[data-theme='dark'] .field input:focus),
:global(.app-shell[data-theme='dark'] .field textarea:focus) {
  border-color: #70b894;
  background: #263630;
}

:global(.app-shell[data-theme='dark'] .form-footer) {
  border-color: #354741;
}

:global(.app-shell[data-theme='dark'] .state-badge) {
  border: 1px solid #426d55;
  background: #244231;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .patient-tooth-chart),
:global(.app-shell[data-theme='dark'] .selected-tooth-panel),
:global(.app-shell[data-theme='dark'] .history-item) {
  border-color: #40534b;
  background: #202e2a;
}

:global(.app-shell[data-theme='dark'] .patient-tooth) {
  border-color: #40534b;
  background: #263630;
  color: #c1d0c9;
}

:global(.app-shell[data-theme='dark'] .patient-tooth.condition-unrecorded) {
  border-color: #52635c;
  background: #202e2a;
  color: #a3b3ae;
}

:global(.app-shell[data-theme='dark'] .patient-tooth.condition-healthy) {
  border-color: #426d55;
  background: #244231;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .patient-tooth.condition-decayed) {
  border-color: #806347;
  background: #403226;
  color: #f0c77b;
}

:global(.app-shell[data-theme='dark'] .patient-tooth.condition-filled),
:global(.app-shell[data-theme='dark'] .patient-tooth.condition-crown) {
  border-color: #655787;
  background: #332c46;
  color: #d3c5ff;
}

:global(.app-shell[data-theme='dark'] .patient-tooth.condition-root-canal) {
  border-color: #4a6b83;
  background: #263947;
  color: #b6dcf6;
}

:global(.app-shell[data-theme='dark'] .patient-tooth.condition-extracted) {
  border-color: #754849;
  background: #40272a;
  color: #f0a3a8;
}

:global(.app-shell[data-theme='dark'] .patient-tooth.selected) {
  outline-color: #70c697;
}

:global(.app-shell[data-theme='dark'] .selected-tooth-heading > span),
:global(.app-shell[data-theme='dark'] .selected-tooth-return) {
  color: #9cdbb4 !important;
}

:global(.app-shell[data-theme='dark'] .selected-tooth-record) {
  border-color: #40534b;
}

:global(.app-shell[data-theme='dark'] .selected-tooth-record p) {
  color: #b2c2bb;
}

:global(.app-shell[data-theme='dark'] .selected-tooth-record p strong) {
  color: #e4ede9;
}

:global(.app-shell[data-theme='dark'] .selected-tooth-record small),
:global(.app-shell[data-theme='dark'] .history-top time) {
  color: #a3b3ae;
}

:global(.app-shell[data-theme='dark'] .recommended-return) {
  border-color: #426d55;
  background: #263a30;
  color: #c9ded1;
}

:global(.app-shell[data-theme='dark'] .recommended-return small) {
  color: #b2c2bb;
}

:global(.app-shell[data-theme='dark'] .form-success) {
  color: #9cdbb4;
}

@media (max-width: 760px) {
  .profile-form-grid {
    grid-template-columns: 1fr;
  }

  .form-footer,
  .card-header,
  .feature-header,
  .history-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .button {
    width: 100%;
  }
}
</style>
