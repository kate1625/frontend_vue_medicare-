<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, type EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ApiError, apiRequest, getApiData } from '../services/api'

interface Overview { services: Array<{service_id:number;service_name:string;price:number|string;duration_min:number}>; dentists: Array<{dentist_id:number;display_name:string;specialization:string|null}> }
interface TimeSlot { time: string; status: 'available' | 'booked' | 'past' }
interface Availability { date: string; duration_min: number; slots: string[]; time_slots?: TimeSlot[] }

const router = useRouter()
const overview = ref<Overview | null>(null)
const date = ref('')
const serviceId = ref('')
const dentistId = ref('')
const selectedTime = ref('')
const timePickerOpen = ref(false)
const availability = ref<Availability | null>(null)
const loading = ref(true)
const checking = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const calendarElement = ref<HTMLDivElement | null>(null)
let calendar: Calendar | null = null
let availabilityRequest = 0
const availableDateCounts = ref<Record<string, number>>({})
const activeService = computed(() => overview.value?.services.find((service) => String(service.service_id) === serviceId.value))
const timeSlots = computed<TimeSlot[]>(() => availability.value?.time_slots ?? availability.value?.slots.map((time) => ({ time, status: 'available' })) ?? [])
const availableTimes = computed(() => timeSlots.value.filter((slot) => slot.status === 'available'))
const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

async function loadOverview() {
  loading.value = true
  error.value = ''
  try {
    const data = await getApiData<Overview>('/api/public/overview')
    overview.value = data
    if (data.services[0]) serviceId.value = String(data.services[0].service_id)
    if (data.dentists[0]) dentistId.value = String(data.dentists[0].dentist_id)
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not load services and dentists.' }
  finally { loading.value = false }
}

async function loadAvailability() {
  const requestId = ++availabilityRequest
  availability.value = null
  selectedTime.value = ''
  if (!date.value || !serviceId.value || !dentistId.value) return
  checking.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ date: date.value, service_id: serviceId.value, dentist_id: dentistId.value })
    const result = await getApiData<Availability>(`/api/appointments/availability?${params.toString()}`)
    if (requestId !== availabilityRequest) return
    availability.value = result
  } catch (cause) { if (requestId === availabilityRequest) { error.value = cause instanceof ApiError ? cause.message : 'Could not check appointment availability.' } }
  finally { if (requestId === availabilityRequest) checking.value = false }
}

function initializeCalendar() {
  if (!calendarElement.value) return
  calendar = new Calendar(calendarElement.value, {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    height: 'auto',
    contentHeight: 470,
    allDaySlot: false,
    selectable: false,
    dayMaxEvents: 2,
    validRange: { start: minDate },
    headerToolbar: { left: 'prev,next', center: 'title', right: 'today' },
    events: async (info, successCallback, failureCallback) => {
      if (!serviceId.value || !dentistId.value) { successCallback([]); return }
      const params = new URLSearchParams({ dentist_id: dentistId.value, service_id: serviceId.value, start: info.startStr.slice(0, 10), end: info.endStr.slice(0, 10) })
      try {
        const events = await getApiData<EventInput[]>(`/api/appointments/calendar?${params.toString()}`)
        availableDateCounts.value = events.reduce<Record<string, number>>((counts, event) => {
          const eventDate = String(event.extendedProps?.appt_date ?? event.start ?? '').slice(0, 10)
          if (eventDate && event.extendedProps?.slot_status === 'available') counts[eventDate] = (counts[eventDate] ?? 0) + 1
          return counts
        }, {})
        successCallback(events.filter((event) => event.extendedProps?.slot_status === 'available').map((event) => ({
          ...event,
          display: 'background',
        })))
        window.setTimeout(renderAvailabilityMarkers, 0)
      }
      catch (cause) { failureCallback(cause instanceof Error ? cause : new Error('Could not load open time slots.')) }
    },
    dateClick: (info) => selectDate(info.dateStr.slice(0, 10)),
    eventDidMount: (info) => {
      info.el.title = info.event.title
      info.el.classList.add(`slot-${info.event.extendedProps.slot_status ?? 'available'}`)
    },
  })
  calendar.render()
}

function selectDate(value: string) {
  date.value = value
  timePickerOpen.value = true
  window.setTimeout(() => {
    calendarElement.value?.querySelectorAll<HTMLElement>('.fc-daygrid-day').forEach((cell) => {
      cell.classList.toggle('is-selected-date', cell.dataset.date === value)
    })
  }, 0)
}

function selectTime(value: string) {
  selectedTime.value = value
  timePickerOpen.value = false
}

function renderAvailabilityMarkers() {
  calendarElement.value?.querySelectorAll<HTMLElement>('.fc-daygrid-day').forEach((cell) => {
    cell.querySelector('.availability-marker')?.remove()
    const count = availableDateCounts.value[cell.dataset.date ?? '']
    if (!count) return
    const marker = document.createElement('span')
    marker.className = 'availability-marker'
    marker.textContent = `${count} available`
    cell.querySelector('.fc-daygrid-day-top')?.append(marker)
  })
}

async function submitBooking() {
  if (saving.value) return
  if (!selectedTime.value || !serviceId.value || !dentistId.value || !date.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await apiRequest<{ data: { appointment_id: number } }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ service_id: Number(serviceId.value), dentist_id: Number(dentistId.value), appt_date: date.value, appt_time: selectedTime.value }),
    })
    success.value = 'Appointment request submitted.'
    await router.push({ path: '/patient/payment', query: { appointment_id: String(result.data.appointment_id) } })
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Could not submit the appointment request.' }
  finally { saving.value = false }
}

