<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { ApiError, apiRequest, getApiData, getPortalRole, getStaffUser } from '../services/api'
import { useRoute } from 'vue-router'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { getProfilePictureForUser } from '../services/profilePreferences'
import UiIcon from '../components/UiIcon.vue'
import { notify } from '../services/toast'

const route = useRoute()
const patientMode = getPortalRole() === 'patient'
const kind = computed(() => route.path.endsWith('/records') ? 'records' : route.path.endsWith('/prescriptions') ? 'prescriptions' : route.path.endsWith('/messages') ? 'messages' : 'settings')
const titles: Record<string,string> = { records:'Dental Records', prescriptions:'Prescriptions', messages:'Messages & reminders', settings:'Clinic Settings' }
const loading=ref(true), error=ref(''), success=ref(''), busy=ref(false)
interface PatientRow { id: number; first_name: string; last_name: string }
interface AppointmentRow { appointment_id: number; patient_id: number; patient: string; dentist_id: number | null; service_name: string; appt_date: string }
interface DentistRow { dentist_id: number; username: string; specialization: string }
interface TreatmentRow {
  record_id: number
  patient_name: string
  tooth_no: string | null
  diagnosis: string | null
  treatment_done: string | null
  follow_up_date: string | null
  follow_up_time: string | null
  created_at: string
}
interface PrescriptionRow {
  prescription_id: number
  patient_name: string
  medication: string
  directions: string
  created_at: string
  status: string
}
interface MessageRow {
  message_id: number
  sender_id: number
  recipient_id: number
  sender: string
  recipient: string
  body: string
  is_read: boolean | number | string
  created_at: string
  reply_to_message_id?: number | null
  reply_to_body?: string | null
  reply_to_sender?: string | null
  delivery_status?: 'sending' | 'sent'
}
interface MessageContact {
  user_id: number
  username: string
  role_name: string
  is_online: boolean | number | string
  unread_count: number | string
  last_message: string | null
  last_message_id?: number | null
  last_message_sender_id: number | string | null
  last_message_at: string | null
}
interface MessagesResponse { messages: MessageRow[]; contacts: MessageContact[] }
interface ClinicSettings {
  clinic_name: string
  clinic_hours: string
  appointment_duration: string
}
type WorkspaceForm = Record<string, string | number>

const recordRows = ref<TreatmentRow[]>([])
const prescriptionRows = ref<PrescriptionRow[]>([])
const appointments = ref<AppointmentRow[]>([])
const dentists = ref<DentistRow[]>([])
const patientContacts = ref<PatientRow[]>([])
const messageContacts = ref<MessageContact[]>([])
const messages = ref<MessageRow[]>([])
const profilePictures = ref<Record<number, string>>({})
const contactSearch = ref('')
const currentUser = getStaffUser()
const currentUserId = currentUser?.id
const selectedContactId = ref<number | null>(null)
const readEnabledContactId = ref<number | null>(null)
const selectedContact = computed(() => messageContacts.value.find((contact) => contact.user_id === selectedContactId.value))
const replyTarget = ref<MessageRow | null>(null)
const mobileContactsOpen = ref(false)
const messageThreadElement = ref<HTMLDivElement | null>(null)
const composerTextarea = ref<HTMLTextAreaElement | null>(null)
const shouldAutoScrollMessages = ref(true)
const orderedMessageContacts = computed(() => messageContacts.value.slice().sort((a, b) => {
  const timeOrder = (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '')
  if (timeOrder) return timeOrder
  const messageOrder = (b.last_message_id ?? 0) - (a.last_message_id ?? 0)
  return messageOrder || a.username.localeCompare(b.username)
}))
const filteredMessageContacts = computed(() => {
  const query = contactSearch.value.trim().toLocaleLowerCase()
  if (!query) return orderedMessageContacts.value
  return orderedMessageContacts.value.filter((contact) =>
    contact.username.toLocaleLowerCase().includes(query),
  )
})
const selectedMessages = computed(() => messages.value
  .filter((message) => message.sender_id === selectedContactId.value || message.recipient_id === selectedContactId.value)
  .slice()
  .reverse())
function conversationSenderLabel(contact: MessageContact) {
  if (Number(contact.last_message_sender_id) === currentUserId) return 'You sent'
  if (patientMode) return contact.role_name === 'Admin' ? 'Clinic admin sent' : 'Clinic team sent'
  return `${contact.role_name} sent`
}
let temporaryMessageId = -1
let messageRefreshTimer: number | null = null
let messagesPageActive = false
watch(selectedContactId, (contactId) => {
  if (readEnabledContactId.value !== contactId) readEnabledContactId.value = null
  replyTarget.value = null
  shouldAutoScrollMessages.value = true
  void scrollMessageThread(true)
})
watch(selectedMessages, () => {
  void scrollMessageThread()
})
const form = ref<WorkspaceForm>({})
const settings = ref<ClinicSettings>({
  clinic_name: 'MediCare+ Dental Clinic',
  clinic_hours: 'Monday–Saturday, 9:00 AM–5:00 PM',
  appointment_duration: '30',
})
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
async function load(){ loading.value=true; error.value=''; try {
  if (kind.value === 'records') {
    recordRows.value = await getApiData<TreatmentRow[]>('/api/treatment-records')
    appointments.value = await getApiData<AppointmentRow[]>('/api/appointments')
    const scheduleRows = await getApiData<DentistRow[]>('/api/dentists')
    dentists.value = scheduleRows.filter(
      (d, i, all) => all.findIndex(x => x.dentist_id === d.dentist_id) === i,
    )
  }
  if (kind.value === 'prescriptions') {
    prescriptionRows.value = await getApiData<PrescriptionRow[]>('/api/prescriptions')
    if (!patientMode) patientContacts.value = await getApiData<PatientRow[]>('/api/patients')
  }
  if (kind.value === 'messages') {
    await refreshMessages(true)
  }
  if (kind.value === 'settings') {
    settings.value = {
      ...settings.value,
      ...(await getApiData<Partial<ClinicSettings>>('/api/settings')),
    }
  }
 }catch(e){error.value=e instanceof ApiError?e.message:'Could not load this workspace section.'}finally{loading.value=false} }
