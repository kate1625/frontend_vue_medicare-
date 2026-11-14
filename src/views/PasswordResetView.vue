<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, apiRequest } from '../services/api'
import UiIcon from '../components/UiIcon.vue'
import { notify } from '../services/toast'

const route = useRoute()
const email = ref('')
const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const requested = ref(false)
const requestStatus = ref<'sent' | 'not_found' | 'unverified' | 'inactive' | ''>('')
const completed = ref(false)
const busy = ref(false)
const checkingToken = ref(false)
const invalidToken = ref(false)
const verificationError = ref('')
const error = ref('')
const message = ref('')
const passwordScore = computed(() => [password.value.length >= 8, /[A-Z]/.test(password.value), /[a-z]/.test(password.value), /\d/.test(password.value), /[^A-Za-z0-9]/.test(password.value)].filter(Boolean).length)

watch(() => route.query.token, async (queryToken) => {
  token.value = ''
  invalidToken.value = false
  verificationError.value = ''
  const resetToken = String(queryToken || '')
  if (!resetToken) return
  checkingToken.value = true
  try {
    const result = await apiRequest<{ valid: boolean }>('/api/auth/password-reset/validate', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken }),
    })
    if (result.valid) token.value = resetToken
    else invalidToken.value = true
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 422) {
      invalidToken.value = true
    } else {
      verificationError.value = cause instanceof ApiError ? cause.message : 'We could not verify your reset link. Please try again.'
    }
  } finally {
    checkingToken.value = false
  }
}, { immediate: true })

async function request() {
  busy.value = true; error.value = ''; message.value = ''; requested.value = false; requestStatus.value = ''
  try {
    const result = await apiRequest<{ data: { status: 'sent' | 'not_found' | 'unverified' | 'inactive'; message: string } }>('/api/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email: email.value.trim() }) })
    message.value = result.data.message
    requested.value = true
    requestStatus.value = result.data.status
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'We could not send your reset instructions. Please try again.'; notify.error(error.value, 'Reset link not sent') }
  finally { busy.value = false }
}

async function confirm() {
  error.value = ''; message.value = ''
  if (password.value !== confirmPassword.value) { error.value = 'Those passwords do not match. Please check and try again.'; return }
  busy.value = true
  try {
    const result = await apiRequest<{ message: string }>('/api/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token: token.value, password: password.value }) })
    message.value = result.message; completed.value = true; token.value = ''; password.value = ''; confirmPassword.value = ''
    notify.success(result.message, 'Password updated')
  } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'We could not update your password. Request a fresh reset link and try again.'; notify.error(error.value, 'Password not updated') }
  finally { busy.value = false }
}
</script>

<template>
  <main class="auth-page">
    <RouterLink class="brand auth-brand" to="/"><span class="brand-mark" aria-hidden="true"><UiIcon name="plus" /></span><span>MediCare<span class="brand-accent">+</span></span></RouterLink>
    <section class="surface auth-card">

      <p class="eyebrow">ACCOUNT RECOVERY</p>
      <h1>{{ checkingToken ? 'Verifying reset link…' : invalidToken ? 'Reset link expired or invalid' : verificationError ? 'Unable to verify reset link' : completed ? 'You’re all set' : token ? 'Choose a new password' : requested && requestStatus === 'sent' ? 'Reset link sent' : requested && requestStatus === 'not_found' ? 'Account not found' : requested && requestStatus === 'unverified' ? 'Verify your account first' : requested && requestStatus === 'inactive' ? 'Account inactive' : 'Forgot your password?' }}</h1>
      <p class="muted auth-description">{{ checkingToken ? 'Please wait while we verify your secure reset link.' : invalidToken ? 'This reset link is invalid or has expired. Request a new link to continue.' : verificationError ? 'We could not check your reset link right now. Please try again.' : completed ? 'Your password has been updated. You can sign in with your new password now.' : token ? 'Create a strong password to secure your MediCare+ account.' : requested && requestStatus === 'sent' ? 'Check your inbox and spam folder, then open the reset link to continue.' : requested && requestStatus === 'not_found' ? 'Check the spelling of the email address or create a MediCare+ account.' : requested && requestStatus === 'unverified' ? 'Complete email verification before requesting a password reset.' : requested && requestStatus === 'inactive' ? 'Contact the clinic if you think this account should be active.' : 'It happens. Enter the email address linked to your account and we’ll send you a secure reset link.' }}</p>

      <form v-if="!token && !completed && !checkingToken && !invalidToken && !verificationError" class="auth-fields" @submit.prevent="request">
        <label class="field"><span>Email address</span><input v-model.trim="email" type="email" required maxlength="100" autocomplete="email" placeholder="you@example.com"></label>
        <p v-if="requested && requestStatus === 'sent'" class="form-success" role="status">{{ message }}</p>
        <p v-else-if="requested && requestStatus" class="form-error" role="status">{{ message }}</p>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <RouterLink v-if="requested && requestStatus === 'not_found'" class="button button-quiet button-full" to="/register">Create an account</RouterLink>
        <RouterLink v-if="requested && requestStatus === 'unverified'" class="button button-quiet button-full" :to="{ path: '/verify-email', query: { email: email.trim() } }">Verify your email</RouterLink>
        <button class="button button-primary button-full" :disabled="busy">{{ busy ? 'Sending instructions…' : requested ? 'Try another email' : 'Send reset link' }}</button>
      </form>

      <form v-else-if="token && !completed" class="auth-fields" @submit.prevent="confirm">
        <label class="field"><span>New password</span><input v-model="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></label>
        <div class="password-meter" :data-strength="passwordScore"><span v-for="part in 5" :key="part"></span></div>
        <small class="password-hint">Use at least 8 characters; a mix of letters, numbers, and symbols is stronger.</small>
        <label class="field"><span>Confirm new password</span><input v-model="confirmPassword" type="password" required minlength="8" autocomplete="new-password" placeholder="Enter it one more time"></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button class="button button-primary button-full" :disabled="busy">{{ busy ? 'Updating password…' : 'Save new password' }}</button>
      </form>

      <div v-if="completed" class="auth-fields"><p class="form-success" role="status">{{ message }}</p><RouterLink class="button button-primary button-full" to="/login">Continue to sign in</RouterLink></div>
      <RouterLink v-else-if="invalidToken || verificationError" class="button button-primary button-full" to="/reset-password">Request a new reset link</RouterLink>
      <RouterLink v-else-if="!checkingToken" class="auth-back" to="/login">← Back to sign in</RouterLink>
      <p class="auth-help">Need a hand? Contact the clinic and we’ll be happy to help.</p>
    </section>
    <p class="auth-footnote">Your account security matters to us.</p>
  </main>
</template>
