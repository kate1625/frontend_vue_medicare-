<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError, getApiData } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

interface EmailRow {
  notification_id: number
  appointment_id: number | null
  patient_id: number | null
  type: string
  subject: string | null
  status: string
  scheduled_at: string | null
  sent_at: string | null
  error_message: string | null
  patient_name: string
  source: 'email' | 'in_app'
  message: string | null
}

const rows = ref<EmailRow[]>([])
const loading = ref(true)
const exportingPdf = ref(false)
const error = ref('')
const exportError = ref('')

onMounted(async () => {
  try {
    rows.value = await getApiData<EmailRow[]>('/api/email-notifications')
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load communication history.'
  } finally {
    loading.value = false
  }
})

async function exportPdf() {
  if (!rows.value.length) return

  exportingPdf.value = true
  exportError.value = ''
  try {
    const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const pdf = new jspdfMod.default({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 12
    const generatedAt = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
    const countStatus = (status: string) => rows.value.filter((row) => row.status.toLowerCase() === status).length
    const summary = [
      { label: 'TOTAL EVENTS', value: rows.value.length },
      { label: 'EMAIL', value: rows.value.filter((row) => row.source === 'email').length },
      { label: 'IN-APP', value: rows.value.filter((row) => row.source === 'in_app').length },
      { label: 'SENT', value: countStatus('sent') },
      { label: 'FAILED', value: countStatus('failed') },
    ]

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(35, 67, 57)
    pdf.text('Communication activity', margin, 37)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(103, 122, 113)
    pdf.text('Delivery history across patient email and in-app notifications', margin, 43)

    const gap = 4
    const cardWidth = (pageWidth - margin * 2 - gap * (summary.length - 1)) / summary.length
    summary.forEach((item, index) => {
      const x = margin + index * (cardWidth + gap)
      pdf.setFillColor(244, 249, 246)
      pdf.setDrawColor(221, 234, 226)
      pdf.roundedRect(x, 49, cardWidth, 20, 2.5, 2.5, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6.5)
      pdf.setTextColor(91, 117, 105)
      pdf.text(item.label, x + 4, 56)
      pdf.setFontSize(12)
      pdf.setTextColor(item.label === 'FAILED' && item.value ? 164 : 35, item.label === 'FAILED' && item.value ? 74 : 91, item.label === 'FAILED' && item.value ? 74 : 69)
      pdf.text(String(item.value), x + 4, 65)
    })

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(35, 67, 57)
    pdf.text('Communication records', margin, 80)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(103, 122, 113)
    pdf.text(`${rows.value.length} records`, pageWidth - margin, 80, { align: 'right' })

    autoTableMod.default(pdf, {
      startY: 84,
      margin: { left: margin, right: margin, top: 31, bottom: 18 },
      head: [['Time', 'Recipient', 'Channel', 'Appointment', 'Type / subject', 'Message', 'Status / error']],
      body: rows.value.map((row) => [
        row.sent_at || row.scheduled_at || '—',
        row.patient_name || 'Unknown recipient',
        row.source === 'email' ? 'Email' : 'In-app',
        row.appointment_id ? `#${row.appointment_id}` : '—',
        `${row.subject || row.type}\n${row.type.replaceAll('_', ' ')}`,
        row.message || '—',
        row.error_message ? `${row.status}\n${row.error_message}` : row.status,
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'top',
        textColor: [49, 69, 61],
        lineColor: [225, 234, 228],
        lineWidth: 0.2,
      },
      headStyles: { fillColor: [25, 74, 78], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [245, 249, 246] },
      columnStyles: {
        0: { cellWidth: 31 },
        1: { cellWidth: 34 },
        2: { cellWidth: 18 },
        3: { cellWidth: 23 },
        4: { cellWidth: 49 },
        5: { cellWidth: 65 },
        6: { cellWidth: 53 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 6) return
        const status = rows.value[data.row.index]?.status.toLowerCase()
        if (status === 'sent') {
          data.cell.styles.fillColor = [232, 244, 236]
          data.cell.styles.textColor = [35, 91, 69]
        } else if (status === 'failed') {
          data.cell.styles.fillColor = [252, 237, 236]
          data.cell.styles.textColor = [145, 57, 57]
        }
      },
    })

    const pageCount = pdf.getNumberOfPages()
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page)
      pdf.setFillColor(25, 74, 78)
      pdf.rect(0, 0, pageWidth, 27, 'F')
      pdf.setFillColor(91, 178, 145)
      pdf.circle(margin + 3, 10, 2.5, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.setTextColor(255, 255, 255)
      pdf.text('MediCare+', margin + 9, 12)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(208, 235, 226)
      pdf.text('CLINIC COMMUNICATIONS · INTERNAL REPORT', margin, 21)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(255, 255, 255)
      pdf.text('Email & Notification Log', pageWidth - margin, 12, { align: 'right' })
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(208, 235, 226)
      pdf.text(`Generated ${generatedAt}`, pageWidth - margin, 21, { align: 'right' })
      pdf.setDrawColor(221, 234, 226)
      pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13)
      pdf.setFontSize(7)
      pdf.setTextColor(103, 122, 113)
      pdf.text('MediCare+ · Clinic communications record', margin, pageHeight - 8)
      pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
    }

    pdf.save(`medicare-communications-${new Date().toISOString().slice(0, 10)}.pdf`)
  } catch (cause) {
    exportError.value = cause instanceof Error ? cause.message : 'Could not generate the communication log PDF.'
    notify.error(exportError.value, 'PDF export failed')
  } finally {
    exportingPdf.value = false
  }
}
</script>

<template>
  <div class="communication-log-page">
    <section class="page-heading communication-heading">
      <div>
        <p class="eyebrow">CLINIC COMMUNICATIONS</p>
        <h1>Email &amp; Notification Log</h1>
        <p class="muted">One history for appointment emails and in-app notifications sent to patients and clinic users.</p>
      </div>
    </section>

    <p v-if="exportError" class="alert alert-error" role="alert">{{ exportError }}</p>
    <SkeletonLoader v-if="loading" variant="table" :rows="5" :columns="7" label="Loading communication history" />
    <section v-else-if="error" class="surface empty-state">
      <strong>Communication history unavailable</strong>
      <p>{{ error }}</p>
    </section>
    <section v-else-if="!rows.length" class="surface empty-state">
      <strong>No communications have been logged</strong>
      <p>Appointment email and in-app notification activity will appear here.</p>
    </section>
    <template v-else>
      <div class="communication-toolbar">
        <span class="result-count">{{ rows.length }} communication records</span>
        <button class="button button-primary communication-export" type="button" :disabled="exportingPdf" @click="exportPdf">
          {{ exportingPdf ? 'Preparing PDF…' : 'Download PDF' }}
        </button>
      </div>
      <section class="surface table-wrap communication-table-wrap">
      <table class="data-table communication-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Recipient</th>
            <th>Channel</th>
            <th>Appointment</th>
            <th>Type / subject</th>
            <th>Message</th>
            <th>Status / error</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="`${row.source}-${row.notification_id}`">
            <td>{{ row.sent_at || row.scheduled_at || '—' }}</td>
            <td>{{ row.patient_name }}</td>
            <td>{{ row.source === 'email' ? 'Email' : 'In-app' }}</td>
            <td>{{ row.appointment_id ? `#${row.appointment_id}` : '—' }}</td>
            <td>{{ row.subject || row.type }}</td>
            <td class="communication-message">{{ row.message || '—' }}</td>
            <td class="communication-status">
              <span class="status-badge" :data-status="row.status">{{ row.status }}</span>
              <small v-if="row.error_message" class="table-secondary">{{ row.error_message }}</small>
            </td>
          </tr>
        </tbody>
      </table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.communication-heading {
  margin-bottom: 20px;
}

.communication-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
}

.communication-export {
  flex: none;
  min-width: 150px;
  min-height: 44px;
  font-weight: 700;
}

.communication-table-wrap {
  overflow: auto;
}

.communication-table {
  min-width: 900px;
}

.communication-message {
  min-width: 220px;
  max-width: 360px;
  white-space: normal;
  line-height: 1.45;
}

.communication-status {
  min-width: 140px;
}

.communication-status small {
  display: block;
  margin-top: 5px;
  white-space: normal;
  line-height: 1.4;
}

@media (max-width: 760px) {
  .communication-heading {
    margin-bottom: 18px;
  }

  .communication-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .communication-export {
    width: 100%;
  }
}
</style>
