<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, apiRequest, getApiData, getPortalRole } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

interface AppNotification {
  id: number
  title: string
  message: string
  type: string
  is_read: boolean | number
  redirect_url: string | null
  created_at: string
}

interface EmailNotice {
  notification_id: number
  type: string
  subject: string | null
  status: string
  sent_at: string | null
  scheduled_at: string | null
  error_message: string | null
}

const router = useRouter()
const role = getPortalRole()
const notifications = ref<AppNotification[]>([])
const emailNotices = ref<EmailNotice[]>([])
const loading = ref(true)
const error = ref('')
const emailError = ref('')
const actionError = ref('')
const busyId = ref<number | null>(null)
const markingAll = ref(false)
const unreadCount = computed(() => notifications.value.filter((notice) => !notice.is_read).length)
const isPatient = computed(() => role === 'patient')

function formatTime(value: string | null) {
  if (!value) return 'Time unavailable'
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function emailTitle(notice: EmailNotice) {
  return notice.subject || notice.type.replaceAll('_', ' ')
}

function statusClass(status: string) {
  if (status === 'sent' || status === 'verified') return 'status-confirmed'
  if (status === 'failed' || status === 'rejected') return 'status-cancelled'
  return 'status-inactive'
}

async function loadNotifications() {
  loading.value = true
  error.value = ''
  emailError.value = ''
  const [appResult, emailResult] = await Promise.allSettled([
    getApiData<AppNotification[]>('/api/notifications'),
    isPatient.value ? getApiData<EmailNotice[]>('/api/patient/notifications') : Promise.resolve([]),
  ])

  if (appResult.status === 'fulfilled') {
    notifications.value = appResult.value
  } else {
    error.value = appResult.reason instanceof ApiError
      ? appResult.reason.message
      : 'Could not load in-app notifications.'
  }

  if (emailResult.status === 'fulfilled') {
    emailNotices.value = emailResult.value
  } else {
    emailError.value = emailResult.reason instanceof ApiError
      ? emailResult.reason.message
      : 'Could not load email history.'
  }
  loading.value = false
}

async function openNotification(notice: AppNotification) {
  actionError.value = ''
  busyId.value = notice.id
  try {
    if (!notice.is_read) {
      await apiRequest(`/api/notifications/${notice.id}/read`, { method: 'POST' })
      notice.is_read = true
      window.dispatchEvent(new Event('medicare:notifications-change'))
    }

    const destination = notice.redirect_url?.startsWith('/') && !notice.redirect_url.startsWith('//')
      ? notice.redirect_url
      : isPatient.value ? '/patient/appointments' : '/staff/appointments'
    await router.push(destination)
  } catch (cause) {
    actionError.value = cause instanceof ApiError ? cause.message : 'Could not open this notification.'
    notify.error(actionError.value, 'Notification could not be opened')
  } finally {
    busyId.value = null
  }
}

async function markAllRead() {
  actionError.value = ''
  markingAll.value = true
  try {
    await apiRequest('/api/notifications/read-all', { method: 'POST' })
    notifications.value.forEach((notice) => { notice.is_read = true })
    window.dispatchEvent(new Event('medicare:notifications-change'))
    notify.success('All notifications have been marked as read.', 'Notifications updated')
  } catch (cause) {
    actionError.value = cause instanceof ApiError ? cause.message : 'Could not mark notifications as read.'
    notify.error(actionError.value, 'Notifications not updated')
  } finally {
    markingAll.value = false
  }
}

onMounted(loadNotifications)
</script>

<template>
  <section class="page-heading notification-heading">
    <div>

      <h1>Notifications</h1>
      <p class="muted">Appointment and payment updates for your account.</p>
    </div>
    <button class="button button-secondary" type="button" :disabled="!unreadCount || markingAll" @click="markAllRead">
      {{ markingAll ? 'Updating…' : 'Mark all as read' }}
    </button>
  </section>

  <p v-if="actionError" class="notice-feedback" role="alert">{{ actionError }}</p>

  <SkeletonLoader v-if="loading" variant="list" :rows="5" label="Loading notifications" />

  <section v-else-if="error" class="surface empty-state">
    <strong>Notifications unavailable</strong>
    <p>{{ error }}</p>
    <button class="button button-secondary" type="button" @click="loadNotifications">Try again</button>
  </section>

  <section v-else class="notification-content">
    <div v-if="notifications.length" class="notice-feed">
      <button
        v-for="notice in notifications"
        :key="notice.id"
        class="surface notice-card"
        :class="{ unread: !notice.is_read }"
        type="button"
        :disabled="busyId === notice.id"
        @click="openNotification(notice)"
      >
        <span class="notice-icon" aria-hidden="true">{{ notice.type === 'payment' ? '$' : '•' }}</span>
        <span class="notice-body">
          <strong>{{ notice.title }}</strong>
          <span class="notice-detail">{{ notice.message }}</span>
          <time>{{ formatTime(notice.created_at) }}</time>
        </span>
        <span class="notice-state">{{ notice.is_read ? 'Read' : 'New' }}</span>
      </button>
    </div>
    <section v-else class="surface empty-state">
      <strong>No notifications yet</strong>
      <p>New appointment and payment updates will appear here.</p>
    </section>

    <section v-if="isPatient" class="email-history">
      <div class="section-heading">
        <div>
          <h2>Email history</h2>
          <p class="muted">Appointment and payment emails sent by the clinic.</p>
        </div>
      </div>
      <p v-if="emailError" class="notice-feedback" role="status">{{ emailError }}</p>
      <div v-else-if="emailNotices.length" class="notice-feed">
        <article v-for="notice in emailNotices" :key="notice.notification_id" class="surface notice-card email-card">
          <span class="notice-icon email-icon" aria-hidden="true">@</span>
          <span class="notice-body">
            <strong>{{ emailTitle(notice) }}</strong>
            <span class="notice-detail">Email {{ notice.status }}</span>
            <time>{{ formatTime(notice.sent_at || notice.scheduled_at) }}</time>
            <span v-if="notice.error_message" class="notice-error">{{ notice.error_message }}</span>
          </span>
          <span class="status-badge" :class="statusClass(notice.status)">{{ notice.status }}</span>
        </article>
      </div>
      <section v-else class="surface empty-state email-empty">
        <strong>No email history</strong>
        <p>Clinic emails will be listed here.</p>
      </section>
    </section>
  </section>
</template>

<style scoped>
.notification-heading { align-items: center; }
.notice-feedback { margin: 0 0 1rem; color: #a9434a; font-weight: 600; }
.notification-content { display: grid; gap: 2rem; }
.notice-feed { display: grid; gap: .8rem; width: min(100%, 980px); }
.notice-card {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.15rem 1.3rem;
  border: 1px solid #e8edf1;
  border-radius: 18px;
  background: rgba(255,255,255,.92);
  color: #243f52;
  text-align: left;
  box-shadow: 0 14px 30px rgba(30,53,73,.05);
}
button.notice-card { cursor: pointer; transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
button.notice-card:hover:not(:disabled) { transform: translateY(-2px); border-color: #9dcbb1; box-shadow: 0 16px 32px rgba(30,53,73,.09); }
button.notice-card:disabled { cursor: progress; opacity: .7; }
.notice-card.unread { border-left: 4px solid #438d70; background: #f6fbf7; }
.notice-icon {
  width: 38px;
  height: 38px;
  display: grid;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 12px;
  background: #e8f4eb;
  color: #438d70;
  font-size: 1.2rem;
  font-weight: 800;
}
.notice-body { display: grid; flex: 1; min-width: 0; gap: .42rem; }
.notice-body strong { color: #243f52; font-size: 1rem; line-height: 1.4; }
.notice-detail { color: #46647a; font-size: .92rem; line-height: 1.5; }
.notice-body time { color: #728693; font-size: .78rem; }
.notice-state { flex: 0 0 auto; color: #45876d; font-size: .76rem; font-weight: 700; }
.email-history { display: grid; gap: .9rem; }
.section-heading h2 { margin: 0 0 .25rem; color: #243f52; }
.section-heading p { margin: 0; }
.email-icon { background: #edf2fb; color: #6684ae; }
.email-card { cursor: default; }
.notice-error { color: #a9434a; font-size: .8rem; }
.status-badge { flex: 0 0 auto; padding: .3rem .65rem; border-radius: 999px; font-size: .72rem; font-weight: 700; }
.status-confirmed { background: #e8f1fb; color: #3e6fa3; }
.status-cancelled { background: #fff0f0; color: #a9434a; }
.status-inactive { background: #f1f3f5; color: #6d7d88; }
.email-empty { max-width: 980px; }

:global(.app-shell[data-theme='dark'] .notice-card) { border-color: #36463f; background: #202e28; color: #dce8e1; }
:global(.app-shell[data-theme='dark'] .notice-card.unread) { border-left-color: #82c39a; background: #26382e; }
:global(.app-shell[data-theme='dark'] .notice-body strong),
:global(.app-shell[data-theme='dark'] .section-heading h2) { color: #e0ebe4; }
:global(.app-shell[data-theme='dark'] .notice-detail) { color: #bdcdc3; }
:global(.app-shell[data-theme='dark'] .notice-body time) { color: #aebdb4; }
:global(.app-shell[data-theme='dark'] .notice-icon) { background: #304538; color: #a7d4b4; }
:global(.app-shell[data-theme='dark'] .email-icon) { background: #303b4e; color: #b7c9e6; }
:global(.app-shell[data-theme='dark'] .notice-state) { color: #a7d4b4; }
:global(.app-shell[data-theme='dark'] .notice-card:hover:not(:disabled)) { border-color: #70a887; background: #2b4035; }
:global(.app-shell[data-theme='dark'] .notice-card.unread:hover:not(:disabled)) { background: #314a39; }
:global(.app-shell[data-theme='dark'] .notice-feedback) { color: #f0a6a6; }
:global(.app-shell[data-theme='dark'] .notice-error) { color: #f0a6a6; }
:global(.app-shell[data-theme='dark'] .email-card .status-confirmed) { background: #244231; color: #a4e2ba; }
:global(.app-shell[data-theme='dark'] .email-card .status-cancelled) { background: #40272a; color: #f0a6a6; }
:global(.app-shell[data-theme='dark'] .email-card .status-inactive) { background: #354741; color: #c1d0c9; }

@media (max-width: 760px) {
  .notification-heading { align-items: flex-start; }
  .notice-card { flex-wrap: wrap; padding: 1rem; }
  .notice-state,.status-badge { margin-left: 3.1rem; }
}
</style>