async function save(){
 busy.value=true;error.value='';success.value=''
 if(kind.value==='records'&&Boolean(form.value.follow_up_date)!==Boolean(form.value.follow_up_time)){
  error.value='Choose both a return date and time, or leave both fields blank.'
  busy.value=false
  return
 }
 try{
  let returnNotifications:{patient:boolean;dentist:boolean}|undefined
  if(kind.value==='records'){
   const result=await apiRequest<{data:{return_notifications:{patient:boolean;dentist:boolean}}}>('/api/treatment-records',{method:'POST',body:JSON.stringify(form.value)})
   returnNotifications=result.data.return_notifications
  }
  if(kind.value==='prescriptions') await apiRequest('/api/prescriptions',{method:'POST',body:JSON.stringify(form.value)})
  if(kind.value==='settings') await apiRequest('/api/settings',{method:'PUT',body:JSON.stringify(settings.value)})
  const hasReturn=kind.value==='records'&&Boolean(form.value.follow_up_date)
  form.value={}
  success.value=kind.value==='settings'
   ?'Clinic settings saved.'
   :kind.value==='records'
     ?hasReturn&&returnNotifications?.patient&&returnNotifications.dentist
       ?'Treatment record saved. The patient and dentist were notified of the return visit.'
       :hasReturn
         ?`Treatment record saved. Return visit status: ${returnNotifications?.patient ? 'patient calendar updated and patient notified' : 'patient account unavailable'}; ${returnNotifications?.dentist ? 'dentist notified' : 'dentist account unavailable'}.`
         :'Treatment record saved. The patient can view it in Profile & Medical History.'
     :'Saved successfully.'
  notify.success(success.value, kind.value==='settings'?'Settings saved':'Record saved')
  await load()
 }catch(e){error.value=e instanceof ApiError?e.message:'Could not save changes.';notify.error(error.value,'Changes not saved')}finally{busy.value=false}
}
function contactInitials(username: string) {
  return username.trim().split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U'
}
function startMessageRefresh() {
  if (!messagesPageActive || kind.value !== 'messages' || loading.value || messageRefreshTimer !== null) return
  messageRefreshTimer = window.setInterval(() => {
    void refreshMessages().catch((cause: unknown) => {
      error.value = cause instanceof ApiError ? cause.message : 'Could not refresh messages.'
    })
  }, 5000)
}
function stopMessageRefresh() {
  if (messageRefreshTimer === null) return
  window.clearInterval(messageRefreshTimer)
  messageRefreshTimer = null
}
function refreshProfilePictures() {
  const userIds = new Set<number>([
    ...(currentUserId ? [currentUserId] : []),
    ...messageContacts.value.map((contact) => contact.user_id),
    ...messages.value.flatMap((message) => [message.sender_id, message.recipient_id]),
  ])
  const nextPictures: Record<number, string> = {}
  for (const userId of userIds) {
    const picture = getProfilePictureForUser(userId)
    if (picture) nextPictures[userId] = picture
  }
  profilePictures.value = nextPictures
}
function handleProfilePictureChange() {
  refreshProfilePictures()
}
function handleProfilePictureStorageChange(event: StorageEvent) {
  if (event.key?.startsWith('medicare.profile-picture.')) refreshProfilePictures()
}
async function scrollMessageThread(force = false) {
  await nextTick()
  const thread = messageThreadElement.value
  if (!thread || (!force && !shouldAutoScrollMessages.value)) return
  thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })
}
function updateMessageScrollState() {
  const thread = messageThreadElement.value
  if (!thread) return
  shouldAutoScrollMessages.value = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 72
}
async function startReply(message: MessageRow) {
  if (message.message_id <= 0) return
  replyTarget.value = message
  await nextTick()
  composerTextarea.value?.focus()
}
async function sendMessage() {
  const recipientId = selectedContactId.value
  const body = String(form.value.body ?? '').trim()
  if (!recipientId || !body) return

  const temporaryId = temporaryMessageId--
  const quotedMessage = replyTarget.value
  const previousContact = messageContacts.value.find((contact) => contact.user_id === recipientId)
  shouldAutoScrollMessages.value = true
  const optimisticMessage: MessageRow = {
    message_id: temporaryId,
    sender_id: currentUserId ?? 0,
    recipient_id: recipientId,
    sender: currentUser?.username ?? 'You',
    recipient: selectedContact.value?.username ?? '',
    body,
    is_read: 0,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    reply_to_message_id: quotedMessage?.message_id ?? null,
    reply_to_body: quotedMessage?.body ?? null,
    reply_to_sender: quotedMessage?.sender ?? null,
    delivery_status: 'sending',
  }
  messages.value = [optimisticMessage, ...messages.value]
  messageContacts.value = messageContacts.value.map((contact) =>
    contact.user_id === recipientId
      ? {
          ...contact,
          last_message: body,
          last_message_id: temporaryId,
          last_message_sender_id: currentUserId ?? null,
          last_message_at: optimisticMessage.created_at,
        }
      : contact,
  )
  form.value.body = ''
  if (replyTarget.value === quotedMessage) replyTarget.value = null
  error.value = ''
  success.value = ''

  try {
    const response = await apiRequest<{ data: { message_id: number } }>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: recipientId,
        body,
        reply_to_message_id: quotedMessage?.message_id ?? null,
      }),
    })
    const alreadyRefreshed = messages.value.some((message) => message.message_id === response.data.message_id)
    messages.value = messages.value
      .filter((message) => message.message_id !== temporaryId)
      .map((message) => message.message_id === response.data.message_id
        ? { ...message, delivery_status: 'sent' }
        : message)
    if (!alreadyRefreshed) {
      messages.value = [{
        ...optimisticMessage,
        message_id: response.data.message_id,
        delivery_status: 'sent',
      }, ...messages.value]
    }
    messageContacts.value = messageContacts.value.map((contact) =>
      contact.user_id === recipientId && contact.last_message_id === temporaryId
        ? { ...contact, last_message_id: response.data.message_id }
        : contact,
    )
  } catch (cause) {
    messages.value = messages.value.filter((message) => message.message_id !== temporaryId)
    const latestKnownMessage = messages.value
      .filter((message) => message.sender_id === recipientId || message.recipient_id === recipientId)
      .reduce<MessageRow | null>((latest, message) => {
        if (!latest || message.created_at > latest.created_at
          || (message.created_at === latest.created_at && message.message_id > latest.message_id)) {
          return message
        }
        return latest
      }, null)
    const previousPersistedContact = previousContact && Number(previousContact.last_message_id) > 0
      ? previousContact
      : null
    messageContacts.value = messageContacts.value.map((contact) =>
      contact.user_id === recipientId && contact.last_message_id === temporaryId
        ? {
            ...contact,
            last_message: latestKnownMessage?.body ?? previousPersistedContact?.last_message ?? null,
            last_message_id: latestKnownMessage?.message_id ?? previousPersistedContact?.last_message_id ?? null,
            last_message_sender_id: latestKnownMessage?.sender_id ?? previousPersistedContact?.last_message_sender_id ?? null,
            last_message_at: latestKnownMessage?.created_at ?? previousPersistedContact?.last_message_at ?? null,
          }
        : contact,
    )
    if (selectedContactId.value === recipientId && !String(form.value.body ?? '').trim()) {
      form.value.body = body
      if (!replyTarget.value) replyTarget.value = quotedMessage
    }
    error.value = cause instanceof ApiError ? cause.message : 'Could not send this message.'
  }
}
async function refreshMessages(loadContacts = false) {
  const response = await getApiData<MessagesResponse>('/api/messages')
  const pendingMessages = messages.value.filter((message) => message.delivery_status === 'sending')
  messages.value = [...pendingMessages, ...response.messages]
  const latestMessagesByContact = new Map<number, MessageRow>()
  const unreadCountsByContact = new Map<number, number>()
  for (const message of [...pendingMessages, ...response.messages]) {
    const senderId = Number(message.sender_id)
    const recipientId = Number(message.recipient_id)
    const contactId = senderId === currentUserId ? recipientId : senderId
    const latestMessage = latestMessagesByContact.get(contactId)
    if (!latestMessage || message.created_at > latestMessage.created_at
      || (message.created_at === latestMessage.created_at && message.message_id > latestMessage.message_id)) {
      latestMessagesByContact.set(contactId, message)
    }
    if (recipientId === currentUserId && Number(message.is_read) === 0) {
      unreadCountsByContact.set(contactId, (unreadCountsByContact.get(contactId) ?? 0) + 1)
    }
  }
  messageContacts.value = patientMode
    ? response.contacts.filter((contact) => ['Staff', 'Admin'].includes(contact.role_name))
    : response.contacts
  messageContacts.value = messageContacts.value.map((contact) => {
    const latestMessage = latestMessagesByContact.get(contact.user_id)
    return {
      ...contact,
      unread_count: unreadCountsByContact.get(contact.user_id) ?? 0,
      last_message: latestMessage?.body ?? null,
      last_message_id: latestMessage?.message_id ?? null,
      last_message_sender_id: latestMessage ? Number(latestMessage.sender_id) : null,
      last_message_at: latestMessage?.created_at ?? null,
    }
  })
  refreshProfilePictures()
  if (loadContacts || !messageContacts.value.some((contact) => contact.user_id === selectedContactId.value)) {
    selectedContactId.value = orderedMessageContacts.value[0]?.user_id ?? null
  }
  if (loadContacts) {
    form.value.recipient_id = selectedContactId.value ?? ''
  }
  const peerId = selectedContactId.value
  if (peerId && readEnabledContactId.value === peerId) {
    await apiRequest('/api/messages/read', {
      method: 'POST',
      body: JSON.stringify({ sender_id: peerId }),
    })
    window.dispatchEvent(new Event('medicare:messages-read'))
    messages.value = messages.value.map((message) =>
      message.sender_id === peerId && message.recipient_id === currentUserId
        ? { ...message, is_read: 1 }
        : message,
    )
    messageContacts.value = messageContacts.value.map((contact) =>
      contact.user_id === peerId
        ? { ...contact, unread_count: 0 }
        : contact,
    )
  }
}
async function selectContact(contactId:number){
  readEnabledContactId.value=contactId
  selectedContactId.value=contactId
  mobileContactsOpen.value = false
  replyTarget.value = null
  shouldAutoScrollMessages.value = true
  form.value.recipient_id=contactId
  try {
    await refreshMessages()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not refresh this conversation.'
  }
}
onMounted(async()=>{
  window.addEventListener('medicare:profile-picture-change', handleProfilePictureChange)
  window.addEventListener('storage', handleProfilePictureStorageChange)
  await load()
  startMessageRefresh()
})
onActivated(() => { messagesPageActive = true; startMessageRefresh() })
onDeactivated(() => { messagesPageActive = false; readEnabledContactId.value = null; stopMessageRefresh() })
onBeforeUnmount(() => {
  stopMessageRefresh()
  window.removeEventListener('medicare:profile-picture-change', handleProfilePictureChange)
  window.removeEventListener('storage', handleProfilePictureStorageChange)
})
</script>

