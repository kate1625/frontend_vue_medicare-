<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError, getApiData } from '../services/api'
import UiIcon from '../components/UiIcon.vue'

let ChartConstructor: typeof import('chart.js').Chart | undefined
async function loadChart() {
  if (!ChartConstructor) {
    const mod = await import('chart.js')
    mod.Chart.register(...mod.registerables)
    ChartConstructor = mod.Chart
  }
  return { Chart: ChartConstructor }
}

const props = defineProps<{ pageNumber: number }>()

interface Count {
  status: string
  total: number
}

interface StaffData {
  patients: number
  appointments: { total: number; pending: number; confirmed: number; completed: number }
  upcoming: {
    appointment_id: number
    appt_date: string
    appt_time: string
    status: string
    service_name: string
    patient_name: string
  }[]
  appointments_by_status: Count[]
  appointments_by_day: { day_name: string; total: number }[]
}

interface AdminData {
  users: number
  patients: number
  dentists: number
  active_services: number
  pending_payments: number
  outstanding_balance: number | string
  appointments_by_status: Count[]
  verified_revenue_by_month: { month: string; total: number }[]
  appointments_by_service: { service_name: string; total: number }[]
}

const loading = ref(true)
const error = ref('')
const staff = ref<StaffData | null>(null)
const admin = ref<AdminData | null>(null)
const isAdmin = computed(() => props.pageNumber === 22)
const statusCanvas = ref<HTMLCanvasElement | null>(null)
const activityCanvas = ref<HTMLCanvasElement | null>(null)
const revenueCanvas = ref<HTMLCanvasElement | null>(null)
const serviceCanvas = ref<HTMLCanvasElement | null>(null)
let charts: { destroy(): void; resize?: () => void }[] = []

function chartTheme() {
  const styles = getComputedStyle(document.documentElement)
  return {
    text: styles.getPropertyValue('--chart-text').trim(),
    grid: styles.getPropertyValue('--chart-grid').trim(),
  }
}

async function renderCharts() {
  charts.forEach((chart) => chart.destroy())
  charts = []

  const { Chart } = await loadChart()

  const colors = ['#438d75', '#efb454', '#77a7c8', '#d76d6d', '#82919b']
  const theme = chartTheme()
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: theme.text } } },
    scales: {
      x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
      y: { beginAtZero: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
    },
  }
  const statusRows = admin.value?.appointments_by_status ?? staff.value?.appointments_by_status ?? []

  if (statusCanvas.value && statusRows.length) {
    charts.push(new Chart(statusCanvas.value, {
      type: 'doughnut',
      data: {
        labels: statusRows.map((row) => row.status),
        datasets: [{ data: statusRows.map((row) => Number(row.total)), backgroundColor: colors }],
      },
      options: { ...baseOptions, scales: {} },
    }))
  }

  if (isAdmin.value && admin.value) {
    if (revenueCanvas.value && admin.value.verified_revenue_by_month.length) {
      charts.push(new Chart(revenueCanvas.value, {
        type: 'line',
        data: {
          labels: admin.value.verified_revenue_by_month.map((row) => row.month),
          datasets: [{
            label: 'Verified revenue (PHP)',
            data: admin.value.verified_revenue_by_month.map((row) => Number(row.total)),
            borderColor: '#438d75',
            backgroundColor: '#438d7522',
            fill: true,
            tension: 0.3,
          }],
        },
        options: baseOptions,
      }))
    }

    if (serviceCanvas.value && admin.value.appointments_by_service.length) {
      charts.push(new Chart(serviceCanvas.value, {
        type: 'bar',
        data: {
          labels: admin.value.appointments_by_service.map((row) => row.service_name),
          datasets: [{
            label: 'Appointments',
            data: admin.value.appointments_by_service.map((row) => Number(row.total)),
            backgroundColor: '#438d75',
            borderRadius: 6,
          }],
        },
        options: {
          ...baseOptions,
          indexAxis: 'y',
          scales: {
            x: {
              beginAtZero: true,
              ticks: { color: theme.text, precision: 0 },
              grid: { color: theme.grid },
            },
            y: {
              ticks: { color: theme.text },
              grid: { display: false },
            },
          },
        },
      }))
    }
  } else if (activityCanvas.value && staff.value?.appointments_by_day.length) {
    charts.push(new Chart(activityCanvas.value, {
      type: 'bar',
      data: {
        labels: staff.value.appointments_by_day.map((row) => row.day_name),
        datasets: [{
          label: 'Appointments',
          data: staff.value.appointments_by_day.map((row) => Number(row.total)),
          backgroundColor: '#438d75',
          borderRadius: 6,
        }],
      },
      options: {
        ...baseOptions,
        scales: { ...baseOptions.scales, y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, precision: 0 } } },
      },
    }))
  }
}