watch([date, serviceId, dentistId], loadAvailability)
watch([serviceId, dentistId], () => {
  availableDateCounts.value = {}
  calendar?.refetchEvents()
})
onMounted(async () => { await loadOverview(); await nextTick(); initializeCalendar() })
onBeforeUnmount(() => { calendar?.destroy(); calendar = null })
</script>

<template>
  <section class="page-heading"><div><p class="eyebrow">PAGE 07 · PATIENT</p><h1>Book an appointment</h1><p class="muted">Choose a service, dentist, and an available time from the clinic schedule.</p></div></section>
  <div v-if="error" class="alert alert-error" role="alert">{{ error }} <button v-if="!overview" class="text-button" type="button" @click="loadOverview">Retry</button></div>
  <div v-if="success" class="alert alert-success" role="status">{{ success }}</div>
  <section class="surface booking-card">
    <div v-if="loading" class="empty-state">Loading clinic services…</div>
    <div v-else-if="!overview?.services.length || !overview.dentists.length" class="empty-state"><strong>Booking is unavailable</strong><p>The clinic needs active services and dentist schedules before patients can book.</p></div>
    <form v-else class="booking-form" @submit.prevent="submitBooking">
      <div class="booking-details">
        <header class="booking-section-heading">
          <span class="booking-step">01</span>
          <div><h2>Appointment details</h2><p>Choose your visit and preferred time.</p></div>
        </header>
        <div class="form-grid">
          <label class="field"><span>Service <i>*</i></span><select v-model="serviceId" required><option v-for="service in overview.services" :key="service.service_id" :value="String(service.service_id)">{{ service.service_name }}</option></select></label>
          <label class="field"><span>Dentist <i>*</i></span><select v-model="dentistId" required><option v-for="dentist in overview.dentists" :key="dentist.dentist_id" :value="String(dentist.dentist_id)">{{ dentist.display_name }}{{ dentist.specialization ? ` · ${dentist.specialization}` : '' }}</option></select></label>
          <label class="field"><span>Date <i>*</i></span><input v-model="date" type="date" :min="minDate" required /></label>
          <label class="field"><span>Available time <i>*</i></span><button class="time-picker-trigger" type="button" :disabled="checking || !availableTimes.length" @click="timePickerOpen = true"><span>{{ checking ? 'Checking availability…' : selectedTime || 'Choose a time' }}</span><span class="time-picker-chevron">⌄</span></button></label>
        </div>
        <div class="booking-summary" v-if="activeService"><span class="booking-summary-label">VISIT SUMMARY</span><strong>{{ activeService.service_name }}</strong><span class="booking-summary-price">{{ Number(activeService.price).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) }}</span><small>{{ activeService.duration_min }} minute visit</small></div>
        <div v-if="date && !checking && availability && !availability.slots.length" class="alert alert-error">No appointment times are available on this date. Choose another date or dentist.</div>
        <footer class="form-actions"><button class="button button-primary" :class="{ 'is-loading': saving }" type="submit" :disabled="saving || !selectedTime" :aria-busy="saving">{{ saving ? 'Submitting…' : 'Request appointment' }}</button></footer>
      </div>
      <div class="calendar-panel booking-calendar">
        <header class="booking-section-heading booking-calendar-heading">
          <span class="booking-step">02</span>
          <div><h2>Choose a date and time</h2><p>Select a date, then choose an available time below.</p></div>
        </header>
        <div ref="calendarElement"></div>
        <p class="form-note">Available slots are based on the dentist’s schedule.</p>
      </div>
    </form>
  </section>
  <div v-if="timePickerOpen" class="time-picker-modal-backdrop" @click.self="timePickerOpen = false">
    <section class="time-picker-modal" role="dialog" aria-modal="true" aria-labelledby="time-picker-title" aria-live="polite">
      <header class="time-picker-modal-header">
        <div>
          <p class="eyebrow">AVAILABLE TIMES</p>
          <h2 id="time-picker-title">{{ date ? `Choose a time for ${date}` : 'Choose an available time' }}</h2>
        </div>
        <button class="icon-button" type="button" aria-label="Close available times" @click="timePickerOpen = false">×</button>
      </header>
      <div v-if="checking" class="time-picker-loading">
        <span class="time-picker-spinner" aria-hidden="true"></span>
        <strong>Checking availability</strong>
        <p>Loading the dentist’s available times…</p>
      </div>
      <div v-else-if="timeSlots.length" class="time-picker-results">
        <div class="time-picker-summary"><p class="time-picker-subtitle">{{ availableTimes.length }} available times</p><div class="time-picker-guide" aria-label="Time status guide"><span><i class="time-status-dot time-status-available"></i>Available</span><span><i class="time-status-dot time-status-booked"></i>Already booked</span><span><i class="time-status-dot time-status-past"></i>Passed time</span></div></div>
        <div class="time-chip-list">
          <button v-for="slot in timeSlots" :key="`${slot.time}-${slot.status}`" class="time-chip" :class="[`time-chip-${slot.status}`, { 'is-selected': selectedTime === slot.time }]" type="button" :disabled="slot.status !== 'available'" :title="slot.status === 'booked' ? 'Already booked' : slot.status === 'past' ? 'Passed time' : 'Available'" @click="selectTime(slot.time)">{{ slot.time }}</button>
        </div>
      </div>
      <div v-else class="time-picker-empty">
        <strong>No available times</strong>
        <p>There are no open slots on this date. Please choose another date.</p>
      </div>
      <footer class="time-picker-modal-footer">
        <button class="button button-quiet" type="button" @click="timePickerOpen = false">Close</button>
      </footer>
    </section>
  </div>
</template>
