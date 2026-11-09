<template>
  <div class="notif-bell">
    <button @click="toggle" class="bell-btn">🔔<span v-if="count" class="badge">{{ count }}</span></button>
    <div v-if="open" class="dropdown">
      <div class="header"><strong>Notifications</strong><button @click="markAll">Mark all read</button></div>
      <ul>
        <li v-for="n in items" :key="n.id" :class="{unread:!n.is_read}" @click="openNotif(n)">
          <div class="title">{{ n.title }}</div>
          <div class="msg">{{ n.message }}</div>
          <small>{{ n.created_at }}</small>
        </li>
        <li v-if="!items.length" class="empty">No notifications</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { apiRequest, getApiData } from '../services/api'

interface NotificationItem {
  id: number | string
  user_id: number
  sender_id: number | null
  role_target: string
  title: string
  message: string
  type: string
  is_read: boolean | 0 | 1
  redirect_url: string | null
  created_at: string
}

interface UnreadCount {
  count: number
}

const items = ref<NotificationItem[]>([])
const count = ref(0)
const open = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  try {
    items.value = await getApiData<NotificationItem[]>('/api/notifications')
    const unread = await getApiData<UnreadCount>('/api/notifications/unread-count')
    count.value = unread.count
  } catch (cause) {
    console.error('Could not load notifications.', cause)
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) void load()
}

async function markAll() {
  try {
    await apiRequest<{ message: string }>('/api/notifications/read-all', { method: 'POST' })
    await load()
  } catch (cause) {
    console.error('Could not mark notifications as read.', cause)
  }
}

async function openNotif(n: NotificationItem) {
  try {
    if (!n.is_read) {
      await apiRequest<{ message: string }>(`/api/notifications/${n.id}/read`, { method: 'POST' })
    }
    if (n.redirect_url) window.location.href = n.redirect_url
    await load()
  } catch (cause) {
    console.error('Could not open this notification.', cause)
  }
}

onMounted(() => {
  void load()
  timer = setInterval(() => void load(), 15000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.notif-bell { position: relative; }
.bell-btn { background:none; border:none; font-size:21.6px; cursor:pointer; }
.badge { background:#e11d48; color:#fff; border-radius:999px; padding:0 6px; font-size:11.9px; margin-left:4px; }
.dropdown { position:absolute; right:0; top:32px; width:320px; max-height:400px; overflow:auto; background:#fff; border:1px solid #ddd; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,.1); z-index:100; }
.header { display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee; }
ul { list-style:none; margin:0; padding:0; }
li { padding:8px; border-bottom:1px solid #f3f3f3; cursor:pointer; }
li.unread { background:#eff6ff; }
.empty { text-align:center; color:#888; }
</style>
EOF