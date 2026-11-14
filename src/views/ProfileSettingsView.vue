<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError, apiRequest, getApiData, getStaffUser, updateStaffUser, type StaffUser } from '../services/api'
import { getProfilePicture, removeProfilePicture, saveProfilePicture } from '../services/profilePreferences'
import UiIcon from '../components/UiIcon.vue'
import { notify } from '../services/toast'

const account = ref(getStaffUser())
const profilePicture = ref('')
const error = ref('')
const success = ref('')
const verificationError = ref('')
const verificationSuccess = ref('')
const verificationCode = ref('')
const verificationSent = ref(false)
const verificationBusy = ref(false)
const resendBusy = ref(false)
const accountLoading = ref(true)
const processing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const initials = computed(() => {
  const name = account.value?.username.trim() ?? ''
  const parts = name.split(/[\s._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U'
})

onMounted(async () => {
  try {
    profilePicture.value = getProfilePicture() ?? ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not load your saved profile picture.'
  }
  try {
    const currentAccount = await getApiData<StaffUser>('/api/auth/account')
    account.value = currentAccount
    updateStaffUser(currentAccount)
  } catch (cause) {
    verificationError.value = cause instanceof ApiError ? cause.message : 'Could not load account verification status.'
  } finally {
    accountLoading.value = false
  }
})

async function sendVerificationCode() {
  if (!account.value?.email || resendBusy.value) return
  resendBusy.value = true
  verificationError.value = ''
  verificationSuccess.value = ''
  try {
    const result = await apiRequest<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: account.value.email }),
    })
    verificationSent.value = true
    verificationCode.value = ''
    verificationSuccess.value = result.message
  } catch (cause) {
    verificationError.value = cause instanceof ApiError ? cause.message : 'Could not send a verification code.'
  } finally {
    resendBusy.value = false
  }
}

async function verifyAccount() {
  if (!account.value?.email || !/^\d{6}$/.test(verificationCode.value) || verificationBusy.value) return
  verificationBusy.value = true
  verificationError.value = ''
  verificationSuccess.value = ''
  try {
    const result = await apiRequest<{ message: string }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: account.value.email, code: verificationCode.value }),
    })
    account.value = { ...account.value, is_verified: true }
    updateStaffUser({ is_verified: true })
    verificationSent.value = false
    verificationCode.value = ''
    verificationSuccess.value = result.message
  } catch (cause) {
    verificationError.value = cause instanceof ApiError ? cause.message : 'Could not verify this email address.'
  } finally {
    verificationBusy.value = false
  }
}

function updateVerificationCode(event: Event) {
  const input = event.target as HTMLInputElement
  verificationCode.value = input.value.replace(/\D/g, '').slice(0, 6)
}

function openFilePicker() {
  fileInput.value?.click()
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Your browser could not process this image.'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.84))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read this image. Choose a different file.'))
    }
    image.src = objectUrl
  })
}

async function selectPicture(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  error.value = ''
  success.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = 'Choose a JPG, PNG, or WebP image.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'Choose an image smaller than 5 MB.'
    return
  }

  processing.value = true
  try {
    const picture = await resizeImage(file)
    saveProfilePicture(picture)
    profilePicture.value = picture
    window.dispatchEvent(new CustomEvent('medicare:profile-picture-change'))
    success.value = 'Your profile picture has been saved on this device.'
    notify.success(success.value, 'Profile picture saved')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not save your profile picture.'
    notify.error(error.value, 'Profile picture not saved')
  } finally {
    processing.value = false
  }
}

