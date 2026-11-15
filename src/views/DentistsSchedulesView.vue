<script setup lang="ts">
import { Calendar, type EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ApiError, apiRequest, getApiData } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

interface ScheduleRow {
  dentist_id: number
  specialization: string | null
  license_no: string | null
  username: string
  email: string
  schedule_id: number | null
  day_of_week: number | null
  schedule_date: string | null
  start_time: string | null
  end_time: string | null
  is_available: boolean | number | null
}

const rows = ref<ScheduleRow[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const calendarElement = ref<HTMLDivElement | null>(null)
const calendarDentistId = ref('all')
let calendar: Calendar | null = null
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const lunchStart = '12:00:00'
const lunchEnd = '13:00:00'
const form = reactive({
  dentist_id: '',
  schedule_type: 'weekly' as 'weekly' | 'date',
  day_of_week: '1',
  schedule_date: '',
  start_time: '',
  end_time: '',
  is_available: true,
})
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await getApiData<ScheduleRow[]>('/api/dentists')
    calendar?.refetchEvents()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not load dentist schedules.'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.schedule_type = 'weekly'
  form.schedule_date = ''
  form.is_available = true
  form.start_time = ''
  form.end_time = ''
}

async function save() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const body = form.schedule_type === 'date'
      ? {
          dentist_id: Number(form.dentist_id),
          schedule_date: form.schedule_date,
          is_available: form.is_available,
          start_time: form.start_time,
          end_time: form.end_time,
        }
      : {
          dentist_id: Number(form.dentist_id),
          day_of_week: Number(form.day_of_week),
          start_time: form.start_time,
          end_time: form.end_time,
        }
    await apiRequest('/api/dentist-schedules', { method: 'POST', body: JSON.stringify(body) })
    success.value = form.schedule_type === 'date'
      ? form.is_available ? 'Date-specific hours saved.' : 'Dentist marked unavailable for that date.'
      : 'Weekly hours added.'
    notify.success(success.value, 'Schedule saved')
    resetForm()
    await load()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not save this schedule.'
    notify.error(error.value, 'Schedule not saved')
  } finally {
    saving.value = false
  }
}

async function remove(id: number) {
  error.value = ''
  success.value = ''
  try {
    await apiRequest(`/api/dentist-schedules/${id}`, { method: 'DELETE' })
    success.value = 'Schedule removed.'
    notify.success(success.value, 'Schedule removed')
    await load()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not remove schedule.'
    notify.error(error.value, 'Schedule not removed')
  }
}

const dentists = computed(() => [...new Map(rows.value.map((row) => [row.dentist_id, row])).values()])
const schedules = computed(() => rows.value.filter((row) => row.schedule_id))
function isAvailable(row: ScheduleRow) {
  if (!row.schedule_date) {
    return row.is_available === null
      || row.is_available === undefined
      || row.is_available === true
      || Number(row.is_available) === 1
  }
  return row.is_available === true || Number(row.is_available) === 1
}

function scheduleTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function scheduleSegments(start: string, end: string) {
  const startTime = scheduleTime(start)
  const endTime = scheduleTime(end)
  const segments: Array<{ start: string; end: string }> = []

  if (startTime < lunchStart) {
    const segmentEnd = endTime < lunchStart ? endTime : lunchStart
    if (startTime < segmentEnd) segments.push({ start: startTime, end: segmentEnd })
  }
  if (endTime > lunchEnd) {
    const segmentStart = startTime > lunchEnd ? startTime : lunchEnd
    if (segmentStart < endTime) segments.push({ start: segmentStart, end: endTime })
  }

  return segments
}

function formatScheduleDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function nextDateKey(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  date.setDate(date.getDate() + 1)
  return dateKey(date)
}

function formatScheduleTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  const date = new Date(2000, 0, 1, hour, minute)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function calendarScheduleEvents(start: Date, end: Date): EventInput[] {
  const filteredSchedules = schedules.value.filter((row) =>
    calendarDentistId.value === 'all' || String(row.dentist_id) === calendarDentistId.value,
  )
  const specificDates = new Set(
    filteredSchedules
      .filter((row) => row.schedule_date)
      .map((row) => `${row.dentist_id}:${row.schedule_date}`),
  )
  const events: EventInput[] = []
  const lunchDates = new Set<string>()
  const date = new Date(start)
  date.setHours(0, 0, 0, 0)

  while (date < end) {
    const key = dateKey(date)
    for (const row of filteredSchedules) {
      if (row.schedule_date || row.day_of_week === null || Number(row.day_of_week) !== date.getDay()) continue
      if (specificDates.has(`${row.dentist_id}:${key}`)) continue
      if (!isAvailable(row) || !row.start_time || !row.end_time) continue
      const startTime = scheduleTime(row.start_time)
      const endTime = scheduleTime(row.end_time)
      if (startTime < lunchEnd && endTime > lunchStart) lunchDates.add(key)
      scheduleSegments(startTime, endTime).forEach((segment, index) => {
        events.push({
          id: `weekly-${row.schedule_id}-${key}-${index}`,
          title: `${row.username} · ${formatScheduleTime(segment.start)}–${formatScheduleTime(segment.end)}`,
          start: `${key}T${segment.start}`,
          end: `${key}T${segment.end}`,
          backgroundColor: '#328866',
          borderColor: '#328866',
          classNames: ['availability-calendar-event', 'availability-weekly'],
        })
      })
    }
    date.setDate(date.getDate() + 1)
  }

  for (const row of filteredSchedules) {
    if (!row.schedule_date || row.schedule_date < dateKey(start) || row.schedule_date >= dateKey(end)) continue
    const available = isAvailable(row)
    const hasHours = Boolean(row.start_time && row.end_time)
    if (available && hasHours && row.start_time && row.end_time) {
      const startTime = scheduleTime(row.start_time)
      const endTime = scheduleTime(row.end_time)
      if (startTime < lunchEnd && endTime > lunchStart) lunchDates.add(row.schedule_date)
      scheduleSegments(startTime, endTime).forEach((segment, index) => {
        events.push({
          id: `date-${row.schedule_id}-${index}`,
          title: `${row.username} · ${formatScheduleTime(segment.start)}–${formatScheduleTime(segment.end)}`,
          start: `${row.schedule_date}T${segment.start}`,
          end: `${row.schedule_date}T${segment.end}`,
          backgroundColor: '#4779ba',
          borderColor: '#4779ba',
          classNames: ['availability-calendar-event', 'availability-specific'],
        })
      })
    } else if (available) {
      events.push({
        id: `date-${row.schedule_id}`,
        title: `${row.username} · Available`,
        start: row.schedule_date,
        allDay: true,
        backgroundColor: '#4779ba',
        borderColor: '#4779ba',
        classNames: ['availability-calendar-event', 'availability-specific'],
      })
    } else {
      events.push({
        id: `closed-${row.schedule_id}`,
        title: `${row.username} · Unavailable`,
        start: row.schedule_date,
        end: nextDateKey(row.schedule_date),
        allDay: true,
        backgroundColor: '#bd555c',
        borderColor: '#bd555c',
        classNames: ['availability-calendar-event', 'availability-closed'],
      })
    }
  }

  for (const lunchDate of lunchDates) {
    events.push({
      id: `lunch-break-${lunchDate}`,
      title: 'Lunch break · unavailable',
      start: `${lunchDate}T${lunchStart}`,
      end: `${lunchDate}T${lunchEnd}`,
      backgroundColor: '#e5e9ec',
      borderColor: '#cbd2d8',
      textColor: '#4d5b66',
      classNames: ['availability-calendar-event', 'availability-lunch-break'],
    })
  }

  return events
}

function initializeCalendar() {
  if (!calendarElement.value || calendar) return
  calendar = new Calendar(calendarElement.value, {
    plugins: [dayGridPlugin, timeGridPlugin],
    initialView: 'dayGridMonth',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    displayEventTime: false,
    events: (fetchInfo, successCallback) => {
      successCallback(calendarScheduleEvents(fetchInfo.start, fetchInfo.end))
    },
    eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: 'short' },
    dayMaxEvents: 3,
    noEventsText: 'No availability scheduled for this period',
  })
  calendar.render()
}

watch(calendarDentistId, () => calendar?.refetchEvents())

onMounted(async () => {
  await load()
  initializeCalendar()
})

onActivated(() => calendar?.updateSize())
onBeforeUnmount(() => {
  calendar?.destroy()
  calendar = null
})
</script>

