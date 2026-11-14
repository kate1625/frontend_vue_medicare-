<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError, getApiData } from '../services/api'
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

async function loadPdf() {
  const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF: jspdfMod.default, autoTable: autoTableMod.default }
}

type ReportValue = string | number | boolean | null
type ReportRow = Record<string, ReportValue>

interface Reports {
  filters: { from: string; to: string }
  appointments_by_status: { status: string; total: number | string }[]
  verified_revenue_by_month: { month: string; total: number | string }[]
  appointments_by_service: { service_name: string; total: number | string }[]
  patients: ReportRow[]
  appointments: ReportRow[]
  schedules: ReportRow[]
  prescriptions: ReportRow[]
  treatments: ReportRow[]
  payments: ReportRow[]
  services: ReportRow[]
  email_notifications: ReportRow[]
  audit_logs: ReportRow[]
  users: ReportRow[]
}

interface ReportSection {
  key: keyof Pick<Reports, 'patients' | 'appointments' | 'schedules' | 'prescriptions' | 'treatments' | 'payments' | 'services' | 'email_notifications' | 'audit_logs' | 'users'>
  title: string
  description: string
  columns: { key: string; label: string }[]
}

const reportSections: ReportSection[] = [
  {
    key: 'patients',
    title: 'Patient directory',
    description: 'Patient contact and registration status.',
    columns: [
      { key: 'patient_id', label: 'Patient ID' }, { key: 'patient_name', label: 'Patient' },
      { key: 'email', label: 'Email' }, { key: 'contact_no', label: 'Phone' },
      { key: 'birth_date', label: 'Date of birth' }, { key: 'sex', label: 'Sex' },
      { key: 'is_archived', label: 'Archived' }, { key: 'created_at', label: 'Registered' },
    ],
  },
  {
    key: 'appointments',
    title: 'Appointments',
    description: 'Appointment schedule, assigned dentist, and visit status.',
    columns: [
      { key: 'appointment_id', label: 'Appointment ID' }, { key: 'patient_name', label: 'Patient' },
      { key: 'service_name', label: 'Service' }, { key: 'dentist', label: 'Dentist' },
      { key: 'appt_date', label: 'Date' }, { key: 'appt_time', label: 'Time' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'schedules',
    title: 'Dentist schedules',
    description: 'Weekly dentist availability by day and clinic hours.',
    columns: [
      { key: 'dentist', label: 'Dentist' }, { key: 'specialization', label: 'Specialization' },
      { key: 'day_of_week', label: 'Day' }, { key: 'start_time', label: 'Starts' },
      { key: 'end_time', label: 'Ends' },
    ],
  },
  {
    key: 'prescriptions',
    title: 'Prescriptions',
    description: 'Medication instructions, prescribing account, and the completed appointment linked to the prescription.',
    columns: [
      { key: 'prescription_id', label: 'Prescription ID' }, { key: 'patient_name', label: 'Patient' },
      { key: 'appointment_id', label: 'Appointment ID' }, { key: 'appt_date', label: 'Appointment date' },
      { key: 'appointment_status', label: 'Appointment status' },
      { key: 'medication', label: 'Medication' }, { key: 'directions', label: 'Directions' },
      { key: 'status', label: 'Status' }, { key: 'prescribed_by', label: 'Prescribed by' },
      { key: 'created_at', label: 'Date created' },
    ],
  },
  {
    key: 'treatments',
    title: 'Treatment records',
    description: 'Recorded diagnoses and dental treatments.',
    columns: [
      { key: 'record_id', label: 'Record ID' }, { key: 'patient_name', label: 'Patient' },
      { key: 'tooth_no', label: 'Tooth' }, { key: 'diagnosis', label: 'Diagnosis' },
      { key: 'treatment_done', label: 'Treatment' }, { key: 'notes', label: 'Notes' },
      { key: 'dentist', label: 'Dentist' }, { key: 'created_at', label: 'Date recorded' },
    ],
  },
  {
    key: 'payments',
    title: 'Payments',
    description: 'Payment method, receipt, amount, and verification status.',
    columns: [
      { key: 'payment_id', label: 'Payment ID' }, { key: 'receipt_no', label: 'Receipt' },
      { key: 'patient_name', label: 'Patient' }, { key: 'service_name', label: 'Service' },
      { key: 'method_name', label: 'Method' }, { key: 'amount', label: 'Amount (PHP)' },
      { key: 'status', label: 'Status' }, { key: 'paid_at', label: 'Paid at' },
    ],
  },
  {
    key: 'services',
    title: 'Service catalogue',
    description: 'Clinic services, fees, duration, and availability.',
    columns: [
      { key: 'service_name', label: 'Service' }, { key: 'category', label: 'Category' },
      { key: 'price', label: 'Price (PHP)' }, { key: 'duration_min', label: 'Duration (min)' },
      { key: 'is_active', label: 'Available' },
    ],
  },
  {
    key: 'email_notifications',
    title: 'Email delivery',
    description: 'Appointment and payment email delivery history.',
    columns: [
      { key: 'notification_id', label: 'Log ID' }, { key: 'patient_name', label: 'Patient' },
      { key: 'type', label: 'Type' }, { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Delivery status' }, { key: 'scheduled_at', label: 'Scheduled' },
      { key: 'sent_at', label: 'Sent at' }, { key: 'error_message', label: 'Delivery detail' },
    ],
  },
  {
    key: 'audit_logs',
    title: 'Audit activity',
    description: 'Administrative and clinic record activity history.',
    columns: [
      { key: 'log_id', label: 'Log ID' }, { key: 'username', label: 'User' },
      { key: 'action', label: 'Action' }, { key: 'table_name', label: 'Area' },
      { key: 'record_id', label: 'Record ID' }, { key: 'ip_address', label: 'IP address' },
      { key: 'created_at', label: 'Date and time' },
    ],
  },
  {
    key: 'users',
    title: 'User access',
    description: 'Clinic and patient account status overview.',
    columns: [
      { key: 'user_id', label: 'User ID' }, { key: 'username', label: 'Username' },
      { key: 'email', label: 'Email' }, { key: 'role_name', label: 'Role' },
      { key: 'is_verified', label: 'Email verified' }, { key: 'status', label: 'Account status' },
      { key: 'created_at', label: 'Created at' },
    ],
  },
]

const report = ref<Reports | null>(null)
const loading = ref(false)
const exporting = ref(false)
const error = ref('')
const exportError = ref('')
const statusCanvas = ref<HTMLCanvasElement | null>(null)
const revenueCanvas = ref<HTMLCanvasElement | null>(null)
const serviceCanvas = ref<HTMLCanvasElement | null>(null)
const dateFrom = ref('')
const dateTo = ref('')
const selectedReport = ref('all')
let statusChart: { destroy(): void } | null = null
let revenueChart: { destroy(): void } | null = null
let serviceChart: { destroy(): void } | null = null
let themeObserver: MutationObserver | null = null

const visibleSections = computed(() => selectedReport.value === 'all'
  ? reportSections
  : reportSections.filter((section) => section.key === selectedReport.value))
const appointmentTotal = computed(() => (report.value?.appointments_by_status ?? [])
  .reduce((sum, row) => sum + Number(row.total), 0))
const pendingAppointments = computed(() => Number(
  report.value?.appointments_by_status.find((row) => row.status === 'pending')?.total ?? 0,
))
const verifiedRevenue = computed(() => (report.value?.verified_revenue_by_month ?? [])
  .reduce((sum, row) => sum + Number(row.total), 0))
const dateRangeLabel = computed(() => {
  if (dateFrom.value && dateTo.value) return `${dateFrom.value} to ${dateTo.value}`
  if (dateFrom.value) return `From ${dateFrom.value}`
  if (dateTo.value) return `Through ${dateTo.value}`
  return 'All available dates'
})
const hasReportLimit = computed(() => {
  const data = report.value
  return Boolean(data && visibleSections.value.some((section) => data[section.key].length >= 1000))
})

async function loadReport() {
  loading.value = true
  error.value = ''
  exportError.value = ''
  report.value = null
  statusChart?.destroy()
  revenueChart?.destroy()
  serviceChart?.destroy()
  statusChart = null
  revenueChart = null
  serviceChart = null
  try {
    const query = new URLSearchParams()
    if (dateFrom.value) query.set('from', dateFrom.value)
    if (dateTo.value) query.set('to', dateTo.value)
    report.value = await getApiData<Reports>(`/api/reports${query.size ? `?${query}` : ''}`)
    await nextTick()
    renderCharts()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Unable to load report data.'
  } finally {
    loading.value = false
  }
}

function renderCharts() {
  if (!report.value) return
  const isDark = document.querySelector('.app-shell')?.getAttribute('data-theme') === 'dark'
  const chartTextColor = isDark ? '#bdccc4' : '#586e60'
  const chartTickColor = isDark ? '#a3b3ae' : '#819087'
  const chartGridColor = isDark ? 'rgba(163, 179, 174, .16)' : 'rgba(119, 142, 128, .12)'
  statusChart?.destroy()
  revenueChart?.destroy()
  serviceChart?.destroy()
  void loadChart().then(({ Chart }) => {
    if (statusCanvas.value) statusChart = new Chart(statusCanvas.value, {
      type: 'doughnut',
      data: {
        labels: report.value!.appointments_by_status.map((row) => row.status.replaceAll('_', ' ')),
        datasets: [{
          data: report.value!.appointments_by_status.map((row) => Number(row.total)),
          backgroundColor: report.value!.appointments_by_status.map((row) => ({
            confirmed: '#438d70',
            pending: '#e8ad4c',
            completed: '#6888b8',
            cancelled: '#d66c70',
            no_show: '#93a0aa',
          })[row.status] ?? '#8a9b91'),
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: chartTextColor, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16 },
          },
        },
        color: chartTextColor,
      },
    })
    if (revenueCanvas.value) revenueChart = new Chart(revenueCanvas.value, {
      type: 'line',
      data: {
        labels: report.value!.verified_revenue_by_month.map((row) => row.month),
        datasets: [{
          label: 'Verified revenue (PHP)',
          data: report.value!.verified_revenue_by_month.map((row) => Number(row.total)),
          borderColor: '#438d70',
          backgroundColor: 'rgba(67, 141, 112, .12)',
          pointBackgroundColor: '#fff',
          pointBorderColor: '#438d70',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: .35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { titleColor: '#f0f5f2', bodyColor: '#e0ece5' } },
        color: chartTextColor,
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: chartTickColor } },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: chartGridColor },
            ticks: { color: chartTickColor, callback: (value) => `₱${Number(value).toLocaleString('en-PH')}` },
          },
        },
      },
    })
    if (serviceCanvas.value) serviceChart = new Chart(serviceCanvas.value, {
      type: 'bar',
      data: {
        labels: report.value!.appointments_by_service.map((row) => row.service_name),
        datasets: [{
          label: 'Appointments',
          data: report.value!.appointments_by_service.map((row) => Number(row.total)),
          backgroundColor: report.value!.appointments_by_service.map((_, index) => (
            index === 0 ? '#438d70' : 'rgba(67, 141, 112, .62)'
          )),
          borderRadius: 7,
          borderSkipped: false,
          barThickness: 18,
          maxBarThickness: 22,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#263b32',
            padding: 11,
            displayColors: false,
            callbacks: { label: (context) => `${Number(context.raw).toLocaleString()} appointments` },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: chartGridColor },
            ticks: { precision: 0, color: chartTickColor, padding: 8 },
          },
          y: {
            border: { display: false },
            grid: { display: false },
            ticks: { color: chartTextColor, padding: 10, font: { size: 12, weight: 500 } },
          },
        },
        color: chartTextColor,
      },
    })
  }).catch((cause: unknown) => {
    console.error('Could not render report charts.', cause)
  })
}

