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
  <section class="page-heading"><div><p class="eyebrow"></p><h1>Welcome{{ data ? `, ${data.patient.first_name}` : '' }}</h1><p class="muted">Your upcoming appointments, payments, and dental care updates.</p></div><RouterLink class="button button-primary" to="/patient/book">Book appointment <UiIcon name="arrow-right" /></RouterLink></section>
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

    <section class="surface feature-state patient-upcoming"><div class="section-heading"><div><h2>Your next visits</h2><p class="muted">Your upcoming bookings, straight from the clinic schedule.</p></div><RouterLink class="text-link" to="/patient/appointments">All appointments <UiIcon name="arrow-right" /></RouterLink></div>
      <div v-if="!upcoming.length" class="empty-state"><strong>No upcoming visits</strong><p>Ready to plan your next checkup?</p><RouterLink class="button button-primary" to="/patient/book">Find an appointment</RouterLink></div>
      <div v-else class="appointment-list"><article v-for="item in upcoming" :key="item.appointment_id" class="appointment-card"><span class="visit-date"><strong>{{ dayOfMonth(item.appt_date) }}</strong><small>{{ monthOfDate(item.appt_date) }}</small></span><div class="visit-detail"><strong>{{ item.service_name }}</strong><p>{{ formatDate(item.appt_date) }} at {{ item.appt_time }} · {{ item.dentist || 'Dentist to be assigned' }}</p></div><span class="status-badge" :class="`status-${item.status}`">{{ item.status }}</span></article></div>
    </section>

    <section class="patient-lower-grid"><section class="surface report-card dashboard-chart"><h2>Your visit history</h2><p v-if="!data.appointment_history.length" class="muted">Completed visits will appear here.</p><div v-else class="report-chart"><canvas ref="chartCanvas" /></div></section>
    <section class="surface feature-state patient-activity"><div class="section-heading"><div><h2>Recent activity</h2><p class="muted">Updates from your clinic record.</p></div></div><div v-if="!data.recent_activity.length" class="empty-state"><p>New appointment and visit updates will appear here.</p></div><div v-else class="activity-list"><article v-for="(item,index) in data.recent_activity" :key="`${item.activity_type}-${item.appointment_id}-${item.activity_date}-${index}`"><span class="activity-dot" :class="`activity-${item.activity_type}`"></span><div><strong>{{ item.description }}</strong><p>{{ formatActivityDate(item.activity_date) }}<span v-if="item.status"> · {{ item.status.replace('_',' ') }}</span></p></div></article></div></section></section>

    <section class="surface feature-state"><div class="section-heading"><div><h2>Recent appointments</h2><p class="muted">Your appointment history</p></div><RouterLink class="text-link" to="/patient/appointments">View history <UiIcon name="arrow-right" /></RouterLink></div><div v-if="!data.appointments.length" class="empty-state"><strong>No appointments yet</strong><p>Your appointment history will appear here.</p><RouterLink to="/patient/book">Choose a service and time</RouterLink></div><div v-else class="appointment-list"><article v-for="item in data.appointments" :key="item.appointment_id" class="appointment-card"><div><strong>{{ item.service_name }}</strong><p>{{ formatDate(item.appt_date) }} at {{ item.appt_time }} · {{ item.dentist || 'Dentist to be assigned' }}</p></div><span class="status-badge" :class="`status-${item.status}`">{{ item.status.replace('_',' ') }}</span></article></div></section>
  </template>
  </div>
</template>

<style scoped>
.dashboard-page :deep(.stat-icon-green),
.dashboard-page :deep(.stat-icon-blue),
.dashboard-page :deep(.stat-icon-amber) {
  background: #e7f5ee;
  color: #379a6b;
}

:global(.app-shell[data-theme='dark'] .dashboard-page .stat-icon-green),
:global(.app-shell[data-theme='dark'] .dashboard-page .stat-icon-blue),
:global(.app-shell[data-theme='dark'] .dashboard-page .stat-icon-amber) {
  background: #294b3b;
  color: #a4e2ba;
}

.patient-summary{grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 18px}.patient-summary .stat-card{min-height:126px}.balance-number{font-size:23.8px!important}.patient-upcoming{padding:0 21px 8px}.patient-upcoming .section-heading,.patient-activity .section-heading{padding:19px 0 13px}.patient-upcoming .section-heading h2,.patient-activity .section-heading h2{margin:0;font-size:16.2px}.patient-upcoming .section-heading p,.patient-activity .section-heading p{margin:3px 0 0;font-size:11.9px}.appointment-card{align-items:center}.visit-date{display:grid;width:42px;height:46px;flex:none;place-content:center;border-radius:12px;background:#edf8f2;color:#367d60;text-align:center}.visit-date strong{font-size:18.4px;line-height:1}.visit-date small{font-size:9.7px;text-transform:uppercase}.visit-detail{flex:1}.patient-lower-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:17px;margin:18px 0}.patient-lower-grid>.surface{min-width:0}.patient-activity{padding:0 20px 15px}.activity-list{display:grid}.activity-list article{display:flex;gap:11px;padding:12px 0;border-top:1px solid #edf0f4}.activity-dot{width:8px;height:8px;flex:none;margin-top:5px;border-radius:50%;background:#65ad8b;box-shadow:0 0 0 4px #e9f6ee}.activity-treatment{background:#8c7abc;box-shadow:0 0 0 4px #f0edfa}.activity-payment{background:#d3a24e;box-shadow:0 0 0 4px #fcf4e7}.activity-list strong{color:#42576d;font-size:11.9px;font-weight:650}.activity-list p{margin:3px 0 0;color:#909bad;font-size:10.8px}.dashboard-chart h2{margin:0 0 5px;font-size:16.2px}.dashboard-chart>.muted{font-size:11.9px}@media(max-width:900px){.patient-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.patient-lower-grid{grid-template-columns:1fr}.patient-summary{gap:10px}.patient-summary .stat-card{min-height:112px;padding:15px}.balance-number{font-size:20.5px!important}.patient-upcoming{padding:0 14px 7px}.patient-upcoming .section-heading{gap:10px}.visit-detail p{font-size:10.8px}}

@media (max-width: 650px) {
  .dashboard-shortcuts .dashboard-shortcut > .stat-icon {
    position: static;
    inset: auto;
    flex: 0 0 32px;
  }

  .dashboard-shortcuts .dashboard-shortcut {
    gap: 10px;
    padding: 12px;
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

  .patient-upcoming .section-heading {
    align-items: flex-start;
  }

  .patient-upcoming .section-heading > div {
    min-width: 0;
  }

  .patient-upcoming .section-heading .text-link {
    flex: 0 0 auto;
    white-space: nowrap;
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

  .patient-upcoming .section-heading {
    flex-direction: column;
  }
}
</style>
