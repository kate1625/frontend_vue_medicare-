<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { endSession, getApiData, getPortalRole, getStaffUser } from './services/api'
import { getProfilePicture } from './services/profilePreferences'
import { setTheme } from './services/theme'
import { sitemap } from './router'
import UiIcon, { type IconName } from './components/UiIcon.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import ToastHost from './components/ToastHost.vue'
import { notify, type ToastCategory } from './services/toast'

const route = useRoute()
const router = useRouter()
const isPublicPage = computed(() => route.meta.public === true)
const staff = ref(getStaffUser())
const profilePicture = ref(readProfilePicture())
const role = ref(getPortalRole())
const isDarkMode = ref(localStorage.getItem('medicare-theme') === 'dark')
const navPages = computed(() => sitemap.filter((page) =>
  !page.path.includes('/:')
  && ![18, 24].includes(page.number)
  && !(role.value === 'admin' && page.number === 32)
  && (page.area === role.value || (role.value === 'admin' && page.area === 'staff')),
))
const personalSettingsPage = computed(() => role.value ? [{ number: 38, title: 'Profile & Settings', path: '/settings/profile', area: role.value }] : [])
const navFilter = ref('')
const searchText = ref('')
const mobileOpen = ref(false)
const sidebarCollapsed = ref(localStorage.getItem('medicare-sidebar-collapsed') === 'true')
const sidebarTooltip = ref<{ text: string; top: number } | null>(null)
const signingOut = ref(false)
const showLogoutConfirmation = ref(false)
const isOnline = ref(navigator.onLine)
const unreadMessageCount = ref(0)
const unreadNotificationCount = ref(0)
const showReconnectedNotice = ref(false)
let reconnectedTimer: number | null = null
let unreadCountsTimer: number | null = null
let initialUnreadCountsTimer: number | null = null
let connectionHealthTimer: number | null = null
let connectionHealthFailures = 0
let unreadCountsInFlight = false
let notificationsInitialized = false
let previousUnreadMessages: number | null = null
const seenNotificationIds = new Set<string>()
const messagePath = computed(() => role.value === 'patient' ? '/patient/messages' : '/staff/messages')
const notificationPath = computed(() => role.value === 'patient' ? '/patient/notifications' : role.value === 'admin' ? '/admin/notifications' : '/staff/notifications')
const emailNotificationPath = computed(() => role.value === 'patient' ? '/patient/notifications' : '/staff/email-log')
const searchMatches = computed(() => {
  const query = searchText.value.trim().toLowerCase()
  return query ? navPages.value.filter((page) => page.title.toLowerCase().includes(query)).slice(0, 5) : []
})
const navGroups = computed(() => {
  const sections = role.value === 'patient'
    ? [
        { title: 'Overview', numbers: [6] },
        { title: 'Appointments', numbers: [7, 8] },
        { title: 'My care', numbers: [9, 10, 11, 35] },
        { title: 'Stay connected', numbers: [12, 37] },
      ]
    : role.value === 'admin'
      ? [
          { title: 'Overview', numbers: [22] },
          { title: 'Clinic setup', numbers: [23, 24, 25, 26, 34] },
          { title: 'People', numbers: [16, 17, 18, 27] },
          { title: 'Appointments & care', numbers: [14, 15, 19, 31, 41] },
          { title: 'Payments & messages', numbers: [20, 21, 33, 39] },
          { title: 'Insights', numbers: [28, 30] },
        ]
      : [
          { title: 'Overview', numbers: [13] },
          { title: 'Appointments', numbers: [14, 15] },
          { title: 'Patient care', numbers: [16, 17, 18, 19, 31, 32] },
          { title: 'Payments & messages', numbers: [20, 21, 33, 40] },
        ]
  const query = role.value === 'staff' ? navFilter.value.trim().toLowerCase() : ''
  sections.push({ title: 'Account', numbers: [38] })
  return sections.map((section) => ({
    title: section.title,
    pages: [...navPages.value, ...personalSettingsPage.value].filter((page) =>
      section.numbers.includes(page.number)
      && (!query || page.title.toLowerCase().includes(query)),
    ),
  })).filter((section) => section.pages.length)
})
const filteredNavCount = computed(() => navGroups.value.reduce((count, section) => count + section.pages.length, 0))

