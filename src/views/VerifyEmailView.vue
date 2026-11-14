<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, apiRequest } from '../services/api'
import UiIcon from '../components/UiIcon.vue'
import { notify } from '../services/toast'

const route = useRoute()
const router = useRouter()
const form = reactive({ email: '', code: '' })
const codeDigits = ref(Array.from({ length: 6 }, () => ''))
const busy = ref(false)
const resendBusy = ref(false)
const error = ref('')
const success = ref('')
const resendMessage = ref('')
const deliveryFailed = ref(false)

async function handleAlreadyVerified(message: string) {
  if (!/already registered and verified/i.test(message)) return false
  sessionStorage.removeItem('medicare_verify_email')
  await router.replace({ path: '/login', query: { notice: 'already-verified' } })
  return true
}

onMounted(() => {
  form.email = String(route.query.email || sessionStorage.getItem('medicare_verify_email') || '')
  deliveryFailed.value = route.query.delivery === 'failed'
  nextTick(() => focusCodeInput(0))
})

function focusCodeInput(index: number) {
  document.getElementById(`verification-code-${index}`)?.focus()
}

function setCodeDigits(value: string, startIndex = 0, replaceRemaining = false) {
  const digits = value.replace(/\D/g, '')
  const updated = [...codeDigits.value]
  if (replaceRemaining) updated.fill('', startIndex)
  for (const [offset, digit] of [...digits].slice(0, 6 - startIndex).entries()) {
    updated[startIndex + offset] = digit
  }
  codeDigits.value = updated
  form.code = updated.join('')
  error.value = ''
}

function handleCodeInput(event: Event, index: number) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '')
  if (digits.length > 1) {
    setCodeDigits(digits, index, true)
    focusCodeInput(Math.min(index + digits.length, 5))
    return
  }

  setCodeDigits(digits, index)
  if (digits && index < 5) focusCodeInput(index + 1)
}

function handleCodePaste(event: ClipboardEvent, index: number) {
  event.preventDefault()
  const digits = event.clipboardData?.getData('text') ?? ''
  setCodeDigits(digits, index, true)
  focusCodeInput(Math.min(index + digits.replace(/\D/g, '').length, 5))
}

function handleCodeKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'Backspace') {
    event.preventDefault()
    const targetIndex = codeDigits.value[index] ? index : Math.max(index - 1, 0)
    const updated = [...codeDigits.value]
    updated[targetIndex] = ''
    codeDigits.value = updated
    form.code = updated.join('')
    error.value = ''
    focusCodeInput(targetIndex)
  } else if (event.key === 'Delete') {
    event.preventDefault()
    const updated = [...codeDigits.value]
    updated[index] = ''
    codeDigits.value = updated
    form.code = updated.join('')
    error.value = ''
  } else if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    focusCodeInput(index - 1)
  } else if (event.key === 'ArrowRight' && index < 5) {
    event.preventDefault()
    focusCodeInput(index + 1)
  }
}

function clearCode() {
  codeDigits.value = Array.from({ length: 6 }, () => '')
  form.code = ''
  nextTick(() => focusCodeInput(0))
}

async function submit() {
  busy.value = true
  error.value = ''
  success.value = ''
  resendMessage.value = ''
  try {
    const result = await apiRequest<{ message: string }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: form.email.trim(), code: form.code.trim() }),
    })
    success.value = result.message
    notify.success(result.message, 'Email verified')
    sessionStorage.removeItem('medicare_verify_email')
    await router.replace({ path: '/login', query: { notice: 'registered' } })
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not verify email.'
    notify.error(error.value, 'Email verification failed')
    if (await handleAlreadyVerified(error.value)) return
  } finally {
    busy.value = false
  }
}

async function resendCode() {
  resendBusy.value = true
  error.value = ''
  resendMessage.value = ''
  try {
    const result = await apiRequest<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: form.email.trim() }),
    })
    resendMessage.value = result.message
    deliveryFailed.value = false
    clearCode()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not send a new verification code.'
    await handleAlreadyVerified(error.value)
  } finally {
    resendBusy.value = false
  }
}
</script>

<template>
  <main class="auth-page verify-page">
    <RouterLink class="brand auth-brand" to="/">
      <span class="brand-mark" aria-hidden="true"><UiIcon name="plus" /></span>
      <span>MediCare<span class="brand-accent">+</span></span>
    </RouterLink>

    <form class="surface auth-card verify-card" @submit.prevent="submit">
      <span class="auth-symbol verify-symbol" aria-hidden="true"><UiIcon name="mail" /></span>
      <p class="eyebrow">PATIENT ACCOUNT SETUP</p>
      <h1>Check your email</h1>
      <p class="auth-description">We sent a six-digit verification code to <strong>{{ form.email || 'your email address' }}</strong>. Enter it below to finish creating your account.</p>

      <div v-if="!success" class="verify-waiting" role="status">
        <span class="verify-waiting-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        Waiting for your code
      </div>

      <label class="verify-email-field">
        <span>Email address</span>
        <input v-model.trim="form.email" required type="email" autocomplete="email">
      </label>

      <fieldset class="verify-code-field" :disabled="busy || Boolean(success)">
        <legend>Verification code</legend>
        <div class="verify-code-inputs" aria-label="Six-digit verification code">
          <input
            v-for="(_, index) in codeDigits"
            :id="`verification-code-${index}`"
            :key="index"
            :value="codeDigits[index]"
            :aria-label="`Digit ${index + 1} of 6`"
            :autocomplete="index === 0 ? 'one-time-code' : 'off'"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            required
            @input="handleCodeInput($event, index)"
            @paste="handleCodePaste($event, index)"
            @keydown="handleCodeKeydown($event, index)"
          >
        </div>
      </fieldset>

      <p v-if="deliveryFailed" class="alert alert-error verify-alert" role="alert">We couldn’t send your verification email yet. Please try again below, and check your spam folder too.</p>
      <p v-if="error" class="alert alert-error verify-alert" role="alert">{{ error }}</p>
      <p v-if="resendMessage" class="alert alert-success verify-alert" role="status">{{ resendMessage }}</p>
      <p v-if="success" class="alert alert-success verify-alert" role="status">{{ success }}</p>

      <button class="button button-primary button-full verify-submit" :disabled="busy || Boolean(success) || form.code.length !== 6">
        <span v-if="busy" class="verify-spinner" aria-hidden="true"></span>
        {{ busy ? 'Verifying your email…' : 'Verify email and finish setup' }}
      </button>
      <p class="verify-resend">Didn’t receive the email?
        <button class="text-button" type="button" :disabled="resendBusy || Boolean(success) || !form.email" @click="resendCode">
          {{ resendBusy ? 'Sending a new code…' : 'Send a new code' }}
        </button>
      </p>
      <RouterLink v-if="success" class="auth-back verify-signin" to="/login">Continue to sign in</RouterLink>
      <p class="auth-help verify-help">Your code expires in 15 minutes. After three incorrect attempts, verification pauses for 30 minutes.</p>
    </form>
  </main>
</template>
