<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiIcon, { type IconName } from './UiIcon.vue'
import type { ToastCategory, ToastPayload } from '../services/toast'

const router = useRouter()
const toasts = ref<ToastPayload[]>([])
const timers = new Map<number, number>()

function dismiss(id: number) {
  const timer = timers.get(id)
  if (timer !== undefined) window.clearTimeout(timer)
  timers.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function addToast(event: Event) {
  if (!(event instanceof CustomEvent)) return
  const toast = event.detail as ToastPayload
  const oldest = toasts.value.length >= 4 ? toasts.value[0] : null
  if (oldest) dismiss(oldest.id)

  toasts.value = [...toasts.value, toast]
  timers.set(toast.id, window.setTimeout(() => dismiss(toast.id), toast.duration))
}

function iconName(kind: ToastPayload['kind']) {
  if (kind === 'success') return 'check-circle'
  if (kind === 'error') return 'alert-circle'
  if (kind === 'warning') return 'alert-triangle'
  return 'sparkles'
}

function categoryIcon(category: ToastCategory): IconName {
  if (category === 'message') return 'message-circle'
  if (category === 'appointment') return 'calendar'
  if (category === 'payment') return 'credit-card'
  return 'bell'
}

function categoryLabel(category: ToastCategory) {
  if (category === 'message') return 'New message'
  if (category === 'appointment') return 'Appointment'
  if (category === 'payment') return 'Payment'
  return 'New notification'
}

function openToast(toast: ToastPayload) {
  const path = toast.actionPath
  dismiss(toast.id)
  if (!path?.startsWith('/') || path.startsWith('//')) return
  void router.push(path).catch((cause: unknown) => {
    console.error('Could not open the notification destination.', cause)
  })
}

onMounted(() => window.addEventListener('medicare:toast', addToast))
onBeforeUnmount(() => {
  window.removeEventListener('medicare:toast', addToast)
  for (const timer of timers.values()) window.clearTimeout(timer)
  timers.clear()
})
</script>

<template>
  <Teleport to="body">
    <section class="toast-region" aria-label="Notifications">
      <TransitionGroup name="toast">
        <article
          v-for="toast in toasts"
          :key="toast.id"
          class="app-toast"
          :class="[`app-toast--${toast.kind}`, toast.category && `app-toast--${toast.category}`]"
          :style="{ '--toast-duration': `${toast.duration}ms` }"
          :role="toast.kind === 'error' ? 'alert' : 'status'"
        >
          <span class="app-toast-icon" aria-hidden="true">
            <UiIcon :name="toast.category ? categoryIcon(toast.category) : iconName(toast.kind)" />
          </span>
          <span class="app-toast-copy">
            <span v-if="toast.category" class="app-toast-category">{{ categoryLabel(toast.category) }}</span>
            <strong>{{ toast.title }}</strong>
            <span>{{ toast.message }}</span>
            <button v-if="toast.actionPath" class="app-toast-action" type="button" @click="openToast(toast)">
              {{ toast.actionLabel || 'View' }}
              <UiIcon name="arrow-right" />
            </button>
          </span>
          <button class="app-toast-close" type="button" aria-label="Dismiss notification" @click="dismiss(toast.id)">
            <UiIcon name="x" />
          </button>
          <span class="app-toast-progress" aria-hidden="true"></span>
        </article>
      </TransitionGroup>
    </section>
  </Teleport>
</template>

<style>
.toast-region {
  position: fixed;
  z-index: 1200;
  top: max(18px, env(safe-area-inset-top));
  right: max(18px, env(safe-area-inset-right));
  display: grid;
  width: min(410px, calc(100vw - 36px));
  gap: 10px;
  pointer-events: none;
}
.app-toast {
  --toast-accent: #37805f;
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 26px;
  align-items: start;
  gap: 12px;
  overflow: hidden;
  padding: 15px 14px 17px;
  border: 1px solid #dce8e1;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 12px 34px rgb(26 49 39 / 16%);
  color: #263d33;
  pointer-events: auto;
}
.app-toast--error { --toast-accent: #bd4b55; }
.app-toast--warning { --toast-accent: #a87527; }
.app-toast--info { --toast-accent: #397995; }
.app-toast--message { --toast-accent: #4573bd; }
.app-toast--appointment { --toast-accent: #37805f; }
.app-toast--payment { --toast-accent: #9a6d2d; }
.app-toast--general { --toast-accent: #397995; }
.app-toast-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  background: color-mix(in srgb, var(--toast-accent) 12%, white);
  color: var(--toast-accent);
  font-size: 16px;
}
.app-toast-copy { display: grid; min-width: 0; justify-items: start; gap: 4px; padding-top: 1px; }
.app-toast-category {
  color: var(--toast-accent);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .045em;
  line-height: 1.25;
  text-transform: uppercase;
}
.app-toast-copy strong { color: #263d33; font-size: 13px; font-weight: 750; line-height: 1.35; }
.app-toast-copy > span:not(.app-toast-category) { color: #62736b; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.app-toast-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--toast-accent);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 750;
}
.app-toast-action svg { width: 13px; height: 13px; }
.app-toast-action:hover { text-decoration: underline; text-underline-offset: 3px; }
.app-toast-close {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #84938c;
  cursor: pointer;
}
.app-toast-close:hover { background: #eef3f0; color: #344c40; }
.app-toast-close svg { width: 15px; height: 15px; }
.app-toast-close:focus-visible,.app-toast-action:focus-visible {
  outline: 2px solid var(--toast-accent);
  outline-offset: 2px;
}
.app-toast-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  transform-origin: left;
  animation: toast-progress var(--toast-duration) linear forwards;
  background: var(--toast-accent);
  opacity: .65;
}
.toast-enter-active,.toast-leave-active,.toast-move { transition: opacity 180ms ease, transform 180ms ease; }
.toast-enter-from,.toast-leave-to { transform: translateY(-8px) scale(.98); opacity: 0; }
.toast-leave-active { position: absolute; right: 0; left: 0; }
@keyframes toast-progress { to { transform: scaleX(0); } }

:root[data-theme='dark'] .app-toast {
  border-color: #3a5146;
  background: #202f29;
  box-shadow: 0 12px 34px rgb(0 0 0 / 32%);
  color: #e4ede9;
}
:root[data-theme='dark'] .app-toast-copy strong { color: #e4ede9; }
:root[data-theme='dark'] .app-toast-copy > span { color: #b7c8bf; }
:root[data-theme='dark'] .app-toast-icon { background: color-mix(in srgb, var(--toast-accent) 22%, #202f29); }
:root[data-theme='dark'] .app-toast-close { color: #9fb1a8; }
:root[data-theme='dark'] .app-toast-close:hover { background: #2b4037; color: #e4ede9; }
:root[data-theme='dark'] .app-toast--success { --toast-accent: #80c99b; }
:root[data-theme='dark'] .app-toast--error { --toast-accent: #f08d93; }
:root[data-theme='dark'] .app-toast--warning { --toast-accent: #efc477; }
:root[data-theme='dark'] .app-toast--info { --toast-accent: #86c5de; }
:root[data-theme='dark'] .app-toast--message { --toast-accent: #a2bfff; }
:root[data-theme='dark'] .app-toast--appointment { --toast-accent: #80c99b; }
:root[data-theme='dark'] .app-toast--payment { --toast-accent: #efc477; }
:root[data-theme='dark'] .app-toast--general { --toast-accent: #86c5de; }

@media (max-width: 600px) {
  .toast-region {
    top: max(12px, env(safe-area-inset-top));
    right: 12px;
    left: 12px;
    width: auto;
  }
  .app-toast { gap: 10px; padding: 13px 12px 15px; border-radius: 13px; }
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,.toast-leave-active,.toast-move { transition: none; }
  .app-toast-progress { animation: none; }
}
</style>