function applyTheme(trigger?: HTMLElement | null) {
  const theme = isDarkMode.value ? 'dark' : 'light'
  setTheme(theme, trigger)
}
function toggleTheme(event: MouseEvent) {
  isDarkMode.value = !isDarkMode.value
  applyTheme(event.currentTarget instanceof HTMLElement ? event.currentTarget : null)
}
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('medicare-sidebar-collapsed', String(sidebarCollapsed.value))
  sidebarTooltip.value = null
}
function showSidebarTooltip(event: FocusEvent | MouseEvent, text: string) {
  if (!sidebarCollapsed.value || !(event.currentTarget instanceof HTMLElement)) return
  const bounds = event.currentTarget.getBoundingClientRect()
  sidebarTooltip.value = {
    text,
    top: Math.min(window.innerHeight - 22, Math.max(22, bounds.top + bounds.height / 2)),
  }
}
function hideSidebarTooltip() {
  sidebarTooltip.value = null
}
function readProfilePicture() {
  if (!getStaffUser()) return ''

  try {
    return getProfilePicture() ?? ''
  } catch (cause) {
    console.error('Could not load the saved MediCare+ profile picture.', cause)
    return ''
  }
}

const userInitials = computed(() => {
  const parts = (staff.value?.username ?? '').trim().split(/[\s._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U'
})

function updateProfilePicture() {
  profilePicture.value = readProfilePicture()
}

async function refreshUnreadCounts() {
  if (unreadCountsInFlight) return
  if (!role.value) {
    unreadMessageCount.value = 0
    unreadNotificationCount.value = 0
    notificationsInitialized = false
    previousUnreadMessages = null
    seenNotificationIds.clear()
    return
  }

  unreadCountsInFlight = true
  try {
    let newUnreadMessages = 0
    const [countsResult, notificationsResult] = await Promise.allSettled([
      getApiData<{ messages: number; notifications: number }>('/api/workspace/unread-counts'),
      getApiData<Array<{
        id: number | string
        title: string
        message: string
        type: string
        redirect_url: string | null
        created_at: string
      }>>('/api/notifications'),
    ])

    if (countsResult.status === 'fulfilled') {
      unreadMessageCount.value = countsResult.value.messages
      unreadNotificationCount.value = countsResult.value.notifications
      if (previousUnreadMessages !== null) {
        newUnreadMessages = Math.max(0, countsResult.value.messages - previousUnreadMessages)
      }
      previousUnreadMessages = countsResult.value.messages
    } else {
      console.error('Could not load unread message and notification counts.', countsResult.reason)
    }

    if (notificationsResult.status === 'rejected') {
      if (newUnreadMessages > 0) {
        notify.incoming(
          newUnreadMessages === 1 ? 'You have a new message.' : `You have ${newUnreadMessages} new messages.`,
          newUnreadMessages === 1 ? 'New message' : 'New messages',
          'message',
          messagePath.value,
        )
      }
      console.error('Could not check for new MediCare+ notifications.', notificationsResult.reason)
      return
    }

    const notifications = notificationsResult.value
    if (!notificationsInitialized) {
      notifications.forEach((notification) => seenNotificationIds.add(String(notification.id)))
      notificationsInitialized = true
      return
    }

    const newNotifications = notifications
      .filter((notification) => {
        const id = String(notification.id)
        if (seenNotificationIds.has(id)) return false
        seenNotificationIds.add(id)
        return true
      })
      .sort((first, second) => {
        const firstCreatedAt = Date.parse(first.created_at)
        const secondCreatedAt = Date.parse(second.created_at)
        return (Number.isNaN(firstCreatedAt) ? 0 : firstCreatedAt)
          - (Number.isNaN(secondCreatedAt) ? 0 : secondCreatedAt)
      })
      .slice(-3)

    for (const notification of newNotifications.reverse()) {
      const category = notificationCategory(notification.type, notification.title, notification.message)
      const path = notification.redirect_url?.startsWith('/') && !notification.redirect_url.startsWith('//')
        ? notification.redirect_url
        : undefined
      notify.incoming(notification.message, notification.title, category, path)
    }

    if (newUnreadMessages > 0 && !newNotifications.some((notification) =>
      notificationCategory(notification.type, notification.title, notification.message) === 'message',
    )) {
      notify.incoming(
        newUnreadMessages === 1 ? 'You have a new message.' : `You have ${newUnreadMessages} new messages.`,
        newUnreadMessages === 1 ? 'New message' : 'New messages',
        'message',
        messagePath.value,
      )
    }
  } finally {
    unreadCountsInFlight = false
  }
}

function notificationCategory(type: string, title: string, message: string): ToastCategory {
  const content = `${type} ${title} ${message}`.toLowerCase()
  if (/message|chat|reply/.test(content)) return 'message'
  if (/appointment|booking|schedule|visit/.test(content)) return 'appointment'
  if (/payment|paid|balance|receipt|refund/.test(content)) return 'payment'
  return 'general'
}

function markMessagesRead() {
  unreadMessageCount.value = 0
  previousUnreadMessages = 0
}

function refreshCountsWhenVisible() {
  if (navigator.onLine && document.visibilityState === 'visible') {
    void refreshUnreadCounts()
  }
}

document.documentElement.dataset.theme = isDarkMode.value ? 'dark' : 'light'

const pageIcons: Record<number, IconName> = {
  6: 'layout-dashboard',
  7: 'calendar-plus',
  8: 'calendar',
  9: 'credit-card',
  10: 'receipt',
  11: 'user-round',
  12: 'bell',
  13: 'layout-dashboard',
  14: 'calendar',
  15: 'clipboard-list',
  16: 'users-round',
  17: 'user-round',
  18: 'user-round-plus',
  19: 'clipboard-plus',
  20: 'credit-card-check',
  21: 'mail',
  22: 'layout-dashboard',
  23: 'briefcase-medical',
  24: 'file-edit',
  25: 'stethoscope',
  26: 'wallet',
  27: 'users-round',
  28: 'clipboard-list',
  29: 'mail',
  30: 'chart-column',
  31: 'file',
  32: 'pill',
  33: 'message-circle',
  34: 'settings',
  35: 'pill',
  36: 'message-circle',
  37: 'toothbrush',
  38: 'settings',
  39: 'bell',
  40: 'bell',
}

function pageIcon(number: number): IconName {
  return pageIcons[number] ?? 'layout-dashboard'
}

function updateConnectionStatus() {
  if (!navigator.onLine) {
    reportConnectionError()
    return
  }

  void checkBackendConnection()
}

async function checkBackendConnection() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error('Backend health check failed.')
    const health = await response.json() as { status?: string; database?: string }
    if (health.status !== 'ok' || health.database !== 'connected') {
      throw new Error('Backend database is unavailable.')
    }
    connectionHealthFailures = 0
    reportConnectionRestored()
  } catch (cause) {
    connectionHealthFailures += 1
    console.warn('MediCare+ backend health check failed.', cause)
    if (connectionHealthFailures >= 3) reportConnectionError()
  } finally {
    window.clearTimeout(timeout)
  }
}