function displayValue(value: ReportValue, key = '') {
  if (value === null || value === '') return '—'
  if (key === 'day_of_week') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[Number(value)] ?? String(value)
  }
  if (key === 'is_archived' || key === 'is_active' || key === 'is_verified') {
    if (key === 'is_archived') return Number(value) ? 'Yes' : 'No'
    return Number(value) ? (key === 'is_verified' ? 'Verified' : 'Active') : (key === 'is_verified' ? 'Not verified' : 'Inactive')
  }
  if (key === 'price' || key === 'amount') {
    return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return String(value).replaceAll('_', ' ')
}

function csvSafe(value: ReportValue) {
  const text = value === null ? '' : String(value)
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
}

function csvCell(value: ReportValue) {
  return `"${csvSafe(value).replaceAll('"', '""')}"`
}

function exportCsv() {
  if (!report.value) return
  exportError.value = ''
  exporting.value = true
  try {
    const selected = visibleSections.value
    const rows: string[][] = [
      ['MediCare+ Clinic Reports'],
      ['Report period', dateRangeLabel.value],
      ['Generated', new Date().toLocaleString()],
      [],
    ]
    if (selectedReport.value === 'all') {
      rows.push(['Appointments by status'], ['Status', 'Appointments'])
      for (const item of report.value.appointments_by_status) rows.push([item.status, String(item.total)])
      rows.push([], ['Verified revenue by month'], ['Month', 'Verified revenue (PHP)'])
      for (const item of report.value.verified_revenue_by_month) rows.push([item.month, Number(item.total).toFixed(2)])
      rows.push([], ['Appointments by service'], ['Service', 'Appointments'])
      for (const item of report.value.appointments_by_service) rows.push([item.service_name, String(item.total)])
      rows.push([])
    }
    for (const section of selected) {
      rows.push([section.title])
      rows.push(section.columns.map((column) => column.label))
      for (const row of report.value[section.key]) {
        rows.push(section.columns.map((column) => csvSafe(row[column.key] ?? null)))
      }
      if (!report.value[section.key].length) rows.push(['No records found'])
      rows.push([])
    }

    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `medicare-${selectedReport.value}-report-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  } catch (cause) {
    exportError.value = cause instanceof Error ? cause.message : 'Unable to export CSV report.'
  } finally {
    exporting.value = false
  }
}

async function exportPdf() {
  if (!report.value) return
  exportError.value = ''
  exporting.value = true
  try {
    const { jsPDF, autoTable } = await loadPdf()
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 14
    const selected = visibleSections.value
    const reportTitle = selectedReport.value === 'all' ? 'Clinic overview' : selected[0]?.title ?? 'Clinic report'
    const generatedAt = new Date().toLocaleString()

    pdf.setFillColor(25, 74, 78)
    pdf.rect(0, 0, pageWidth, 43, 'F')
    pdf.setFillColor(91, 178, 145)
    pdf.circle(margin + 5, 15, 4, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(19)
    pdf.text('MediCare+', margin + 13, 16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text('CLINIC MANAGEMENT REPORT', margin, 28)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.text(reportTitle, pageWidth - margin, 16, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`Period: ${dateRangeLabel.value}`, pageWidth - margin, 26, { align: 'right' })
    pdf.text(`Generated: ${generatedAt}`, pageWidth - margin, 33, { align: 'right' })
    pdf.setTextColor(47, 67, 63)

    let startY = 51
    if (selectedReport.value === 'all') {
      const gap = 5
      const cardWidth = (pageWidth - margin * 2 - gap * 3) / 4
      const metrics: [string, string][] = [
        ['PATIENTS', String(report.value.patients.length)],
        ['APPOINTMENTS', String(appointmentTotal.value)],
        ['PENDING', String(pendingAppointments.value)],
        ['VERIFIED REVENUE', `PHP ${verifiedRevenue.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
      ]
      metrics.forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + gap)
        pdf.setFillColor(241, 248, 243)
        pdf.roundedRect(x, startY, cardWidth, 20, 2, 2, 'F')
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(87, 112, 99)
        pdf.text(label, x + 4, startY + 7)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(13)
        pdf.setTextColor(35, 91, 69)
        pdf.text(value, x + 4, startY + 15)
      })
      startY += 29

      const addSummaryTable = (title: string, headings: string[], rows: string[][]) => {
        if (startY > 175) {
          pdf.addPage()
          startY = 18
        }
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.setTextColor(35, 91, 69)
        pdf.text(title, margin, startY)
        autoTable(pdf, {
          startY: startY + 3,
          head: [headings],
          body: rows.length ? rows : [['No records found', ...Array(Math.max(0, headings.length - 1)).fill('')]],
          margin: { left: margin, right: margin, bottom: 15 },
          tableWidth: Math.min(140, pageWidth - margin * 2),
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [35, 110, 91], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [244, 249, 246] },
        })
        startY = ((pdf as typeof pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 15) + 8
      }

      addSummaryTable(
        'Appointments by status',
        ['Status', 'Appointments'],
        report.value.appointments_by_status.map((row) => [row.status.replaceAll('_', ' '), String(row.total)]),
      )
      addSummaryTable(
        'Verified revenue by month',
        ['Month', 'Verified revenue (PHP)'],
        report.value.verified_revenue_by_month.map((row) => [row.month, Number(row.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })]),
      )
      addSummaryTable(
        'Appointments by service',
        ['Service', 'Appointments'],
        report.value.appointments_by_service.map((row) => [row.service_name, String(row.total)]),
      )
    }

    for (const section of selected) {
      const rows = report.value[section.key]
      if (startY > 175) {
        pdf.addPage()
        startY = 18
      }
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.setTextColor(35, 91, 69)
      pdf.text(section.title, margin, startY)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(108, 126, 117)
      pdf.text(rows.length ? `${rows.length} records` : 'No records for this period', pageWidth - margin, startY, { align: 'right' })

      autoTable(pdf, {
        startY: startY + 4,
        head: [section.columns.map((column) => column.label)],
        body: rows.length
          ? rows.map((row) => section.columns.map((column) => displayValue(row[column.key] ?? null, column.key)))
          : [['No records found', ...Array(Math.max(0, section.columns.length - 1)).fill('')]],
        margin: { left: margin, right: margin, bottom: 15 },
        styles: { font: 'helvetica', fontSize: 7, cellPadding: 2.2, overflow: 'linebreak', textColor: [48, 65, 60] },
        headStyles: { fillColor: [35, 110, 91], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 249, 246] },
        didDrawPage: () => {
          const pageCount = pdf.getNumberOfPages()
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          pdf.setTextColor(120, 137, 128)
          pdf.text('Confidential clinic report · MediCare+', margin, pdf.internal.pageSize.getHeight() - 7)
          pdf.text(`Page ${pageCount}`, pageWidth - margin, pdf.internal.pageSize.getHeight() - 7, { align: 'right' })
        },
      })
      const finalY = (pdf as typeof pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 20
      startY = finalY + 12
    }

    pdf.save(`medicare-${selectedReport.value}-report-${new Date().toISOString().slice(0, 10)}.pdf`)
  } catch (cause) {
    exportError.value = cause instanceof Error ? cause.message : 'Unable to export PDF report.'
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  themeObserver = new MutationObserver(() => {
    if (selectedReport.value === 'all' && report.value) {
      void nextTick().then(renderCharts)
    }
  })
  const appShell = document.querySelector('.app-shell')
  if (appShell) themeObserver.observe(appShell, { attributes: true, attributeFilter: ['data-theme'] })
  void loadReport()
})
watch(selectedReport, async (selection) => {
  if (selection === 'all' && report.value) {
    await nextTick()
    renderCharts()
  } else {
    statusChart?.destroy()
    revenueChart?.destroy()
    serviceChart?.destroy()
    statusChart = null
    revenueChart = null
    serviceChart = null
  }
})
onBeforeUnmount(() => {
  themeObserver?.disconnect()
  statusChart?.destroy()
  revenueChart?.destroy()
  serviceChart?.destroy()
})
</script>

