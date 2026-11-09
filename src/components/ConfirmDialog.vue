<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import UiIcon from './UiIcon.vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  busyLabel?: string
  inputLabel?: string
  inputPlaceholder?: string
  requireInput?: boolean
  busy?: boolean
}>(), {
  confirmLabel: 'Confirm',
  cancelLabel: 'Keep it',
  busyLabel: 'Cancelling…',
  inputLabel: '',
  inputPlaceholder: '',
  requireInput: false,
  busy: false,
})

const emit = defineEmits<{
  confirm: [value: string]
  cancel: []
}>()

const input = ref('')
const inputElement = ref<HTMLInputElement | null>(null)

watch(() => props.open, (open) => {
  if (!open) {
    input.value = ''
    return
  }
  void nextTick(() => inputElement.value?.focus())
})

function confirm() {
  const value = input.value.trim()
  if (props.requireInput && !value) return
  emit('confirm', value)
}
</script>

<template>
  <div v-if="open" class="modal-backdrop confirm-backdrop" @click.self="emit('cancel')">
    <section
      class="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div class="confirm-dialog-icon" aria-hidden="true">
        <UiIcon name="alert-triangle" />
      </div>
      <div class="confirm-dialog-copy">
        <p class="eyebrow">PLEASE CONFIRM</p>
        <h2 id="confirm-dialog-title">{{ title }}</h2>
        <p id="confirm-dialog-message">{{ message }}</p>
      </div>
      <label v-if="inputLabel" class="confirm-dialog-field">
        <span>{{ inputLabel }}</span>
        <input
          ref="inputElement"
          v-model="input"
          type="text"
          :placeholder="inputPlaceholder"
          :required="requireInput"
          @keydown.enter="confirm"
        >
        <small v-if="requireInput" class="confirm-dialog-hint">A reason is required before this appointment can be cancelled.</small>
      </label>
      <div class="confirm-dialog-actions">
        <button class="button button-quiet" type="button" :disabled="busy" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button class="button button-danger" type="button" :disabled="busy || (requireInput && !input.trim())" @click="confirm">
          <span v-if="busy" class="button-spinner" aria-hidden="true"></span>
          {{ busy ? busyLabel : confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>
