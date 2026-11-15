<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
import { getApiData } from '../services/api'
import UiIcon from '../components/UiIcon.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'

let ChartConstructor: typeof import('chart.js').Chart | undefined
async function loadChart() {
  if (!ChartConstructor) {
    const mod = await import('chart.js')
    mod.Chart.register(...mod.registerables)
    ChartConstructor = mod.Chart
  }
  return { Chart: ChartConstructor }
}
interface DashboardData {
  patient: { first_name: string; last_name: string }
  appointments: { appointment_id: number | string; appt_date: string; appt_time: string; status: string; service_name: string; dentist: string | null }[]
  upcoming_appointments: { appointment_id: number | string; appt_date: string; appt_time: string; status: string; service_name: string; dentist: string | null; price: number | string }[]
  appointment_history: { month: string; total: number | string }[]
  recent_activity: { activity_type: string; activity_date: string | null; description: string; status: string | null; appointment_id: number | string }[]
  outstanding_balance: number | string
  summary: { total: number | string | null; pending: number | string | null; confirmed: number | string | null; completed: number | string | null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCount(value: unknown): value is number | string | null {
  return typeof value === 'number' || typeof value === 'string' || value === null
}

function isIdentifier(value: unknown): value is number | string {
  return typeof value === 'number' || typeof value === 'string'
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!isRecord(value) || !isRecord(value.patient) || !isRecord(value.summary)) return false
  const summary = value.summary
  if (typeof value.patient.first_name !== 'string' || typeof value.patient.last_name !== 'string') return false
  if (!Array.isArray(value.appointments) || !Array.isArray(value.upcoming_appointments)) return false
  if (!Array.isArray(value.appointment_history) || !Array.isArray(value.recent_activity)) return false
  if (typeof value.outstanding_balance !== 'number' && typeof value.outstanding_balance !== 'string') return false

  return ['total', 'pending', 'confirmed', 'completed'].every((key) => isCount(summary[key]))
    && value.appointments.every((appointment: unknown) =>
      isRecord(appointment)
      && isIdentifier(appointment.appointment_id)
      && typeof appointment.appt_date === 'string'
      && typeof appointment.appt_time === 'string'
      && typeof appointment.status === 'string'
      && typeof appointment.service_name === 'string'
      && (typeof appointment.dentist === 'string' || appointment.dentist === null),
    )
    && value.upcoming_appointments.every((appointment: unknown) =>
      isRecord(appointment)
      && isIdentifier(appointment.appointment_id)
      && typeof appointment.appt_date === 'string'
      && typeof appointment.appt_time === 'string'
      && typeof appointment.status === 'string'
      && typeof appointment.service_name === 'string'
      && (typeof appointment.dentist === 'string' || appointment.dentist === null)
      && (typeof appointment.price === 'number' || typeof appointment.price === 'string'),
    )
    && value.appointment_history.every((entry: unknown) =>
      isRecord(entry) && typeof entry.month === 'string' && isCount(entry.total),
    )
    && value.recent_activity.every((entry: unknown) =>
      isRecord(entry)
      && typeof entry.activity_type === 'string'
      && (typeof entry.activity_date === 'string' || entry.activity_date === null)
      && typeof entry.description === 'string'
      && (typeof entry.status === 'string' || entry.status === null)
      && isIdentifier(entry.appointment_id),
    )
}

const data = ref<DashboardData | null>(null)
const loading = ref(true)
const error = ref('')
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let historyChart: { destroy(): void; resize?: () => void } | null = null
const upcoming = computed(() => data.value?.upcoming_appointments ?? [])
function money(amount: number | string) { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount) || 0) }
function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}
function formatDate(value: string) {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date) : value
}
function formatActivityDate(value: string | null) {
  return value ? formatDate(value.slice(0, 10)) : 'Date unavailable'
}
function dayOfMonth(value: string) { return parseDate(value)?.getDate() ?? '—' }
function monthOfDate(value: string) { return parseDate(value)?.toLocaleDateString(undefined, { month: 'short' }) ?? '—' }
async function renderHistoryChart() {
  historyChart?.destroy()
  historyChart = null
  if (!chartCanvas.value || !data.value?.appointment_history.length) return

  const { Chart } = await loadChart()
  const styles = getComputedStyle(document.documentElement)
  const text = styles.getPropertyValue('--chart-text').trim() || '#183b4c'
  const grid = styles.getPropertyValue('--chart-grid').trim() || '#e9edf3'
  historyChart = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels: data.value.appointment_history.map((row) => row.month),
      datasets: [{
        label: 'Completed visits',
        data: data.value.appointment_history.map((row) => Number(row.total)),
        backgroundColor: '#438d75',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: text } } },
      scales: {
        x: { ticks: { color: text }, grid: { color: grid } },
        y: { beginAtZero: true, ticks: { color: text, precision: 0 }, grid: { color: grid } },
      },
    },
  })
}
function onThemeChange() {
  renderHistoryChart()
}
async function loadDashboard() {
  loading.value = true; error.value = ''; historyChart?.destroy(); historyChart = null
  try {
    const response: unknown = await getApiData<unknown>('/api/patient/dashboard')
    if (!isDashboardData(response)) {
      throw new Error('The clinic returned incomplete dashboard data. Please try again or contact the clinic.')
    }
    data.value = response
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not load your dashboard.' }
  finally { loading.value = false }
  if (data.value) {
    await nextTick()
    renderHistoryChart()
  }
}
onMounted(() => {
  window.addEventListener('medicare:theme-change', onThemeChange)
  void loadDashboard()
})
onActivated(() => {
  if (historyChart?.resize) void nextTick().then(() => historyChart?.resize?.())
})
onBeforeUnmount(() => {
  window.removeEventListener('medicare:theme-change', onThemeChange)
  historyChart?.destroy()
})
</script>
<template>
  <div class="dashboard-page">
  <section class="page-heading patient-welcome"><div class="welcome-copy"><p class="eyebrow">YOUR CARE, IN ONE PLACE</p><h1>Welcome{{ data ? `, ${data.patient.first_name}` : '' }}</h1><p class="muted">Your upcoming appointments, payments, and dental care updates.</p></div><RouterLink class="button button-primary" to="/patient/book">Book appointment <UiIcon name="arrow-right" /></RouterLink></section>
  <SkeletonLoader v-if="loading" variant="patient-dashboard" label="Loading your dashboard" />
  <section v-else-if="error" class="surface empty-state"><strong>Dashboard unavailable</strong><p>{{ error }}</p><button class="button button-quiet" type="button" @click="loadDashboard">Try again</button></section>
  <template v-else-if="data">
    <section class="dashboard-shortcuts" aria-label="Patient quick actions">
      <RouterLink class="dashboard-shortcut" to="/patient/appointments"><span class="stat-icon stat-icon-green"><UiIcon name="calendar" /></span><span><strong>My appointments</strong><small>View and manage your visits</small></span><UiIcon class="shortcut-arrow" name="arrow-right" /></RouterLink>
      <RouterLink class="dashboard-shortcut" to="/patient/payment"><span class="stat-icon stat-icon-blue"><UiIcon name="wallet" /></span><span><strong>Payments</strong><small>Review your payment details</small></span><UiIcon class="shortcut-arrow" name="arrow-right" /></RouterLink>
      <RouterLink class="dashboard-shortcut" to="/patient/messages"><span class="stat-icon stat-icon-amber"><UiIcon name="message-circle" /></span><span><strong>Contact the clinic</strong><small>Chat with your care team</small></span><UiIcon class="shortcut-arrow" name="arrow-right" /></RouterLink>
    </section>
    <section class="stats-grid patient-summary">
      <article class="stat-card"><span class="stat-icon stat-icon-green"><UiIcon name="calendar" /></span><p>Upcoming visits</p><strong>{{ upcoming.length }}</strong><small>Pending or confirmed</small></article>
      <article class="stat-card"><span class="stat-icon stat-icon-amber"><UiIcon name="clock" /></span><p>Requests to confirm</p><strong>{{ data.summary.pending || 0 }}</strong><small>We’ll update you when confirmed</small></article>
      <article class="stat-card"><span class="stat-icon stat-icon-blue"><UiIcon name="wallet" /></span><p>Outstanding balance</p><strong class="balance-number">{{ money(data.outstanding_balance) }}</strong><small>Based on service fees and verified payments</small></article>
      <article class="stat-card"><span class="stat-icon stat-icon-green"><UiIcon name="check-circle" /></span><p>Completed visits</p><strong>{{ data.summary.completed || 0 }}</strong><small>Your recorded appointments</small></article>
    </section>

    <section class="surface feature-state patient-upcoming"><div class="section-heading"><div class="patient-section-heading"><span class="patient-section-icon" aria-hidden="true"><UiIcon name="calendar" /></span><div><h2>Your next visits</h2><p class="muted">Your upcoming bookings, straight from the clinic schedule.</p></div></div><RouterLink class="text-link" to="/patient/appointments">All appointments <UiIcon name="arrow-right" /></RouterLink></div>
      <div v-if="!upcoming.length" class="empty-state"><strong>No upcoming visits</strong><p>Ready to plan your next checkup?</p><RouterLink class="button button-primary" to="/patient/book">Find an appointment</RouterLink></div>
      <div v-else class="appointment-list"><article v-for="item in upcoming" :key="item.appointment_id" class="appointment-card"><span class="visit-date"><strong>{{ dayOfMonth(item.appt_date) }}</strong><small>{{ monthOfDate(item.appt_date) }}</small></span><div class="visit-detail"><strong>{{ item.service_name }}</strong><p>{{ formatDate(item.appt_date) }} at {{ item.appt_time }} · {{ item.dentist || 'Dentist to be assigned' }}</p></div><span class="status-badge" :class="`status-${item.status}`">{{ item.status }}</span></article></div>
    </section>

    <section class="patient-lower-grid"><section class="surface report-card dashboard-chart"><h2>Your visit history</h2><div v-if="!data.appointment_history.length" class="history-empty"><span class="history-empty-icon"><UiIcon name="calendar" /></span><div><strong>Your care journey starts here</strong><p>Completed visits will show here so you can keep track of your care.</p></div></div><div v-else class="report-chart"><canvas ref="chartCanvas" /></div></section>
    <section class="surface feature-state patient-activity"><div class="section-heading"><div class="patient-section-heading"><span class="patient-section-icon" aria-hidden="true"><UiIcon name="activity" /></span><div><h2>Recent activity</h2><p class="muted">Updates from your clinic record.</p></div></div></div><div v-if="!data.recent_activity.length" class="empty-state"><p>New appointment and visit updates will appear here.</p></div><div v-else class="activity-list"><article v-for="(item,index) in data.recent_activity" :key="`${item.activity_type}-${item.appointment_id}-${item.activity_date}-${index}`"><span class="activity-dot" :class="`activity-${item.activity_type}`"></span><div><strong>{{ item.description }}</strong><p>{{ formatActivityDate(item.activity_date) }}<span v-if="item.status"> · {{ item.status.replace('_',' ') }}</span></p></div></article></div></section></section>

    <section class="surface feature-state patient-history"><div class="section-heading"><div class="patient-section-heading"><span class="patient-section-icon" aria-hidden="true"><UiIcon name="clipboard-list" /></span><div><h2>Recent appointments</h2><p class="muted">Your latest bookings and their status.</p></div></div><RouterLink class="text-link" to="/patient/appointments">View history <UiIcon name="arrow-right" /></RouterLink></div><div v-if="!data.appointments.length" class="empty-state"><strong>No appointments yet</strong><p>Your appointment history will appear here.</p><RouterLink to="/patient/book">Choose a service and time</RouterLink></div><div v-else class="appointment-list patient-history-list"><article v-for="item in data.appointments" :key="item.appointment_id" class="appointment-card patient-history-card"><span class="patient-history-date"><strong>{{ dayOfMonth(item.appt_date) }}</strong><small>{{ monthOfDate(item.appt_date) }}</small></span><div class="patient-history-copy"><strong>{{ item.service_name }}</strong><p>{{ formatDate(item.appt_date) }} at {{ item.appt_time }} · {{ item.dentist || 'Dentist to be assigned' }}</p></div><span class="status-badge" :class="`status-${item.status}`">{{ item.status.replace('_',' ') }}</span></article></div></section>
  </template>
  </div>
</template>

<style scoped>
.patient-welcome {
  position: relative;
  overflow: hidden;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
  padding: 23px 25px;
  border: 1px solid #e3efe8;
  border-radius: 20px;
  background: linear-gradient(112deg, #fff 0%, #f2faf5 70%, #f2f1ff 100%);
  box-shadow: 0 12px 30px rgb(53 82 66 / 6%);
}

.patient-welcome::after {
  position: absolute;
  top: -88px;
  right: 12%;
  width: 210px;
  height: 210px;
  border-radius: 50%;
  background: rgb(111 190 150 / 9%);
  content: '';
  pointer-events: none;
}

.welcome-copy,
.patient-welcome > .button {
  position: relative;
  z-index: 1;
}

.patient-welcome .eyebrow {
  margin: 0 0 4px;
  color: #578875;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.35px;
}

.patient-welcome h1 {
  margin: 0;
  font-size: clamp(24px, 2.2vw, 30px);
  letter-spacing: -0.7px;
}

.patient-welcome .muted {
  margin: 5px 0 0;
  font-size: 13px;
}

.patient-summary {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
  margin: 0 0 17px;
}

.patient-summary .stat-card {
  min-height: 120px;
  padding: 16px 18px;
}

.patient-summary .stat-card p {
  margin: 9px 0 1px;
}

.patient-summary .stat-card strong {
  font-size: 27px;
}

.balance-number {
  font-size: 23.8px !important;
}

.dashboard-page :deep(.stat-icon) {
  background: #e7f5ee;
  color: #438d75;
}

.patient-upcoming {
  padding: 0 21px 8px;
  border-color: #e4ede8;
}

.patient-upcoming .section-heading,
.patient-activity .section-heading {
  padding: 18px 0 13px;
}

.patient-upcoming .section-heading h2,
.patient-activity .section-heading h2 {
  margin: 0;
  font-size: 16px;
}

.patient-upcoming .section-heading p,
.patient-activity .section-heading p {
  margin: 3px 0 0;
  font-size: 11.9px;
}

.patient-section-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.patient-section-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border: 1px solid #dceee3;
  border-radius: 12px;
  background: #edf8f2;
  color: #438d75;
}

.patient-upcoming .appointment-list {
  gap: 9px;
  padding: 1px 0 8px;
  border-top: 0;
}

.patient-upcoming .appointment-card {
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid #e1ece5;
  border-radius: 15px;
  background: linear-gradient(110deg, #fbfefc, #f5faf7);
}

.patient-upcoming .appointment-card:hover {
  border-color: #b6d8c4;
  background: linear-gradient(110deg, #f5fbf7, #f2f6fc);
}

.visit-date {
  display: grid;
  width: 48px;
  height: 50px;
  flex: 0 0 48px;
  place-content: center;
  border: 1px solid #dceee3;
  border-radius: 14px;
  background: #e7f5ee;
  color: #367d60;
  text-align: center;
}

.visit-date strong {
  font-size: 18px;
  line-height: 1;
}

.visit-date small {
  margin-top: 3px;
  font-size: 9.7px;
  text-transform: uppercase;
}

.visit-detail {
  min-width: 0;
  flex: 1;
}

.visit-detail > strong {
  color: var(--ink);
  font-size: 12.5px;
}

.visit-detail p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.patient-upcoming .status-badge {
  padding: 6px 11px;
  border-radius: 999px;
}

.patient-lower-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  margin: 17px 0;
}

.patient-lower-grid > .surface {
  min-width: 0;
}

.patient-activity {
  padding: 0 20px 14px;
}

.dashboard-chart {
  padding: 19px 20px;
}

.dashboard-chart h2 {
  margin: 0 0 14px;
  font-size: 16px;
}

.dashboard-chart .report-chart {
  height: 240px;
}

.history-empty {
  display: flex;
  min-height: 133px;
  align-items: center;
  gap: 13px;
  padding: 17px;
  border: 1px dashed #dce9e1;
  border-radius: 15px;
  background: linear-gradient(120deg, #f8fcf9, #fbfaff);
}

.history-empty-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  place-items: center;
  border-radius: 13px;
  background: #e7f5ee;
  color: #438d75;
}

.history-empty strong {
  color: #3a5264;
  font-size: 12px;
}

.history-empty p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
}

.activity-list {
  display: grid;
  gap: 2px;
  padding-bottom: 4px;
}

.activity-list article {
  position: relative;
  display: flex;
  gap: 13px;
  padding: 11px 8px;
  border: 0;
  border-radius: 11px;
  background: transparent;
}

.activity-list article:not(:last-child)::before {
  position: absolute;
  top: 21px;
  bottom: -13px;
  left: 12px;
  width: 2px;
  border-radius: 2px;
  background: #dceee3;
  content: '';
}

.activity-dot {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
  margin: 3px 0 0;
  border-radius: 50%;
  background: #438d75;
  box-shadow: 0 0 0 4px #e7f5ee;
}

.activity-treatment {
  background: #438d75;
  box-shadow: 0 0 0 4px #e7f5ee;
}

.activity-payment {
  background: #438d75;
  box-shadow: 0 0 0 4px #e7f5ee;
}

.activity-list strong {
  color: #42576d;
  font-size: 11.9px;
  font-weight: 650;
}

.activity-list p {
  margin: 3px 0 0;
  color: #909bad;
  font-size: 10.8px;
}

.patient-history {
  padding: 0 21px 9px;
}

.patient-history .section-heading {
  padding: 18px 0 14px;
}

.patient-history-list {
  gap: 9px;
  padding: 1px 0 8px;
}

.patient-history-card {
  align-items: center;
  gap: 13px;
  padding: 12px 14px;
  border: 1px solid #e1ece5;
  border-radius: 15px;
  background: linear-gradient(110deg, #fbfefc, #f5faf7);
}

.patient-history-card:hover {
  border-color: #b6d8c4;
  background: linear-gradient(110deg, #f5fbf7, #f2f6fc);
}

.patient-history-date {
  display: grid;
  width: 46px;
  height: 48px;
  flex: 0 0 46px;
  place-content: center;
  border: 1px solid #dceee3;
  border-radius: 13px;
  background: #e7f5ee;
  color: #367d60;
  text-align: center;
}

.patient-history-date strong {
  font-size: 17px;
  line-height: 1;
}

.patient-history-date small {
  margin-top: 3px;
  font-size: 9px;
  text-transform: uppercase;
}

.patient-history-copy {
  min-width: 0;
  flex: 1;
}

.patient-history-copy strong {
  color: var(--ink);
  font-size: 12px;
}

.patient-history-copy p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.5;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-welcome) {
  border-color: #293d37;
  background: linear-gradient(112deg, #182a28 0%, #1c302b 70%, #28273b 100%);
  box-shadow: 0 12px 30px rgb(0 0 0 / 14%);
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-welcome::after) {
  background: rgb(111 190 150 / 10%);
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-welcome .eyebrow) {
  color: #9bd1b4;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .history-empty) {
  border-color: #344a40;
  background: linear-gradient(120deg, #1d302b, #25263a);
}

:global(.app-shell[data-theme='dark'] .dashboard-page .history-empty-icon),
:global(.app-shell[data-theme='dark'] .dashboard-page .stat-icon),
:global(.app-shell[data-theme='dark'] .dashboard-page .patient-section-icon) {
  background: #294b3b;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .history-empty strong),
:global(.app-shell[data-theme='dark'] .dashboard-page .activity-list strong) {
  color: #e1e9f1;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-history-card) {
  border-color: #354a40;
  background: linear-gradient(110deg, #1d2c26, #202f29);
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-history-card:hover) {
  border-color: #52775f;
  background: linear-gradient(110deg, #22382d, #202f29);
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-history-date) {
  border-color: #3c5949;
  background: #294b3b;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-upcoming .appointment-card) {
  border-color: #354a40;
  background: linear-gradient(110deg, #1d2c26, #202f29);
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-upcoming .appointment-card:hover) {
  border-color: #52775f;
  background: linear-gradient(110deg, #22382d, #202f29);
}

:global(.app-shell[data-theme='dark'] .dashboard-page .visit-date) {
  border-color: #3c5949;
  background: #294b3b;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .patient-activity .activity-list article) {
  border: 0;
  background: transparent;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .activity-list article:not(:last-child)::before) {
  background: #3c5949;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .activity-dot),
:global(.app-shell[data-theme='dark'] .dashboard-page .activity-treatment),
:global(.app-shell[data-theme='dark'] .dashboard-page .activity-payment) {
  background: #73bd92;
  box-shadow: 0 0 0 4px #294b3b;
}

@media (max-width: 900px) {
  .patient-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 650px) {
  .patient-welcome {
    align-items: flex-start;
    flex-direction: column;
    padding: 20px;
  }

  .patient-welcome > .button {
    width: 100%;
    justify-content: center;
  }

  .dashboard-shortcuts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-shortcuts .dashboard-shortcut:last-child {
    grid-column: 1 / -1;
  }

  .dashboard-shortcuts .dashboard-shortcut > .stat-icon {
    position: static;
    inset: auto;
    flex: 0 0 32px;
  }

  .dashboard-shortcuts .dashboard-shortcut {
    gap: 9px;
    padding: 11px;
  }

  .dashboard-page .patient-summary .stat-card {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    align-content: center;
    gap: 4px 9px;
    min-height: 112px;
    padding: 13px;
  }

  .dashboard-page .patient-summary .stat-card > .stat-icon {
    position: static;
    grid-column: 1;
    grid-row: 1 / span 3;
    align-self: start;
    inset: auto;
  }

  .dashboard-page .patient-summary .stat-card > p,
  .dashboard-page .patient-summary .stat-card > strong,
  .dashboard-page .patient-summary .stat-card > small {
    grid-column: 2;
    min-width: 0;
  }

  .dashboard-page .patient-summary .stat-card > p {
    margin: 0;
    line-height: 1.35;
  }

  .dashboard-page .patient-summary .stat-card > strong {
    overflow-wrap: anywhere;
    font-size: 20px;
  }

  .dashboard-page .patient-summary .stat-card > small {
    line-height: 1.4;
  }

  .patient-upcoming {
    padding: 0 14px 7px;
  }

  .patient-upcoming .section-heading {
    align-items: flex-start;
    gap: 10px;
  }

  .patient-upcoming .section-heading > div {
    min-width: 0;
  }

  .patient-upcoming .section-heading .text-link {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .patient-history {
    padding: 0 14px 8px;
  }

  .patient-history .section-heading {
    align-items: flex-start;
    gap: 10px;
  }

  .patient-history .section-heading > div {
    min-width: 0;
  }

  .patient-history .section-heading .text-link {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .patient-history-card {
    gap: 10px;
    padding: 10px;
  }

  .patient-history-copy p {
    white-space: normal;
  }

  .patient-lower-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 380px) {
  .dashboard-page .page-heading h1 {
    font-size: 23px;
  }

  .dashboard-page .patient-summary .stat-card {
    grid-template-columns: 27px minmax(0, 1fr);
    gap: 4px 7px;
    padding: 11px;
  }

  .dashboard-page .patient-summary .stat-card > .stat-icon {
    width: 27px;
    height: 27px;
    font-size: 16px;
  }

  .dashboard-page .patient-summary .stat-card > strong {
    font-size: 18px;
  }

  .dashboard-shortcuts {
    grid-template-columns: 1fr;
  }

  .dashboard-shortcuts .dashboard-shortcut:last-child {
    grid-column: auto;
  }

  .patient-upcoming .section-heading {
    flex-direction: column;
  }
}
</style>
