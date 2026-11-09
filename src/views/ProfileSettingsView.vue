<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getStaffUser } from '../services/api'
import { getProfilePicture, removeProfilePicture, saveProfilePicture } from '../services/profilePreferences'
import UiIcon from '../components/UiIcon.vue'

const account = getStaffUser()
const profilePicture = ref('')
const error = ref('')
const success = ref('')
const processing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const initials = computed(() => {
  const name = account?.username.trim() ?? ''
  const parts = name.split(/[\s._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U'
})

onMounted(() => {
  try {
    profilePicture.value = getProfilePicture() ?? ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not load your saved profile picture.'
  }
})

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
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not save your profile picture.'
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
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not remove the profile picture.'
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
  <p v-if="success" class="alert alert-success" role="status">{{ success }}</p>

  <section class="surface profile-settings-card">
    <div class="profile-settings-heading">
      <span class="profile-settings-symbol"><UiIcon name="user-round" /></span>
      <div><h2>Profile picture</h2><p>Shown with your account in the workspace.</p></div>
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
    <div class="profile-settings-footnote"><UiIcon name="shield-check" /> Profile picture is stored in this browser on this device. It is optional; your initials appear when no picture is set.</div>
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
</template>
