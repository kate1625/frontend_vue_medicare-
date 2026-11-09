<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError, getPatients, type Patient } from '../services/api'
import UiIcon from '../components/UiIcon.vue'

const patients = ref<Patient[]>([])
const error = ref('')
const loading = ref(true)
const activeCount = computed(() => patients.value.filter((patient) => patient.status === 'active').length)
const inactiveCount = computed(() => patients.value.length - activeCount.value)
const recentPatients = computed(() => patients.value.slice(0, 5))

async function loadPatients() {
  loading.value = true
  error.value = ''
  try {
    patients.value = await getPatients()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load patient information.'
  } finally {
    loading.value = false
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

onMounted(loadPatients)
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">OVERVIEW</p>
      <h1>Dashboard</h1>
      <p class="muted">A simple overview of your patient directory.</p>
    </div>
    <RouterLink class="button button-primary" to="/patients">View patients <UiIcon name="arrow-right" /></RouterLink>
  </section>

  <div v-if="error" class="alert alert-error" role="alert">
    {{ error }}
    <button class="text-button" type="button" @click="loadPatients">Try again</button>
  </div>

  <div class="stats-grid">
    <article class="stat-card">
      <span class="stat-icon stat-icon-blue"><UiIcon name="users-round" /></span>
      <p>Total patients</p>
      <strong>{{ loading ? '—' : patients.length }}</strong>
      <small>Records in your directory</small>
    </article>
    <article class="stat-card">
      <span class="stat-icon stat-icon-green"><UiIcon name="check-circle" /></span>
      <p>Active records</p>
      <strong>{{ loading ? '—' : activeCount }}</strong>
      <small>Currently marked active</small>
    </article>
    <article class="stat-card">
      <span class="stat-icon stat-icon-amber"><UiIcon name="clock" /></span>
      <p>Inactive records</p>
      <strong>{{ loading ? '—' : inactiveCount }}</strong>
      <small>Currently marked inactive</small>
    </article>
  </div>

  <section class="surface recent-panel">
    <div class="section-heading">
      <div>
        <h2>Recently added</h2>
        <p class="muted">Latest records from the database</p>
      </div>
      <RouterLink class="text-link" to="/patients">See all patients <UiIcon name="arrow-right" /></RouterLink>
    </div>

    <div v-if="loading" class="empty-state">Loading patient records…</div>
    <div v-else-if="!recentPatients.length && !error" class="empty-state">
      <span class="empty-icon"><UiIcon name="users-round" /></span>
      <strong>Your directory is ready</strong>
      <p>Add a patient to see the first record here.</p>
      <RouterLink class="button button-primary" to="/patients">Open patient directory</RouterLink>
    </div>
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Patient</th><th>Contact</th><th>Status</th><th>Added</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="patient in recentPatients" :key="patient.id">
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
            <td><span class="status-badge" :class="`status-${patient.status}`">{{ patient.status }}</span></td>
            <td>{{ formatDate(patient.created_at) }}</td>
            <td><RouterLink class="row-action" :to="`/patients/${patient.id}`">View <UiIcon name="arrow-right" /></RouterLink></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
