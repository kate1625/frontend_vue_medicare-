<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ApiError, apiRequest, getApiData } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

async function loadPdf() {
  const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF: jspdfMod.default, autoTable: autoTableMod.default }
}
interface Treatment { record_id: number; tooth_no: string | null; diagnosis: string | null; treatment_done: string | null; notes: string | null; follow_up_date: string | null; created_at: string; dentist: string | null }
interface ToothCondition { tooth_no: string; condition_name: string; updated_at: string }
interface ProfileData { profile: { first_name: string; last_name: string; birth_date: string | null; sex: string | null; contact_no: string | null; email: string | null; address: string | null; emergency_contact_name: string | null; emergency_contact_no: string | null; allergies: string | null }; treatment_history: Treatment[]; tooth_chart: ToothCondition[] }
const data = ref<ProfileData | null>(null)
const form = reactive({ contact_no: '', email: '', address: '', emergency_contact_name: '', emergency_contact_no: '', allergies: '' })
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
function formatFollowUpDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
async function load() {
  loading.value = true; error.value = ''
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    data.value = await getApiData<ProfileData>('/api/patient/profile', controller.signal)
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
  if (!data.value) return
  const { jsPDF, autoTable } = await loadPdf()
  const pdf = new jsPDF(); pdf.text(`Medical history: ${data.value.profile.first_name} ${data.value.profile.last_name}`, 14, 18)
  autoTable(pdf, { startY: 25, head: [['Date', 'Tooth', 'Diagnosis', 'Treatment', 'Recommended return', 'Dentist']], body: data.value.treatment_history.map((item) => [item.created_at, item.tooth_no || '—', item.diagnosis || '—', item.treatment_done || '—', item.follow_up_date ? formatFollowUpDate(item.follow_up_date) : '—', item.dentist || '—']) })
  pdf.save('medical-history.pdf')
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
    <button class="button button-quiet" type="button" :disabled="!data" @click="exportHistory">
      Download history PDF
    </button>
  </section>

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
          <p class="muted">A dentist updates this chart after reviewing your assessment. It is read-only here.</p>
        </div>
      </div>

      <p v-if="!data.tooth_chart.length" class="empty-inline">Your dentist has not published tooth chart updates yet.</p>
      <div v-else class="chart-conditions">
        <article v-for="tooth in data.tooth_chart" :key="tooth.tooth_no">
          <strong>Tooth {{ tooth.tooth_no }}</strong>
          <span>{{ tooth.condition_name }}</span>
          <small>Updated {{ tooth.updated_at }}</small>
        </article>
      </div>
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

          <div class="history-meta">
            <span>{{ item.dentist || 'Clinic team' }}</span>
            <span>Tooth {{ item.tooth_no || '—' }}</span>
          </div>

          <p v-if="item.notes" class="history-notes">{{ item.notes }}</p>

          <p v-if="item.follow_up_date" class="recommended-return">
            <span>Recommended return:</span>
            <strong>{{ formatFollowUpDate(item.follow_up_date) }}</strong>
            <small>This is not a booked appointment. Please contact the clinic to schedule your visit.</small>
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

.chart-conditions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 0.9rem;
  margin-top: 0.85rem;
}

.chart-conditions article {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 0.95rem;
  border: 1px solid #e4edf2;
  border-radius: 16px;
  background: linear-gradient(180deg, #f9fdfc 0%, #f5f9fb 100%);
}

.chart-conditions strong {
  color: #244d64;
  font-size: 0.96rem;
}

.chart-conditions span {
  color: #2b7a59;
  font-weight: 700;
}

.chart-conditions small {
  color: #758b96;
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
:global(.app-shell[data-theme='dark'] .chart-conditions strong) {
  color: #e4ede9;
}

:global(.app-shell[data-theme='dark'] .profile-card .eyebrow),
:global(.app-shell[data-theme='dark'] .field),
:global(.app-shell[data-theme='dark'] .field span),
:global(.app-shell[data-theme='dark'] .helper-text),
:global(.app-shell[data-theme='dark'] .feature-header .muted),
:global(.app-shell[data-theme='dark'] .empty-inline),
:global(.app-shell[data-theme='dark'] .history-meta),
:global(.app-shell[data-theme='dark'] .history-notes) {
  color: #b2c2bb;
}

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

:global(.app-shell[data-theme='dark'] .chart-conditions article),
:global(.app-shell[data-theme='dark'] .history-item) {
  border-color: #40534b;
  background: #202e2a;
}

:global(.app-shell[data-theme='dark'] .chart-conditions span) {
  color: #9cdbb4;
}

:global(.app-shell[data-theme='dark'] .chart-conditions small),
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