function onThemeChange() {
  renderCharts()
}

onMounted(async () => {
  window.addEventListener('medicare:theme-change', onThemeChange)
  try {
    if (isAdmin.value) admin.value = await getApiData<AdminData>('/api/admin/dashboard')
    else staff.value = await getApiData<StaffData>('/api/staff/dashboard')
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load the clinic dashboard.'
  } finally {
    loading.value = false
  }
  if (!error.value) {
    await nextTick()
    renderCharts()
  }
})
onActivated(() => {
  if (charts.length) void nextTick().then(() => charts.forEach((chart) => chart.resize?.()))
})

onBeforeUnmount(() => {
  window.removeEventListener('medicare:theme-change', onThemeChange)
  charts.forEach((chart) => chart.destroy())
})
</script>

<template>
  <div class="dashboard-page" :class="{ 'admin-dashboard': isAdmin }">
    <section class="page-heading">
      <div>
        <p class="eyebrow">{{ isAdmin ? 'CLINIC OVERVIEW' : 'STAFF OVERVIEW' }}</p>
        <h1>{{ isAdmin ? 'Admin Dashboard' : 'Staff Dashboard' }}</h1>
        <p class="muted">Live clinic totals and activity from the clinic database.</p>
      </div>
      <RouterLink class="button button-primary" :to="isAdmin ? '/admin/reports' : '/staff/appointments'">
        {{ isAdmin ? 'View reports' : 'Manage appointments' }} <UiIcon name="arrow-right" />
      </RouterLink>
    </section>

    <section v-if="loading" class="dashboard-loading" role="status" aria-label="Loading dashboard">
      <div class="stats-grid dashboard-skeleton-stats" aria-hidden="true">
        <article v-for="index in (isAdmin ? 6 : 4)" :key="index" class="stat-card dashboard-skeleton-card">
          <span class="dashboard-skeleton-shape dashboard-skeleton-icon" />
          <span class="dashboard-skeleton-shape dashboard-skeleton-label" />
          <span class="dashboard-skeleton-shape dashboard-skeleton-value" />
          <span v-if="index === 1 || !isAdmin" class="dashboard-skeleton-shape dashboard-skeleton-note" />
        </article>
      </div>

      <div v-if="isAdmin" class="dashboard-shortcuts dashboard-skeleton-shortcuts" aria-hidden="true">
        <div v-for="index in 3" :key="index" class="dashboard-shortcut dashboard-skeleton-shortcut">
          <span class="dashboard-skeleton-shape dashboard-skeleton-shortcut-icon" />
          <span class="dashboard-skeleton-shortcut-copy">
            <span class="dashboard-skeleton-shape dashboard-skeleton-shortcut-title" />
            <span class="dashboard-skeleton-shape dashboard-skeleton-shortcut-note" />
          </span>
        </div>
      </div>

      <div class="report-grid dashboard-skeleton-reports" aria-hidden="true">
        <article
          v-for="index in (isAdmin ? 3 : 2)"
          :key="index"
          class="surface report-card dashboard-skeleton-report"
        >
          <span class="dashboard-skeleton-shape dashboard-skeleton-report-title" />
          <div class="dashboard-skeleton-plot" :class="{ 'is-donut': index === 1 }">
            <span v-if="index === 1" class="dashboard-skeleton-donut" />
            <div v-else class="dashboard-skeleton-bars">
              <i v-for="bar in 6" :key="bar" />
            </div>
          </div>
        </article>
      </div>

      <section v-if="!isAdmin" class="surface dashboard-skeleton-upcoming" aria-hidden="true">
        <span class="dashboard-skeleton-shape dashboard-skeleton-report-title" />
        <div v-for="index in 2" :key="index" class="dashboard-skeleton-appointment">
          <span class="dashboard-skeleton-shape dashboard-skeleton-appointment-copy" />
          <span class="dashboard-skeleton-shape dashboard-skeleton-appointment-action" />
        </div>
      </section>
    </section>
    <section v-else-if="error" class="surface empty-state"><strong>Dashboard unavailable</strong><p>{{ error }}</p></section>

    <template v-else-if="admin">
      <div class="stats-grid">
        <article class="stat-card"><span class="stat-icon stat-icon-green"><UiIcon name="users-round" /></span><p>Active patient records</p><strong>{{ admin.patients }}</strong></article>
        <article class="stat-card"><span class="stat-icon stat-icon-green"><UiIcon name="stethoscope" /></span><p>Active dentists</p><strong>{{ admin.dentists }}</strong></article>
        <article class="stat-card"><span class="stat-icon stat-icon-green"><UiIcon name="user-round" /></span><p>Accounts</p><strong>{{ admin.users }}</strong></article>
        <article class="stat-card"><span class="stat-icon stat-icon-green"><UiIcon name="briefcase-medical" /></span><p>Active services</p><strong>{{ admin.active_services }}</strong></article>
        <article class="stat-card stat-card-balance"><span class="stat-icon stat-icon-green"><UiIcon name="wallet" /></span><p>Unpaid appointment charges</p><strong>{{ Number(admin.outstanding_balance).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) }}</strong><small>Calculated from service fees less verified payments</small></article>
        <article class="stat-card"><span class="stat-icon stat-icon-green"><UiIcon name="credit-card-check" /></span><p>Payments to verify</p><strong>{{ admin.pending_payments }}</strong></article>
      </div>

      <section class="dashboard-shortcuts" aria-label="Admin quick actions">
        <RouterLink class="dashboard-shortcut" to="/admin/users"><span class="stat-icon stat-icon-green"><UiIcon name="users-round" /></span><span><strong>Manage users</strong><small>Review staff and patient accounts</small></span><UiIcon class="shortcut-arrow" name="arrow-right" /></RouterLink>
        <RouterLink class="dashboard-shortcut" to="/admin/services"><span class="stat-icon stat-icon-green"><UiIcon name="briefcase-medical" /></span><span><strong>Clinic services</strong><small>Update available treatments</small></span><UiIcon class="shortcut-arrow" name="arrow-right" /></RouterLink>
        <RouterLink class="dashboard-shortcut" to="/staff/payments"><span class="stat-icon stat-icon-green"><UiIcon name="credit-card-check" /></span><span><strong>Verify payments</strong><small>{{ admin.pending_payments }} awaiting review</small></span><UiIcon class="shortcut-arrow" name="arrow-right" /></RouterLink>
      </section>

      <section class="report-grid">
        <article class="surface report-card"><h2>Appointments by status</h2><p v-if="!admin.appointments_by_status.length" class="muted">No appointment activity yet.</p><div v-else class="report-chart"><canvas ref="statusCanvas" /></div></article>
        <article class="surface report-card"><h2>Verified monthly revenue</h2><p v-if="!admin.verified_revenue_by_month.length" class="muted">No verified payment activity yet.</p><div v-else class="report-chart"><canvas ref="revenueCanvas" /></div></article>
        <article class="surface report-card"><h2>Appointments per service</h2><p v-if="!admin.appointments_by_service.length" class="muted">No services yet.</p><div v-else class="report-chart" :style="{ height: `${Math.max(260, admin.appointments_by_service.length * 38)}px` }"><canvas ref="serviceCanvas" /></div></article>
      </section>
    </template>

    <template v-else-if="staff">
      <div class="stats-grid">
        <article class="stat-card"><span class="stat-icon stat-icon-blue"><UiIcon name="users-round" /></span><p>Patients</p><strong>{{ staff.patients }}</strong><small>Active records</small></article>
        <article class="stat-card"><span class="stat-icon stat-icon-blue"><UiIcon name="calendar" /></span><p>Total appointments</p><strong>{{ staff.appointments.total }}</strong></article>
        <article class="stat-card"><span class="stat-icon stat-icon-amber"><UiIcon name="clock" /></span><p>Pending</p><strong>{{ staff.appointments.pending || 0 }}</strong></article>
        <article class="stat-card"><span class="stat-icon stat-icon-green"><UiIcon name="check-circle" /></span><p>Confirmed</p><strong>{{ staff.appointments.confirmed || 0 }}</strong></article>
      </div>
      <section class="report-grid">
        <article class="surface report-card"><h2>Appointment status</h2><p v-if="!staff.appointments_by_status.length" class="muted">No appointment activity yet.</p><div v-else class="report-chart"><canvas ref="statusCanvas" /></div></article>
        <article class="surface report-card"><h2>Recent daily appointments</h2><p v-if="!staff.appointments_by_day.length" class="muted">No appointments in the past week.</p><div v-else class="report-chart"><canvas ref="activityCanvas" /></div></article>
      </section>
      <section class="surface feature-state"><h2>Upcoming appointments</h2><p v-if="!staff.upcoming.length" class="muted">No upcoming appointments.</p><div v-else class="appointment-list"><article v-for="appointment in staff.upcoming" :key="appointment.appointment_id" class="appointment-card"><div><strong>{{ appointment.patient_name }} · {{ appointment.service_name }}</strong><p>{{ appointment.appt_date }} {{ appointment.appt_time }}</p></div><RouterLink :to="`/staff/appointments/${appointment.appointment_id}`">Review</RouterLink></article></div></section>
    </template>
  </div>
