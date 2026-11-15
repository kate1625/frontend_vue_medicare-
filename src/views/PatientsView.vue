<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, createPatient, deletePatient, getPatients, getPortalRole, updatePatient, type Patient, type PatientInput } from '../services/api'
import UiIcon from '../components/UiIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

const emptyForm = (): PatientInput => ({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  address: '',
  status: 'active',
})

const patients = ref<Patient[]>([])
const query = ref('')
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})
const success = ref('')
const loading = ref(true)
const saving = ref(false)
const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref<PatientInput>(emptyForm())
const canManagePatients = ref(false)
const archiveTarget = ref<Patient | null>(null)
const route = useRoute()
const today = new Date()
today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
const maxDateOfBirth = today.toISOString().slice(0, 10)

const filteredPatients = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  if (!search) return patients.value
  return [...patients.value].sort((first, second) =>
    `${first.last_name} ${first.first_name}`.localeCompare(`${second.last_name} ${second.first_name}`),
  ).filter((patient) =>
    [patient.first_name, patient.last_name, patient.email ?? '', patient.phone ?? '', String(patient.id)]
      .join(' ')
      .toLocaleLowerCase()
      .includes(search),
  )
})

async function loadPatients() {
  loading.value = true
  error.value = ''
  try {
    patients.value = await getPatients()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load patient records.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  error.value = ''
  fieldErrors.value = {}
  success.value = ''
  formOpen.value = true
}

function openEdit(patient: Patient) {
  editingId.value = patient.id
  form.value = {
    first_name: patient.first_name,
    last_name: patient.last_name,
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    date_of_birth: patient.date_of_birth ?? '',
    gender: patient.gender,
    address: patient.address ?? '',
    status: patient.status,
  }
  error.value = ''
  fieldErrors.value = {}
  success.value = ''
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  fieldErrors.value = {}
}

async function savePatient() {
  saving.value = true
  error.value = ''
  fieldErrors.value = {}
  try {
    if (editingId.value === null) {
      await createPatient(form.value)
      success.value = 'Patient record created.'
      notify.success(success.value, 'Patient added')
    } else {
      await updatePatient(editingId.value, form.value)
      success.value = 'Patient record updated.'
      notify.success(success.value, 'Patient updated')
    }
    formOpen.value = false
    await loadPatients()
  } catch (cause) {
    if (cause instanceof ApiError) {
      error.value = cause.message
      fieldErrors.value = cause.fields
    } else {
      error.value = 'Could not save the patient record.'
    }
    notify.error(error.value, 'Patient record not saved')
  } finally {
    saving.value = false
  }
}

async function removePatient(patient: Patient) {
  archiveTarget.value = patient
}

async function confirmArchivePatient() {
  const patient = archiveTarget.value
  archiveTarget.value = null
  if (!patient) return
  error.value = ''
  success.value = ''
  try {
    await deletePatient(patient.id)
    success.value = 'Patient record archived.'
    notify.success(success.value, 'Patient archived')
    await loadPatients()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not delete the patient record.'
    notify.error(error.value, 'Patient record not archived')
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function escapeHtml(value: string) {
  const escapedCharacters: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return value.replace(/[&<>"']/g, (character) => escapedCharacters[character] ?? character)
}

function printRecords(records: Patient[]) {
  if (!records.length) return

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) {
    notify.error('Allow pop-ups to print patient records.', 'Print window blocked')
    return
  }

  printWindow.opener = null
  const patientPages = records.map((patient) => {
    const fullName = `${patient.first_name} ${patient.last_name}`
    const details: Array<[string, string]> = [
      ['Patient number', `#${patient.id}`],
      ['First name', patient.first_name],
      ['Last name', patient.last_name],
      ['Email', patient.email || '—'],
      ['Phone', patient.phone || '—'],
      ['Date of birth', patient.date_of_birth ? formatDate(patient.date_of_birth) : '—'],
      ['Gender', patient.gender || '—'],
      ['Address', patient.address || '—'],
      ['Status', patient.status],
      ['Record created', formatDate(patient.created_at)],
      ['Last updated', patient.updated_at ? formatDate(patient.updated_at) : '—'],
    ]

    return `<article class="patient-record">
      <h2>${escapeHtml(fullName)}</h2>
      <table><tbody>${details.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>
    </article>`
  }).join('')

  const singlePatient = records.length === 1 ? records[0] : undefined
  const documentTitle = singlePatient
    ? `Patient Record - ${singlePatient.first_name} ${singlePatient.last_name}`
    : 'Patient Records'

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(documentTitle)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 32px; color: #1f2933; font: 14px/1.5 Arial, sans-serif; }
          header { margin-bottom: 24px; border-bottom: 2px solid #23836c; padding-bottom: 14px; }
          h1 { margin: 0; color: #174e42; font-size: 24px; }
          header p { margin: 5px 0 0; color: #52615b; }
          .patient-record { break-inside: avoid; page-break-inside: avoid; }
          .patient-record + .patient-record { break-before: page; page-break-before: always; }
          h2 { margin: 0 0 12px; font-size: 19px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { width: 50%; border: 1px solid #d5ded9; padding: 9px 12px; text-align: left; vertical-align: top; }
          th { background: #f1f6f3; font-weight: 600; }
          @page { margin: 16mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <header>
          <h1>${escapeHtml(records.length === 1 ? 'Patient Record' : 'Patient Records')}</h1>
          <p>Printed ${escapeHtml(formatDate(new Date().toISOString()))} · ${records.length} ${records.length === 1 ? 'record' : 'records'}</p>
        </header>
        ${patientPages}
      </body>
    </html>`)
  printWindow.document.close()
  printWindow.onafterprint = () => printWindow.close()
  printWindow.focus()
  window.setTimeout(() => printWindow.print(), 150)
}

onMounted(() => {
  canManagePatients.value = ['staff', 'admin'].includes(getPortalRole() ?? '')
  void loadPatients()
  if (route.path === '/staff/patients/edit') openCreate()
})
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">DIRECTORY</p>
      <h1>Patients</h1>
      <p class="muted">View and manage patient contact records.</p>
    </div>
    <button class="button button-quiet" type="button" :disabled="loading || !patients.length" @click="printRecords(patients)">
      <UiIcon name="file" /> Print all records
    </button>
  </section>

  <div v-if="error && !formOpen" class="alert alert-error" role="alert">{{ error }}</div>

  <section class="surface directory-panel patient-directory">
    <div class="directory-toolbar">
      <label class="search-field">
        <span class="search-icon"><UiIcon name="search" /></span>
        <input v-model="query" type="search" placeholder="Search name, email, phone or patient number" aria-label="Search patients" />
      </label>
      <span class="result-count">{{ filteredPatients.length }} {{ filteredPatients.length === 1 ? 'record' : 'records' }}</span>
    </div>

    <SkeletonLoader v-if="loading" variant="table" :rows="5" :columns="5" :contained="true" label="Loading patient records" />
    <div v-else-if="!patients.length && !error" class="empty-state">
      <span class="empty-icon"><UiIcon name="users-round" /></span>
      <strong>No patient records yet</strong>
      <p>Create a record to start your directory. Use fictional data for this demonstration.</p>
      <button v-if="canManagePatients" class="button button-primary" type="button" @click="openCreate">Add first patient</button>
    </div>
    <div v-else-if="!filteredPatients.length" class="empty-state">
      <strong>No matching patients</strong>
      <p>Try another name, email, phone number, or patient number.</p>
    </div>
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Patient</th><th>Contact details</th><th>Date of birth</th><th>Status</th><th class="actions-head">Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="patient in filteredPatients" :key="patient.id">
            <td>
              <RouterLink class="patient-name" :to="`/patients/${patient.id}`">
                {{ patient.first_name }} {{ patient.last_name }}
              </RouterLink>
              <small class="table-secondary">Patient #{{ patient.id }}</small>
            </td>
            <td>
              {{ patient.email || '—' }}
              <small class="table-secondary">{{ patient.phone || 'No phone recorded' }}</small>
            </td>
            <td>{{ patient.date_of_birth ? formatDate(patient.date_of_birth) : '—' }}</td>
            <td><span class="status-badge" :class="`status-${patient.status}`">{{ patient.status }}</span></td>
            <td class="actions-cell">
              <RouterLink class="row-action" :to="`/patients/${patient.id}`">View</RouterLink>
              <button class="row-action" type="button" :aria-label="`Print ${patient.first_name} ${patient.last_name}'s record`" @click="printRecords([patient])">Print</button>
              <template v-if="canManagePatients">
                <button class="row-action" type="button" @click="openEdit(patient)">Edit</button>
                <button class="row-action row-action-danger" type="button" @click="removePatient(patient)">Delete</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ConfirmDialog
    :open="archiveTarget !== null"
    title="Archive this patient record?"
    :message="archiveTarget ? `${archiveTarget.first_name} ${archiveTarget.last_name}'s record will be hidden from the active patient list.` : ''"
    confirm-label="Archive record"
    @cancel="archiveTarget = null"
    @confirm="confirmArchivePatient"
  />

  <div v-if="formOpen" class="modal-backdrop" @click.self="closeForm">
    <section class="form-modal" role="dialog" aria-modal="true" :aria-labelledby="'patient-form-title'">
      <header class="modal-heading">
        <div>
          <p class="eyebrow">{{ editingId === null ? 'NEW RECORD' : `PATIENT #${editingId}` }}</p>
          <h2 id="patient-form-title">{{ editingId === null ? 'Add a patient' : 'Edit patient' }}</h2>
        </div>
        <button class="icon-button" type="button" aria-label="Close form" @click="closeForm"><UiIcon name="x" /></button>
      </header>

      <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>
      <form class="patient-form" @submit.prevent="savePatient">
        <div class="form-grid">
          <label class="field">
            <span>First name <i>*</i></span>
            <input v-model="form.first_name" required maxlength="50" autocomplete="given-name" />
            <small v-if="fieldErrors.first_name" class="field-error">{{ fieldErrors.first_name }}</small>
          </label>
          <label class="field">
            <span>Last name <i>*</i></span>
            <input v-model="form.last_name" required maxlength="50" autocomplete="family-name" />
            <small v-if="fieldErrors.last_name" class="field-error">{{ fieldErrors.last_name }}</small>
          </label>
          <label class="field">
            <span>Email</span>
            <input v-model="form.email" type="email" maxlength="100" autocomplete="email" />
            <small v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</small>
          </label>
          <label class="field">
            <span>Phone</span>
            <input v-model="form.phone" type="tel" maxlength="20" autocomplete="tel" />
            <small v-if="fieldErrors.phone" class="field-error">{{ fieldErrors.phone }}</small>
          </label>
          <label class="field">
            <span>Date of birth</span>
            <input v-model="form.date_of_birth" type="date" :max="maxDateOfBirth" />
            <small v-if="fieldErrors.date_of_birth" class="field-error">{{ fieldErrors.date_of_birth }}</small>
          </label>
          <label class="field">
            <span>Gender <i>*</i></span>
            <select v-model="form.gender" required>
              <option value="" disabled>Select an option</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
            <small v-if="fieldErrors.gender" class="field-error">{{ fieldErrors.gender }}</small>
          </label>
          <label class="field field-full">
            <span>Address</span>
            <input v-model="form.address" maxlength="255" autocomplete="street-address" />
            <small v-if="fieldErrors.address" class="field-error">{{ fieldErrors.address }}</small>
          </label>
          <label class="field">
            <span>Record status</span>
            <select v-model="form.status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <small v-if="fieldErrors.status" class="field-error">{{ fieldErrors.status }}</small>
          </label>
        </div>
        <p class="form-note">Avoid entering real patient or clinical information in this demo.</p>
        <footer class="form-actions">
          <button class="button button-quiet" type="button" :disabled="saving" @click="closeForm">Cancel</button>
          <button class="button button-primary" type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : editingId === null ? 'Create record' : 'Save changes' }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>
