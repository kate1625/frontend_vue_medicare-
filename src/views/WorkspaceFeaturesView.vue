<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
  delivery_status?: 'sending' | 'sent'
}
interface MessageContact {
  user_id: number
  username: string
  role_name: string
  is_online: boolean | number | string
  unread_count: number | string
  last_message: string | null
  last_message_sender_id: number | string | null
  last_message_at: string | null
}
interface MessagesResponse { messages: MessageRow[]; contacts: MessageContact[] }
interface ToothChartRow { tooth_no: string; condition_name: string }
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
const selectedContact = computed(() => messageContacts.value.find((contact) => contact.user_id === selectedContactId.value))
const filteredMessageContacts = computed(() => {
  const query = contactSearch.value.trim().toLocaleLowerCase()
  if (!query) return messageContacts.value
  return messageContacts.value.filter((contact) =>
    contact.username.toLocaleLowerCase().includes(query),
  )
})
const selectedMessages = computed(() => messages.value
  .filter((message) => message.sender_id === selectedContactId.value || message.recipient_id === selectedContactId.value)
  .slice()
  .reverse())
const sendingMessage = ref(false)
let temporaryMessageId = -1
let messageRefreshTimer: number | null = null
const chartPatients = ref<PatientRow[]>([])
const chartPatient = ref('')
const selectedTooth = ref('')
const toothMap = ref<Record<string, string>>({})
const toothCondition = ref('')
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
    chartPatients.value = await getApiData<PatientRow[]>('/api/patients')
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
async function save(){busy.value=true;error.value='';success.value='';try{
 let followUpNotificationSent=false;const hasFollowUpDate=kind.value==='records'&&Boolean(form.value.follow_up_date)
 if(kind.value==='records'){const result=await apiRequest<{data:{notification_sent:boolean}}>('/api/treatment-records',{method:'POST',body:JSON.stringify(form.value)});followUpNotificationSent=result.data.notification_sent}
 if(kind.value==='prescriptions') await apiRequest('/api/prescriptions',{method:'POST',body:JSON.stringify(form.value)})
 if(kind.value==='settings') await apiRequest('/api/settings',{method:'PUT',body:JSON.stringify(settings.value)})
 form.value={};success.value=kind.value==='settings'?'Clinic settings saved.':hasFollowUpDate?(followUpNotificationSent?'Dental record and recommended return date saved. The patient was notified in MediCare+.':'Dental record and recommended return date saved. No in-app notification was sent because the patient account is not linked.'):'Saved successfully.';notify.success(success.value, kind.value==='settings'?'Settings saved':'Record saved');await load()
 }catch(e){error.value=e instanceof ApiError?e.message:'Could not save changes.';notify.error(error.value,'Changes not saved')}finally{busy.value=false}}