<template>
  <section class="page-heading"><div><p class="eyebrow"></p><h1>{{ titles[kind] }}</h1><p class="muted">{{ kind==='settings'?'Set the clinic details shown across your workspace.':kind==='messages'?'Stay connected with your patients and care team.':'' }}</p></div></section>
  <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>
  <SkeletonLoader
    v-if="loading"
    :variant="kind === 'records' ? 'records' : kind === 'messages' ? 'messages' : kind === 'settings' ? 'form' : patientMode ? 'list' : 'form'"
    :rows="4"
    :label="`Loading ${(titles[kind] ?? 'workspace').toLowerCase()}`"
  />
  <template v-else>
    <section v-if="kind==='settings'" class="surface feature-state"><h2>Clinic preferences</h2><p class="muted">These settings control the clinic name shown in the workspace and the default appointment length used when a service has no duration configured. Dentist availability still controls which times can be booked.</p><div class="form-grid"><label>Clinic name<input v-model="settings.clinic_name"></label><label>Clinic hours<input v-model="settings.clinic_hours"></label><label>Default appointment duration<select v-model="settings.appointment_duration"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label></div><button class="button button-primary" :disabled="busy" @click="save">Save settings</button></section>
    <template v-else-if="kind==='records'">
      <section class="surface feature-state dental-records">
        <h2>Add dental record</h2>
        <div class="form-grid">
          <label>Appointment<select v-model.number="form.appointment_id"><option value="">Choose appointment</option><option v-for="a in appointments" :key="a.appointment_id" :value="a.appointment_id">#{{a.appointment_id}} · {{a.patient}} · {{a.service_name}} · {{a.appt_date}}</option></select></label>
          <label>Dentist<select v-model.number="form.dentist_id"><option value="">Choose dentist</option><option v-for="d in dentists" :key="d.dentist_id" :value="d.dentist_id">{{d.username}} ({{d.specialization}})</option></select></label>
          <label>Tooth number<input v-model="form.tooth_no" placeholder="e.g. 16 (FDI)"></label>
          <label>Diagnosis<input v-model="form.diagnosis" placeholder="Clinical finding"></label>
          <label class="wide">Treatment / notes<textarea v-model="form.treatment_done" rows="3"/></label>
          <label class="wide">Additional notes<textarea v-model="form.notes" rows="2"/></label>
          <label class="wide">Return visit
            <span class="return-visit-fields"><input v-model="form.follow_up_date" type="date" :min="today" aria-label="Return visit date"><input v-model="form.follow_up_time" type="time" aria-label="Return visit time"></span>
            <small>Optional. Set both date and time to add a reminder to the patient’s calendar and notify the patient and dentist. It does not reserve an appointment slot.</small>
          </label>
        </div>
        <button class="button button-primary" :disabled="busy" @click="save">Save dental record</button>
      </section>
      <section class="surface feature-state dental-records">
        <h2>Recent clinical records</h2>
        <div v-if="!recordRows.length" class="empty-state">No records have been added yet.</div>
        <div v-for="r in recordRows" :key="r.record_id" class="appointment-card">
          <div>
            <strong>{{r.patient_name}} · {{r.tooth_no ? `Tooth ${r.tooth_no}` : 'Clinical note'}}</strong>
            <p>{{r.diagnosis||'No diagnosis'}} · {{r.treatment_done||'No treatment noted'}}</p>
            <p v-if="r.follow_up_date">Return visit: {{r.follow_up_date}}{{r.follow_up_time ? ` · ${r.follow_up_time.slice(0,5)}` : ''}}</p>
          </div>
          <small>{{r.created_at}}</small>
        </div>
      </section>
    </template>
    <template v-else-if="kind==='prescriptions'"><section v-if="!patientMode" class="surface feature-state"><h2>Create prescription record</h2><p class="muted">A prescription is the dentist’s written medication plan, including the medicine and how the patient should take it. Record only instructions provided by the treating clinician.</p><div class="form-grid"><label>Patient<select v-model.number="form.patient_id"><option value="">Choose patient</option><option v-for="p in patientContacts" :key="p.id" :value="p.id">{{p.first_name}} {{p.last_name}}</option></select></label><label>Medication<input v-model="form.medication" required></label><label class="wide">Directions<textarea v-model="form.directions" rows="3" required/></label></div><button class="button button-primary" :disabled="busy" @click="save">Save prescription</button></section><section class="surface feature-state"><h2>{{patientMode?'Your prescriptions':'Prescription history'}}</h2><div v-if="!prescriptionRows.length" class="empty-state"><strong>No prescriptions have been recorded</strong><p v-if="patientMode">New instructions from your care team will appear here.</p></div><div v-for="r in prescriptionRows" :key="r.prescription_id" class="appointment-card"><div><strong>{{patientMode?'':`${r.patient_name} · `}}{{r.medication}}</strong><p>{{r.directions}}</p><small>{{r.created_at}}</small></div><span class="status-badge">{{r.status}}</span></div></section></template>
    <template v-else>
      <section :class="['surface messenger', { 'mobile-contacts-open': mobileContactsOpen }]">
        <aside class="messenger-contacts">
          <div class="contacts-panel-heading">
            <h2>Conversations</h2>
            <button class="mobile-contact-close" type="button" aria-label="Close conversations" @click="mobileContactsOpen = false">
              <UiIcon name="x" />
            </button>
          </div>
          <label class="conversation-search">
            <UiIcon name="search" />
            <input v-model="contactSearch" type="search" placeholder="Search by name" aria-label="Search conversations by name">
          </label>
          <div id="message-conversation-list" class="conversation-list" aria-label="Conversations">
            <button v-for="contact in filteredMessageContacts" :key="contact.user_id" :class="{selected:selectedContactId===contact.user_id, 'has-unread':Number(contact.unread_count)>0}" type="button" @click="selectContact(contact.user_id)">
              <span class="contact-summary">
                <span class="contact-avatar"><img v-if="profilePictures[contact.user_id]" :src="profilePictures[contact.user_id]" alt=""><span v-else>{{contactInitials(contact.username)}}</span></span>
                <span class="contact-identity"><strong>{{contact.username}}</strong><small>{{contact.role_name}} · <span :class="['presence-label', { online: Number(contact.is_online) === 1 }]">{{Number(contact.is_online)===1?'Online':'Offline'}}</span></small></span>
                <span v-if="Number(contact.unread_count)>0" class="unread-count" :aria-label="`${contact.username} sent ${contact.unread_count} new message${Number(contact.unread_count) === 1 ? '' : 's'}`">{{Number(contact.unread_count)>99?'New 99+':`New ${contact.unread_count}`}}</span>
              </span>
              <span v-if="contact.last_message" class="contact-preview">
                <span class="conversation-sender-indicator" :class="{ incoming: Number(contact.last_message_sender_id) !== currentUserId, unread: Number(contact.unread_count) > 0 }">{{conversationSenderLabel(contact)}}</span>
                <span class="contact-message-preview">{{contact.last_message}}</span>
              </span>
              <time v-if="contact.last_message_at" class="contact-time">{{contact.last_message_at}}</time>
            </button>
            <p v-if="!messageContacts.length" class="conversation-empty">No clinic contacts are available.</p>
            <p v-else-if="!filteredMessageContacts.length" class="conversation-empty">No names match “{{ contactSearch.trim() }}”.</p>
          </div>
        </aside>
        <div class="messenger-thread">
          <header>
            <div v-if="selectedContact" class="conversation-heading">
              <span class="contact-avatar"><img v-if="profilePictures[selectedContact.user_id]" :src="profilePictures[selectedContact.user_id]" alt=""><span v-else>{{contactInitials(selectedContact.username)}}</span></span>
              <div><h2>{{selectedContact.username}}</h2><p :class="['presence-label', { online: Number(selectedContact.is_online) === 1 }]"><span class="presence-dot"></span>{{Number(selectedContact.is_online)===1?'Online':'Offline'}}</p></div>
            </div>
            <div v-else><h2>Clinic messages</h2><p class="muted">Private messages with your care team.</p></div>
            <button class="mobile-conversations-toggle" type="button" :aria-expanded="mobileContactsOpen" aria-controls="message-conversation-list" @click="mobileContactsOpen = true">
              <UiIcon name="users-round" />
              <span>Conversations</span>
            </button>
          </header>
          <div ref="messageThreadElement" class="message-thread" aria-live="polite" @scroll="updateMessageScrollState">
            <p v-if="!selectedContactId" class="empty-state">Choose a contact to open a conversation.</p>
            <p v-else-if="!selectedMessages.length" class="empty-state">No messages yet. Send a message to start the conversation.</p>
            <article v-for="m in selectedMessages" :key="m.message_id" :class="['message-bubble',{outgoing:m.sender_id===currentUserId}]" :data-message-id="m.message_id">
              <small class="message-meta"><span class="message-avatar"><img v-if="profilePictures[m.sender_id]" :src="profilePictures[m.sender_id]" alt=""><span v-else>{{contactInitials(m.sender)}}</span></span>{{m.sender}} · {{m.created_at}}</small>
              <div v-if="m.reply_to_message_id" class="message-reply-quote">
                <span class="reply-quote-accent"></span>
                <span class="reply-quote-content"><strong>{{m.reply_to_sender || 'Message'}}</strong><span>{{m.reply_to_body || 'Original message unavailable'}}</span></span>
              </div>
              <p>{{m.body}}</p>
              <small v-if="m.sender_id===currentUserId" class="delivery-status">
                <span v-if="m.delivery_status==='sending'" class="sending-indicator"><span class="loading-spinner"></span>Sending…</span>
                <span v-else>{{Number(m.is_read)===1?'Seen ✓✓':'Sent ✓'}}</span>
              </small>
              <button v-if="m.message_id > 0" class="message-reply-action" type="button" :aria-label="`Reply to message from ${m.sender}`" :title="`Reply to ${m.sender}`" @click="startReply(m)">
                <UiIcon name="reply" />
              </button>
            </article>
          </div>
          <form class="message-composer" @submit.prevent="sendMessage">
            <div v-if="replyTarget" class="reply-composer-preview">
              <span class="reply-quote-accent"></span>
              <span class="reply-preview-content"><strong>Replying to {{replyTarget.sender}}</strong><span>{{replyTarget.body}}</span></span>
              <button class="cancel-reply" type="button" aria-label="Cancel reply" @click="replyTarget = null">×</button>
            </div>
            <textarea ref="composerTextarea" v-model="form.body" rows="1" maxlength="5000" placeholder="Write a message…" required :disabled="!selectedContactId" @keydown.enter.exact.prevent="sendMessage"></textarea>
            <button class="button button-primary" :disabled="busy||!selectedContactId||!String(form.body||'').trim()">
              Send
            </button>
          </form>
        </div>
      </section>
    </template>
  </template>
