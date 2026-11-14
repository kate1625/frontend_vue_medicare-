<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ApiError, apiRequest, getApiData } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

interface Method {
  payment_method_id: number
  method_name: string
  type: 'cash' | 'ewallet' | 'card' | 'bank'
  account_name: string | null
  account_no: string | null
  instructions: string | null
  is_active: number | boolean | string
  is_maintenance: number | boolean | string
}

const rows = ref<Method[]>([])
const editing = ref(0)
const loading = ref(true)
const saving = ref(false)
const maintenanceSavingId = ref(0)
const error = ref('')
const success = ref('')
const form = reactive({
  method_name: '',
  type: 'cash' as Method['type'],
  account_name: '',
  account_no: '',
  instructions: '',
  is_active: true,
  is_maintenance: false,
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await getApiData<Method[]>('/api/payment-methods')
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load payment methods.'
  } finally {
    loading.value = false
  }
}

function active(row: Method) {
  return row.is_active === true || Number(row.is_active) === 1
}

function maintenance(row: Method) {
  return row.is_maintenance === true || Number(row.is_maintenance) === 1
}

function edit(row: Method) {
  editing.value = row.payment_method_id
  success.value = ''
  error.value = ''
  Object.assign(form, {
    method_name: row.method_name,
    type: row.type,
    account_name: row.account_name || '',
    account_no: row.account_no || '',
    instructions: row.instructions || '',
    is_active: active(row),
    is_maintenance: maintenance(row),
  })
  document.querySelector('.payment-method-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function reset() {
  editing.value = 0
  Object.assign(form, {
    method_name: '',
    type: 'cash' as Method['type'],
    account_name: '',
    account_no: '',
    instructions: '',
    is_active: true,
    is_maintenance: false,
  })
}

async function save() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await apiRequest(editing.value ? `/api/payment-methods/${editing.value}` : '/api/payment-methods', {
      method: editing.value ? 'PUT' : 'POST',
      body: JSON.stringify(form),
    })
    success.value = editing.value ? 'Payment method updated.' : 'Payment method added.'
    notify.success(success.value, editing.value ? 'Payment method updated' : 'Payment method added')
    reset()
    await load()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not save payment method.'
    notify.error(error.value, 'Payment method not saved')
  } finally {
    saving.value = false
  }
}

async function toggleMaintenance(row: Method) {
  maintenanceSavingId.value = row.payment_method_id
  error.value = ''
  success.value = ''
  try {
    await apiRequest(`/api/payment-methods/${row.payment_method_id}`, {
      method: 'PUT',
      body: JSON.stringify({
        method_name: row.method_name,
        type: row.type,
        account_name: row.account_name || '',
        account_no: row.account_no || '',
        instructions: row.instructions || '',
        is_active: active(row),
        is_maintenance: !maintenance(row),
      }),
    })
    await load()
    success.value = maintenance(row)
      ? `${row.method_name} is available again.`
      : `${row.method_name} is now under maintenance and unavailable to patients.`
    notify.success(success.value, 'Payment method updated')
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not update this payment method’s maintenance status.'
    notify.error(error.value, 'Payment method not updated')
  } finally {
    maintenanceSavingId.value = 0
  }
}

onMounted(load)
</script>

