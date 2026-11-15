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
  top: max(82px, calc(env(safe-area-inset-top) + 64px));
  right: max(18px, env(safe-area-inset-right));
  display: grid;
  width: min(390px, calc(100vw - 36px));
  max-height: calc(100vh - 100px);
  gap: 11px;
  overflow-y: auto;
  overscroll-behavior: contain;
  pointer-events: none;
  scrollbar-width: none;
}
.toast-region::-webkit-scrollbar { display: none; }
.app-toast {
  --toast-accent: #37805f;
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 28px;
  align-items: start;
  gap: 11px;
  overflow: hidden;
  padding: 14px 14px 16px 16px;
  border: 1px solid #dce8e1;
  border-radius: 17px;
  background: linear-gradient(145deg, #fff 0%, #fbfdfc 100%);
  box-shadow: 0 16px 42px rgb(26 49 39 / 18%), 0 2px 8px rgb(26 49 39 / 5%);
  color: #263d33;
  pointer-events: auto;
}
.app-toast::before {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 3px;
  border-radius: 0 4px 4px 0;
  background: var(--toast-accent);
  content: '';
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
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--toast-accent) 15%, white);
  border-radius: 13px;
  background: color-mix(in srgb, var(--toast-accent) 10%, white);
  color: var(--toast-accent);
  font-size: 17px;
}
.app-toast-copy { display: grid; min-width: 0; justify-items: start; gap: 5px; padding-top: 1px; }
.app-toast-category {
  display: inline-flex;
  min-height: 19px;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--toast-accent) 10%, white);
  color: var(--toast-accent);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .06em;
  line-height: 1.25;
  text-transform: uppercase;
}
.app-toast-copy strong { color: #263d33; font-size: 14px; font-weight: 750; line-height: 1.35; }
.app-toast-copy > span:not(.app-toast-category) { color: #62736b; font-size: 12.5px; line-height: 1.45; overflow-wrap: anywhere; }
.app-toast-action {
  display: inline-flex;
  min-height: 29px;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  padding: 5px 9px;
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--toast-accent) 9%, white);
  color: var(--toast-accent);
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  font-weight: 750;
  transition: background-color 160ms ease, transform 160ms ease;
}
.app-toast-action svg { width: 13px; height: 13px; }
.app-toast-action:hover { transform: translateX(2px); background: color-mix(in srgb, var(--toast-accent) 15%, white); }
.app-toast-close {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: #f1f5f2;
  color: #718078;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
.app-toast-close:hover { background: #e6eee9; color: #344c40; }
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
  background: linear-gradient(90deg, var(--toast-accent), color-mix(in srgb, var(--toast-accent) 30%, white));
  opacity: .75;
}
.toast-enter-active,.toast-leave-active,.toast-move { transition: opacity 200ms ease, transform 200ms cubic-bezier(.2,.8,.2,1); }
.toast-enter-from,.toast-leave-to { transform: translateY(-10px) scale(.985); opacity: 0; }
.toast-leave-active { position: absolute; right: 0; left: 0; }
@keyframes toast-progress { to { transform: scaleX(0); } }

:root[data-theme='dark'] .app-toast {
  border-color: #3a5146;
  background: linear-gradient(145deg, #24342d 0%, #1d2b25 100%);
  box-shadow: 0 16px 42px rgb(0 0 0 / 38%), 0 2px 8px rgb(0 0 0 / 15%);
  color: #e4ede9;
}
:root[data-theme='dark'] .app-toast-copy strong { color: #e4ede9; }
:root[data-theme='dark'] .app-toast-copy > span { color: #b7c8bf; }
:root[data-theme='dark'] .app-toast-icon {
  border-color: color-mix(in srgb, var(--toast-accent) 30%, #24342d);
  background: color-mix(in srgb, var(--toast-accent) 20%, #24342d);
}
:root[data-theme='dark'] .app-toast-category { background: color-mix(in srgb, var(--toast-accent) 18%, #24342d); }
:root[data-theme='dark'] .app-toast-action { background: color-mix(in srgb, var(--toast-accent) 17%, #24342d); }
:root[data-theme='dark'] .app-toast-action:hover { background: color-mix(in srgb, var(--toast-accent) 25%, #24342d); }
:root[data-theme='dark'] .app-toast-close { background: #304139; color: #aabbb2; }
:root[data-theme='dark'] .app-toast-close:hover { background: #3a5045; color: #e4ede9; }
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
    top: max(68px, calc(env(safe-area-inset-top) + 56px));
    right: max(9px, env(safe-area-inset-right));
    left: max(9px, env(safe-area-inset-left));
    width: auto;
    max-height: min(42vh, calc(100vh - 80px));
    max-height: min(42dvh, calc(100dvh - 80px));
    gap: 8px;
    -webkit-overflow-scrolling: touch;
  }
  .app-toast {
    grid-template-columns: 32px minmax(0, 1fr) 24px;
    gap: 8px;
    padding: 9px 9px 11px 11px;
    border-radius: 13px;
  }
  .app-toast::before { top: 10px; bottom: 10px; }
  .app-toast-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    font-size: 15px;
  }
  .app-toast-copy { gap: 3px; padding-top: 0; }
  .app-toast-category {
    min-height: 17px;
    padding: 2px 6px;
    font-size: 8px;
  }
  .app-toast-copy strong {
    font-size: 12.5px;
    line-height: 1.3;
  }
  .app-toast-copy > span:not(.app-toast-category) {
    font-size: 11px;
    line-height: 1.35;
  }
  .app-toast-action {
    min-height: 25px;
    margin-top: 1px;
    padding: 4px 8px;
    font-size: 10.5px;
  }
  .app-toast-close {
    width: 24px;
    height: 24px;
    border-radius: 8px;
  }
  .app-toast-close svg { width: 14px; height: 14px; }
}
@media (max-width: 380px) {
  .toast-region {
    right: max(7px, env(safe-area-inset-right));
    left: max(7px, env(safe-area-inset-left));
    max-height: min(40vh, calc(100vh - 76px));
    max-height: min(40dvh, calc(100dvh - 76px));
    gap: 7px;
  }
  .app-toast {
    grid-template-columns: 29px minmax(0, 1fr) 22px;
    gap: 7px;
    padding: 8px 8px 10px 10px;
  }
  .app-toast-icon {
    width: 29px;
    height: 29px;
    border-radius: 9px;
    font-size: 14px;
  }
  .app-toast-copy strong { font-size: 12px; }
  .app-toast-copy > span:not(.app-toast-category) { font-size: 10.5px; }
  .app-toast-close { width: 22px; height: 22px; }
}
@media (min-width: 601px) and (max-width: 900px) {
  .toast-region {
    right: 16px;
    width: min(360px, calc(100vw - 32px));
  }
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,.toast-leave-active,.toast-move { transition: none; }
  .app-toast-action { transition: none; }
  .app-toast-progress { animation: none; }
}
</style>
