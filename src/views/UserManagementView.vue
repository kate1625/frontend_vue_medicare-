<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError, apiRequest, getApiData, getStaffUser } from '../services/api'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

interface Account {
  user_id: number
  username: string
  email: string
  role_name: string
  is_verified: number | boolean
  status: 'active' | 'inactive' | 'locked'
  last_login: string | null
  failed_login_attempts: number
  created_at: string
  appointment_count: number | string
  amount_paid: number | string
  balance_due: number | string
  is_archived: number | boolean
  last_activity: string | null
  patient_payment_status: string
}

const rows = ref<Account[]>([])
const loading = ref(true)
const busy = ref(0)
const error = ref('')
const success = ref('')
const current = getStaffUser()
const archiveTarget = ref<Account | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await getApiData<Account[]>('/api/users')
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load accounts.'
  } finally {
    loading.value = false
  }
}

async function setStatus(row: Account, status: Account['status']) {
  busy.value = row.user_id
  error.value = ''
  success.value = ''
  try {
    await apiRequest(`/api/users/${row.user_id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
    success.value = `Account for ${row.username} updated.`
    notify.success(success.value, 'Account updated')
    await load()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not update account.'
    notify.error(error.value, 'Account not updated')
  } finally {
    busy.value = 0
  }
}

async function archive(row: Account) {
  archiveTarget.value = row
}

async function confirmArchive() {
  const row = archiveTarget.value
  archiveTarget.value = null
  if (!row) return
  busy.value = row.user_id
  error.value = ''
  success.value = ''
  try {
    const result = await apiRequest<{ message: string }>(`/api/users/${row.user_id}`, { method: 'DELETE' })
    success.value = result.message
    notify.success(success.value, 'Account archived')
    await load()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not archive this account.'
    notify.error(error.value, 'Account not archived')
  } finally {
    busy.value = 0
  }
}

function money(value: number | string) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0)
}

function isPatient(row: Account) {
  return row.role_name.toLowerCase() === 'patient'
}

function isArchived(row: Account) {
  return row.is_archived === true || Number(row.is_archived) === 1
}

function isVerified(row: Account) {
  return row.is_verified === true || Number(row.is_verified) === 1
}

onMounted(load)
</script>

<template>
  <section class="page-heading">
    <div><h1>User Management</h1><p class="muted">Review verification, account access, appointment activity, and payment balances.</p></div>
    <button class="button button-quiet" type="button" :disabled="loading" @click="load">Refresh</button>
  </section>
  <p v-if="error" class="alert alert-error" role="alert">{{ error }}</p>
  <SkeletonLoader v-if="loading" variant="table" :rows="5" :columns="7" label="Loading user accounts" />
  <section v-else-if="!rows.length" class="surface empty-state"><strong>No accounts found</strong></section>
  <section v-else class="surface table-wrap">
    <table class="data-table">
      <thead><tr><th>User</th><th>Role / verification</th><th>Account</th><th>Activity</th><th>Payments</th><th>Last sign-in</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row.user_id">
          <td><strong>{{ row.username }}</strong><small class="table-secondary">{{ row.email }}</small></td>
          <td>{{ row.role_name }}<small class="table-secondary">{{ isVerified(row) ? 'Email verified' : 'Not verified' }}</small></td>
          <td><span class="status-badge" :data-status="row.status">{{ row.status }}</span><small class="table-secondary">{{ row.failed_login_attempts }} failed attempts</small></td>
          <td>{{ row.appointment_count }} appointments<small class="table-secondary">Last activity: {{ row.last_activity || '—' }}</small></td>
          <td><strong>{{ money(row.amount_paid) }} paid</strong><small class="table-secondary">{{ money(row.balance_due) }} due · {{ row.patient_payment_status.replaceAll('_', ' ') }}</small></td>
          <td>{{ row.last_login || '—' }}</td>
          <td class="actions-cell">
            <button v-if="row.status !== 'active' && !isArchived(row)" class="row-action" type="button" :disabled="busy === row.user_id" @click="setStatus(row, 'active')">Activate</button>
            <button v-if="row.status === 'active'" class="row-action" type="button" :disabled="busy === row.user_id || current?.id === row.user_id" @click="setStatus(row, 'inactive')">Deactivate</button>
            <button v-if="row.status !== 'locked'" class="row-action" type="button" :disabled="busy === row.user_id || current?.id === row.user_id" @click="setStatus(row, 'locked')">Lock</button>
            <button v-if="isPatient(row) && !isArchived(row)" class="row-action row-action-danger" type="button" :disabled="busy === row.user_id || current?.id === row.user_id" @click="archive(row)">Archive</button>
            <small v-else-if="isPatient(row) && isArchived(row)" class="table-secondary">Archived</small>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
  <ConfirmDialog
    :open="archiveTarget !== null"
    title="Archive this account?"
    :message="archiveTarget ? `Sign-in for ${archiveTarget.username} will be disabled, while associated clinic history is retained.` : ''"
    confirm-label="Archive account"
    @cancel="archiveTarget = null"
    @confirm="confirmArchive"
  />
</template>