</template>

<style scoped>
.admin-dashboard > .page-heading {
  margin-bottom: 20px;
}

.admin-dashboard > .page-heading .eyebrow {
  margin: 0 0 5px;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.2px;
}

.admin-dashboard > .page-heading h1 {
  margin-top: 0;
  margin-bottom: 4px;
  letter-spacing: -0.65px;
}

.admin-dashboard > .page-heading .muted {
  margin-top: 0;
  font-size: 13px;
}

.admin-dashboard > .stats-grid {
  gap: 14px;
  margin-bottom: 17px;
}

.admin-dashboard > .stats-grid .stat-card {
  position: relative;
  overflow: hidden;
  min-height: 124px;
  padding: 17px 19px;
  border: 1px solid var(--line);
  border-radius: 17px;
  background: linear-gradient(145deg, var(--surface), color-mix(in srgb, var(--surface) 92%, #e8f4ec));
  box-shadow: var(--shadow);
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}

.admin-dashboard > .stats-grid .stat-card::before {
  position: absolute;
  top: 0;
  left: 19px;
  width: 36px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: #438d75;
  content: '';
}

.admin-dashboard > .stats-grid .stat-card:hover {
  transform: translateY(-2px);
  border-color: #b7d9c6;
  box-shadow: 0 15px 32px rgb(39 70 56 / 10%);
}

.admin-dashboard > .stats-grid .stat-card > .stat-icon,
.admin-dashboard .dashboard-shortcut .stat-icon {
  width: 36px;
  height: 36px;
  border: 1px solid #dceee3;
  border-radius: 12px;
  background: #e8f4ec;
  color: #438d75;
}

.admin-dashboard > .stats-grid .stat-card > p {
  margin: 10px 0 2px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}

.admin-dashboard > .stats-grid .stat-card > strong {
  color: var(--ink);
  font-size: clamp(24px, 2vw, 29px);
  letter-spacing: -0.7px;
}

.admin-dashboard > .stats-grid .stat-card > small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.45;
}

.admin-dashboard > .stats-grid .stat-card-balance > strong {
  font-size: clamp(20px, 1.8vw, 25px);
}

.admin-dashboard .dashboard-shortcuts {
  gap: 12px;
  margin-bottom: 17px;
}

.admin-dashboard .dashboard-shortcut {
  min-height: 62px;
  border-color: var(--line);
  border-radius: 14px;
  box-shadow: 0 7px 20px rgb(39 70 56 / 5%);
}

.admin-dashboard .dashboard-shortcut .stat-icon {
  flex: 0 0 36px;
}

.admin-dashboard .dashboard-shortcut .shortcut-arrow {
  color: #438d75;
}

.admin-dashboard .dashboard-shortcut:focus-visible {
  outline: 3px solid rgb(67 141 117 / 28%);
  outline-offset: 2px;
}

.admin-dashboard .report-grid {
  gap: 15px;
}

.admin-dashboard .report-card {
  padding: 20px;
}

.admin-dashboard .report-card h2 {
  margin-bottom: 14px;
  padding-bottom: 12px;
  font-size: 15px;
}

.admin-dashboard .report-chart {
  height: 260px;
}

:global(:root[data-theme='dark'] .admin-dashboard > .stats-grid .stat-card) {
  border-color: #334741;
  background: linear-gradient(145deg, #202e2a, #1d2b26);
}

:global(:root[data-theme='dark'] .admin-dashboard > .stats-grid .stat-card::before) {
  background: #73bd92;
}

:global(:root[data-theme='dark'] .admin-dashboard > .stats-grid .stat-card:hover) {
  border-color: #52775f;
  box-shadow: 0 15px 32px rgb(0 0 0 / 20%);
}

:global(:root[data-theme='dark'] .admin-dashboard > .stats-grid .stat-card > .stat-icon),
:global(:root[data-theme='dark'] .admin-dashboard .dashboard-shortcut .stat-icon) {
  border-color: #3c5949;
  background: #294b3b;
  color: #a4e2ba;
}

:global(:root[data-theme='dark'] .admin-dashboard .dashboard-shortcut .shortcut-arrow) {
  color: #a4e2ba;
}

:global(:root[data-theme='dark'] .admin-dashboard .dashboard-shortcut:focus-visible) {
  outline-color: rgb(164 226 186 / 35%);
}

@media (max-width: 700px) {
  .admin-dashboard > .stats-grid .stat-card {
    min-height: 126px;
    padding: 15px 13px 14px 54px;
  }

  .admin-dashboard > .stats-grid .stat-card > .stat-icon {
    top: 16px;
    left: 13px;
    width: 32px;
    height: 32px;
  }

  .admin-dashboard > .stats-grid .stat-card > p {
    min-height: 34px;
    margin: 0 0 4px;
    font-size: 12px;
    line-height: 1.4;
  }

  .admin-dashboard > .stats-grid .stat-card > strong {
    overflow-wrap: anywhere;
    font-size: clamp(20px, 5vw, 25px);
    line-height: 1.2;
  }

  .admin-dashboard > .stats-grid .stat-card > small {
    margin-top: 6px;
    font-size: 10px;
  }
}

@media (max-width: 360px) {
  .admin-dashboard > .stats-grid .stat-card {
    padding-left: 54px;
  }
}
</style>
