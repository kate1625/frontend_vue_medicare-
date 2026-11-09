<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError, getApiData } from '../services/api'
import { sitemap } from '../router'

const props = defineProps<{ pageNumber: number }>()
const route = useRoute()
const page = computed(() => sitemap.find((item) => item.number === props.pageNumber))
const loading = ref(false)
const error = ref('')
const payload = ref<unknown>(null)
const hasLoaded = ref(false)

function endpointForPage() {
  let endpoint = page.value?.endpoint ?? ''
  for (const [key, value] of Object.entries(route.params)) {
    endpoint = endpoint.replace(`:${key}`, encodeURIComponent(String(value)))
  }
  return endpoint
}

async function loadPageData() {
  const endpoint = endpointForPage()
  if (!endpoint) return
  loading.value = true
  error.value = ''
  try {
    payload.value = await getApiData<unknown>(endpoint)
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load this page from the clinic API.'
  } finally {
    loading.value = false
    hasLoaded.value = true
  }
}

onMounted(loadPageData)
watch(() => [props.pageNumber, route.fullPath], loadPageData)
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">PAGE {{ String(pageNumber).padStart(2, '0') }} · {{ page?.area.toUpperCase() }}</p>
      <h1>{{ page?.title }}</h1>
      <p class="muted">Clinic data is requested from the configured backend endpoint.</p>
    </div>
    <button class="button button-quiet" type="button" :disabled="loading" @click="loadPageData">
      {{ loading ? 'Loading…' : 'Refresh' }}
    </button>
  </section>

  <section class="surface feature-state" aria-live="polite">
    <div v-if="loading" class="empty-state"><span class="loading-dot" aria-hidden="true"></span><strong>Loading clinic data</strong></div>
    <div v-else-if="error" class="empty-state">
      <strong>Backend response unavailable</strong>
      <p>{{ error }}</p>
      <small>Endpoint: {{ endpointForPage() }}</small>
      <button class="button button-primary" type="button" @click="loadPageData">Try again</button>
    </div>
    <div v-else-if="hasLoaded && (payload == null || (Array.isArray(payload) && payload.length === 0))" class="empty-state">
      <strong>No records returned</strong>
      <p>The backend returned an empty result for this page.</p>
    </div>
    <div v-else-if="payload !== null" class="feature-payload">
      <h2>Backend data</h2>
      <pre>{{ JSON.stringify(payload, null, 2) }}</pre>
    </div>
  </section>
</template>