<template>
  <section class="page-heading methods-heading">
    <div>
      <p class="eyebrow">CLINIC SETUP <span>·</span> BILLING</p>
      <h1>Payment methods</h1>
      <p class="muted">Manage the payment options and account instructions patients see at checkout.</p>
    </div>
    <span class="methods-heading-note"><span></span> Patient checkout settings</span>
  </section>

  <p v-if="error && rows.length" class="alert alert-error methods-alert" role="alert">{{ error }}</p>

  <form class="surface payment-method-form" @submit.prevent="save">
    <header class="methods-form-heading">
      <div>
        <p class="methods-kicker">{{ editing ? 'UPDATE PAYMENT OPTION' : 'PAYMENT SETUP' }}</p>
        <h2>{{ editing ? `Edit ${form.method_name || 'payment method'}` : 'Add a payment method' }}</h2>
        <p>{{ editing ? 'Update the details patients see when selecting this payment option.' : 'Add a way for patients to pay and include any helpful account details.' }}</p>
      </div>
      <span class="methods-count">{{ rows.length }} {{ rows.length === 1 ? 'method' : 'methods' }}</span>
    </header>

    <div class="methods-form-grid">
      <label class="methods-field">
        <span>Method name <i>Required</i></span>
        <input v-model="form.method_name" required maxlength="50" placeholder="e.g. GCash or Bank Transfer">
        <small>This name will appear as an option to patients.</small>
      </label>

      <label class="methods-field">
        <span>Payment type <i>Required</i></span>
        <select v-model="form.type" required>
          <option value="cash">Cash</option>
          <option value="ewallet">E-wallet</option>
          <option value="card">Card</option>
          <option value="bank">Bank transfer</option>
        </select>
        <small>Choose the category that best matches this method.</small>
      </label>

      <label class="methods-field">
        <span>Account name <em>Optional</em></span>
        <input v-model="form.account_name" maxlength="100" placeholder="Name registered to the account">
        <small>Shown to patients so they can confirm the recipient.</small>
      </label>

      <label class="methods-field">
        <span>Account number <em>Optional</em></span>
        <input v-model="form.account_no" maxlength="50" placeholder="Account or mobile number">
        <small>Leave blank if this method does not use an account number.</small>
      </label>

      <label class="methods-field methods-field-full">
        <span>Payment instructions <em>Optional</em></span>
        <textarea v-model="form.instructions" rows="3" maxlength="5000" placeholder="Tell patients how to pay, what reference to include, or what to bring to the clinic."></textarea>
        <small>Clear instructions help patients complete their payment correctly.</small>
      </label>
    </div>

    <div class="methods-status-options">
      <label class="methods-toggle">
        <input v-model="form.is_active" type="checkbox">
        <span class="methods-toggle-copy"><strong>Available to patients</strong><small>Patients can select this payment method.</small></span>
        <span class="methods-toggle-indicator" aria-hidden="true"></span>
      </label>
    </div>
    <p class="methods-maintenance-hint">Need to temporarily disable a payment option? Set it to maintenance from its status in the configured methods table below.</p>

    <p v-if="error && !rows.length" class="form-error methods-form-error" role="alert">{{ error }}</p>

    <div class="methods-form-footer">
      <p>Changes here affect the payment options shown in the patient portal.</p>
      <div>
        <button v-if="editing" class="button button-quiet" type="button" :disabled="saving" @click="reset">Cancel</button>
        <button class="button button-primary" type="submit" :disabled="saving">
          {{ saving ? 'Saving method…' : editing ? 'Save changes' : 'Add payment method' }}
        </button>
      </div>
    </div>
  </form>

  <section class="methods-list-heading">
    <div><p class="methods-kicker">PATIENT CHECKOUT</p><h2>Configured payment methods</h2></div>
    <span v-if="!loading && !error" class="methods-list-count">{{ rows.length }} {{ rows.length === 1 ? 'option' : 'options' }}</span>
  </section>

  <SkeletonLoader v-if="loading" variant="table" :rows="4" :columns="6" label="Loading configured payment methods" />
  <section v-else-if="error && !rows.length" class="surface empty-state methods-empty">
    <strong>Could not load payment methods</strong><p>{{ error }}</p><button class="button button-quiet" type="button" @click="load">Try again</button>
  </section>
  <section v-else-if="!rows.length" class="surface empty-state methods-empty">
    <strong>No payment methods yet</strong><p>Add a payment method above to make it available in your clinic’s checkout settings.</p>
  </section>
  <section v-else class="surface table-wrap methods-table-wrap">
    <table class="data-table methods-table">
      <thead><tr><th>Payment method</th><th>Type</th><th>Account details</th><th>Status</th><th>Manage status</th><th><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row.payment_method_id">
          <td><strong class="methods-name">{{ row.method_name }}</strong></td>
          <td><span class="methods-type">{{ row.type === 'ewallet' ? 'E-wallet' : row.type === 'bank' ? 'Bank transfer' : row.type === 'card' ? 'Card' : 'Cash' }}</span></td>
          <td>
            <span v-if="row.account_name || row.account_no">{{ row.account_name || 'Account details' }}</span>
            <span v-else class="methods-no-account">No account details</span>
            <small v-if="row.account_no" class="table-secondary">{{ row.account_no }}</small>
          </td>
          <td>
            <span class="status-badge" :data-status="maintenance(row) || !active(row) ? 'inactive' : 'active'">
              {{ maintenance(row) ? 'Under maintenance' : active(row) ? 'Available' : 'Inactive' }}
            </span>
          </td>
          <td>
            <button
              class="methods-maintenance-action"
              :class="{ 'is-maintenance': maintenance(row) }"
              type="button"
              :disabled="maintenanceSavingId === row.payment_method_id"
              :aria-label="maintenance(row) ? `End maintenance for ${row.method_name}` : `Set ${row.method_name} under maintenance`"
              @click="toggleMaintenance(row)"
            >
              {{ maintenanceSavingId === row.payment_method_id ? 'Updating…' : maintenance(row) ? 'End maintenance' : 'Set maintenance' }}
            </button>
          </td>
          <td class="methods-actions"><button class="text-button" type="button" @click="edit(row)">Edit details</button></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.methods-heading .eyebrow span { padding: 0 4px; color: #a4b0ba; }
.methods-heading-note { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 9px; padding: 9px 13px; border: 1px solid #dfece5; border-radius: 999px; background: #f5faf7; color: #49675a; font-size: 10.8px; font-weight: 650; }
.methods-heading-note > span { width: 8px; height: 8px; border-radius: 50%; background: #4a9a75; box-shadow: 0 0 0 3px #e1f1e7; }
.methods-alert { margin: 0 0 15px; }
.payment-method-form { margin-bottom: 28px; padding: clamp(20px, 2.5vw, 30px); border-radius: 16px; }
.methods-form-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 23px; }
.methods-kicker { margin: 0 0 6px; color: #438d75; font-size: 10.8px; font-weight: 750; letter-spacing: 1px; }
.methods-form-heading h2,.methods-list-heading h2 { margin: 0; color: #26364a; font-size: 20.5px; font-weight: 720; letter-spacing: -.3px; }
.methods-form-heading > div > p:last-child { margin: 6px 0 0; color: #78879a; font-size: 13px; }
.methods-count,.methods-list-count { flex: 0 0 auto; padding: 6px 10px; border: 1px solid #e4ebe7; border-radius: 999px; background: #f7faf8; color: #667a70; font-size: 10.8px; font-weight: 650; }
.methods-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 20px; }
.methods-field { display: grid; align-content: start; gap: 7px; color: #405168; font-size: 11.9px; font-weight: 650; }
.methods-field > span:first-child { color: #405168; font-size: 11.9px; font-weight: 700; }
.methods-field i,.methods-field em { margin-left: 5px; color: #8793a2; font-size: 9.7px; font-style: normal; font-weight: 500; }
.methods-field input,.methods-field select,.methods-field textarea { width: 100%; min-width: 0; min-height: 43px; padding: 10px 12px; border: 1px solid #dce4e8; border-radius: 9px; background: #fff; color: #314359; font: inherit; font-size: 13px; }
.methods-field input::placeholder,.methods-field textarea::placeholder { color: #9aa5b2; font-weight: 400; }
.methods-field textarea { min-height: 82px; resize: vertical; line-height: 1.55; }
.methods-field input:focus,.methods-field select:focus,.methods-field textarea:focus { border-color: #69a98c; outline: 0; box-shadow: 0 0 0 3px rgb(67 141 117 / 13%); }
.methods-field small { color: #8390a0; font-size: 10.8px; font-weight: 450; line-height: 1.5; }
.methods-field-full { grid-column: 1 / -1; }
.methods-status-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 21px; }
.methods-toggle { position: relative; display: flex; align-items: center; gap: 12px; min-height: 68px; padding: 13px 15px; border: 1px solid #e1e9e4; border-radius: 11px; background: #f9fbfa; cursor: pointer; }
.methods-toggle > input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.methods-toggle-copy { display: grid; flex: 1; gap: 4px; }
.methods-toggle-copy strong { color: #405168; font-size: 11.9px; }
.methods-toggle-copy small { color: #8390a0; font-size: 10.8px; line-height: 1.5; }
.methods-toggle-indicator { position: relative; width: 34px; height: 20px; flex: 0 0 auto; border-radius: 99px; background: #cbd4d1; transition: background .16s ease; }
.methods-toggle-indicator::after { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgb(23 43 34 / 20%); content: ''; transition: transform .16s ease; }
.methods-toggle > input:checked + .methods-toggle-copy + .methods-toggle-indicator { background: #438d75; }
.methods-toggle > input:checked + .methods-toggle-copy + .methods-toggle-indicator::after { transform: translateX(14px); }
.methods-toggle > input:focus-visible + .methods-toggle-copy + .methods-toggle-indicator { outline: 3px solid rgb(67 141 117 / 25%); outline-offset: 3px; }
.methods-toggle:has(input:checked) { border-color: #d3e6da; background: #f5faf6; }
.methods-form-error { margin: 16px 0 0; }
.methods-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 22px; padding-top: 17px; border-top: 1px solid #edf0f2; }
.methods-form-footer > p { max-width: 470px; margin: 0; color: #78879a; font-size: 10.8px; line-height: 1.6; }
.methods-form-footer > div { display: flex; flex-wrap: wrap; gap: 9px; }
.methods-form-footer .button { min-height: 42px; padding-inline: 17px; border-radius: 9px; }
.methods-list-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin: 0 2px 13px; }
.methods-empty { min-height: 125px; justify-items: center; gap: 7px; padding: 24px; text-align: center; }
.methods-empty p { max-width: 480px; margin: 0; color: #78879a; font-size: 11.9px; }
.methods-table-wrap { border-radius: 14px; }
.methods-table { width: 100%; min-width: 820px; }
.methods-table th { padding: 13px 16px; }
.methods-table td { padding: 14px 16px; vertical-align: middle; }
.methods-name { color: #35495b; font-size: 13px; }
.methods-type { display: inline-block; padding: 5px 8px; border-radius: 7px; background: #f0f4f2; color: #566a60; font-size: 10.8px; font-weight: 650; }
.methods-no-account { color: #8793a2; font-size: 11.9px; }
.methods-table td small { display: block; margin-top: 4px; }
.methods-actions { min-width: 110px; text-align: right; }
.methods-actions .text-button { margin: 0; }
.methods-maintenance-hint { margin: 12px 0 0; color: #78879a; font-size: 10.8px; line-height: 1.6; }
.methods-maintenance-action { min-height: 31px; padding: 0 10px; border: 1px solid #dfe8e3; border-radius: 7px; background: #fff; color: #536d78; cursor: pointer; font: inherit; font-size: 10.8px; font-weight: 650; white-space: nowrap; }
.methods-maintenance-action:hover:not(:disabled) { border-color: #e4c990; background: #fffaf0; color: #8b641f; }
.methods-maintenance-action.is-maintenance { border-color: #d3e6da; background: #f3f9f5; color: #34745f; }
.methods-maintenance-action:disabled { cursor: wait; opacity: .65; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
:global(:root[data-theme='dark'] .methods-form-heading h2),
:global(:root[data-theme='dark'] .methods-list-heading h2),
:global(:root[data-theme='dark'] .methods-toggle-copy strong),
:global(:root[data-theme='dark'] .methods-name),
:global(:root[data-theme='dark'] .methods-field > span:first-child) { color: #e4ede9; }
:global(:root[data-theme='dark'] .methods-form-heading > div > p:last-child),
:global(:root[data-theme='dark'] .methods-form-footer > p),
:global(:root[data-theme='dark'] .methods-field small),
:global(:root[data-theme='dark'] .methods-toggle-copy small),
:global(:root[data-theme='dark'] .methods-empty p),
:global(:root[data-theme='dark'] .methods-maintenance-hint) { color: #b2c2bb; }
:global(:root[data-theme='dark'] .methods-field i),
:global(:root[data-theme='dark'] .methods-field em) { color: #b2c2bb; }
:global(:root[data-theme='dark'] .methods-heading-note),
:global(:root[data-theme='dark'] .methods-count),
:global(:root[data-theme='dark'] .methods-list-count),
:global(:root[data-theme='dark'] .methods-type) { border-color: #40534b; background: #263630; color: #d2dfd8; }
:global(:root[data-theme='dark'] .methods-field input),
:global(:root[data-theme='dark'] .methods-field select),
:global(:root[data-theme='dark'] .methods-field textarea) { border-color: #40534b; background: #1d2a25; color: #f0f5f2; color-scheme: dark; }
:global(:root[data-theme='dark'] .methods-field input::placeholder),
:global(:root[data-theme='dark'] .methods-field textarea::placeholder) { color: #a3b3ae; opacity: 1; }
:global(:root[data-theme='dark'] .methods-field select option) { background: #1d2a25; color: #f0f5f2; }
:global(:root[data-theme='dark'] .methods-toggle) { border-color: #40534b; background: #263630; }
:global(:root[data-theme='dark'] .methods-toggle:has(input:checked)) { border-color: #456b55; background: #2b4037; }
:global(:root[data-theme='dark'] .methods-form-footer) { border-color: #354741; }
:global(:root[data-theme='dark'] .methods-table th) { border-color: #354741; background: #263630; color: #cbd9d2; }
:global(:root[data-theme='dark'] .methods-table td) { border-color: #354741; color: #e0eae4; }
:global(:root[data-theme='dark'] .methods-table .table-secondary),
:global(:root[data-theme='dark'] .methods-no-account) { color: #b2c2bb; }
:global(:root[data-theme='dark'] .methods-maintenance-action) { border-color: #40534b; background: #263630; color: #d2dfd8; }
:global(:root[data-theme='dark'] .methods-maintenance-action:hover:not(:disabled)) { border-color: #806b43; background: #3a3428; color: #f0d7a2; }
:global(:root[data-theme='dark'] .methods-maintenance-action.is-maintenance) { border-color: #456b55; background: #2b4037; color: #c5e7d6; }
@media (max-width: 760px) {
  .methods-heading { align-items: flex-start; flex-direction: column; gap: 13px; }
  .methods-form-grid,.methods-status-options { grid-template-columns: minmax(0, 1fr); }
  .methods-field-full { grid-column: auto; }
  .methods-form-footer { align-items: stretch; flex-direction: column; }
  .methods-form-footer > div { flex-direction: column-reverse; }
  .methods-form-footer .button { width: 100%; }
  .methods-table-wrap { overflow-x: auto; }
}
@media (max-width: 480px) {
  .methods-form-heading { flex-direction: column; }
  .methods-count { align-self: flex-start; }
}
</style>
