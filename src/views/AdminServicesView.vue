<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ApiError, apiRequest, getApiData } from '../services/api'

interface Service {
  service_id: number
  service_name: string
  category: string | null
  description: string | null
  price: string
  duration_min: number | null
  is_active: number | boolean | string
}

const rows = ref<Service[]>([])
const loading = ref(true)
const saving = ref(false)
const busy = ref(0)
const error = ref('')
const success = ref('')
const dialogOpen = ref(false)
const editingId = ref(0)
const form = reactive({ service_name: '', category: '', description: '', price: '', duration_min: '30', is_active: true })

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await getApiData<Service[]>('/api/services')
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load services.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = 0
  Object.assign(form, { service_name: '', category: '', description: '', price: '', duration_min: '30', is_active: true })
  dialogOpen.value = true
}

function openEdit(item: Service) {
  editingId.value = item.service_id
  Object.assign(form, {
    service_name: item.service_name,
    category: item.category || '',
    description: item.description || '',
    price: String(item.price),
    duration_min: String(item.duration_min || 30),
    is_active: item.is_active === true || Number(item.is_active) === 1,
  })
  dialogOpen.value = true
}

async function save() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await apiRequest(editingId.value ? `/api/services/${editingId.value}` : '/api/services', {
      method: editingId.value ? 'PUT' : 'POST',
      body: JSON.stringify({ ...form, price: Number(form.price), duration_min: Number(form.duration_min) }),
    })
    success.value = editingId.value ? 'Service updated.' : 'Service created.'
    dialogOpen.value = false
    await load()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not save service.'
  } finally {
    saving.value = false
  }
}

async function archive(item: Service) {
  busy.value = item.service_id
  error.value = ''
  try {
    await apiRequest(`/api/services/${item.service_id}`, { method: 'DELETE' })
    await load()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not deactivate service.'
  } finally {
    busy.value = 0
  }
}

function active(item: Service) {
  return item.is_active === true || Number(item.is_active) === 1
}

onMounted(load)
</script>