<template>
  <section class="page-heading schedule-heading">
    <div>
      <p class="eyebrow">CLINIC SETUP <span>·</span> DENTIST SCHEDULES</p>
      <h1>Dentist availability</h1>
      <p class="muted">Set regular clinic hours or make a one-time change for a particular date.</p>
    </div>
    <button class="button button-quiet schedule-refresh" type="button" :disabled="loading" @click="load">
      <span aria-hidden="true">↻</span>{{ loading ? 'Refreshing…' : 'Refresh schedules' }}
    </button>
  </section>

  <p v-if="error" class="alert alert-error schedule-alert" role="alert">{{ error }}</p>

  <form class="surface schedule-form" @submit.prevent="save">
    <header class="schedule-form-heading">
      <div>
        <p class="schedule-kicker">SCHEDULE SETUP</p>
        <h2>Add dentist hours</h2>
        <p>Choose a dentist and set when patients can book with them.</p>
      </div>
      <span class="schedule-count">{{ schedules.length }} {{ schedules.length === 1 ? 'schedule' : 'schedules' }}</span>
    </header>

    <div v-if="!loading && !dentists.length" class="schedule-no-dentists" role="status">
      <strong>No dentists available yet</strong>
      <p>Add a dentist account first, then return here to set their availability.</p>
    </div>
    <template v-else>
      <div class="schedule-type-group">
        <span class="schedule-field-label">What would you like to set?</span>
        <div class="schedule-type-options" role="group" aria-label="Schedule type">
          <button type="button" :class="{ active: form.schedule_type === 'weekly' }" :aria-pressed="form.schedule_type === 'weekly'" @click="form.schedule_type = 'weekly'">
            <strong>Weekly hours</strong><small>Repeats every week</small>
          </button>
          <button type="button" :class="{ active: form.schedule_type === 'date' }" :aria-pressed="form.schedule_type === 'date'" @click="form.schedule_type = 'date'">
            <strong>Specific date</strong><small>One-time change or closure</small>
          </button>
        </div>
      </div>

      <div class="schedule-fields">
        <label class="schedule-field">
          <span>Dentist <i>Required</i></span>
          <select v-model="form.dentist_id" required>
            <option value="" disabled>Choose a dentist</option>
            <option v-for="dentist in dentists" :key="dentist.dentist_id" :value="String(dentist.dentist_id)">
              {{ dentist.username }} · {{ dentist.specialization || 'Dentist' }}
            </option>
          </select>
          <small>Select whose calendar you want to update.</small>
        </label>

        <label v-if="form.schedule_type === 'weekly'" class="schedule-field">
          <span>Day of the week <i>Required</i></span>
          <select v-model="form.day_of_week" required>
            <option v-for="(day, index) in days" :key="day" :value="String(index)">{{ day }}</option>
          </select>
          <small>These hours will repeat each week.</small>
        </label>
        <label v-else class="schedule-field">
          <span>Date <i>Required</i></span>
          <input v-model="form.schedule_date" type="date" :min="today" required>
          <small>This change applies only to the selected date.</small>
        </label>

        <label v-if="form.schedule_type === 'date'" class="schedule-availability">
          <input v-model="form.is_available" type="checkbox">
          <span><strong>Accept appointments on this date</strong><small>Turn this off to mark the dentist unavailable.</small></span>
        </label>

        <template v-if="form.schedule_type === 'weekly' || form.is_available">
          <label class="schedule-field">
            <span>Start time <i>Required</i></span>
            <input v-model="form.start_time" type="time" required>
            <small>When the dentist starts seeing patients.</small>
          </label>
          <label class="schedule-field">
            <span>End time <i>Required</i></span>
            <input v-model="form.end_time" type="time" required>
            <small>When the dentist finishes for the day.</small>
          </label>
        </template>
      </div>

      <div class="schedule-form-footer">
        <p>
          <span v-if="form.schedule_type === 'date'">A specific-date setting takes priority over that day’s weekly hours.</span>
          <span v-else>Patients can book during these hours on the selected weekday.</span>
          <span class="schedule-lunch-note">Lunch break, 12:00–1:00 PM, is always blocked.</span>
        </p>
        <button class="button button-primary" :disabled="saving || !dentists.length">
          {{ saving ? 'Saving schedule…' : form.schedule_type === 'date' ? form.is_available ? 'Save date availability' : 'Save as unavailable' : 'Add weekly hours' }}
        </button>
      </div>
    </template>
  </form>

  <section class="availability-calendar-section">
    <header class="availability-calendar-heading">
      <div>
        <p class="schedule-kicker">SCHEDULE OVERVIEW</p>
        <h2>Availability calendar</h2>
        <p>See weekly hours and one-time date changes at a glance.</p>
      </div>
      <label class="calendar-dentist-filter">
        <span>Show dentist</span>
        <select v-model="calendarDentistId" aria-label="Filter availability calendar by dentist">
          <option value="all">All dentists</option>
          <option v-for="dentist in dentists" :key="dentist.dentist_id" :value="String(dentist.dentist_id)">
            {{ dentist.username }}
          </option>
        </select>
      </label>
    </header>
    <section class="surface availability-calendar-card" aria-label="Dentist availability calendar">
      <div class="availability-calendar-legend" aria-label="Calendar legend">
        <span><i class="legend-dot legend-weekly"></i>Weekly hours</span>
        <span><i class="legend-dot legend-specific"></i>Date-specific hours</span>
        <span><i class="legend-dot legend-closed"></i>Unavailable</span>
        <span><i class="legend-dot legend-lunch"></i>Lunch break (12:00–1:00 PM)</span>
      </div>
      <p v-if="!loading && !schedules.length" class="availability-empty-note" role="status">
        No availability times are scheduled yet. Add hours above to show them here.
      </p>
      <div ref="calendarElement" class="availability-calendar"></div>
    </section>
  </section>

  <section class="schedule-list-heading">
    <div><p class="schedule-kicker">CURRENT AVAILABILITY</p><h2>Saved schedules</h2></div>
    <span v-if="!loading && schedules.length" class="schedule-list-count">{{ schedules.length }} entries</span>
  </section>

  <SkeletonLoader v-if="loading" variant="table" :rows="5" :columns="5" label="Loading saved dentist schedules" />
  <section v-else-if="!schedules.length" class="surface empty-state schedule-empty">
    <strong>No schedules added yet</strong>
    <p>Once you add weekly hours or a specific-date change, it will appear here.</p>
  </section>
  <section v-else class="surface table-wrap schedule-table">
    <table class="data-table">
      <thead><tr><th>Dentist</th><th>Schedule type</th><th>Day / date</th><th>Availability and hours</th><th><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>
        <tr v-for="row in schedules" :key="row.schedule_id ?? `${row.dentist_id}-${row.schedule_date ?? row.day_of_week}`">
          <td><strong>{{ row.username }}</strong><small class="table-secondary">{{ row.specialization || 'Dentist' }}</small></td>
          <td><span class="schedule-type-badge">{{ row.schedule_date ? 'Specific date' : 'Weekly hours' }}</span></td>
          <td>{{ row.schedule_date ? formatScheduleDate(row.schedule_date) : row.day_of_week === null ? '—' : days[row.day_of_week] }}</td>
          <td>
            <span class="status-badge" :data-status="isAvailable(row) ? 'active' : 'inactive'">{{ isAvailable(row) ? 'Available' : 'Unavailable' }}</span>
            <small v-if="isAvailable(row)" class="table-secondary">{{ row.start_time }} – {{ row.end_time }}</small>
          </td>
          <td class="actions-cell"><button class="row-action row-action-danger" type="button" :aria-label="`Remove ${row.username}'s ${row.schedule_date ? 'specific-date' : 'weekly'} schedule`" @click="remove(row.schedule_id!)">Remove</button></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.schedule-heading .eyebrow span { padding: 0 4px; color: #a4b0ba; }
.schedule-refresh { gap: 8px; border-radius: 9px; }
.schedule-refresh span { font-size: 18.4px; line-height: 1; }
.schedule-alert { margin: 0 0 14px; }
.schedule-form { margin-bottom: 28px; padding: clamp(20px, 2.5vw, 30px); border-radius: 16px; }
.schedule-form-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 23px; }
.schedule-kicker { margin: 0 0 6px; color: #438d75; font-size: 10.8px; font-weight: 750; letter-spacing: 1px; }
.schedule-form-heading h2,.schedule-list-heading h2 { margin: 0; color: #26364a; font-size: 20.5px; font-weight: 720; letter-spacing: -.3px; }
.schedule-form-heading > div > p:last-child { margin: 6px 0 0; color: #78879a; font-size: 13px; }
.availability-calendar-section { margin: 0 0 30px; }
.availability-calendar-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin: 0 2px 13px; }
.availability-calendar-heading h2 { margin: 0; color: #26364a; font-size: 20.5px; font-weight: 720; letter-spacing: -.3px; }
.availability-calendar-heading > div > p:last-child { margin: 6px 0 0; color: #78879a; font-size: 12.5px; }
.calendar-dentist-filter { display: grid; flex: 0 0 min(240px, 38%); gap: 6px; color: #526579; font-size: 11px; font-weight: 700; }
.calendar-dentist-filter select { width: 100%; min-height: 40px; padding: 0 11px; border: 1px solid #dce4e8; border-radius: 9px; background: #fff; color: #314359; font: inherit; }
.calendar-dentist-filter select:focus { border-color: #69a98c; outline: 0; box-shadow: 0 0 0 3px rgb(67 141 117 / 13%); }
.availability-calendar-card { overflow: hidden; padding: clamp(14px, 2vw, 22px); border-radius: 15px; }
.availability-calendar-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 9px 18px; margin-bottom: 15px; color: #64776f; font-size: 10.8px; }
.availability-calendar-legend > span { display: inline-flex; align-items: center; gap: 7px; }
.availability-empty-note { margin: 0 0 14px; padding: 11px 13px; border: 1px dashed #cbd9d1; border-radius: 9px; background: #f7faf8; color: #61746b; font-size: 11.5px; line-height: 1.5; }
.legend-dot { width: 9px; height: 9px; flex: 0 0 auto; border-radius: 50%; }
.legend-weekly { background: #328866; }
.legend-specific { background: #4779ba; }
.legend-closed { background: #bd555c; }
.legend-lunch { background: #aeb8bf; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .availability-lunch-break) { border-color: #66737b !important; background: #39454c !important; color: #e1e7eb !important; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .availability-lunch-break .fc-event-main) { color: #e1e7eb !important; }
:global(.availability-calendar .fc .fc-toolbar) { gap: 12px; margin-bottom: 17px; }
:global(.availability-calendar .fc .fc-toolbar-title) { font-size: clamp(16px, 2vw, 20px); }
:global(.availability-calendar .fc .fc-button) { border-radius: 7px; box-shadow: none; font-size: 11.5px; font-weight: 650; }
:global(.availability-calendar .fc .fc-event) { border-radius: 5px; padding: 2px 4px; font-size: 10px; font-weight: 650; }
:global(.availability-calendar .fc .fc-daygrid-event-dot) { display: none; }
:global(.availability-calendar .fc .fc-daygrid-day-frame) { min-height: 95px; }
.schedule-count,.schedule-list-count { flex: 0 0 auto; padding: 6px 10px; border: 1px solid #e4ebe7; border-radius: 999px; background: #f7faf8; color: #667a70; font-size: 10.8px; font-weight: 650; }
.schedule-type-group { margin-bottom: 19px; }
.schedule-field-label,.schedule-field > span:first-child { display: block; color: #405168; font-size: 11.9px; font-weight: 700; }
.schedule-type-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 8px; }
.schedule-type-options button { display: grid; gap: 4px; min-height: 62px; padding: 11px 14px; border: 1px solid #e1e8e5; border-radius: 10px; background: #fff; color: #46566b; cursor: pointer; text-align: left; transition: border-color .16s ease, background .16s ease, box-shadow .16s ease; }
.schedule-type-options button:hover { border-color: #9dc5ad; }
.schedule-type-options button.active { border-color: #68a98a; background: #f3f9f5; box-shadow: 0 0 0 2px rgb(67 141 117 / 9%); }
.schedule-type-options button strong { font-size: 13px; }
.schedule-type-options button small { color: #8290a0; font-size: 10.8px; }
.schedule-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px 20px; }
.schedule-field { display: grid; align-content: start; gap: 7px; color: #405168; font-size: 11.9px; font-weight: 650; }
.schedule-field > span:first-child i { margin-left: 5px; color: #8793a2; font-size: 9.7px; font-style: normal; font-weight: 500; }
.schedule-field select,.schedule-field input { width: 100%; min-width: 0; min-height: 43px; padding: 0 12px; border: 1px solid #dce4e8; border-radius: 9px; background-color: #fff; color: #314359; font: inherit; font-size: 13px; }
.schedule-field select:focus,.schedule-field input:focus { border-color: #69a98c; outline: 0; box-shadow: 0 0 0 3px rgb(67 141 117 / 13%); }
.schedule-field small,.schedule-availability small { color: #8390a0; font-size: 10.8px; font-weight: 450; line-height: 1.5; }
.schedule-availability { display: flex; grid-column: 1 / -1; align-items: flex-start; gap: 11px; padding: 13px 15px; border: 1px solid #e1e9e4; border-radius: 10px; background: #f8faf8; cursor: pointer; }
.schedule-availability input { width: 16px; height: 16px; flex: 0 0 auto; margin: 1px 0 0; accent-color: #438d75; }
.schedule-availability > span { display: grid; gap: 3px; }
.schedule-availability strong { color: #405168; font-size: 11.9px; }
.schedule-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 21px; padding-top: 17px; border-top: 1px solid #edf0f2; }
.schedule-form-footer p { max-width: 510px; margin: 0; color: #78879a; font-size: 10.8px; line-height: 1.6; }
.schedule-lunch-note { display: block; margin-top: 3px; font-weight: 650; }
.schedule-form-footer .button { min-height: 42px; flex: 0 0 auto; padding-inline: 18px; border-radius: 9px; }
.schedule-no-dentists { padding: 20px; border: 1px dashed #dce6e1; border-radius: 11px; background: #f8faf9; }
.schedule-no-dentists strong { color: #35495b; font-size: 13px; }
.schedule-no-dentists p { margin: 5px 0 0; color: #78879a; font-size: 11.9px; }
.schedule-list-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin: 0 2px 13px; }
.schedule-empty { min-height: 120px; justify-items: center; gap: 7px; padding: 24px; text-align: center; }
.schedule-empty p { margin: 0; color: #78879a; font-size: 11.9px; }
.schedule-table { border-radius: 14px; }
.schedule-table .data-table th { padding: 13px 16px; }
.schedule-table .data-table td { padding: 14px 16px; vertical-align: middle; }
.schedule-table td small { display: block; margin-top: 4px; }
.schedule-type-badge { display: inline-block; padding: 5px 8px; border-radius: 7px; background: #f0f4f2; color: #566a60; font-size: 10.8px; font-weight: 650; white-space: nowrap; }
.schedule-table .status-badge { display: inline-flex; }
.schedule-table .actions-cell { min-width: 82px; text-align: right; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
:global(:root[data-theme='dark'] .schedule-form-heading h2),
:global(:root[data-theme='dark'] .availability-calendar-heading h2),
:global(:root[data-theme='dark'] .schedule-list-heading h2),
:global(:root[data-theme='dark'] .schedule-no-dentists strong),
:global(:root[data-theme='dark'] .schedule-availability strong) { color: #e4ede9; }
:global(:root[data-theme='dark'] .schedule-form-heading > div > p:last-child),
:global(:root[data-theme='dark'] .availability-calendar-heading > div > p:last-child),
:global(:root[data-theme='dark'] .schedule-form-footer p),
:global(:root[data-theme='dark'] .schedule-no-dentists p),
:global(:root[data-theme='dark'] .schedule-empty p) { color: #b2c2bb; }
:global(:root[data-theme='dark'] .schedule-count),
:global(:root[data-theme='dark'] .schedule-list-count),
:global(:root[data-theme='dark'] .schedule-type-badge) { border-color: #40534b; background: #263630; color: #d2dfd8; }
:global(:root[data-theme='dark'] .schedule-field),
:global(:root[data-theme='dark'] .schedule-field-label),
:global(:root[data-theme='dark'] .schedule-field > span:first-child) { color: #e0eae4; }
:global(:root[data-theme='dark'] .schedule-field > span:first-child i) { color: #b2c2bb; }
:global(:root[data-theme='dark'] .schedule-field select),
:global(:root[data-theme='dark'] .schedule-field input) { border-color: #40534b; background-color: #1d2a25; color: #f0f5f2; color-scheme: dark; }
:global(:root[data-theme='dark'] .schedule-field select option) { background: #1d2a25; color: #f0f5f2; }
:global(:root[data-theme='dark'] .schedule-field small),
:global(:root[data-theme='dark'] .schedule-availability small) { color: #b2c2bb; }
:global(:root[data-theme='dark'] .calendar-dentist-filter) { color: #d3e0d9; }
:global(:root[data-theme='dark'] .calendar-dentist-filter select) { border-color: #40534b; background: #1d2a25; color: #f0f5f2; color-scheme: dark; }
:global(:root[data-theme='dark'] .availability-calendar-legend) { color: #b2c2bb; }
:global(:root[data-theme='dark'] .availability-empty-note) { border-color: #40534b; background: #263630; color: #c1d0c9; }
:global(:root[data-theme='dark'] .schedule-type-options button) { border-color: #40534b; background: #263630; color: #e0eae4; }
:global(:root[data-theme='dark'] .schedule-type-options button.active) { border-color: #5a9677; background: #2b4037; }
:global(:root[data-theme='dark'] .schedule-type-options button small) { color: #b2c2bb; }
:global(:root[data-theme='dark'] .schedule-availability),
:global(:root[data-theme='dark'] .schedule-no-dentists) { border-color: #40534b; background: #263630; }
:global(:root[data-theme='dark'] .schedule-form-footer) { border-color: #354741; }
:global(:root[data-theme='dark'] .schedule-table .data-table th) { border-color: #354741; background: #263630; color: #cbd9d2; }
:global(:root[data-theme='dark'] .schedule-table .data-table td) { border-color: #354741; color: #e0eae4; }
:global(:root[data-theme='dark'] .schedule-table .data-table td strong) { color: #f0f5f2; }
:global(:root[data-theme='dark'] .schedule-table .data-table td small) { color: #b2c2bb; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc) { color: #d2dfd8; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-toolbar-title) { color: #e7f0eb; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-col-header-cell) { background: #24352e; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-col-header-cell-cushion) { color: #b7c9bf; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-daygrid-day-number) { color: #d3e0d9; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-day-other .fc-daygrid-day-number) { color: #71847a; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-day-today) { background: #2b4037; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-button-primary:disabled) { border-color: #3b5148; background: #263630; color: #a8b9b1; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-button-primary:not(:disabled):hover),
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-button-primary:not(:disabled).fc-button-active) { border-color: #609676; background: #35664c; color: #f0f5f2; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-daygrid-more-link) { color: #a9dfbf; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-popover) { border-color: #40534b; background: #1d2b26; }
:global(.app-shell[data-theme='dark'] .availability-calendar .fc .fc-popover-header) { background: #263630; color: #e4ede9; }
@media (max-width: 760px) {
  .schedule-fields { grid-template-columns: minmax(0, 1fr); gap: 15px; }
  .schedule-availability { grid-column: auto; }
  .schedule-form-footer { align-items: stretch; flex-direction: column; }
  .schedule-form-footer .button { width: 100%; }
  .schedule-table { overflow-x: auto; }
  .schedule-table .data-table { min-width: 680px; }
  .availability-calendar-heading { align-items: stretch; flex-direction: column; }
  .calendar-dentist-filter { flex-basis: auto; width: 100%; }
  :global(.availability-calendar .fc .fc-header-toolbar) { align-items: center; flex-direction: column; }
  :global(.availability-calendar .fc .fc-toolbar-chunk) { display: flex; flex-wrap: wrap; justify-content: center; }
  :global(.availability-calendar .fc .fc-daygrid-day-frame) { min-height: 74px; }
}
@media (max-width: 480px) {
  .schedule-form-heading { flex-direction: column; }
  .schedule-type-options { grid-template-columns: minmax(0, 1fr); }
  .schedule-count { align-self: flex-start; }
  .availability-calendar-card { padding: 10px; }
  .availability-calendar-legend { justify-content: center; gap: 8px 12px; }
  :global(.availability-calendar .fc .fc-button) { padding: .3em .42em; font-size: 10px; }
  :global(.availability-calendar .fc .fc-toolbar-title) { font-size: 15px; }
  :global(.availability-calendar .fc .fc-daygrid-day-frame) { min-height: 60px; }
  :global(.availability-calendar .fc .fc-daygrid-day-number) { padding: 3px; font-size: 10px; }
  :global(.availability-calendar .fc .fc-daygrid-event) { margin: 1px 2px; padding: 1px 2px; font-size: 9px; }
}
</style>