async function loadChart(){toothMap.value={};selectedTooth.value='';toothCondition.value='';if(!chartPatient.value)return;try{const data=await getApiData<ToothChartRow[]>(`/api/patients/${chartPatient.value}/tooth-chart`);toothMap.value=Object.fromEntries(data.map(x=>[x.tooth_no,x.condition_name]))}catch(e){error.value=e instanceof ApiError?e.message:'Could not load the tooth chart.'}}
async function saveTooth(){if(!chartPatient.value||!selectedTooth.value)return;busy.value=true;error.value='';try{await apiRequest(`/api/patients/${chartPatient.value}/tooth-chart`,{method:'PUT',body:JSON.stringify({tooth_no:selectedTooth.value,condition_name:toothCondition.value})});toothMap.value={...toothMap.value,[selectedTooth.value]:toothCondition.value};success.value=`Tooth ${selectedTooth.value} updated.`;notify.success(success.value,'Tooth chart updated')}catch(e){error.value=e instanceof ApiError?e.message:'Could not update the tooth chart.';notify.error(error.value,'Tooth chart not updated')}finally{busy.value=false}}
function contactInitials(username: string) {
  return username.trim().split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U'
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
async function sendMessage() {
  const recipientId = selectedContactId.value
  const body = String(form.value.body ?? '').trim()
  if (!recipientId || !body || sendingMessage.value) return

  const temporaryId = temporaryMessageId--
  const optimisticMessage: MessageRow = {
    message_id: temporaryId,
    sender_id: currentUserId ?? 0,
    recipient_id: recipientId,
    sender: currentUser?.username ?? 'You',
    recipient: selectedContact.value?.username ?? '',
    body,
    is_read: 0,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    delivery_status: 'sending',
  }
  messages.value = [optimisticMessage, ...messages.value]
  sendingMessage.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await apiRequest<{ data: { message_id: number } }>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId, body }),
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
    form.value.body = ''
  } catch (cause) {
    messages.value = messages.value.filter((message) => message.message_id !== temporaryId)
    error.value = cause instanceof ApiError ? cause.message : 'Could not send this message.'
  } finally {
    sendingMessage.value = false
  }
}
async function refreshMessages(loadContacts = false) {
  const response = await getApiData<MessagesResponse>('/api/messages')
  const pendingMessages = messages.value.filter((message) => message.delivery_status === 'sending')
  messages.value = [...pendingMessages, ...response.messages]
  messageContacts.value = patientMode
    ? response.contacts.filter((contact) => ['Staff', 'Admin'].includes(contact.role_name))
    : response.contacts
  refreshProfilePictures()
  if (loadContacts || !messageContacts.value.some((contact) => contact.user_id === selectedContactId.value)) {
    selectedContactId.value = messageContacts.value[0]?.user_id ?? null
  }
  if (loadContacts) {
    form.value.recipient_id = selectedContactId.value ?? ''
  }
  const peerId = selectedContactId.value
  if (peerId) {
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
        ? { ...contact, unread_count: 0, last_message_sender_id: currentUserId ?? null }
        : contact,
    )
  }
}
async function selectContact(contactId:number){
  selectedContactId.value=contactId
  form.value.recipient_id=contactId
  try {
    await refreshMessages()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not refresh this conversation.'
  }
}
const upperTeeth=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28], lowerTeeth=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]
onMounted(async()=>{
  window.addEventListener('medicare:profile-picture-change', handleProfilePictureChange)
  window.addEventListener('storage', handleProfilePictureStorageChange)
  await load()
  if (kind.value === 'messages') {
    messageRefreshTimer = window.setInterval(() => {
      void refreshMessages().catch((cause: unknown) => {
        error.value = cause instanceof ApiError ? cause.message : 'Could not refresh messages.'
      })
    }, 5000)
  }
})
onBeforeUnmount(() => {
  if (messageRefreshTimer !== null) window.clearInterval(messageRefreshTimer)
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
    <template v-else-if="kind==='records'"><section class="surface feature-state dental-records"><h2>Add dental record</h2><div class="form-grid"><label>Appointment<select v-model.number="form.appointment_id"><option value="">Choose appointment</option><option v-for="a in appointments" :key="a.appointment_id" :value="a.appointment_id">#{{a.appointment_id}} · {{a.patient}} · {{a.service_name}} · {{a.appt_date}}</option></select></label><label>Dentist<select v-model.number="form.dentist_id"><option value="">Choose dentist</option><option v-for="d in dentists" :key="d.dentist_id" :value="d.dentist_id">{{d.username}} ({{d.specialization}})</option></select></label><label>Tooth number<input v-model="form.tooth_no" placeholder="e.g. 16 (FDI)"></label><label>Diagnosis<input v-model="form.diagnosis" placeholder="Clinical finding"></label><label class="wide">Treatment / notes<textarea v-model="form.treatment_done" rows="3"/></label><label class="wide">Additional notes<textarea v-model="form.notes" rows="2"/></label><label class="wide">Recommended return date<input v-model="form.follow_up_date" type="date" :min="today"><small>Optional. The patient will see this recommendation and receive an in-app notification if their account is linked. This does not book an appointment.</small></label></div><button class="button button-primary" :disabled="busy" @click="save">Save dental record</button></section><section class="surface feature-state dental-records"><h2>Interactive 32-tooth chart</h2><p class="muted">Select a patient and tooth to view or update its saved condition. Unrecorded teeth remain blank.</p><label class="chart-patient">Patient<select v-model="chartPatient" @change="loadChart"><option value="">Choose patient</option><option v-for="p in chartPatients" :key="p.id" :value="String(p.id)">{{p.first_name}} {{p.last_name}}</option></select></label><div class="arch-label">UPPER ARCH · FDI notation</div><div class="tooth-grid"><button v-for="t in upperTeeth" :key="t" :class="['tooth', `condition-${(toothMap[String(t)]||'Unrecorded').toLowerCase().replace(' ','-')}`, { chosen:selectedTooth===String(t) }]" @click="selectedTooth=String(t);toothCondition=toothMap[String(t)]||''">{{t}}</button></div><div class="arch-label">LOWER ARCH · FDI notation</div><div class="tooth-grid"><button v-for="t in lowerTeeth" :key="t" :class="['tooth', `condition-${(toothMap[String(t)]||'Unrecorded').toLowerCase().replace(' ','-')}`, { chosen:selectedTooth===String(t) }]" @click="selectedTooth=String(t);toothCondition=toothMap[String(t)]||''">{{t}}</button></div><div v-if="selectedTooth" class="tooth-editor"><strong>Tooth {{selectedTooth}}</strong><select v-model="toothCondition"><option value="" disabled>Select a condition</option><option v-for="c in ['Healthy','Decayed','Filled','Crown','Root Canal','Extracted']" :key="c">{{c}}</option></select><button class="button button-primary" :disabled="busy||!chartPatient||!toothCondition" @click="saveTooth">Save condition</button></div></section><section class="surface feature-state dental-records"><h2>Recent clinical records</h2><div v-if="!recordRows.length" class="empty-state">No records have been added yet.</div><div v-for="r in recordRows" :key="r.record_id" class="appointment-card"><div><strong>{{r.patient_name}} · {{r.tooth_no ? `Tooth ${r.tooth_no}` : 'Clinical note'}}</strong><p>{{r.diagnosis||'No diagnosis'}} · {{r.treatment_done||'No treatment noted'}}</p><p v-if="r.follow_up_date">Recommended return: {{r.follow_up_date}}</p></div><small>{{r.created_at}}</small></div></section></template>
    <template v-else-if="kind==='prescriptions'"><section v-if="!patientMode" class="surface feature-state"><h2>Create prescription record</h2><p class="muted">A prescription is the dentist’s written medication plan, including the medicine and how the patient should take it. Record only instructions provided by the treating clinician.</p><div class="form-grid"><label>Patient<select v-model.number="form.patient_id"><option value="">Choose patient</option><option v-for="p in patientContacts" :key="p.id" :value="p.id">{{p.first_name}} {{p.last_name}}</option></select></label><label>Medication<input v-model="form.medication" required></label><label class="wide">Directions<textarea v-model="form.directions" rows="3" required/></label></div><button class="button button-primary" :disabled="busy" @click="save">Save prescription</button></section><section class="surface feature-state"><h2>{{patientMode?'Your prescriptions':'Prescription history'}}</h2><div v-if="!prescriptionRows.length" class="empty-state"><strong>No prescriptions have been recorded</strong><p v-if="patientMode">New instructions from your care team will appear here.</p></div><div v-for="r in prescriptionRows" :key="r.prescription_id" class="appointment-card"><div><strong>{{patientMode?'':`${r.patient_name} · `}}{{r.medication}}</strong><p>{{r.directions}}</p><small>{{r.created_at}}</small></div><span class="status-badge">{{r.status}}</span></div></section></template>
    <template v-else>
      <section class="surface messenger">
        <aside class="messenger-contacts">
          <h2>Conversations</h2>
          <label class="conversation-search">
            <UiIcon name="search" />
            <input v-model="contactSearch" type="search" placeholder="Search by name" aria-label="Search conversations by name">
          </label>
          <button v-for="contact in filteredMessageContacts" :key="contact.user_id" :class="{selected:selectedContactId===contact.user_id, 'has-unread':Number(contact.unread_count)>0}" type="button" @click="selectContact(contact.user_id)">
            <span class="contact-summary">
              <span class="contact-avatar"><img v-if="profilePictures[contact.user_id]" :src="profilePictures[contact.user_id]" alt=""><span v-else>{{contactInitials(contact.username)}}</span></span>
              <span class="contact-identity"><strong>{{contact.username}}</strong><small>{{contact.role_name}} · <span :class="['presence-label', { online: Number(contact.is_online) === 1 }]">{{Number(contact.is_online)===1?'Online':'Offline'}}</span></small></span>
              <span v-if="Number(contact.unread_count)>0" class="unread-count" :aria-label="`${contact.unread_count} unread messages`">{{contact.unread_count}}</span>
            </span>
            <span v-if="contact.last_message" class="contact-preview">{{Number(contact.last_message_sender_id)===contact.user_id?`${contact.username}: `:'You: '}}{{contact.last_message}}</span>
            <time v-if="contact.last_message_at" class="contact-time">{{contact.last_message_at}}</time>
          </button>
          <p v-if="!messageContacts.length" class="conversation-empty">No clinic contacts are available.</p>
          <p v-else-if="!filteredMessageContacts.length" class="conversation-empty">No names match “{{ contactSearch.trim() }}”.</p>
        </aside>
        <div class="messenger-thread">
          <header>
            <div v-if="selectedContact" class="conversation-heading">
              <span class="contact-avatar"><img v-if="profilePictures[selectedContact.user_id]" :src="profilePictures[selectedContact.user_id]" alt=""><span v-else>{{contactInitials(selectedContact.username)}}</span></span>
              <div><h2>{{selectedContact.username}}</h2><p :class="['presence-label', { online: Number(selectedContact.is_online) === 1 }]"><span class="presence-dot"></span>{{Number(selectedContact.is_online)===1?'Online':'Offline'}}</p></div>
            </div>
            <div v-else><h2>Clinic messages</h2><p class="muted">Private messages with your care team.</p></div>
          </header>
          <div class="message-thread" aria-live="polite">
            <p v-if="!selectedContactId" class="empty-state">Choose a contact to open a conversation.</p>
            <p v-else-if="!selectedMessages.length" class="empty-state">No messages yet. Send a message to start the conversation.</p>
            <article v-for="m in selectedMessages" :key="m.message_id" :class="['message-bubble',{outgoing:m.sender_id===currentUserId}]">
              <small class="message-meta"><span class="message-avatar"><img v-if="profilePictures[m.sender_id]" :src="profilePictures[m.sender_id]" alt=""><span v-else>{{contactInitials(m.sender)}}</span></span>{{m.sender}} · {{m.created_at}}</small>
              <p>{{m.body}}</p>
              <small v-if="m.sender_id===currentUserId" class="delivery-status">
                <span v-if="m.delivery_status==='sending'" class="sending-indicator"><span class="loading-spinner"></span>Sending…</span>
                <span v-else>{{Number(m.is_read)===1?'Seen ✓✓':'Sent ✓'}}</span>
              </small>
            </article>
          </div>
          <form class="message-composer" @submit.prevent="sendMessage">
            <textarea v-model="form.body" rows="2" maxlength="5000" placeholder="Write a message…" required :disabled="!selectedContactId || sendingMessage"></textarea>
            <button class="button button-primary" :disabled="busy||sendingMessage||!selectedContactId||!String(form.body||'').trim()">
              <span v-if="sendingMessage" class="button-sending"><span class="loading-spinner"></span>Sending…</span>
              <span v-else>Send</span>
            </button>
          </form>
        </div>
      </section>
    </template>
  </template>
</template>

<style scoped>
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}.form-grid label{display:grid;gap:6px;color:#718793;font-size:13px;font-weight:650}.form-grid input,.form-grid select,.form-grid textarea{width:100%;border:1px solid #dce8e8;border-radius:11px;padding:11px;background:#fff;color:#183b4c;font:inherit}.wide{grid-column:1/-1}.feature-state{margin-bottom:18px}.feature-state h2{margin-top:0}.appointment-card{display:flex;justify-content:space-between;gap:16px;padding:14px 4px;border-top:1px solid #e4edf0}.appointment-card p{margin:4px 0;color:#718793}.appointment-card small{color:#718793}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}}
.chart-patient{display:grid;max-width:380px;gap:6px;margin:15px 0;color:#718793;font-size:13px;font-weight:650}.chart-patient select,.tooth-editor select{border:1px solid #dce8e8;border-radius:10px;padding:10px;background:#fff}.arch-label{margin:18px 0 8px;color:#8390a2;font-size:11.9px;font-weight:750;letter-spacing:.7px}.tooth-grid{display:grid;grid-template-columns:repeat(16,minmax(26px,1fr));gap:6px;overflow:auto}.tooth{min-width:28px;height:38px;border:1px solid #dce8e8;border-radius:9px;background:#f4fbf8;color:#39745f;font-weight:700}.tooth.condition-unrecorded{background:#f2f4f6;color:#8995a4;border-style:dashed}.tooth.condition-decayed{background:#fff0e3;color:#9c6436}.tooth.condition-filled,.tooth.condition-crown{background:#eee9ff;color:#6956a2}.tooth.condition-root-canal{background:#e8f4ff;color:#426c93}.tooth.condition-extracted{background:#fce9eb;color:#a15460}.tooth.chosen{outline:2px solid #438d75;outline-offset:1px}.tooth-editor{display:flex;align-items:center;gap:12px;margin-top:18px}.tooth-editor select{min-width:160px}
.messenger{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:520px;overflow:hidden;padding:0}.messenger-contacts{padding:18px;border-right:1px solid var(--line)}.messenger-contacts h2,.messenger-thread h2{margin:0 0 12px;font-size:16.2px}.messenger-contacts button{display:grid;width:100%;gap:3px;margin:5px 0;padding:11px;border:0;border-radius:10px;background:transparent;text-align:left;color:var(--ink)}.messenger-contacts button.selected,.messenger-contacts button:hover{background:#e8f4ee}.messenger-contacts small,.message-bubble small{color:var(--muted);font-size:10.8px}.messenger-thread{display:flex;min-width:0;flex-direction:column;padding:18px}.messenger-thread header{border-bottom:1px solid var(--line)}.messenger-thread header p{margin:0 0 12px}.message-thread{display:flex;flex:1;flex-direction:column;gap:10px;overflow:auto;padding:16px 3px}.message-bubble{align-self:flex-start;max-width:min(78%,520px);padding:10px 13px;border-radius:14px 14px 14px 4px;background:#eef2f5}.message-bubble.outgoing{align-self:flex-end;border-radius:14px 14px 4px 14px;background:#e4f6ed}.message-bubble p{margin:4px 0 0;color:var(--ink);font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}.message-composer{display:flex;align-items:end;gap:10px;padding-top:12px;border-top:1px solid var(--line)}.message-composer textarea{flex:1;min-width:0;border:1px solid var(--line);border-radius:11px;padding:10px;background:var(--surface);color:var(--ink);font:inherit;resize:vertical}.contact-preview{overflow:hidden;color:var(--muted);font-size:10.8px;text-overflow:ellipsis;white-space:nowrap}.contact-time{color:var(--muted);font-size:9.7px}.messenger-contacts button.has-unread:not(.selected){border:1px solid #f1c5cb;background:#fff7f8}.messenger-contacts button.has-unread:not(.selected) strong{font-weight:800}.messenger-contacts button.has-unread:not(.selected) small{color:#bd3c51;font-weight:700}@media(max-width:700px){.messenger{grid-template-columns:1fr}.messenger-contacts{display:flex;flex-wrap:wrap;gap:5px;border-right:0;border-bottom:1px solid var(--line)}.messenger-contacts h2{width:100%}.messenger-contacts button{width:auto}.messenger-thread{min-height:420px;padding:13px}}
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
:global(.app-shell[data-theme='dark'] .dental-records h2),
:global(.app-shell[data-theme='dark'] .dental-records .tooth-editor strong) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .dental-records > .muted),
:global(.app-shell[data-theme='dark'] .dental-records .form-grid label),
:global(.app-shell[data-theme='dark'] .dental-records .chart-patient),
:global(.app-shell[data-theme='dark'] .dental-records .arch-label) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .dental-records .form-grid input),
:global(.app-shell[data-theme='dark'] .dental-records .form-grid select),
:global(.app-shell[data-theme='dark'] .dental-records .form-grid textarea),
:global(.app-shell[data-theme='dark'] .dental-records .chart-patient select),
:global(.app-shell[data-theme='dark'] .dental-records .tooth-editor select) { border-color: #40534b; background: #1d2a25; color: #e4ede9; color-scheme: dark; }
:global(.app-shell[data-theme='dark'] .dental-records .form-grid input::placeholder),
:global(.app-shell[data-theme='dark'] .dental-records .form-grid textarea::placeholder) { color: #82988d; }
:global(.app-shell[data-theme='dark'] .dental-records .form-grid small) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth) { border-color: #40534b; background: #263630; color: #c1d0c9; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth.condition-unrecorded) { border-color: #52635c; background: #202e2a; color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth.condition-healthy) { border-color: #426d55; background: #244231; color: #a4e2ba; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth.condition-decayed) { border-color: #806347; background: #403226; color: #f0c77b; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth.condition-filled),
:global(.app-shell[data-theme='dark'] .dental-records .tooth.condition-crown) { border-color: #655787; background: #332c46; color: #d3c5ff; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth.condition-root-canal) { border-color: #4a6b83; background: #263947; color: #b6dcf6; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth.condition-extracted) { border-color: #754849; background: #40272a; color: #f0a3a8; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth:hover) { border-color: #70b894; }
:global(.app-shell[data-theme='dark'] .dental-records .tooth.chosen) { outline-color: #70c697; }
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
  min-height: 48px;
  max-height: 150px;
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
</style>