</template>

<style scoped>
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}.form-grid label{display:grid;gap:6px;color:#718793;font-size:13px;font-weight:650}.form-grid input,.form-grid select,.form-grid textarea{width:100%;border:1px solid #dce8e8;border-radius:11px;padding:11px;background:#fff;color:#183b4c;font:inherit}.return-visit-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.wide{grid-column:1/-1}.feature-state{margin-bottom:18px}.feature-state h2{margin-top:0}.appointment-card{display:flex;justify-content:space-between;gap:16px;padding:14px 4px;border-top:1px solid #e4edf0}.appointment-card p{margin:4px 0;color:#718793}.appointment-card small{color:#718793}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}}
.messenger{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:520px;overflow:hidden;padding:0}.messenger-contacts{padding:18px;border-right:1px solid var(--line)}.messenger-contacts h2,.messenger-thread h2{margin:0 0 12px;font-size:16.2px}.messenger-contacts button{display:grid;width:100%;gap:3px;margin:5px 0;padding:11px;border:0;border-radius:10px;background:transparent;text-align:left;color:var(--ink)}.messenger-contacts button.selected,.messenger-contacts button:hover{background:#e8f4ee}.messenger-contacts small,.message-bubble small{color:var(--muted);font-size:10.8px}.messenger-thread{display:flex;min-width:0;flex-direction:column;padding:18px}.messenger-thread header{border-bottom:1px solid var(--line)}.messenger-thread header p{margin:0 0 12px}.message-thread{display:flex;flex:1;flex-direction:column;gap:10px;overflow:auto;padding:16px 3px}.message-bubble{align-self:flex-start;max-width:min(78%,520px);padding:10px 13px;border-radius:14px 14px 14px 4px;background:#eef2f5}.message-bubble.outgoing{align-self:flex-end;border-radius:14px 14px 4px 14px;background:#e4f6ed}.message-bubble p{margin:4px 0 0;color:var(--ink);font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}.message-composer{display:flex;align-items:end;gap:10px;padding-top:12px;border-top:1px solid var(--line)}.message-composer textarea{flex:1;min-width:0;border:1px solid var(--line);border-radius:11px;padding:10px;background:var(--surface);color:var(--ink);font:inherit;resize:vertical}.contact-preview{overflow:hidden;color:var(--muted);font-size:10.8px;text-overflow:ellipsis;white-space:nowrap}.contact-time{color:var(--muted);font-size:9.7px}.messenger-contacts button.has-unread:not(.selected){border:1px solid #f1c5cb;background:#fff7f8}.messenger-contacts button.has-unread:not(.selected) strong{font-weight:800}.messenger-contacts button.has-unread:not(.selected) small{color:#bd3c51;font-weight:700}@media(max-width:700px){.messenger{grid-template-columns:1fr}.messenger-contacts{display:flex;flex-wrap:wrap;gap:5px;border-right:0;border-bottom:1px solid var(--line)}.messenger-contacts h2{width:100%}.messenger-contacts button{width:auto}.messenger-thread{min-height:420px;padding:13px}}
.contact-preview{display:flex;align-items:center;gap:6px;min-width:0}.conversation-sender-indicator{flex:none;padding:2px 6px;border:1px solid #d5e9dd;border-radius:999px;background:#eef7f2;color:#39745f;font-size:9px;font-weight:750;line-height:1.4;white-space:nowrap}.conversation-sender-indicator.incoming{border-color:#dbe8f3;background:#f0f5fa;color:#4b6e89}.conversation-sender-indicator.unread{border-color:#f1c5cb;background:#fff0f2;color:#bd3c51}.contact-message-preview{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.delivery-status{display:block;margin-top:5px;text-align:right;color:#5d8a78!important;font-size:10.8px!important}
.contact-summary{display:flex;align-items:center;justify-content:space-between;gap:8px}.unread-count{display:inline-grid;min-width:20px;height:20px;place-items:center;padding:0 6px;border-radius:999px;background:#d34f61;color:#fff;font-size:10.8px;font-weight:750}.messenger-contacts button:not(.selected):has(.unread-count) strong{font-weight:800}.messenger-contacts button:not(.selected):has(.unread-count) small{color:#bd3c51;font-weight:700}
.contact-avatar,.message-avatar{display:inline-grid;flex:none;place-items:center;overflow:hidden;border-radius:50%;background:#dcefe5;color:#2f704e;font-weight:750}.contact-avatar{width:38px;height:38px;font-size:12px}.message-avatar{width:22px;height:22px;font-size:9px}.contact-avatar img,.message-avatar img{width:100%;height:100%;object-fit:cover}.contact-identity{display:grid;min-width:0;flex:1;gap:3px}.contact-identity strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.contact-identity small{display:flex;align-items:center;gap:4px}.presence-label{display:inline-flex;align-items:center;gap:5px;color:#718793;font-size:10.8px}.presence-label.online{color:#23824c}.presence-dot{width:8px;height:8px;border-radius:50%;background:#8995a4}.presence-label.online .presence-dot{background:#35a765;box-shadow:0 0 0 2px #dff4e7}.conversation-heading{display:flex;align-items:center;gap:10px;padding-bottom:12px}.conversation-heading h2{margin:0 0 3px}.conversation-heading p{margin:0}.message-meta{display:flex;align-items:center;gap:6px}.sending-indicator,.button-sending{display:inline-flex;align-items:center;gap:6px}.loading-spinner{width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:message-spin .7s linear infinite}@keyframes message-spin{to{transform:rotate(360deg)}}
:global(.app-shell[data-theme='dark'] .messenger-contacts) { border-color: #354741; }
:global(.app-shell[data-theme='dark'] .messenger-contacts h2),
:global(.app-shell[data-theme='dark'] .messenger-thread h2),
:global(.app-shell[data-theme='dark'] .messenger-contacts button strong) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .messenger-contacts button),
:global(.app-shell[data-theme='dark'] .messenger-contacts button small),
:global(.app-shell[data-theme='dark'] .messenger-contacts button .contact-preview),
:global(.app-shell[data-theme='dark'] .messenger-contacts button .contact-time),
:global(.app-shell[data-theme='dark'] .messenger-thread header p) { color: #b2c2bb; }
:global(.app-shell[data-theme='dark'] .messenger-contacts button:hover) { background: #263a32; }
:global(.app-shell[data-theme='dark'] .messenger-contacts button.selected),
:global(.app-shell[data-theme='dark'] .messenger-contacts button.selected:hover) { border: 1px solid #426d55; background: #294b36; color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .messenger-contacts button.selected strong) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .messenger-contacts button.selected small),
:global(.app-shell[data-theme='dark'] .messenger-contacts button.selected .contact-preview),
:global(.app-shell[data-theme='dark'] .messenger-contacts button.selected .contact-time) { color: #c1d0c9; }
:global(.app-shell[data-theme='dark'] .messenger-contacts button.has-unread:not(.selected)) { border-color: #754849; background: #33272a; }
:global(.app-shell[data-theme='dark'] .messenger-contacts button.has-unread:not(.selected) small) { color: #f0a3a8; }
:global(.app-shell[data-theme='dark'] .conversation-sender-indicator) { border-color: #426d55; background: #244231; color: #a4e2ba; }
:global(.app-shell[data-theme='dark'] .conversation-sender-indicator.incoming) { border-color: #4a6b83; background: #263947; color: #b6dcf6; }
:global(.app-shell[data-theme='dark'] .conversation-sender-indicator.unread) { border-color: #754849; background: #40272a; color: #f0a3a8; }
:global(.app-shell[data-theme='dark'] .messenger-thread header),
:global(.app-shell[data-theme='dark'] .messenger .message-composer) { border-color: #354741; }
:global(.app-shell[data-theme='dark'] .messenger .message-bubble) { background: #263630; color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .messenger .message-bubble p) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .messenger .message-bubble small) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .messenger .message-bubble.outgoing) { background: #294b36; }
:global(.app-shell[data-theme='dark'] .messenger .delivery-status) { color: #a4e2ba !important; }
:global(.app-shell[data-theme='dark'] .messenger .contact-avatar),
:global(.app-shell[data-theme='dark'] .messenger .message-avatar) { background: #345a45; color: #d3f0dd; }
:global(.app-shell[data-theme='dark'] .messenger .presence-label) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .messenger .presence-label.online) { color: #9de0b4; }
:global(.app-shell[data-theme='dark'] .messenger .presence-label.online .presence-dot) { background: #61c982; box-shadow: 0 0 0 2px #294b36; }
:global(.app-shell[data-theme='dark'] .messenger .message-composer textarea) { border-color: #40534b; background: #1d2a25; color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .messenger .message-composer textarea::placeholder) { color: #82988d; opacity: 1; }
:global(.app-shell[data-theme='dark'] .messenger .message-thread > .empty-state) { border-color: transparent; background: transparent; color: #c1d0c9; }
:global(.app-shell[data-theme='dark'] .dental-records h2) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .dental-records .appointment-card) { border-color: #354741; }
:global(.app-shell[data-theme='dark'] .dental-records .appointment-card strong) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .dental-records .appointment-card p),
:global(.app-shell[data-theme='dark'] .dental-records .appointment-card small) { color: #a3b3ae; }

.messenger {
  min-height: 620px;
  border-color: #dce8e3;
  background: #fff;
  box-shadow: 0 16px 38px rgb(34 70 58 / 7%);
}
.messenger-contacts {
  background: #f8fbf9;
}
.messenger-contacts h2 {
  margin-bottom: 15px;
  color: #294a40;
}
.messenger-contacts button {
  transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.messenger-contacts button:hover {
  transform: translateX(2px);
}
.messenger-contacts button.selected {
  border: 1px solid #cce4d5;
  background: #eaf5ee;
}
.messenger-thread {
  background: linear-gradient(180deg, #fff 0%, #fbfdfc 100%);
}
.messenger-thread > header {
  padding: 2px 0 12px;
}
.conversation-heading h2 {
  color: #294a40;
}
.message-thread {
  min-height: 390px;
}
.message-bubble {
  border: 1px solid #e6ece9;
  box-shadow: 0 3px 10px rgb(31 65 52 / 4%);
}
.message-bubble.outgoing {
  border-color: #d5e9dd;
}
.message-composer textarea {
  height: 48px;
  min-height: 48px;
  max-height: 48px;
  resize: none;
  overflow-y: auto;
}
.message-composer .button {
  min-height: 42px;
  min-width: 82px;
}
:global(.app-shell[data-theme='dark'] .messenger) {
  border-color: #354741;
  background: #1d2b26;
  box-shadow: 0 16px 38px rgb(0 0 0 / 14%);
}
:global(.app-shell[data-theme='dark'] .messenger-contacts) {
  background: #1a2823;
}
:global(.app-shell[data-theme='dark'] .messenger-contacts h2),
:global(.app-shell[data-theme='dark'] .conversation-heading h2) {
  color: #e4ede9;
}
:global(.app-shell[data-theme='dark'] .messenger-thread) {
  background: linear-gradient(180deg, #1d2b26 0%, #1b2924 100%);
}
:global(.app-shell[data-theme='dark'] .messenger-contacts button.selected) {
  border-color: #426d55;
  background: #294b36;
}
:global(.app-shell[data-theme='dark'] .messenger .message-bubble) {
  border-color: #354741;
  box-shadow: 0 3px 10px rgb(0 0 0 / 10%);
}
:global(.app-shell[data-theme='dark'] .messenger .message-bubble.outgoing) {
  border-color: #426d55;
}

@media (max-width: 700px) {
  .messenger {
    display: flex;
    min-height: 0;
    flex-direction: column;
    border-radius: 16px;
  }
  .messenger-contacts {
    display: grid;
    max-height: 260px;
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
    overflow-y: auto;
    padding: 14px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    overscroll-behavior: contain;
  }
  .messenger-contacts h2 {
    position: sticky;
    z-index: 1;
    top: -14px;
    margin: -14px -14px 5px;
    padding: 13px 14px 9px;
    border-bottom: 1px solid var(--line);
    background: #f8fbf9;
  }
  .messenger-contacts button {
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 9px 10px;
    border: 1px solid transparent;
    border-radius: 11px;
  }
  .messenger-contacts button:hover {
    transform: none;
  }
  .contact-summary {
    justify-content: flex-start;
  }
  .contact-identity {
    text-align: left;
  }
  .messenger-thread {
    min-height: 470px;
    padding: 14px;
  }
  .messenger-thread > header {
    padding-bottom: 11px;
  }
  .message-thread {
    min-height: 300px;
    padding: 14px 0;
  }
  .message-bubble {
    max-width: 90%;
  }
  .message-composer {
    align-items: stretch;
  }
  .message-composer textarea {
    min-height: 44px;
    font-size: 13px;
  }
  .message-composer .button {
    min-width: 70px;
    padding-inline: 12px;
  }
  :global(.app-shell[data-theme='dark'] .messenger-contacts h2) {
    border-color: #354741;
    background: #1a2823;
    color: #e4ede9;
  }
}
.conversation-search {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 0 11px;
  border: 1px solid #dce8e3;
  border-radius: 10px;
  background: #fff;
  color: #748780;
}
.conversation-search:focus-within {
  border-color: #69a58a;
  box-shadow: 0 0 0 3px rgb(74 148 113 / 12%);
}
.conversation-search :deep(svg) {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}
.conversation-search input {
  width: 100%;
  min-width: 0;
  height: 38px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #294a40;
  font: inherit;
  font-size: 12px;
}
.conversation-search input::placeholder { color: #899a92; opacity: 1; }
.conversation-empty {
  margin: 5px 2px;
  color: #748780;
  font-size: 12px;
  line-height: 1.5;
}
:global(.app-shell[data-theme='dark'] .conversation-search) {
  border-color: #40534b;
  background: #202f29;
  color: #a9bdb3;
}
:global(.app-shell[data-theme='dark'] .conversation-search:focus-within) {
  border-color: #70a985;
  box-shadow: 0 0 0 3px rgb(112 169 133 / 15%);
}
:global(.app-shell[data-theme='dark'] .conversation-search input) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .conversation-search input::placeholder) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .conversation-empty) { color: #a3b3ae; }
@media (max-width: 700px) {
  .conversation-search {
    position: sticky;
    z-index: 1;
    top: 34px;
    margin-bottom: 7px;
  }
}

:global(.app-shell.messages-shell) {
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
:global(.app-shell.messages-shell .main-column) {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}
:global(.app-shell.messages-shell .topbar) {
  flex: 0 0 auto;
}
:global(.app-shell.messages-shell .page-content) {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 18px;
}
:global(.app-shell.messages-shell .page-heading) {
  flex: 0 0 auto;
  margin-bottom: 16px;
}
.messenger {
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(250px, 30%) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
}
.messenger-contacts {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}
.messenger-contacts h2,
.conversation-search {
  flex: 0 0 auto;
}
.contacts-panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mobile-contact-close,
.mobile-conversations-toggle {
  display: none;
}
.conversation-list {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  align-content: start;
  gap: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 4px;
  scrollbar-width: thin;
}
.conversation-list button {
  margin: 0;
}
.messenger-thread {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.message-thread {
  min-height: 0;
  flex: 1 1 auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.message-composer {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1fr) auto;
}
.reply-composer-preview {
  display: flex;
  min-width: 0;
  grid-column: 1 / -1;
  align-items: stretch;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 88%, #73b28d 12%);
}
.reply-quote-accent {
  width: 3px;
  flex: 0 0 3px;
  border-radius: 3px;
  background: #4b9b70;
}
.reply-preview-content,
.message-reply-quote .reply-quote-content {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.reply-preview-content strong,
.message-reply-quote strong {
  color: #387753;
  font-size: 11px;
}
.reply-preview-content span,
.message-reply-quote .reply-quote-content > span {
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cancel-reply {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  margin-left: auto;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}
.cancel-reply:hover {
  background: rgb(80 110 95 / 10%);
  color: var(--ink);
}
.message-reply-quote {
  display: flex;
  min-width: 0;
  gap: 8px;
  margin: 8px 0 6px;
  padding: 7px 8px;
  border: 1px solid rgb(88 132 105 / 15%);
  border-radius: 9px;
  background: rgb(255 255 255 / 54%);
}
.message-reply-quote .reply-quote-content > span {
  max-width: 100%;
}
.message-reply-action {
  position: absolute;
  z-index: 1;
  top: 7px;
  right: 7px;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 4px 12px rgb(22 46 36 / 16%);
  color: #438d75;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translateY(7px) scale(.55) rotate(-24deg);
  transition: opacity 150ms ease, transform 210ms cubic-bezier(.2, .8, .25, 1), visibility 0s linear 210ms;
  visibility: hidden;
}
.message-reply-action :deep(svg) {
  width: 15px;
  height: 15px;
}
.message-bubble:hover .message-reply-action,
.message-bubble:focus-within .message-reply-action {
  animation: reply-icon-reveal 360ms cubic-bezier(.2, 1.45, .4, 1) both;
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1) rotate(0);
  transition-delay: 0s;
  visibility: visible;
}
.message-reply-action:hover,
.message-reply-action:focus-visible {
  border-color: #9ac9aa;
  background: #edf8f0;
  box-shadow: 0 6px 16px rgb(36 111 67 / 24%);
  color: #2d7549;
  outline: 3px solid rgb(67 141 117 / 20%);
  outline-offset: 2px;
}
.message-bubble {
  position: relative;
  padding-right: 43px;
}
.message-meta {
  padding-right: 25px;
}
@keyframes reply-icon-reveal {
  0% {
    opacity: 0;
    transform: translateY(9px) scale(.45) rotate(-28deg);
  }
  72% {
    opacity: 1;
    transform: translateY(-2px) scale(1.12) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0);
  }
}
:global(.app-shell[data-theme='dark'] .reply-composer-preview) {
  border-color: #40534b;
  background: #23352c;
}
:global(.app-shell[data-theme='dark'] .reply-preview-content strong),
:global(.app-shell[data-theme='dark'] .message-reply-quote strong),
:global(.app-shell[data-theme='dark'] .message-reply-action) {
  color: #a4e2ba;
}
:global(.app-shell[data-theme='dark'] .message-reply-quote) {
  border-color: rgb(164 226 186 / 15%);
  background: rgb(11 22 17 / 22%);
}
:global(.app-shell[data-theme='dark'] .cancel-reply) {
  color: #a3b3ae;
}
 :global(.app-shell[data-theme='dark'] .message-reply-action) {
  border-color: #40534b;
  background: #263630;
  box-shadow: 0 4px 12px rgb(0 0 0 / 24%);
  color: #a4e2ba;
}
:global(.app-shell[data-theme='dark'] .message-reply-action:hover),
:global(.app-shell[data-theme='dark'] .message-reply-action:focus-visible) {
  border-color: #70a985;
  background: #294b36;
  color: #d3f0dd;
  outline-color: rgb(164 226 186 / 24%);
}
@media (hover: none) {
  .message-reply-action {
    opacity: 1;
    pointer-events: auto;
    transform: none;
    transition: none;
    visibility: visible;
  }
}
@media (prefers-reduced-motion: reduce) {
  .message-reply-action,
  .message-bubble:hover .message-reply-action,
  .message-bubble:focus-within .message-reply-action {
    animation: none;
    transition: none;
  }
}
@media (max-width: 700px) {
  :global(.app-shell.messages-shell .page-content) {
    padding: 18px 12px 12px;
  }
  :global(.app-shell.messages-shell .page-heading) {
    margin-bottom: 12px;
  }
  .messenger {
    position: relative;
    display: flex;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }
  .messenger-contacts {
    position: absolute;
    z-index: 5;
    inset: 0;
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    max-height: none;
    flex: 0 0 auto;
    flex-direction: column;
    gap: 0;
    grid-template-columns: none;
    padding: 16px;
    border-right: 0;
    border-bottom: 0;
    opacity: 0;
    pointer-events: none;
    transform: translateX(-14px);
    transition: opacity 180ms ease, transform 240ms cubic-bezier(.2, .8, .25, 1), visibility 0s linear 240ms;
    visibility: hidden;
  }
  .messenger.mobile-contacts-open .messenger-contacts {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
    transition-delay: 0s;
    visibility: visible;
  }
  .contacts-panel-heading {
    flex: 0 0 auto;
    margin-bottom: 12px;
  }
  .messenger-contacts h2 {
    width: auto;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }
  .mobile-contact-close {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
  .mobile-contact-close :deep(svg) {
    width: 17px;
    height: 17px;
  }
  .conversation-search {
    position: relative;
    top: auto;
    min-height: 42px;
    flex: 0 0 auto;
    margin-bottom: 10px;
  }
  .conversation-list {
    width: 100%;
    flex: 1 1 auto;
    padding-right: 2px;
  }
  .messenger-contacts button {
    width: 100%;
  }
  .messenger-thread {
    min-height: 0;
    flex: 1 1 auto;
    padding: 12px;
  }
  .messenger-thread > header {
    display: flex;
    min-height: 52px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 10px;
  }
  .conversation-heading {
    min-width: 0;
    flex: 1 1 auto;
  }
  .conversation-heading > div {
    min-width: 0;
  }
  .conversation-heading h2 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mobile-conversations-toggle {
    display: inline-flex;
    min-height: 36px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 650;
  }
  .mobile-conversations-toggle :deep(svg) {
    width: 16px;
    height: 16px;
    color: #438d75;
  }
  .message-thread {
    min-height: 0;
    flex: 1 1 auto;
    padding: 10px 0;
  }
  .message-composer {
    align-items: end;
  }
}
@media (max-height: 620px) {
  :global(.app-shell.messages-shell .page-content) {
    padding-top: 12px;
    padding-bottom: 8px;
  }
  :global(.app-shell.messages-shell .page-heading) {
    margin-bottom: 8px;
  }
  .messenger-contacts,
  .messenger-thread {
    padding: 12px;
  }
  .conversation-heading {
    padding-bottom: 6px;
  }
  .message-composer textarea {
    max-height: 90px;
  }
}
</style>