function useInitials() {
  error.value = ''
  success.value = ''
  try {
    removeProfilePicture()
    profilePicture.value = ''
    window.dispatchEvent(new CustomEvent('medicare:profile-picture-change'))
    success.value = 'Your initials will be shown instead of a profile picture.'
    notify.success(success.value, 'Profile picture removed')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not remove the profile picture.'
    notify.error(error.value, 'Profile picture not removed')
  }
}
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">ACCOUNT</p>
      <h1>Profile &amp; settings</h1>
      <p class="muted">Personalize your account and choose how your profile appears.</p>
    </div>
  </section>

  <p v-if="error" class="alert alert-error" role="alert">{{ error }}</p>

  <section class="surface profile-settings-card">
    <div class="profile-settings-heading">
      <span class="profile-settings-symbol"><UiIcon name="user-round" /></span>
      <div><h2>Profile picture</h2><p>Shown beside your account in Messages on this browser.</p></div>
    </div>
    <div class="profile-settings-body">
      <div class="profile-picture-preview" aria-label="Profile picture preview">
        <img v-if="profilePicture" :src="profilePicture" alt="Your profile picture">
        <span v-else>{{ initials }}</span>
      </div>
      <div class="profile-picture-controls">
        <strong>{{ account?.username ?? 'MediCare user' }}</strong>
        <p>JPG, PNG, or WebP · up to 5 MB. Your image is resized before it is saved.</p>
        <div class="profile-picture-actions">
          <button class="button button-primary" type="button" :disabled="processing" @click="openFilePicker">
            <UiIcon name="user-round-plus" /> {{ processing ? 'Processing image…' : profilePicture ? 'Change picture' : 'Add picture' }}
          </button>
          <button v-if="profilePicture" class="button button-quiet" type="button" :disabled="processing" @click="useInitials">Use initials</button>
        </div>
        <input ref="fileInput" class="profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile picture" @change="selectPicture">
      </div>
    </div>
    <div class="profile-settings-footnote"><UiIcon name="shield-check" /> Stored in this browser only. Other accounts using this browser can see it in Messages; it is not synced to other devices. Your initials appear when no picture is set.</div>
  </section>

  <section class="surface profile-account-card">
    <div class="profile-settings-heading">
      <span class="profile-settings-symbol profile-settings-symbol-blue"><UiIcon name="shield-check" /></span>
      <div><h2>Account details</h2><p>Identity information for your current signed-in account.</p></div>
    </div>
    <dl class="profile-account-details">
      <div><dt>Username</dt><dd>{{ account?.username ?? '—' }}</dd></div>
      <div><dt>Email</dt><dd>{{ account?.email ?? '—' }}</dd></div>
      <div><dt>Role</dt><dd class="profile-role">{{ account?.role ?? 'User' }}</dd></div>
    </dl>
  </section>

  <section class="surface profile-verification-card" aria-labelledby="verification-heading">
    <div class="profile-settings-heading">
      <span class="profile-settings-symbol" :class="{ 'profile-settings-symbol-blue': account?.is_verified }"><UiIcon :name="account?.is_verified ? 'shield-check' : 'mail'" /></span>
      <div><h2 id="verification-heading">Email verification</h2><p>Verified email helps protect your account and is required to book appointments.</p></div>
    </div>
    <div v-if="accountLoading" class="profile-verification-content"><p>Checking your account status…</p></div>
    <div v-else-if="account?.is_verified" class="profile-verification-content is-verified" role="status">
      <div class="profile-verification-copy"><strong>Account verified</strong><p>Your email address is verified. You can book appointments.</p></div>
    </div>
    <div v-else class="profile-verification-content" role="status">
      <div class="profile-verification-copy"><strong>Account not verified</strong><p>Verify <b>{{ account?.email ?? 'your email address' }}</b> before requesting an appointment.</p></div>
      <div class="profile-verification-actions">
        <button v-if="!verificationSent" class="button button-primary" type="button" :disabled="resendBusy || !account?.email" @click="sendVerificationCode">
          <span v-if="resendBusy" class="verification-spinner" aria-hidden="true"></span>
          {{ resendBusy ? 'Sending verification code…' : 'Send verification code' }}
        </button>
      </div>
    </div>
    <Transition name="verification-reveal">
      <form v-if="verificationSent && !account?.is_verified" class="verification-code-panel" @submit.prevent="verifyAccount">
        <div class="verification-code-heading">
          <span class="verification-code-icon"><UiIcon name="mail" /></span>
          <div><h3>Enter your verification code</h3><p>We sent a 6-digit code to <strong>{{ account?.email }}</strong>. Check your inbox and spam folder.</p></div>
        </div>
        <div class="verification-code-controls">
          <label class="sr-only" for="account-verification-code">Six-digit verification code</label>
          <input id="account-verification-code" :value="verificationCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="Enter 6-digit code" required @input="updateVerificationCode">
          <button class="button button-primary" type="submit" :disabled="verificationBusy || verificationCode.length !== 6">
            <span v-if="verificationBusy" class="verification-spinner" aria-hidden="true"></span>
            {{ verificationBusy ? 'Verifying email…' : 'Verify email' }}
          </button>
          <button class="text-button verification-resend" type="button" :disabled="resendBusy || verificationBusy" @click="sendVerificationCode">
            {{ resendBusy ? 'Sending new code…' : 'Send a new code' }}
          </button>
        </div>
      </form>
    </Transition>
    <p v-if="verificationError" class="alert alert-error verification-feedback" role="alert">{{ verificationError }}</p>
    <p v-if="verificationSuccess" class="alert alert-success verification-feedback" role="status">{{ verificationSuccess }}</p>
    <p v-if="verificationSent && !account?.is_verified" class="profile-verification-hint">For your security, this code expires in 15 minutes.</p>
  </section>
</template>