function reportConnectionRestored() {
  const wasOffline = !isOnline.value
  isOnline.value = true
  if (!wasOffline) return

  showReconnectedNotice.value = true
  if (reconnectedTimer) window.clearTimeout(reconnectedTimer)
  reconnectedTimer = window.setTimeout(() => {
    showReconnectedNotice.value = false
    reconnectedTimer = null
  }, 5000)
}

function reportConnectionError() {
  isOnline.value = false
  showReconnectedNotice.value = false
  if (reconnectedTimer) {
    window.clearTimeout(reconnectedTimer)
    reconnectedTimer = null
  }
}

onMounted(() => {
  window.addEventListener('online', updateConnectionStatus)
  window.addEventListener('offline', updateConnectionStatus)
  window.addEventListener('medicare:connection-error', reportConnectionError)
  window.addEventListener('medicare:connection-restored', reportConnectionRestored)
  window.addEventListener('medicare:profile-picture-change', updateProfilePicture)
  window.addEventListener('medicare:messages-read', markMessagesRead)
  window.addEventListener('medicare:notifications-change', refreshUnreadCounts)
  document.addEventListener('visibilitychange', refreshCountsWhenVisible)
  initialUnreadCountsTimer = window.setTimeout(() => {
    initialUnreadCountsTimer = null
    refreshCountsWhenVisible()
  }, 750)
  unreadCountsTimer = window.setInterval(refreshCountsWhenVisible, 15000)
  connectionHealthTimer = window.setInterval(() => {
    if (navigator.onLine && document.visibilityState === 'visible') void checkBackendConnection()
  }, 120000)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', updateConnectionStatus)
  window.removeEventListener('offline', updateConnectionStatus)
  window.removeEventListener('medicare:connection-error', reportConnectionError)
  window.removeEventListener('medicare:connection-restored', reportConnectionRestored)
  window.removeEventListener('medicare:profile-picture-change', updateProfilePicture)
  window.removeEventListener('medicare:messages-read', markMessagesRead)
  window.removeEventListener('medicare:notifications-change', refreshUnreadCounts)
  document.removeEventListener('visibilitychange', refreshCountsWhenVisible)
  if (initialUnreadCountsTimer) {
    window.clearTimeout(initialUnreadCountsTimer)
    initialUnreadCountsTimer = null
  }
  if (unreadCountsTimer) {
    window.clearInterval(unreadCountsTimer)
    unreadCountsTimer = null
  }
  if (connectionHealthTimer) {
    window.clearInterval(connectionHealthTimer)
    connectionHealthTimer = null
  }
  if (reconnectedTimer) {
    window.clearTimeout(reconnectedTimer)
    reconnectedTimer = null
  }
})