<template>
  <section class="page-heading services-heading">
    <div><p class="eyebrow">PAGE 23 · ADMIN</p><h1>Services</h1><p class="muted">Manage active clinic services and prices.</p></div>
    <button class="button button-primary" type="button" @click="openCreate"><span aria-hidden="true">＋</span> Add service</button>
  </section>
  <p v-if="error && !dialogOpen" class="alert alert-error" role="alert">{{ error }}</p>
  <p v-if="success" class="alert alert-success" role="status">{{ success }}</p>
  <section v-if="loading" class="surface empty-state"><span class="loading-dot" /><strong>Loading services</strong></section>
  <section v-else-if="!rows.length" class="surface empty-state"><strong>No services found</strong><p>Add a service to make it available in the clinic catalog.</p></section>
  <section v-else class="surface table-wrap">
    <table class="data-table">
      <thead><tr><th>Service</th><th>Category</th><th>Price</th><th>Appointment length</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="item in rows" :key="item.service_id">
          <td><strong>{{ item.service_name }}</strong><small class="table-secondary">{{ item.description }}</small></td>
          <td>{{ item.category || 'Not categorized' }}</td>
          <td><strong class="service-price">₱{{ Number(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</strong></td>
          <td>{{ item.duration_min }} {{ item.duration_min === 1 ? 'minute' : 'minutes' }}</td>
          <td><span class="status-badge" :data-status="active(item) ? 'active' : 'inactive'">{{ active(item) ? 'Active' : 'Inactive' }}</span></td>
          <td class="service-actions">
            <button class="text-button" type="button" @click="openEdit(item)">Edit details</button>
            <button class="text-button service-deactivate" type="button" :disabled="busy === item.service_id || !active(item)" @click="archive(item)">{{ busy === item.service_id ? 'Updating…' : 'Deactivate' }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
  <div v-if="dialogOpen" class="service-dialog-backdrop" @click.self="!saving && (dialogOpen = false)">
    <section class="surface service-dialog" role="dialog" aria-modal="true" aria-labelledby="service-dialog-title" aria-describedby="service-dialog-description">
      <header class="service-dialog-heading">
        <div class="service-dialog-icon" aria-hidden="true">✦</div>
        <div class="service-dialog-title">
          <p class="service-dialog-kicker">{{ editingId ? 'UPDATE SERVICE' : 'SERVICE CATALOG' }}</p>
          <h2 id="service-dialog-title">{{ editingId ? 'Edit service details' : 'Add a clinic service' }}</h2>
          <p id="service-dialog-description">{{ editingId ? 'Keep the service information and booking availability up to date.' : 'Add a service patients can understand and book at your clinic.' }}</p>
        </div>
        <button class="service-close-button" type="button" aria-label="Close dialog" :disabled="saving" @click="dialogOpen = false">×</button>
      </header>

      <form class="service-form" @submit.prevent="save">
        <p v-if="error" class="service-form-error" role="alert">{{ error }}</p>

        <div class="service-form-grid">
          <label class="service-field service-field-full">
            <span>Service name <i>Required</i></span>
            <input v-model="form.service_name" maxlength="100" placeholder="e.g. Dental cleaning" autocomplete="off" required>
            <small>Use a clear name patients will recognize.</small>
          </label>

          <label class="service-field">
            <span>Category <em>Optional</em></span>
            <input v-model="form.category" maxlength="50" placeholder="e.g. Preventive care">
            <small>Helps organize your service catalog.</small>
          </label>

          <label class="service-field">
            <span>Price <i>Required</i></span>
            <div class="service-price-input"><span>₱</span><input v-model="form.price" type="number" min="0" step="0.01" placeholder="0.00" inputmode="decimal" required></div>
            <small>Enter the amount in Philippine pesos.</small>
          </label>

          <label class="service-field">
            <span>Appointment length <i>Required</i></span>
            <div class="service-duration-input"><input v-model="form.duration_min" type="number" min="5" max="600" step="5" inputmode="numeric" required><span>minutes</span></div>
            <small>Choose between 5 and 600 minutes.</small>
          </label>

          <label class="service-active-toggle">
            <input v-model="form.is_active" type="checkbox">
            <span><strong>Available for booking</strong><small>Patients can see and book this service.</small></span>
            <span class="service-toggle-indicator" aria-hidden="true"></span>
          </label>

          <label class="service-field service-field-full">
            <span>Description <em>Optional</em></span>
            <textarea v-model="form.description" rows="3" maxlength="5000" placeholder="Briefly explain what this service includes and what patients can expect."></textarea>
            <small>A short description helps patients choose the right service.</small>
          </label>
        </div>

        <footer class="service-dialog-footer">
          <p><i>*</i> Required information must be completed before saving.</p>
          <div>
            <button class="button button-quiet" type="button" :disabled="saving" @click="dialogOpen = false">Cancel</button>
            <button class="button button-primary" :disabled="saving">{{ saving ? 'Saving service…' : editingId ? 'Save changes' : 'Add service' }}</button>
          </div>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.services-heading .button { gap: 8px; }
.services-heading .button > span { font-size: 17px; line-height: 1; }
.services-heading .muted { color: #5f6e82; font-size: 14px; }
.service-price { color: #2f4358; font-size: 13px; font-weight: 750; }
.service-actions { min-width: 150px; }
.service-actions .text-button { margin: 0 9px 0 0; color: #28664f; font-size: 13px; font-weight: 700; white-space: nowrap; }
.service-deactivate { color: #a64c53; }
.service-actions .service-deactivate { color: #a13e46; }
.service-deactivate:disabled { cursor: not-allowed; opacity: .5; }
.services-heading + .alert { font-size: 13px; }
:deep(.data-table th) { color: #536579; font-size: 12px; font-weight: 750; }
:deep(.data-table td) { color: #45586d; font-size: 13.5px; }
:deep(.data-table td strong:not(.service-price)) { color: #2f4358; font-size: 13.5px; }
:deep(.data-table .table-secondary) { color: #66778a; font-size: 12px; line-height: 1.5; }
:deep(.status-badge) { font-size: 11px; font-weight: 750; }
.service-dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; overflow-y: auto; padding: 24px; background: rgb(25 37 47 / 58%); backdrop-filter: blur(4px); }
.service-dialog { width: min(660px,100%); max-height: min(90vh,820px); overflow-y: auto; padding: clamp(20px,3vw,30px); border: 1px solid rgb(255 255 255 / 90%); border-radius: 18px; box-shadow: 0 28px 90px rgb(22 37 49 / 25%); }
.service-dialog-heading { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 24px; }
.service-dialog-icon { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; border-radius: 13px; background: linear-gradient(145deg,#e4f6ed,#edf0ff); color: #438d75; font-size: 18px; }
.service-dialog-title { min-width: 0; flex: 1; }
.service-dialog-kicker { margin: 0 0 5px; color: #34745f; font-size: 11px; font-weight: 800; letter-spacing: 1px; }
.service-dialog-title h2 { margin: 0; color: #20344a; font-size: 21px; font-weight: 760; letter-spacing: -.4px; }
.service-dialog-title > p:last-child { margin: 6px 0 0; color: #5f6e82; font-size: 13px; line-height: 1.55; }
.service-close-button { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border: 1px solid #e1e8e5; border-radius: 9px; background: #fff; color: #637287; cursor: pointer; font-size: 23px; line-height: 1; }
.service-close-button:hover:not(:disabled) { border-color: #cbd9d1; background: #f7faf8; }
.service-close-button:disabled { cursor: wait; opacity: .6; }
.service-form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 17px 18px; }
.service-field { display: grid; align-content: start; gap: 7px; color: #35495f; font-size: 12.5px; font-weight: 700; }
.service-field > span:first-child { color: #35495f; font-size: 12.5px; font-weight: 750; }
.service-field i,.service-field em { margin-left: 5px; color: #66768a; font-size: 10.5px; font-style: normal; font-weight: 600; }
.service-field i { color: #bd5960; }
.service-field input,.service-field textarea { width: 100%; min-width: 0; min-height: 45px; padding: 10px 12px; border: 1px solid #cbd6df; border-radius: 9px; background: #fff; color: #263a50; font: inherit; font-size: 13px; }
.service-field textarea { min-height: 88px; resize: vertical; line-height: 1.6; }
.service-field input::placeholder,.service-field textarea::placeholder { color: #69798c; font-weight: 450; opacity: 1; }
.service-field input:focus,.service-field textarea:focus { border-color: #69a98c; outline: 0; box-shadow: 0 0 0 3px rgb(67 141 117 / 13%); }
.service-field small,.service-active-toggle small { color: #5d6e82; font-size: 11.5px; font-weight: 500; line-height: 1.5; }
.service-field-full { grid-column: 1 / -1; }
.service-price-input,.service-duration-input { display: flex; min-height: 43px; align-items: center; overflow: hidden; border: 1px solid #dce4e8; border-radius: 9px; background: #fff; }
.service-price-input:focus-within,.service-duration-input:focus-within { border-color: #69a98c; box-shadow: 0 0 0 3px rgb(67 141 117 / 13%); }
.service-price-input > span,.service-duration-input > span { flex: 0 0 auto; padding: 0 12px; color: #566a7e; font-size: 12px; font-weight: 650; }
.service-price-input > span { align-self: stretch; display: grid; place-items: center; border-right: 1px solid #e7ecef; background: #f8faf9; font-weight: 700; }
.service-price-input input,.service-duration-input input { min-height: 41px; border: 0; border-radius: 0; box-shadow: none !important; }
.service-duration-input input { max-width: 110px; }
.service-duration-input > span { border-left: 1px solid #e7ecef; }
.service-active-toggle { position: relative; display: flex; min-height: 66px; grid-column: 1 / -1; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #e1e9e4; border-radius: 10px; background: #f8faf9; cursor: pointer; }
.service-active-toggle > input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.service-active-toggle > span:nth-child(2) { display: grid; flex: 1; gap: 4px; }
.service-active-toggle strong { color: #34495e; font-size: 12.5px; font-weight: 750; }
.service-toggle-indicator { position: relative; width: 36px; height: 21px; flex: 0 0 auto; border-radius: 99px; background: #cbd4d1; transition: background .16s ease; }
.service-toggle-indicator::after { position: absolute; top: 3px; left: 3px; width: 15px; height: 15px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgb(23 43 34 / 20%); content: ''; transition: transform .16s ease; }
.service-active-toggle > input:checked ~ .service-toggle-indicator { background: #438d75; }
.service-active-toggle > input:checked ~ .service-toggle-indicator::after { transform: translateX(15px); }
.service-active-toggle > input:focus-visible ~ .service-toggle-indicator { outline: 3px solid rgb(67 141 117 / 25%); outline-offset: 3px; }
.service-active-toggle:has(input:checked) { border-color: #d3e6da; background: #f5faf6; }
.service-form-error { margin: 0 0 16px; padding: 11px 13px; border: 1px solid #edc9cd; border-radius: 9px; background: #fff7f7; color: #913941; font-size: 12.5px; font-weight: 600; line-height: 1.5; }
.service-dialog-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 21px; padding-top: 17px; border-top: 1px solid #edf0f2; }
.service-dialog-footer > p { margin: 0; color: #596a7e; font-size: 11.5px; font-weight: 500; line-height: 1.5; }
.service-dialog-footer > p i { color: #bd5960; font-style: normal; font-weight: 750; }
.service-dialog-footer > div { display: flex; flex: 0 0 auto; gap: 9px; }
.service-dialog-footer .button { min-height: 41px; padding-inline: 15px; border-radius: 9px; }
:global(:root[data-theme='dark']) .services-heading .muted { color: #b6c4bd; }
:global(:root[data-theme='dark']) .service-actions .text-button { color: #a9dec1; }
:global(:root[data-theme='dark']) .service-actions .service-deactivate { color: #f0a9ae; }
:global(:root[data-theme='dark']) :deep(.data-table th) { color: #c1d0c9; }
:global(:root[data-theme='dark']) :deep(.data-table td) { color: #d0dbd5; }
:global(:root[data-theme='dark']) :deep(.data-table td strong:not(.service-price)) { color: #e4ede9; }
:global(:root[data-theme='dark']) :deep(.data-table .table-secondary) { color: #afbeb8; }
:global(:root[data-theme='dark']) :deep(.status-badge) { color: #e4ede9; }
:global(:root[data-theme='dark']) .service-dialog-kicker { color: #9ed5b5; }
:global(:root[data-theme='dark']) .service-field i,:global(:root[data-theme='dark']) .service-field em { color: #b2c0b9; }
:global(:root[data-theme='dark']) .service-field i { color: #f0a9ae; }
:global(:root[data-theme='dark']) .service-field input::placeholder,:global(:root[data-theme='dark']) .service-field textarea::placeholder { color: #a5b5ad; }
:global(:root[data-theme='dark']) .service-field small,:global(:root[data-theme='dark']) .service-active-toggle small,:global(:root[data-theme='dark']) .service-dialog-footer > p { color: #b2c0b9; }
:global(:root[data-theme='dark']) .service-price-input > span,:global(:root[data-theme='dark']) .service-duration-input > span { color: #d2dfd8; }
:global(:root[data-theme='dark']) .service-active-toggle strong { color: #e4ede9; }
:global(:root[data-theme='dark']) .service-dialog { border-color: #40534b; }
:global(:root[data-theme='dark']) .service-dialog-title h2,:global(:root[data-theme='dark']) .service-field > span:first-child,:global(:root[data-theme='dark']) .service-active-toggle strong,:global(:root[data-theme='dark']) .service-price { color: #e4ede9; }
:global(:root[data-theme='dark']) .service-dialog-title > p:last-child,:global(:root[data-theme='dark']) .service-field small,:global(:root[data-theme='dark']) .service-active-toggle small,:global(:root[data-theme='dark']) .service-dialog-footer > p { color: #a3b3ae; }
:global(:root[data-theme='dark']) .service-close-button,:global(:root[data-theme='dark']) .service-field input,:global(:root[data-theme='dark']) .service-field textarea,:global(:root[data-theme='dark']) .service-price-input,:global(:root[data-theme='dark']) .service-duration-input { border-color: #40534b; background: #1d2a25; color: #e4ede9; }
:global(:root[data-theme='dark']) .service-price-input > span { border-color: #40534b; background: #263630; }
:global(:root[data-theme='dark']) .service-duration-input > span { border-color: #40534b; color: #c1d0c9; }
:global(:root[data-theme='dark']) .service-active-toggle { border-color: #40534b; background: #263630; }
:global(:root[data-theme='dark']) .service-active-toggle:has(input:checked) { border-color: #456b55; background: #2b4037; }
:global(:root[data-theme='dark']) .service-dialog-footer { border-color: #354741; }
:global(:root[data-theme='dark']) .service-form-error { border-color: #634044; background: #38282a; color: #efb8bd; }
:global(:root[data-theme='dark']) .service-deactivate { color: #e7a1a6; }
@media (max-width: 600px) {
  .services-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
  .service-dialog-backdrop { align-items: start; padding: 12px; }
  .service-dialog { max-height: calc(100dvh - 24px); padding: 19px; }
  .service-form-grid { grid-template-columns: minmax(0,1fr); gap: 15px; }
  .service-field-full,.service-active-toggle { grid-column: auto; }
  .service-dialog-footer { align-items: stretch; flex-direction: column; }
  .service-dialog-footer > div { flex-direction: column-reverse; }
  .service-dialog-footer .button { width: 100%; }
}
</style>