<template>
  <section class="page-heading reports-heading">
    <div>

      <h1>Clinic reports</h1>
      <p class="muted">Review and download organized clinic, patient, care, schedule, and finance reports.</p>
    </div>
    <div class="report-actions">
      <button class="button button-quiet" type="button" :disabled="loading" @click="loadReport">
        {{ loading ? 'Refreshing…' : 'Refresh reports' }}
      </button>
      <button class="button button-secondary" type="button" :disabled="!report || loading || exporting" @click="exportCsv">
        {{ exporting ? 'Preparing…' : 'Download CSV' }}
      </button>
      <button class="button button-primary" type="button" :disabled="!report || loading || exporting" @click="exportPdf">
        Download PDF
      </button>
    </div>
  </section>

  <section class="surface report-filter-panel">
    <div class="report-filter-copy">
      <strong>Build your report</strong>
      <span>Choose a report type and optional date range.</span>
    </div>
    <label class="report-filter-field">
      <span>Report type</span>
      <select v-model="selectedReport">
        <option value="all">Complete clinic report</option>
        <option v-for="section in reportSections" :key="section.key" :value="section.key">{{ section.title }}</option>
      </select>
    </label>
    <label class="report-filter-field">
      <span>From</span>
      <input v-model="dateFrom" type="date" :max="dateTo || undefined">
    </label>
    <label class="report-filter-field">
      <span>To</span>
      <input v-model="dateTo" type="date" :min="dateFrom || undefined">
    </label>
    <button class="button button-primary report-generate" type="button" :disabled="loading" @click="loadReport">
      {{ loading ? 'Generating…' : 'Generate report' }}
    </button>
  </section>
  <p class="report-filter-note">Date range filters patient and clinic activity. Dentist schedules, service catalogue, and user access show current records.</p>

  <p v-if="exportError" class="report-error" role="alert">{{ exportError }}</p>

  <SkeletonLoader v-if="loading && !report" variant="reports" label="Preparing clinic reports" />
  <section v-else-if="error && !report" class="surface empty-state">
    <strong>Reports unavailable</strong>
    <p>{{ error }}</p>
    <button class="button button-primary" type="button" @click="loadReport">Try again</button>
  </section>
  <template v-else-if="report">
    <p v-if="error" class="report-error" role="alert">{{ error }}</p>
    <div v-if="selectedReport === 'all'" class="report-metrics">
      <article class="surface report-metric"><span class="metric-icon patient-metric">P</span><span><small>Patients in report</small><strong>{{ report.patients.length.toLocaleString() }}</strong></span></article>
      <article class="surface report-metric"><span class="metric-icon appointment-metric">A</span><span><small>Appointments</small><strong>{{ appointmentTotal.toLocaleString() }}</strong></span></article>
      <article class="surface report-metric"><span class="metric-icon pending-metric">!</span><span><small>Awaiting confirmation</small><strong>{{ pendingAppointments.toLocaleString() }}</strong></span></article>
      <article class="surface report-metric"><span class="metric-icon revenue-metric">₱</span><span><small>Verified revenue</small><strong>{{ verifiedRevenue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) }}</strong></span></article>
    </div>

    <section v-if="selectedReport === 'all'" class="report-overview">
      <div class="report-overview-grid">
        <article class="surface report-card">
          <div class="report-card-heading">
            <div class="report-title-lockup">
              <span class="chart-icon status-chart-icon" aria-hidden="true">◉</span>
              <div><h2>Appointments by status</h2><p>Visit progress across the selected period.</p></div>
            </div>
            <span class="chart-period">{{ dateRangeLabel }}</span>
          </div>
          <p v-if="!report.appointments_by_status.length" class="muted report-no-chart">No appointments found.</p>
          <div v-else class="report-chart"><canvas ref="statusCanvas" /></div>
        </article>
        <article class="surface report-card">
          <div class="report-card-heading">
            <div class="report-title-lockup">
              <span class="chart-icon revenue-chart-icon" aria-hidden="true">₱</span>
              <div><h2>Verified monthly revenue</h2><p>Payments confirmed by clinic staff.</p></div>
            </div>
            <span class="chart-period">12-month view</span>
          </div>
          <p v-if="!report.verified_revenue_by_month.length" class="muted report-no-chart">No verified payments found.</p>
          <div v-else class="report-chart"><canvas ref="revenueCanvas" /></div>
        </article>
      </div>
      <article class="surface report-card report-service-card">
        <div class="report-card-heading">
          <div class="report-title-lockup">
            <span class="chart-icon service-chart-icon" aria-hidden="true">▥</span>
            <div><h2>Appointments per service</h2><p>Compare demand across all clinic services.</p></div>
          </div>
          <span class="chart-period">{{ report.appointments_by_service.length }} services</span>
        </div>
        <p v-if="!report.appointments_by_service.length" class="muted report-no-chart">No service records found.</p>
        <div v-else class="report-chart report-service-chart" :style="{ height: `${Math.min(420, Math.max(220, report.appointments_by_service.length * 48 + 28))}px` }"><canvas ref="serviceCanvas" /></div>
      </article>
    </section>

    <section class="surface report-data-card">
      <div class="report-data-heading">
        <div>
          <p class="eyebrow">{{ selectedReport === 'all' ? 'REPORT DATA' : 'SELECTED REPORT' }}</p>
          <h2>{{ selectedReport === 'all' ? 'Complete report sections' : visibleSections[0]?.title }}</h2>
          <p class="muted">{{ selectedReport === 'all' ? 'Choose a category above to preview its records before downloading.' : visibleSections[0]?.description }}</p>
        </div>
        <span class="report-period">{{ dateRangeLabel }}</span>
      </div>
      <div v-if="selectedReport === 'all'" class="report-category-grid">
        <button v-for="section in reportSections" :key="section.key" type="button" class="report-category" @click="selectedReport = section.key">
          <span>{{ section.title }}</span>
          <strong>{{ report[section.key].length.toLocaleString() }}</strong>
          <small>View records <span aria-hidden="true">→</span></small>
        </button>
      </div>
      <p v-if="hasReportLimit" class="report-table-limit">
        Some report sections reached the 1,000-record export limit. Narrow the date range to include fewer records.
      </p>
      <div v-for="section in visibleSections" :key="section.key" class="report-table-section">
        <div class="report-table-heading">
          <div><h3>{{ section.title }}</h3><p>{{ section.description }}</p></div>
          <span>{{ report[section.key].length.toLocaleString() }} records</span>
        </div>
        <div v-if="!report[section.key].length" class="report-table-empty">No records found for this report period.</div>
        <div v-else class="report-table-scroll">
          <table class="data-table report-data-table">
            <thead><tr><th v-for="column in section.columns" :key="column.key">{{ column.label }}</th></tr></thead>
            <tbody>
              <tr v-for="(row, index) in report[section.key].slice(0, 50)" :key="String(section.columns[0] ? row[section.columns[0].key] ?? index : index)">
                <td v-for="column in section.columns" :key="column.key">{{ displayValue(row[column.key] ?? null, column.key) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="report[section.key].length > 50" class="report-table-limit">
            Showing 50 of {{ report[section.key].length.toLocaleString() }} records. Download the report to see all records.
          </p>
        </div>
      </div>
      <button v-if="selectedReport !== 'all'" class="button button-quiet back-to-reports" type="button" @click="selectedReport = 'all'">← Back to all reports</button>
    </section>
  </template>
</template>

<style scoped>
.reports-heading { align-items: center; gap: 1.2rem; }
.report-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .6rem; }
.report-filter-panel {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) repeat(3, minmax(135px, .7fr)) auto;
  align-items: end;
  gap: 1rem;
  margin-bottom: 1.2rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid #e6eee8;
  border-radius: 18px;
  background: linear-gradient(120deg, #fff, #f8fbf8);
}
.report-filter-copy { display: grid; gap: .3rem; padding-bottom: .35rem; }
.report-filter-copy strong { color: #2b4939; font-size: .98rem; }
.report-filter-copy span,.report-filter-field > span { color: #76877d; font-size: .78rem; }
.report-filter-field { display: grid; gap: .35rem; color: #53675b; font-size: .78rem; font-weight: 650; }
.report-filter-field input,.report-filter-field select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 .7rem;
  border: 1px solid #dfe9e2;
  border-radius: 10px;
  background: #fff;
  color: #344d3e;
  font: inherit;
  font-size: .84rem;
}
.report-generate { min-height: 40px; white-space: nowrap; }
.report-filter-note { margin: -.65rem 0 1rem; color: #819087; font-size: .76rem; }
.report-error { margin: 0 0 1rem; color: #a9434a; font-weight: 600; }
.report-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .9rem; margin-bottom: 1rem; }
.report-metric { display: flex; align-items: center; gap: .8rem; min-width: 0; padding: 1rem; border: 1px solid #e8eee9; border-radius: 16px; }
.metric-icon { display: grid; width: 40px; height: 40px; flex: 0 0 40px; place-items: center; border-radius: 13px; font-size: 1rem; font-weight: 800; }
.patient-metric { background: #e9f1fb; color: #537ba9; }
.appointment-metric { background: #e8f4eb; color: #438d70; }
.pending-metric { background: #fff3e1; color: #ac7a32; }
.revenue-metric { background: #f0ecfa; color: #806bb1; }
.report-metric > span:last-child { display: grid; min-width: 0; gap: .28rem; }
.report-metric small { overflow: hidden; color: #75867b; font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
.report-metric strong { overflow: hidden; color: #2c4939; font-size: clamp(1.05rem, 1.6vw, 1.45rem); text-overflow: ellipsis; white-space: nowrap; }
.report-overview { display: grid; gap: 1rem; margin-bottom: 1rem; }
.report-overview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: 1rem; }
.report-card { min-width: 0; padding: 1.3rem; overflow: hidden; border: 1px solid #e6ede8; border-radius: 20px; background: linear-gradient(145deg, #fff 60%, #fbfdfb); box-shadow: 0 12px 30px rgba(47, 74, 58, .055); }
.report-card-heading { display: flex; min-height: 48px; align-items: flex-start; justify-content: space-between; gap: .8rem; padding-bottom: .9rem; border-bottom: 1px solid #edf2ee; }
.report-title-lockup { display: flex; min-width: 0; align-items: center; gap: .75rem; }
.chart-icon { display: grid; width: 38px; height: 38px; flex: 0 0 38px; place-items: center; border-radius: 12px; font-size: 1.1rem; font-weight: 800; }
.status-chart-icon { background: #eaf5ee; color: #438d70; }
.revenue-chart-icon { background: #edf2fa; color: #6580ad; }
.service-chart-icon { background: #f2eefb; color: #8671b2; }
.report-card h2,.report-data-heading h2 { margin: 0; color: #294438; font-size: 1rem; font-weight: 750; letter-spacing: -.01em; }
.report-card-heading p { margin: .2rem 0 0; color: #819087; font-size: .76rem; }
.chart-period { flex: 0 0 auto; max-width: 45%; padding: .35rem .55rem; overflow: hidden; border: 1px solid #e7eee8; border-radius: 999px; background: #fbfdfb; color: #708277; font-size: .68rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.report-chart { position: relative; height: 275px; margin-top: .9rem; }
.report-no-chart { display: grid; min-height: 220px; place-items: center; text-align: center; }
.report-service-card { background: linear-gradient(145deg, #fff 55%, #f8fbf8); }
.report-service-chart { min-height: 220px; max-height: 420px; }
.report-data-card { display: grid; gap: 1.15rem; padding: 1.25rem; border: 1px solid #e7eee8; border-radius: 18px; }
.report-data-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.report-data-heading .eyebrow { margin: 0 0 .35rem; }
.report-data-heading h2 { font-size: 1.2rem; }
.report-data-heading > div > p:last-child { margin: .3rem 0 0; }
.report-period { flex: 0 0 auto; padding: .45rem .7rem; border-radius: 999px; background: #eff6f0; color: #527760; font-size: .75rem; font-weight: 700; }
.report-category-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .65rem; }
.report-category { display: grid; gap: .35rem; min-width: 0; padding: .8rem; border: 1px solid #e6eee7; border-radius: 13px; background: #fbfdfb; color: #4a6052; text-align: left; cursor: pointer; transition: border-color .16s ease, transform .16s ease, background .16s ease; }
.report-category:hover { transform: translateY(-2px); border-color: #9dcbb1; background: #f4faf5; }
.report-category span { overflow: hidden; font-size: .81rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.report-category strong { color: #2f7659; font-size: 1.45rem; }
.report-category small { color: #7d9183; font-size: .72rem; }
.report-table-section { min-width: 0; }
.report-table-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin: .2rem 0 .7rem; }
.report-table-heading h3 { margin: 0; color: #344f40; font-size: .95rem; }
.report-table-heading p { margin: .22rem 0 0; color: #829087; font-size: .76rem; }
.report-table-heading > span { flex: 0 0 auto; color: #63806d; font-size: .76rem; font-weight: 700; }
.report-table-empty { padding: 1.5rem; border: 1px dashed #dfe9e2; border-radius: 12px; color: #7d8c82; font-size: .85rem; text-align: center; }
.report-table-scroll { max-width: 100%; overflow: auto; border: 1px solid #e8eee9; border-radius: 12px; }
.report-data-table { min-width: 720px; margin: 0; }
.report-data-table th { position: sticky; top: 0; z-index: 1; background: #f2f7f3; color: #587261; font-size: .72rem; white-space: nowrap; }
.report-data-table td { max-width: 280px; color: #53655a; font-size: .77rem; }
.report-data-table td:nth-child(2) { white-space: normal; }
.report-table-limit { margin: .55rem 0 0; color: #829087; font-size: .75rem; }
.back-to-reports { justify-self: start; }

:global(.app-shell[data-theme='dark'] .report-filter-panel),
:global(.app-shell[data-theme='dark'] .report-metric),
:global(.app-shell[data-theme='dark'] .report-card),
:global(.app-shell[data-theme='dark'] .report-data-card) { border-color: #35473d; background: #202e28; }
:global(.app-shell[data-theme='dark'] .report-card-heading) { border-bottom-color: #35473d; }
:global(.app-shell[data-theme='dark'] .chart-period) { border-color: #3a4b41; background: #26362f; color: #d1ded5; }
:global(.app-shell[data-theme='dark'] .status-chart-icon) { background: #2b4435; color: #a7d4b4; }
:global(.app-shell[data-theme='dark'] .revenue-chart-icon) { background: #2f3c50; color: #b9c9e6; }
:global(.app-shell[data-theme='dark'] .service-chart-icon) { background: #3a354c; color: #c9b9ed; }
:global(.app-shell[data-theme='dark'] .report-filter-copy strong),
:global(.app-shell[data-theme='dark'] .report-metric strong),
:global(.app-shell[data-theme='dark'] .report-card h2),
:global(.app-shell[data-theme='dark'] .report-data-heading h2),
:global(.app-shell[data-theme='dark'] .report-table-heading h3),
:global(.app-shell[data-theme='dark'] .report-category strong) { color: #e0ebe4; }
:global(.app-shell[data-theme='dark'] .report-filter-copy span),
:global(.app-shell[data-theme='dark'] .report-filter-field),
:global(.app-shell[data-theme='dark'] .report-filter-field > span),
:global(.app-shell[data-theme='dark'] .report-metric small),
:global(.app-shell[data-theme='dark'] .report-card-heading p),
:global(.app-shell[data-theme='dark'] .report-data-heading .muted),
:global(.app-shell[data-theme='dark'] .report-table-heading p),
:global(.app-shell[data-theme='dark'] .report-table-heading > span),
:global(.app-shell[data-theme='dark'] .report-table-limit),
:global(.app-shell[data-theme='dark'] .report-table-empty),
:global(.app-shell[data-theme='dark'] .report-no-chart) { color: #b2c2bb; }
:global(.app-shell[data-theme='dark'] .report-filter-field input),
:global(.app-shell[data-theme='dark'] .report-filter-field select) { border-color: #405148; background: #26362f; color: #e0ece5; color-scheme: dark; }
:global(.app-shell[data-theme='dark'] .report-filter-field input::placeholder) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .report-category) { border-color: #394b41; background: #26362f; color: #d1ded5; }
:global(.app-shell[data-theme='dark'] .report-category:hover) { border-color: #6b9f7b; background: #2d4035; }
:global(.app-shell[data-theme='dark'] .report-category small) { color: #b2c2bb; }
:global(.app-shell[data-theme='dark'] .report-data-table th) { background: #2c3d33; color: #d0e0d5; }
:global(.app-shell[data-theme='dark'] .report-data-table td) { border-color: #35473d; color: #d7e5de; }
:global(.app-shell[data-theme='dark'] .report-table-scroll) { border-color: #35473d; }
:global(.app-shell[data-theme='dark'] .report-period) { background: #2a4032; color: #cce2d2; }
:global(.app-shell[data-theme='dark'] .report-filter-note) { color: #b2c2bb; }
:global(.app-shell[data-theme='dark'] .report-error) { color: #f0a6a6; }

@media (max-width: 1050px) {
  .report-filter-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .report-filter-copy { grid-column: 1 / -1; }
  .report-generate { justify-self: start; }
  .report-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .report-category-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .report-chart { height: 250px; }
  .report-card { padding: 1.05rem; }
}
@media (max-width: 760px) {
  .reports-heading { align-items: flex-start; }
  .report-actions { justify-content: flex-start; }
  .report-filter-panel { grid-template-columns: minmax(0, 1fr); gap: .8rem; }
  .report-filter-copy { grid-column: auto; }
  .report-metrics,.report-overview-grid { grid-template-columns: minmax(0, 1fr); }
  .report-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .report-data-heading { flex-direction: column; }
  .report-period { max-width: 100%; }
  .report-chart { height: 260px; }
  .report-service-chart { max-height: 360px; }
  .chart-period { max-width: 42%; }
}
@media (max-width: 420px) {
  .report-metrics { gap: .55rem; }
  .report-metric { padding: .75rem; }
  .report-actions .button { flex: 1 1 120px; }
  .report-card-heading { gap: .4rem; }
  .chart-icon { width: 32px; height: 32px; flex-basis: 32px; }
  .report-card h2 { font-size: .9rem; }
  .chart-period { max-width: 40%; font-size: .62rem; }
}
</style>
