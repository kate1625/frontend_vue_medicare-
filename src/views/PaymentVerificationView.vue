<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError, apiRequest, getApiData } from '../services/api'
import UiIcon from '../components/UiIcon.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

interface PendingPayment {
  payment_id: number
  appointment_id: number
  patient_name: string
  service_name: string
  amount: string
  payment_plan: 'full' | 'downpayment'
  payment_percent: number | null
  amount_due: string
  balance_due: string
  reference_no: string | null
  receipt_no: string | null
  method_name: string
  paid_at: string | null
  status: 'pending' | 'verified' | 'rejected' | 'refunded'
  verification_source: 'clinic' | 'paymongo'
}
type PaymentHistory = PendingPayment

const rows = ref<PendingPayment[]>([])
const historyRows = ref<PaymentHistory[]>([])
const loading = ref(true)
const busy = ref(0)
const loadError = ref('')
const actionError = ref('')
const message = ref('')

const searchQuery = ref('')
const methodFilter = ref('all')
const viewMode = ref<'table' | 'card'>('card')
const activeTab = ref<'pending' | 'history'>('pending')

const pendingCount = computed(() => rows.value.length)
const pendingTotal = computed(() => {
  const total = rows.value.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  return total.toLocaleString('en-PH', { minimumFractionDigits: 2 })
})
const todayVerified = ref('0.00')

const filteredRows = computed(() => {
  let result = activeTab.value === 'pending' ? rows.value : historyRows.value
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(r => 
      r.patient_name.toLowerCase().includes(query) ||
      r.reference_no?.toLowerCase().includes(query) ||
      r.receipt_no?.toLowerCase().includes(query)
    )
  }
  
  if (methodFilter.value !== 'all') {
    result = result.filter(r => r.method_name.toLowerCase() === methodFilter.value.toLowerCase())
  }
  
  return result
})


async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [pending, history] = await Promise.all([
      getApiData<PendingPayment[]>('/api/payments/pending'),
      getApiData<PaymentHistory[]>('/api/payments/history'),
    ])
    rows.value = pending
    historyRows.value = history
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : 'Could not load pending payments.'
  } finally {
    loading.value = false
  }
}

