<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError, getApiData } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'

async function loadQr() {
  const mod = await import('qrcode')
  return mod.default
}

async function loadPdf() {
  const mod = await import('jspdf')
  return mod.default
}
interface Receipt { payment_id: number; receipt_no: string | null; amount: string; payment_plan: 'full'|'downpayment'; payment_percent: number|null; reference_no: string | null; status: string; paid_at: string | null; method_name: string; account_name: string | null; account_no: string | null; appt_date: string; appt_time: string; service_name: string; first_name: string; last_name: string }
const route = useRoute(); const receipt = ref<Receipt | null>(null); const receipts = ref<Receipt[]>([]); const qr = ref(''); const loading = ref(true); const error = ref('')
async function load() { loading.value = true; error.value = ''; receipt.value = null; receipts.value = []; qr.value = ''; const id = String(route.query.id || ''); try { if (/^\d+$/.test(id)) { receipt.value = await getApiData<Receipt>(`/api/payments/receipt/${id}`) } else { receipts.value = await getApiData<Receipt[]>('/api/payments/mine'); return } const QRCode = await loadQr()
qr.value = await QRCode.toDataURL(
  `Tooth Doctor receipt ${receipt.value.receipt_no} | Appointment ${receipt.value.payment_id} | Amount PHP ${receipt.value.amount}`,
  { width: 180, margin: 1 },
) } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not load receipts.' } finally { loading.value = false } }
async function exportPdf() {
  if (!receipt.value || receipt.value.status !== 'verified') return
  const r = receipt.value
  const receiptNo = r.receipt_no
  if (!receiptNo) return
  const jsPDF = await loadPdf()
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 18
  const contentWidth = pageWidth - margin * 2
  const amount = Number(r.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })
  const plan = r.payment_plan === 'downpayment' ? `${r.payment_percent}% downpayment` : 'Full payment'
  const status = 'VERIFIED'
  const statusColor: [number, number, number] = [36, 124, 86]

  pdf.setFillColor(25, 74, 78)
  pdf.rect(0, 0, pageWidth, 46, 'F')
  pdf.setFillColor(91, 178, 145)
  pdf.circle(margin + 6, 18, 6, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text('+', margin + 4.1, 20.5)
  pdf.setFontSize(19)
  pdf.text('Tooth Doctor Dental Clinic', margin + 16, 17)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(208, 235, 226)
  pdf.text('OFFICIAL PAYMENT RECEIPT', margin + 16, 25)
  pdf.setFontSize(10)
  pdf.text(receiptNo, pageWidth - margin, 18, { align: 'right' })
  pdf.text(`Issued ${r.paid_at || 'verified'}`, pageWidth - margin, 25, { align: 'right' })

  pdf.setTextColor(38, 57, 68)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text('Payment receipt', margin, 62)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(102, 119, 128)
  pdf.text('Thank you. Please keep this receipt for your records.', margin, 69)

  const infoTop = 80
  const columnGap = 12
  const columnWidth = (contentWidth - columnGap) / 2
  const drawInfo = (label: string, value: string, x: number, y: number) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(112, 132, 139)
    pdf.text(label.toUpperCase(), x, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(38, 57, 68)
    pdf.text(pdf.splitTextToSize(value, columnWidth), x, y + 6)
  }
  drawInfo('Patient', `${r.first_name} ${r.last_name}`, margin, infoTop)
  drawInfo('Appointment', `${r.appt_date} · ${r.appt_time}`, margin + columnWidth + columnGap, infoTop)
  drawInfo('Service', r.service_name, margin, infoTop + 25)
  drawInfo('Payment method', r.method_name, margin + columnWidth + columnGap, infoTop + 25)
  drawInfo('Payment plan', plan, margin, infoTop + 50)
  drawInfo('Reference number', r.reference_no || 'Not provided', margin + columnWidth + columnGap, infoTop + 50)

  const summaryTop = 158
  pdf.setFillColor(243, 248, 246)
  pdf.roundedRect(margin, summaryTop, contentWidth, 43, 4, 4, 'F')
  pdf.setDrawColor(215, 231, 224)
  pdf.roundedRect(margin, summaryTop, contentWidth, 43, 4, 4, 'S')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(77, 104, 100)
  pdf.text('PAYMENT SUMMARY', margin + 10, summaryTop + 11)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(76, 94, 103)
  pdf.text('Amount paid', margin + 10, summaryTop + 23)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor(25, 106, 83)
  pdf.text(`PHP ${amount}`, margin + 10, summaryTop + 35)
  pdf.setFillColor(...statusColor)
  pdf.roundedRect(pageWidth - margin - 57, summaryTop + 12, 47, 14, 7, 7, 'F')
  pdf.setFontSize(8)
  pdf.setTextColor(255, 255, 255)
  pdf.text(status, pageWidth - margin - 33.5, summaryTop + 20.5, { align: 'center' })

  const qrTop = 218
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(38, 57, 68)
  pdf.text('Receipt verification', margin, qrTop)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(102, 119, 128)
  pdf.text('Scan the QR code to identify this payment receipt.', margin, qrTop + 8)
  if (qr.value) {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(margin, qrTop + 16, 48, 48, 3, 3, 'F')
    pdf.setDrawColor(215, 231, 224)
    pdf.roundedRect(margin, qrTop + 16, 48, 48, 3, 3, 'S')
    pdf.addImage(qr.value, 'PNG', margin + 5, qrTop + 21, 38, 38)
  }
  pdf.setDrawColor(220, 230, 227)
  pdf.line(margin, 278, pageWidth - margin, 278)
  pdf.setFontSize(8)
  pdf.setTextColor(118, 135, 140)
  pdf.text('This receipt confirms payment verified by Tooth Doctor Dental Clinic.', margin, 287)
  pdf.text('MediCare+ patient portal', margin, 294)
  pdf.setTextColor(25, 106, 83)
  pdf.text(receiptNo, pageWidth - margin, 294, { align: 'right' })
  pdf.save(`${receiptNo}.pdf`)
}
onMounted(load); watch(() => route.query.id, load)
</script>
<template>
  <div class="receipt-page">
    <section class="page-heading receipt-page-heading">
      <div>
        <h1>Payment Receipts</h1>
        <p class="muted">Official receipts appear after payment is verified. For cash, the clinic releases the receipt when payment is received during your visit.</p>
      </div>
      <button v-if="receipt?.status === 'verified'" class="button button-primary" @click="exportPdf">Download PDF</button>
    </section>

    <SkeletonLoader v-if="loading" variant="receipt" label="Loading your payment receipts" />
    <section v-else-if="error" class="surface empty-state">
      <strong>Receipts unavailable</strong>
      <p>{{ error }}</p>
      <RouterLink to="/patient/payment">Go to payments</RouterLink>
    </section>
    <section v-else-if="!receipt" class="surface receipt-list-panel">
      <div class="receipt-list-heading">
        <div>
          <p class="payment-step">PAYMENT HISTORY</p>
          <h2>Your receipts</h2>
          <p>Only verified payments have official receipts available to view and download.</p>
        </div>
        <RouterLink class="button button-quiet" to="/patient/payment">Make a payment</RouterLink>
      </div>
      <div v-if="receipts.length" class="receipt-list">
        <article v-for="item in receipts" :key="item.payment_id" class="receipt-list-item">
          <div class="receipt-list-icon">₱</div>
          <div class="receipt-list-main">
            <strong>{{ item.receipt_no || `Payment #${item.payment_id}` }}</strong>
            <p>{{ item.service_name }}</p>
            <small>
              Appointment: {{ item.appt_date }} {{ item.appt_time }} ·
              {{ item.payment_plan === 'downpayment' ? `${item.payment_percent}% downpayment` : 'Full payment' }} ·
              <b>₱{{ Number(item.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</b>
            </small>
          </div>
          <span class="status-badge" :data-status="item.status">
            {{ item.status === 'pending' ? 'Pending verification' : item.status }}
          </span>
          <RouterLink
            v-if="item.status === 'verified' && item.receipt_no"
            class="receipt-view-link"
            :to="{ path: '/patient/receipt', query: { id: item.payment_id } }"
          >
            View receipt <span aria-hidden="true">→</span>
          </RouterLink>
          <span v-else class="receipt-unavailable">
            {{ item.status === 'pending' ? 'Available after clinic confirmation' : 'No receipt issued' }}
          </span>
        </article>
      </div>
      <div v-else class="empty-state">
        <strong>No payment receipts yet</strong>
        <p>An official receipt will appear here after the clinic verifies payment.</p>
        <RouterLink to="/patient/payment">Go to payments</RouterLink>
      </div>
    </section>
    <article v-else class="surface receipt-card receipt-detail">
      <div class="receipt-detail-header">
        <div>
          <p class="eyebrow">TOOTH DOCTOR · PAYMENT</p>
          <h2>{{ receipt.receipt_no }}</h2>
        </div>
        <span class="status-badge" :data-status="receipt.status">
          {{ receipt.status === 'pending' ? 'Pending clinic verification' : receipt.status }}
        </span>
      </div>
      <p class="receipt-detail-note">This official receipt confirms a payment verified by the clinic. Keep it for your records.</p>
      <dl>
        <dt>Patient</dt><dd>{{ receipt.first_name }} {{ receipt.last_name }}</dd>
        <dt>Service</dt><dd>{{ receipt.service_name }}</dd>
        <dt>Appointment</dt><dd>{{ receipt.appt_date }} {{ receipt.appt_time }}</dd>
        <dt>Payment plan</dt>
        <dd>{{ receipt.payment_plan === 'downpayment' ? `${receipt.payment_percent}% downpayment` : 'Full payment' }}</dd>
        <dt>Payment method</dt><dd>{{ receipt.method_name }}</dd>
        <dt>Amount submitted</dt>
        <dd>₱{{ Number(receipt.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</dd>
        <dt>Reference</dt><dd>{{ receipt.reference_no || '—' }}</dd>
        <dt>Paid at</dt><dd>{{ receipt.paid_at || 'Pending clinic verification' }}</dd>
      </dl>
      <img :src="qr" alt="Receipt QR code" width="180" height="180">
      <RouterLink class="button button-quiet" to="/patient/receipt">Back to receipts</RouterLink>
    </article>
  </div>
</template>

<style scoped>
.receipt-page {
  width: 100%;
  padding-bottom: 48px;
}

.receipt-page-heading {
  align-items: center;
  margin-bottom: 23px;
}

.receipt-page-heading h1 {
  margin: 6px 0 5px;
  color: #223951;
  font-size: clamp(25px, 2.4vw, 31px);
  font-weight: 720;
  letter-spacing: -.8px;
  line-height: 1.2;
}

.receipt-page-heading .muted {
  max-width: 620px;
  color: #5f6e82;
  font-size: 14px;
}

.receipt-list-panel,
.receipt-detail {
  padding: clamp(22px, 3vw, 36px);
  border: 1px solid #dfe9e5;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 16px 38px rgb(36 73 91 / 8%);
}

.receipt-list-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 22px;
  border-bottom: 1px solid #e6eeeb;
}

.receipt-list-heading h2 {
  margin: 5px 0 7px;
  color: #1b3d58;
  font-size: 24px;
}

.receipt-list-heading p:last-child {
  margin: 0;
  color: #607789;
  font-size: 14px;
}

.receipt-list {
  display: grid;
  gap: 12px;
  margin-top: 22px;
}

.receipt-list-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid #dce8e3;
  border-radius: 14px;
  background: #fbfdfc;
  transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
}

.receipt-list-item:hover {
  border-color: #8bc3a7;
  box-shadow: 0 8px 22px rgb(48 99 76 / 10%);
  transform: translateY(-1px);
}

.receipt-list-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 12px;
  background: #e4f4eb;
  color: #28775b;
  font-size: 20px;
  font-weight: 800;
}

.receipt-list-main {
  min-width: 0;
}

.receipt-list-main strong {
  display: block;
  overflow: hidden;
  color: #173b58;
  font-size: 15px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.receipt-list-main p {
  margin: 4px 0;
  color: #36566b;
  font-size: 14px;
  font-weight: 650;
}

.receipt-list-main small {
  color: #657b89;
  font-size: 12px;
}

.receipt-list-main b {
  color: #2b765c;
}

.receipt-view-link {
  color: #276f59;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.receipt-view-link span {
  margin-left: 4px;
  font-size: 17px;
}

.receipt-unavailable {
  color: #74837d;
  font-size: 12px;
  font-weight: 650;
  text-align: right;
}

.receipt-detail {
  width: min(840px, 100%);
  margin-inline: auto;
}

.receipt-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e6eeeb;
}

.receipt-detail h2 {
  margin: 7px 0 0;
  color: #173b58;
  font-size: 28px;
}

.receipt-detail-note {
  margin: 20px 0;
  padding: 13px 15px;
  border-radius: 10px;
  background: #f0f8f4;
  color: #426b5b;
  font-size: 13px;
  line-height: 1.55;
}

.receipt-detail dl {
  display: grid;
  grid-template-columns: minmax(145px, .7fr) 1.3fr;
  gap: 0;
  margin: 0 0 24px;
  border: 1px solid #e1ebe7;
  border-radius: 12px;
  overflow: hidden;
}

.receipt-detail dt,
.receipt-detail dd {
  margin: 0;
  padding: 13px 15px;
  border-bottom: 1px solid #e8efec;
  font-size: 14px;
}

.receipt-detail dt {
  background: #f7faf8;
  color: #617887;
  font-weight: 700;
}

.receipt-detail dd {
  color: #23465d;
  font-weight: 700;
}

.receipt-detail img {
  display: block;
  max-width: 100%;
  margin: 0 0 24px;
  padding: 10px;
  border: 1px solid #e1ebe7;
  border-radius: 12px;
}

@media (max-width: 760px) {
  .receipt-page-heading,
  .receipt-list-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .receipt-list-item {
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 10px 12px;
    padding: 15px;
  }

  .receipt-list-icon {
    width: 40px;
    height: 40px;
  }

  .receipt-list-item .status-badge,
  .receipt-view-link,
  .receipt-unavailable {
    grid-column: 2;
    justify-self: start;
  }

  .receipt-list-main small {
    display: block;
    line-height: 1.6;
  }

  .receipt-detail-header {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .receipt-detail dl {
    grid-template-columns: minmax(0, 1fr);
  }

  .receipt-detail dt {
    padding-bottom: 5px;
    border-bottom: 0;
  }

  .receipt-detail dd {
    padding-top: 5px;
  }
}

:global(.app-shell[data-theme='dark'] .receipt-page-heading h1),
:global(.app-shell[data-theme='dark'] .receipt-list-heading h2),
:global(.app-shell[data-theme='dark'] .receipt-detail h2),
:global(.app-shell[data-theme='dark'] .receipt-list-main strong) {
  color: #e5f0ea;
}

:global(.app-shell[data-theme='dark'] .receipt-page-heading .muted),
:global(.app-shell[data-theme='dark'] .receipt-list-heading .payment-step),
:global(.app-shell[data-theme='dark'] .receipt-detail-header .eyebrow) {
  color: #b2c2bb;
}

:global(.app-shell[data-theme='dark'] .receipt-list-panel),
:global(.app-shell[data-theme='dark'] .receipt-detail),
:global(.app-shell[data-theme='dark'] .receipt-list-item) {
  border-color: #3a5047;
  background: #1d2b26;
}

:global(.app-shell[data-theme='dark'] .receipt-list-item:hover) {
  border-color: #638e74;
  box-shadow: 0 8px 22px rgb(0 0 0 / 18%);
}

:global(.app-shell[data-theme='dark'] .receipt-list-heading),
:global(.app-shell[data-theme='dark'] .receipt-detail-header) {
  border-color: #40564c;
}

:global(.app-shell[data-theme='dark'] .receipt-list-heading p:last-child),
:global(.app-shell[data-theme='dark'] .receipt-list-main small) {
  color: #a7bdb0;
}

:global(.app-shell[data-theme='dark'] .receipt-list-main p),
:global(.app-shell[data-theme='dark'] .receipt-list-main b),
:global(.app-shell[data-theme='dark'] .receipt-detail dd) {
  color: #c9ded1;
}

:global(.app-shell[data-theme='dark'] .receipt-list-icon) {
  background: #294b36;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .receipt-view-link) {
  color: #9cdbb4;
}

:global(.app-shell[data-theme='dark'] .receipt-unavailable) {
  color: #b2c2bb;
}

:global(.app-shell[data-theme='dark'] .receipt-view-link:hover) {
  color: #c0ebcf;
}

:global(.app-shell[data-theme='dark'] .receipt-detail-note) {
  background: #263a32;
  color: #c1d0c9;
}

:global(.app-shell[data-theme='dark'] .receipt-detail img) {
  border-color: #40564c;
  background: #fff;
}

:global(.app-shell[data-theme='dark'] .receipt-detail dt) {
  background: #243730;
  color: #a7bdb0;
}

:global(.app-shell[data-theme='dark'] .receipt-detail dt),
:global(.app-shell[data-theme='dark'] .receipt-detail dd) {
  border-color: #40564c;
}

:global(.app-shell[data-theme='dark'] .receipt-list-item .status-badge[data-status='pending']) {
  border: 1px solid #806b3e;
  background: #403821;
  color: #f0d48b;
}

:global(.app-shell[data-theme='dark'] .receipt-list-item .status-badge[data-status='verified']) {
  border: 1px solid #426d55;
  background: #244231;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .receipt-list-item .status-badge[data-status='rejected']) {
  border: 1px solid #754849;
  background: #40272a;
  color: #f0a6a6;
}

:global(.app-shell[data-theme='dark'] .receipt-page .button-quiet) {
  border-color: #40534b;
  background: #263630;
  color: #d2dfd8;
}
</style>