function goToSearchResult(path: string) {
  void router.push(path)
  searchText.value = ''
  mobileOpen.value = false
}

watch(() => route.fullPath, () => {
  staff.value = getStaffUser()
  role.value = getPortalRole()
  void refreshUnreadCounts()
})

function signOut() {
  if (!signingOut.value) showLogoutConfirmation.value = true
}

async function confirmSignOut() {
  if (signingOut.value) return
  showLogoutConfirmation.value = false
  signingOut.value = true
  try { await endSession() } catch { /* Session is cleared even when the API is offline. */ }
  window.location.assign('/')
}
</script>

<template>
  <div v-if="!isOnline" class="offline-banner" role="status" aria-live="polite">
    Connection unavailable. App pages may open from cache, but records, sign-in, and changes need the server. Nothing is saved offline.
  </div>
  <Transition name="reconnected-fade">
    <div v-if="showReconnectedNotice" class="reconnected-banner" role="status" aria-live="polite">
      <span class="reconnected-dot" aria-hidden="true"></span>
      Connection restored. You're back online.
    </div>
  </Transition>
  <RouterView v-if="isPublicPage" />

  <div v-else class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }" :data-theme="isDarkMode ? 'dark' : 'light'">
    <aside class="sidebar" :class="{ open: mobileOpen, 'sidebar-role-compact': role === 'patient' || role === 'admin' }">
      <div class="sidebar-header">
        <RouterLink
          class="brand"
          to="/"
          @mouseenter="showSidebarTooltip($event, 'MediCare+ home')"
          @mouseleave="hideSidebarTooltip"
          @focus="showSidebarTooltip($event, 'MediCare+ home')"
          @blur="hideSidebarTooltip"
        >
          <span class="brand-mark" aria-hidden="true"><UiIcon name="plus" /></span>
          <span>MediCare<span class="brand-accent">+</span><small>Your Smile, Our Priority</small></span>
        </RouterLink>
        <button
          class="sidebar-toggle"
          type="button"
          :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-expanded="!sidebarCollapsed"
          @click="toggleSidebar"
          @mouseenter="showSidebarTooltip($event, sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')"
          @mouseleave="hideSidebarTooltip"
          @focus="showSidebarTooltip($event, sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')"
          @blur="hideSidebarTooltip"
        >
          <UiIcon name="menu" />
        </button>
      </div>

      <div v-if="role !== 'patient' && role !== 'admin'" class="sidebar-section-heading">
        <div>
          <p class="nav-label">CLINIC WORKSPACE</p>
          <span class="sidebar-nav-caption">Tools for your clinic team</span>
        </div>
        <span class="sidebar-nav-count" aria-label="Available pages">{{ navPages.length + (role ? 1 : 0) }}</span>
      </div>
      <label v-if="role !== 'patient' && role !== 'admin'" class="sidebar-nav-search">
        <UiIcon name="search" />
        <input v-model="navFilter" type="search" placeholder="Find a workspace page" aria-label="Filter navigation pages">
        <button v-if="navFilter" type="button" aria-label="Clear navigation filter" @click="navFilter = ''"><UiIcon name="x" /></button>
      </label>
      <nav class="side-nav" aria-label="Main navigation">
        <section v-for="group in navGroups" :key="group.title" class="nav-group">
          <h2 class="nav-group-title">{{ group.title }}</h2>
          <RouterLink
            v-for="page in group.pages"
            :key="page.number"
            :to="page.path"
            class="nav-link"
            @click="mobileOpen=false"
            @mouseenter="showSidebarTooltip($event, page.title)"
            @mouseleave="hideSidebarTooltip"
            @focus="showSidebarTooltip($event, page.title)"
            @blur="hideSidebarTooltip"
          >
            <span class="nav-icon"><UiIcon :name="pageIcon(page.number)" /></span>
            <span class="nav-link-title">{{ page.title }}</span>
            <span
              v-if="page.number === 33 && unreadMessageCount"
              class="message-unread-count sidebar-message-count"
              aria-hidden="true"
            >{{ unreadMessageCount > 99 ? '99+' : unreadMessageCount }}</span>
            <span
              v-if="[12, 39, 40].includes(page.number) && unreadNotificationCount"
              class="message-unread-count sidebar-message-count"
              aria-hidden="true"
            >{{ unreadNotificationCount > 99 ? '99+' : unreadNotificationCount }}</span>
            <UiIcon class="nav-link-arrow" name="arrow-right" />
          </RouterLink>
        </section>
        <p v-if="!filteredNavCount" class="nav-empty">No pages match “{{ navFilter }}”.</p>
      </nav>

      <section class="sidebar-note"><strong>{{ role === 'patient' ? 'Need a little help?' : 'Clinic workspace' }}</strong><span>{{ role === 'patient' ? 'Our care team is happy to assist.' : 'Keep your team and every visit in sync.' }}</span><small v-if="role !== 'patient'"><i/> All systems operational</small></section>
      <div class="sidebar-footer">
        <span class="avatar" aria-hidden="true"><img v-if="profilePicture" :src="profilePicture" alt=""><span v-else>{{ userInitials }}</span></span>
        <span class="staff-info">
          <strong>{{ staff?.username ?? 'Staff account' }}</strong>
          <small>{{ staff?.role ?? 'Staff' }}</small>
        </span>
        <button class="sign-out" type="button" :disabled="signingOut" :aria-label="signingOut ? 'Logging out' : 'Sign out'" :title="sidebarCollapsed ? 'Sign out' : undefined" @click="signOut"><UiIcon v-if="!signingOut" name="log-out" /><span v-else class="sign-out-spinner" aria-hidden="true" /></button>
      </div>
    </aside>
    <Transition name="sidebar-tooltip">
      <div
        v-if="sidebarCollapsed && sidebarTooltip"
        class="sidebar-tooltip"
        aria-hidden="true"
        :style="{ top: `${sidebarTooltip.top}px` }"
      >{{ sidebarTooltip.text }}</div>
    </Transition>

    <button
      v-if="mobileOpen"
      class="sidebar-backdrop"
      type="button"
      aria-label="Close navigation"
      @click="mobileOpen = false"
    ></button>

    <div class="main-column">
      <header class="topbar">
        <button class="icon-button mobile-menu" type="button" aria-label="Open navigation" @click="mobileOpen=!mobileOpen"><UiIcon name="menu" /></button>
        <div class="top-search"><UiIcon name="search" /><input v-model="searchText" type="search" placeholder="Search pages and features..." aria-label="Search pages and features" @keydown.enter="searchMatches[0] && goToSearchResult(searchMatches[0].path)"><div v-if="searchMatches.length" class="search-results"><button v-for="page in searchMatches" :key="page.number" type="button" @click="goToSearchResult(page.path)">{{ page.title }}<small>{{ page.path }}</small></button></div></div>
        <div class="topbar-actions"><button class="top-icon theme-toggle" type="button" :aria-label="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'" :aria-pressed="isDarkMode" @click="toggleTheme"><UiIcon :name="isDarkMode ? 'sun' : 'moon'" /></button><RouterLink class="top-icon notification-link" :to="notificationPath" :aria-label="unreadNotificationCount ? `Notifications, ${unreadNotificationCount} unread` : 'Notifications'"><UiIcon name="bell" /><span v-if="unreadNotificationCount" class="message-unread-count top-message-count" aria-hidden="true">{{ unreadNotificationCount > 99 ? '99+' : unreadNotificationCount }}</span></RouterLink><RouterLink class="top-icon email-notification-link" :to="emailNotificationPath" :aria-label="role === 'patient' ? 'Email notifications' : 'Email and notification log'"><UiIcon name="mail" /></RouterLink><RouterLink class="top-icon message-link" :to="messagePath" :aria-label="unreadMessageCount ? `Messages, ${unreadMessageCount} unread` : 'Messages'"><UiIcon name="message-circle" /><span v-if="unreadMessageCount" class="message-unread-count top-message-count" aria-hidden="true">{{ unreadMessageCount > 99 ? '99+' : unreadMessageCount }}</span></RouterLink><RouterLink class="top-user top-user-profile" to="/settings/profile" aria-label="Profile and settings"><span class="avatar" aria-hidden="true"><img v-if="profilePicture" :src="profilePicture" alt=""><span v-else>{{ userInitials }}</span></span><span><strong>{{ staff?.username ?? 'MediCare user' }}</strong><small>{{ staff?.role ?? 'Patient' }}</small></span></RouterLink></div>
      </header>
      <main class="page-content"><RouterView /></main>
    </div>
  </div>
  <Transition name="logout-fade">
    <div v-if="signingOut" class="logout-overlay" role="status" aria-live="polite">
      <div class="logout-dialog"><span class="logout-spinner" aria-hidden="true"></span><strong>Logging out</strong><p>Securely ending your MediCare+ session…</p></div>
    </div>
  </Transition>
  <ConfirmDialog
    :open="showLogoutConfirmation"
    title="Log out of MediCare+?"
    message="Are you sure you want to log out of your account?"
    cancel-label="Stay signed in"
    confirm-label="Log out"
    busy-label="Logging out…"
    :busy="signingOut"
    @cancel="showLogoutConfirmation = false"
    @confirm="confirmSignOut"
  />
  <ToastHost />
</template>