async function setStatus(row: PendingPayment, status: 'verified' | 'rejected') {
  busy.value = row.payment_id
  actionError.value = ''
  message.value = ''
  try {
    if (status === 'verified' && row.verification_source === 'paymongo') {
      const result = await apiRequest<{ data: { status: string }; message: string }>('/api/payments/paymongo/confirm', {
        method: 'POST',
        body: JSON.stringify({ payment_id: row.payment_id, verify: true }),
      })
      message.value = result.message
    } else {
      await apiRequest(`/api/payments/${row.payment_id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      })
      message.value = `Payment #${row.payment_id} ${status}.`
    }
    notify.success(message.value, status === 'verified' ? 'Payment verified' : 'Payment rejected')
    await load()
  } catch (error) {
    actionError.value = error instanceof ApiError ? error.message : 'Could not update payment.'
    notify.error(actionError.value, 'Payment update failed')
  } finally {
    busy.value = 0
  }
}

async function copyRef(ref: string | null) {
  if (!ref) return
  try {
    await navigator.clipboard.writeText(ref)
    message.value = 'Reference code copied to clipboard'
    notify.info(message.value, 'Reference copied')
    setTimeout(() => { message.value = '' }, 2000)
  } catch {
    notify.error('Could not copy the reference code. Please select and copy it manually.', 'Copy failed')
  }
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

onMounted(load)
</script>

<template>
  <div class="payment-verification-page">
    <!-- Page Header -->
    <section class="page-header">
      <div class="header-left">
        <h1>Payment Verification</h1>
        <p class="subtitle">Review and process patient transactions</p>
      </div>
      <div class="header-right">
        <div class="search-box">
          <UiIcon name="search" class="search-icon" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search patient or reference..." 
            class="search-input"
          />
        </div>
        <select v-model="methodFilter" class="filter-select">
          <option value="all">All Methods</option>
          <option value="gcash">GCash</option>
          <option value="maya">Maya</option>
          <option value="cash">Cash</option>
          <option value="bank transfer">Bank Transfer</option>
        </select>
        <button class="refresh-btn" :disabled="loading" @click="load" title="Refresh Data">
          <UiIcon name="refresh-cw" :class="{ 'spinning': loading }" />
        </button>
      </div>
    </section>

    <!-- Summary Metric Cards -->
    <section class="metrics-grid">
      <article class="metric-card">
        <div class="metric-icon metric-icon-yellow">
          <UiIcon name="clock" />
        </div>
        <div class="metric-content">
          <p class="metric-label">Pending Approvals</p>
          <div class="metric-values">
            <span class="metric-count">{{ pendingCount }}</span>
            <span class="metric-amount">₱{{ pendingTotal }}</span>
          </div>
        </div>
      </article>

      <article class="metric-card">
        <div class="metric-icon metric-icon-green">
          <UiIcon name="check-circle" />
        </div>
        <div class="metric-content">
          <p class="metric-label">Today's Verified Payments</p>
          <div class="metric-values">
            <span class="metric-amount-single">₱{{ todayVerified }}</span>
          </div>
        </div>
      </article>

      <article class="metric-card">
        <div class="metric-icon metric-icon-blue">
          <UiIcon name="zap" />
        </div>
        <div class="metric-content">
          <p class="metric-label">PayMongo Sync Status</p>
          <div class="metric-status">
            <span class="status-dot status-connected"></span>
            <span class="status-text">Connected</span>
          </div>
        </div>
      </article>
    </section>

    <!-- Alerts -->
    <p v-if="actionError" class="alert alert-error" role="alert">
      <UiIcon name="alert-circle" /> {{ actionError }}
    </p>

    <!-- Filter Tabs & View Toggle -->
    <section class="controls-bar">
      <div class="filter-tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'pending' }" type="button" @click="activeTab = 'pending'">
          Pending Verification <span class="tab-count">{{ rows.length }}</span>
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'history' }" type="button" @click="activeTab = 'history'">
          Payment History <span class="tab-count">{{ historyRows.length }}</span>
        </button>
      </div>
      <div class="view-toggle">
        <button 
          :class="['view-btn', { 'active': viewMode === 'table' }]"
          @click="viewMode = 'table'"
          title="Table View"
        >
          <UiIcon name="list" />
        </button>
        <button 
          :class="['view-btn', { 'active': viewMode === 'card' }]"
          @click="viewMode = 'card'"
          title="Card View"
        >
          <UiIcon name="grid" />
        </button>
      </div>
    </section>

    <SkeletonLoader v-if="loading" :variant="viewMode === 'card' ? 'cards' : 'table'" :rows="4" :columns="7" label="Loading payment verification records" />

    <!-- Error State -->
    <section v-else-if="loadError" class="error-state">
      <UiIcon name="alert-triangle" class="error-icon" />
      <strong>Payment list unavailable</strong>
      <p>{{ loadError }}</p>
      <button class="btn btn-primary" @click="load">Retry</button>
    </section>

    <!-- Empty State -->
    <section v-else-if="!filteredRows.length" class="empty-state">
      <UiIcon name="inbox" class="empty-icon" />
      <strong>{{ activeTab === 'pending' ? 'No pending payments' : 'No payment history' }}</strong>
      <p>{{ activeTab === 'pending' ? 'New submissions will appear here.' : 'Verified and rejected payments will appear here.' }}</p>
    </section>

    <!-- Card View -->
    <section v-else-if="viewMode === 'card'" class="cards-grid">
      <article v-for="row in filteredRows" :key="row.payment_id" class="payment-card">
        <div class="card-header">
          <div class="patient-info">
            <div class="avatar">{{ getInitials(row.patient_name) }}</div>
            <div>
              <h3 class="patient-name">{{ row.patient_name }}</h3>
              <p class="treatment">{{ row.service_name }}</p>
            </div>
          </div>
          <span class="amount">₱{{ Number(row.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</span>
        </div>

        <div class="card-body">
          <div class="info-row">
            <span class="info-label">Payment plan</span>
            <span class="info-value">{{ row.payment_plan === 'downpayment' ? `${row.payment_percent}% downpayment` : 'Full payment' }} · Balance after verification: ₱{{ Number(row.balance_due).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Appt / Payment ID</span>
            <span class="info-value">Appointment #{{ row.appointment_id }} • Payment #{{ row.payment_id }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Payment Method</span>
            <span class="method-badge" :class="`method-${row.method_name.toLowerCase().replace(' ', '-')}`">
              {{ row.method_name }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Reference Code</span>
            <button class="ref-chip" @click="copyRef(row.reference_no || row.receipt_no)" title="Click to copy">
              {{ row.reference_no || row.receipt_no || '—' }}
              <UiIcon name="copy" class="copy-icon" />
            </button>
          </div>
        </div>

        <div v-if="row.verification_source === 'paymongo'" class="paymongo-alert">
          <UiIcon name="alert-circle" />
          <span>PayMongo test checkout: staff verification is required after the checkout is completed.</span>
        </div>

        <div v-if="activeTab === 'pending'" class="card-actions">
          <button 
            class="btn btn-verify"
            :disabled="busy === row.payment_id"
            @click="setStatus(row, 'verified')"
          >
            <span v-if="busy === row.payment_id" class="payment-action-spinner" aria-hidden="true"></span>
            <UiIcon v-else name="check" />
            {{ busy === row.payment_id ? (row.verification_source === 'paymongo' ? 'Checking…' : 'Verifying…') : row.verification_source === 'paymongo' ? 'Verify completed test payment' : 'Verify Payment' }}
          </button>
          <button 
            class="btn btn-reject"
            :disabled="busy === row.payment_id"
            @click="setStatus(row, 'rejected')"
          >
            <UiIcon name="x" />
            Reject / Flag
          </button>
          <button class="btn-icon" title="View Receipt / Details">
            <UiIcon name="eye" />
          </button>
        </div>
        <div v-else class="payment-history-status">
          <span class="status-badge" :class="row.status === 'verified' ? 'status-verified' : 'status-rejected'">
            {{ row.status === 'verified' ? 'Verified' : 'Rejected' }}
          </span>
          <small>{{ row.paid_at ? new Date(row.paid_at).toLocaleString('en-PH') : 'No date recorded' }}</small>
        </div>
      </article>
    </section>

    <!-- Table View -->
    <section v-else class="table-container">
      <table class="payments-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Treatment</th>
            <th>Appt / Payment ID</th>
            <th>Payment Method</th>
            <th>Reference Code</th>
            <th>Plan / Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filteredRows" :key="row.payment_id">
            <td>
              <div class="patient-cell">
                <div class="avatar-sm">{{ getInitials(row.patient_name) }}</div>
                <span>{{ row.patient_name }}</span>
              </div>
            </td>
            <td>{{ row.service_name }}</td>
            <td>Appt #{{ row.appointment_id }} • Pay #{{ row.payment_id }}</td>
            <td>
              <span class="method-badge" :class="`method-${row.method_name.toLowerCase().replace(' ', '-')}`">
                {{ row.method_name }}
              </span>
            </td>
            <td>
              <button class="ref-chip-sm" @click="copyRef(row.reference_no || row.receipt_no)">
                {{ row.reference_no || row.receipt_no || '—' }}
                <UiIcon name="copy" />
              </button>
            </td>
            <td class="amount-cell">{{ row.payment_plan === 'downpayment' ? `${row.payment_percent}% downpayment` : 'Full payment' }}<br>₱{{ Number(row.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}<small>Balance: ₱{{ Number(row.balance_due).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</small></td>
            <td>
              <span class="status-badge" :class="row.status === 'verified' ? 'status-verified' : row.status === 'rejected' ? 'status-rejected' : 'status-pending'">{{ row.status === 'verified' ? 'Verified' : row.status === 'rejected' ? 'Rejected' : 'Pending' }}</span>
            </td>
            <td>
              <div class="table-actions">
                <button 
                  class="btn-sm btn-verify-sm"
                  :disabled="busy === row.payment_id"
                  @click="setStatus(row, 'verified')"
                  :title="row.verification_source === 'paymongo' ? 'Verify completed test payment' : 'Verify payment'"
                >
                  <span v-if="busy === row.payment_id" class="payment-action-spinner payment-action-spinner-small" aria-hidden="true"></span>
                  <UiIcon v-else name="check" />
                </button>
                <button v-if="activeTab === 'pending'"
                  class="btn-sm btn-reject-sm"
                  :disabled="busy === row.payment_id"
                  @click="setStatus(row, 'rejected')"
                  title="Reject"
                >
                  <UiIcon name="x" />
                </button>
                <button v-if="activeTab === 'pending'" class="btn-sm btn-view-sm" title="View Details">
                  <UiIcon name="eye" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.payment-verification-page {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 2rem;
  background: #F8FAFC;
  min-height: calc(100vh - 66px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left h1 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
  letter-spacing: -0.025em;
}

.subtitle {
  color: #64748b;
  margin: 0;
  font-size: 0.875rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.875rem;
  color: #94a3b8;
  width: 1rem;
  height: 1rem;
}

.search-input {
  padding: 0.625rem 0.875rem 0.625rem 2.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: white;
  font-size: 0.875rem;
  color: #0f172a;
  width: 280px;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #0F766E;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
}

.filter-select {
  padding: 0.625rem 2rem 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: white url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") no-repeat right 0.5rem center;
  background-size: 1.5em 1.5em;
  font-size: 0.875rem;
  color: #0f172a;
  cursor: pointer;
  appearance: none;
}

.filter-select:focus {
  outline: none;
  border-color: #0F766E;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: white;
  color: #64748b;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0F766E;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  flex-shrink: 0;
}

.metric-icon-yellow { background: #fef3c7; color: #d97706; }
.metric-icon-green { background: #dcfce7; color: #16a34a; }
.metric-icon-blue { background: #dbeafe; color: #2563eb; }

.metric-label {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 0.375rem 0;
  font-weight: 500;
}

.metric-values {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.metric-count {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.metric-amount {
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
}

.metric-amount-single {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.metric-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.status-connected {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.status-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #16a34a;
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.alert-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.alert-error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.controls-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-tabs {
  display: flex;
  gap: 0.5rem;
  background: white;
  padding: 0.25rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  cursor: pointer;
}

.tab-btn.active {
  background: #0F766E;
  color: white;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  font-size: 0.75rem;
}

.tab-btn:not(.active) .tab-count {
  background: #f1f5f9;
  color: #64748b;
}

.view-toggle {
  display: flex;
  background: white;
  padding: 0.25rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
}

.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 0.5rem;
  cursor: pointer;
}

.view-btn.active {
  background: #0F766E;
  color: white;
}

.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  text-align: center;
  gap: 0.75rem;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid #e2e8f0;
  border-top-color: #0F766E;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.payment-action-spinner {
  display: inline-block;
  width: 15px;
  height: 15px;
  margin-right: 7px;
  border: 2px solid rgb(255 255 255 / 45%);
  border-top-color: #fff;
  border-radius: 50%;
  vertical-align: -3px;
  animation: payment-action-spin .7s linear infinite;
}

.payment-action-spinner-small {
  width: 12px;
  height: 12px;
  margin: 0;
  border-width: 2px;
}

.payment-history-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid #e8eef0;
}

.payment-history-status small {
  color: #718793;
  font-size: 11px;
}

@keyframes payment-action-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .payment-action-spinner { animation: none; }
}

.error-icon, .empty-icon {
  width: 3rem;
  height: 3rem;
  color: #94a3b8;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 1.25rem;
}

.payment-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.25rem 1.25rem 1rem 1.25rem;
  gap: 1rem;
}

.patient-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, #0F766E 0%, #10b981 100%);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.patient-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.treatment {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
}

.amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}

.card-body {
  padding: 0 1.25rem 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.info-label {
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 500;
}

.info-value {
  font-size: 0.8125rem;
  color: #0f172a;
  text-align: right;
}

.method-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.method-gcash { background: #dcfce7; color: #166534; }
.method-maya { background: #fef3c7; color: #92400e; }
.method-cash { background: #f1f5f9; color: #475569; }
.method-bank-transfer { background: #e0f2fe; color: #075985; }

.ref-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-family: 'Courier New', monospace;
  color: #475569;
  cursor: pointer;
}

.paymongo-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0 1.25rem 1rem 1.25rem;
  padding: 0.75rem;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 0.5rem;
  color: #92400e;
  font-size: 0.8125rem;
}

.paymongo-alert svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
}

.btn-verify {
  flex: 1;
  justify-content: center;
  background: #10b981;
  color: white;
}

.btn-reject {
  flex: 1;
  justify-content: center;
  background: white;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  border-radius: 0.5rem;
  cursor: pointer;
  flex-shrink: 0;
}

.table-container {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}

.payments-table {
  width: 100%;
  border-collapse: collapse;
}

.payments-table thead {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.payments-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
}

.payments-table tbody tr {
  border-bottom: 1px solid #f1f5f9;
}

.payments-table td {
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: #0f172a;
}

.patient-cell {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.avatar-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: linear-gradient(135deg, #0F766E 0%, #10b981 100%);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.amount-cell {
  font-weight: 600;
}

.ref-chip-sm {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-family: 'Courier New', monospace;
  color: #475569;
  cursor: pointer;
}

.ref-chip-sm svg {
  width: 0.75rem;
  height: 0.75rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.btn-sm svg {
  width: 0.875rem;
  height: 0.875rem;
}

.btn-verify-sm { background: #dcfce7; color: #16a34a; }
.btn-reject-sm { background: #fef2f2; color: #dc2626; }
.btn-view-sm { background: #f1f5f9; color: #475569; }

:global(.app-shell[data-theme='dark'] .payment-verification-page) {
  background: transparent;
  color: #d7e5de;
}

:global(.app-shell[data-theme='dark'] .payment-card),
:global(.app-shell[data-theme='dark'] .table-container),
:global(.app-shell[data-theme='dark'] .metric-card),
:global(.app-shell[data-theme='dark'] .filter-tabs),
:global(.app-shell[data-theme='dark'] .view-toggle),
:global(.app-shell[data-theme='dark'] .loading-state),
:global(.app-shell[data-theme='dark'] .error-state),
:global(.app-shell[data-theme='dark'] .empty-state) {
  border-color: #3b5148;
  background: #1d2b26;
  color: #d7e5de;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page h1),
:global(.app-shell[data-theme='dark'] .payment-verification-page h2),
:global(.app-shell[data-theme='dark'] .payment-verification-page h3),
:global(.app-shell[data-theme='dark'] .payment-verification-page strong),
:global(.app-shell[data-theme='dark'] .payment-verification-page .amount),
:global(.app-shell[data-theme='dark'] .payment-verification-page .metric-count),
:global(.app-shell[data-theme='dark'] .payment-verification-page .metric-amount-single) {
  color: #e6f0eb;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page p),
:global(.app-shell[data-theme='dark'] .payment-verification-page label),
:global(.app-shell[data-theme='dark'] .payment-verification-page small),
:global(.app-shell[data-theme='dark'] .payment-verification-page .subtitle),
:global(.app-shell[data-theme='dark'] .payment-verification-page .metric-label),
:global(.app-shell[data-theme='dark'] .payment-verification-page .metric-amount),
:global(.app-shell[data-theme='dark'] .payment-verification-page .info-label),
:global(.app-shell[data-theme='dark'] .payment-verification-page .payments-table th),
:global(.app-shell[data-theme='dark'] .payment-verification-page .payment-history-status small) {
  color: #a9bdb3;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .patient-name),
:global(.app-shell[data-theme='dark'] .payment-verification-page .info-value),
:global(.app-shell[data-theme='dark'] .payment-verification-page .payments-table td) {
  color: #d7e5de;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page input),
:global(.app-shell[data-theme='dark'] .payment-verification-page select),
:global(.app-shell[data-theme='dark'] .payment-verification-page textarea),
:global(.app-shell[data-theme='dark'] .payment-verification-page .ref-chip),
:global(.app-shell[data-theme='dark'] .payment-verification-page .ref-chip-sm) {
  border-color: #496258;
  background: #202f29;
  color: #e0ece5;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .search-input::placeholder) {
  color: #a3b3ae;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .filter-select) {
  background-color: #202f29;
  background-image: none;
  appearance: auto;
  color-scheme: dark;
  min-width: 150px;
  padding-right: 0.875rem;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .refresh-btn),
:global(.app-shell[data-theme='dark'] .payment-verification-page .btn-icon) {
  border-color: #496258;
  background: #263630;
  color: #c1d0c9;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .refresh-btn:hover:not(:disabled)),
:global(.app-shell[data-theme='dark'] .payment-verification-page .btn-icon:hover) {
  background: #31453c;
  color: #e0ece5;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .card-actions),
:global(.app-shell[data-theme='dark'] .payment-verification-page .payments-table thead) {
  border-color: #3b5148;
  background: #24332e;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .payments-table tbody tr) {
  border-color: #354741;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .filter-tabs),
:global(.app-shell[data-theme='dark'] .payment-verification-page .view-toggle) {
  background: #202f29;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .tab-btn:not(.active)),
:global(.app-shell[data-theme='dark'] .payment-verification-page .view-btn:not(.active)) {
  color: #bdccc4;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .tab-btn:not(.active) .tab-count) {
  background: #354741;
  color: #d7e5de;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .metric-icon-yellow),
:global(.app-shell[data-theme='dark'] .payment-verification-page .method-maya) {
  background: #403821;
  color: #f0d48b;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .metric-icon-green),
:global(.app-shell[data-theme='dark'] .payment-verification-page .method-gcash),
:global(.app-shell[data-theme='dark'] .payment-verification-page .btn-verify-sm) {
  background: #244231;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .metric-icon-blue) {
  background: #263947;
  color: #b6dcf6;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .method-cash),
:global(.app-shell[data-theme='dark'] .payment-verification-page .btn-view-sm) {
  background: #263a32;
  color: #c4d8cc;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .method-bank-transfer) {
  background: #263947;
  color: #b6dcf6;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .btn-reject),
:global(.app-shell[data-theme='dark'] .payment-verification-page .btn-reject-sm) {
  background: #40272a;
  border-color: #754849;
  color: #f0a6a6;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .status-pending) {
  background: #403821;
  color: #f0d48b;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .paymongo-alert) {
  border-color: #806b3e;
  background: #403821;
  color: #f0d48b;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .alert-success) {
  border-color: #426d55;
  background: #244231;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .payment-verification-page .alert-error) {
  border-color: #754849;
  background: #40272a;
  color: #f0a6a6;
}

@media (max-width: 768px) {
  .payment-verification-page { padding: 1rem; }
  .header-right { width: 100%; }
  .search-input { width: 100%; }
  .cards-grid { grid-template-columns: 1fr; }
  .table-container { overflow-x: auto; }
  .payments-table { min-width: 800px; }
}
</style>
