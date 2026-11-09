<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ApiError, apiRequest, getApiData, getPortalRole, getStaffUser } from '../services/api'
import { useRoute } from 'vue-router'

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
}
interface MessageContact {
  user_id: number
  username: string
  role_name: string
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
const currentUserId = getStaffUser()?.id
const selectedContactId = ref<number | null>(null)
const selectedContact = computed(() => messageContacts.value.find((contact) => contact.user_id === selectedContactId.value))
const selectedMessages = computed(() => messages.value
  .filter((message) => message.sender_id === selectedContactId.value || message.recipient_id === selectedContactId.value)
  .slice()
  .reverse())
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
    window.dispatchEvent(new Event('medicare:messages-read'))
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
 form.value={};success.value=kind.value==='settings'?'Clinic settings saved.':hasFollowUpDate?(followUpNotificationSent?'Dental record and recommended return date saved. The patient was notified in MediCare+.':'Dental record and recommended return date saved. No in-app notification was sent because the patient account is not linked.'):'Saved successfully.';await load()
 }catch(e){error.value=e instanceof ApiError?e.message:'Could not save changes.'}finally{busy.value=false}}
async function loadChart(){toothMap.value={};selectedTooth.value='';toothCondition.value='';if(!chartPatient.value)return;try{const data=await getApiData<ToothChartRow[]>(`/api/patients/${chartPatient.value}/tooth-chart`);toothMap.value=Object.fromEntries(data.map(x=>[x.tooth_no,x.condition_name]))}catch(e){error.value=e instanceof ApiError?e.message:'Could not load the tooth chart.'}}
async function saveTooth(){if(!chartPatient.value||!selectedTooth.value)return;busy.value=true;error.value='';try{await apiRequest(`/api/patients/${chartPatient.value}/tooth-chart`,{method:'PUT',body:JSON.stringify({tooth_no:selectedTooth.value,condition_name:toothCondition.value})});toothMap.value={...toothMap.value,[selectedTooth.value]:toothCondition.value};success.value=`Tooth ${selectedTooth.value} updated.`}catch(e){error.value=e instanceof ApiError?e.message:'Could not update the tooth chart.'}finally{busy.value=false}}
async function sendMessage(){busy.value=true;error.value='';success.value='';try{await apiRequest('/api/messages',{method:'POST',body:JSON.stringify(form.value)});form.value.body='';success.value='Message sent.';await load()}catch(e){error.value=e instanceof ApiError?e.message:'Could not send this message.'}finally{busy.value=false}}
async function refreshMessages(loadContacts = false) {
  const response = await getApiData<MessagesResponse>('/api/messages')
  messages.value = response.messages
  messageContacts.value = patientMode
    ? response.contacts.filter((contact) => ['Staff', 'Admin'].includes(contact.role_name))
    : response.contacts
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
    window.dispatchEvent(new Event('medicare:messages-read'))
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not refresh this conversation.'
  }
}
const upperTeeth=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28], lowerTeeth=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]
onMounted(async()=>{
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
})
</script>

<template>
  <section class="page-heading"><div><p class="eyebrow">CLINIC WORKSPACE</p><h1>{{ titles[kind] }}</h1><p class="muted">{{ kind==='settings'?'Set the clinic details shown across your workspace.':'Manage clinic information stored in the MediCare+ database.' }}</p></div></section>
  <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div><div v-if="success" class="alert alert-success" role="status">{{ success }}</div>
  <section v-if="loading" class="surface empty-state">Loading {{ (titles[kind] ?? 'workspace').toLowerCase() }}…</section>
  <template v-else>
    <section v-if="kind==='settings'" class="surface feature-state"><h2>Clinic preferences</h2><p class="muted">These settings control the clinic name shown in the workspace and the default appointment length used when a service has no duration configured. Dentist availability still controls which times can be booked.</p><div class="form-grid"><label>Clinic name<input v-model="settings.clinic_name"></label><label>Clinic hours<input v-model="settings.clinic_hours"></label><label>Default appointment duration<select v-model="settings.appointment_duration"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label></div><button class="button button-primary" :disabled="busy" @click="save">Save settings</button></section>
    <template v-else-if="kind==='records'"><section class="surface feature-state"><h2>Add dental record</h2><div class="form-grid"><label>Appointment<select v-model.number="form.appointment_id"><option value="">Choose appointment</option><option v-for="a in appointments" :key="a.appointment_id" :value="a.appointment_id">#{{a.appointment_id}} · {{a.patient}} · {{a.service_name}} · {{a.appt_date}}</option></select></label><label>Dentist<select v-model.number="form.dentist_id"><option value="">Choose dentist</option><option v-for="d in dentists" :key="d.dentist_id" :value="d.dentist_id">{{d.username}} ({{d.specialization}})</option></select></label><label>Tooth number<input v-model="form.tooth_no" placeholder="e.g. 16 (FDI)"></label><label>Diagnosis<input v-model="form.diagnosis" placeholder="Clinical finding"></label><label class="wide">Treatment / notes<textarea v-model="form.treatment_done" rows="3"/></label><label class="wide">Additional notes<textarea v-model="form.notes" rows="2"/></label><label class="wide">Recommended return date<input v-model="form.follow_up_date" type="date" :min="today"><small>Optional. The patient will see this recommendation and receive an in-app notification if their account is linked. This does not book an appointment.</small></label></div><button class="button button-primary" :disabled="busy" @click="save">Save dental record</button></section><section class="surface feature-state"><h2>Interactive 32-tooth chart</h2><p class="muted">Select a patient and tooth to view or update its saved condition. Unrecorded teeth remain blank.</p><label class="chart-patient">Patient<select v-model="chartPatient" @change="loadChart"><option value="">Choose patient</option><option v-for="p in chartPatients" :key="p.id" :value="String(p.id)">{{p.first_name}} {{p.last_name}}</option></select></label><div class="arch-label">UPPER ARCH · FDI notation</div><div class="tooth-grid"><button v-for="t in upperTeeth" :key="t" :class="['tooth', `condition-${(toothMap[String(t)]||'Unrecorded').toLowerCase().replace(' ','-')}`, { chosen:selectedTooth===String(t) }]" @click="selectedTooth=String(t);toothCondition=toothMap[String(t)]||''">{{t}}</button></div><div class="arch-label">LOWER ARCH · FDI notation</div><div class="tooth-grid"><button v-for="t in lowerTeeth" :key="t" :class="['tooth', `condition-${(toothMap[String(t)]||'Unrecorded').toLowerCase().replace(' ','-')}`, { chosen:selectedTooth===String(t) }]" @click="selectedTooth=String(t);toothCondition=toothMap[String(t)]||''">{{t}}</button></div><div v-if="selectedTooth" class="tooth-editor"><strong>Tooth {{selectedTooth}}</strong><select v-model="toothCondition"><option value="" disabled>Select a condition</option><option v-for="c in ['Healthy','Decayed','Filled','Crown','Root Canal','Extracted']" :key="c">{{c}}</option></select><button class="button button-primary" :disabled="busy||!chartPatient||!toothCondition" @click="saveTooth">Save condition</button></div></section><section class="surface feature-state"><h2>Recent clinical records</h2><div v-if="!recordRows.length" class="empty-state">No records have been added yet.</div><div v-for="r in recordRows" :key="r.record_id" class="appointment-card"><div><strong>{{r.patient_name}} · {{r.tooth_no ? `Tooth ${r.tooth_no}` : 'Clinical note'}}</strong><p>{{r.diagnosis||'No diagnosis'}} · {{r.treatment_done||'No treatment noted'}}</p><p v-if="r.follow_up_date">Recommended return: {{r.follow_up_date}}</p></div><small>{{r.created_at}}</small></div></section></template>
    <template v-else-if="kind==='prescriptions'"><section v-if="!patientMode" class="surface feature-state"><h2>Create prescription record</h2><p class="muted">A prescription is the dentist’s written medication plan, including the medicine and how the patient should take it. Record only instructions provided by the treating clinician.</p><div class="form-grid"><label>Patient<select v-model.number="form.patient_id"><option value="">Choose patient</option><option v-for="p in patientContacts" :key="p.id" :value="p.id">{{p.first_name}} {{p.last_name}}</option></select></label><label>Medication<input v-model="form.medication" required></label><label class="wide">Directions<textarea v-model="form.directions" rows="3" required/></label></div><button class="button button-primary" :disabled="busy" @click="save">Save prescription</button></section><section class="surface feature-state"><h2>{{patientMode?'Your prescriptions':'Prescription history'}}</h2><div v-if="!prescriptionRows.length" class="empty-state"><strong>No prescriptions have been recorded</strong><p v-if="patientMode">New instructions from your care team will appear here.</p></div><div v-for="r in prescriptionRows" :key="r.prescription_id" class="appointment-card"><div><strong>{{patientMode?'':`${r.patient_name} · `}}{{r.medication}}</strong><p>{{r.directions}}</p><small>{{r.created_at}}</small></div><span class="status-badge">{{r.status}}</span></div></section></template>
    <template v-else><section class="surface messenger"><aside class="messenger-contacts"><h2>Conversations</h2><button v-for="contact in messageContacts" :key="contact.user_id" :class="{selected:selectedContactId===contact.user_id, 'has-unread':Number(contact.unread_count)>0}" type="button" @click="selectContact(contact.user_id)"><span class="contact-summary"><strong>{{contact.username}}</strong><span v-if="Number(contact.unread_count)>0" class="unread-count" :aria-label="`${contact.unread_count} unread messages`">{{contact.unread_count}}</span></span><small>{{contact.role_name}}{{Number(contact.unread_count)>0?' · New message':''}}</small><span v-if="contact.last_message" class="contact-preview">{{Number(contact.last_message_sender_id)===contact.user_id?`${contact.username}: `:'You: '}}{{contact.last_message}}</span><time v-if="contact.last_message_at" class="contact-time">{{contact.last_message_at}}</time></button><p v-if="!messageContacts.length" class="muted">No clinic contacts are available.</p></aside><div class="messenger-thread"><header><h2>{{selectedContact?.username||'Clinic messages'}}</h2><p class="muted">Private messages with your care team.</p></header><div class="message-thread" aria-live="polite"><p v-if="!selectedContactId" class="empty-state">Choose a contact to open a conversation.</p><p v-else-if="!selectedMessages.length" class="empty-state">No messages yet. Send a message to start the conversation.</p><article v-for="m in selectedMessages" :key="m.message_id" :class="['message-bubble',{outgoing:m.sender_id===currentUserId}]"><small>{{m.sender}} · {{m.created_at}}</small><p>{{m.body}}</p><small v-if="m.sender_id===currentUserId" class="delivery-status">{{Number(m.is_read)===1?'Seen ✓✓':'Sent ✓'}}</small></article></div><form class="message-composer" @submit.prevent="sendMessage"><textarea v-model="form.body" rows="2" maxlength="5000" placeholder="Write a message…" required :disabled="!selectedContactId"></textarea><button class="button button-primary" :disabled="busy||!selectedContactId||!String(form.body||'').trim()">Send</button></form></div></section></template>
  </template>
</template>

<style scoped>
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}.form-grid label{display:grid;gap:6px;color:#718793;font-size:13px;font-weight:650}.form-grid input,.form-grid select,.form-grid textarea{width:100%;border:1px solid #dce8e8;border-radius:11px;padding:11px;background:#fff;color:#183b4c;font:inherit}.wide{grid-column:1/-1}.feature-state{margin-bottom:18px}.feature-state h2{margin-top:0}.appointment-card{display:flex;justify-content:space-between;gap:16px;padding:14px 4px;border-top:1px solid #e4edf0}.appointment-card p{margin:4px 0;color:#718793}.appointment-card small{color:#718793}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}}
.chart-patient{display:grid;max-width:380px;gap:6px;margin:15px 0;color:#718793;font-size:13px;font-weight:650}.chart-patient select,.tooth-editor select{border:1px solid #dce8e8;border-radius:10px;padding:10px;background:#fff}.arch-label{margin:18px 0 8px;color:#8390a2;font-size:11.9px;font-weight:750;letter-spacing:.7px}.tooth-grid{display:grid;grid-template-columns:repeat(16,minmax(26px,1fr));gap:6px;overflow:auto}.tooth{min-width:28px;height:38px;border:1px solid #dce8e8;border-radius:9px;background:#f4fbf8;color:#39745f;font-weight:700}.tooth.condition-unrecorded{background:#f2f4f6;color:#8995a4;border-style:dashed}.tooth.condition-decayed{background:#fff0e3;color:#9c6436}.tooth.condition-filled,.tooth.condition-crown{background:#eee9ff;color:#6956a2}.tooth.condition-root-canal{background:#e8f4ff;color:#426c93}.tooth.condition-extracted{background:#fce9eb;color:#a15460}.tooth.chosen{outline:2px solid #438d75;outline-offset:1px}.tooth-editor{display:flex;align-items:center;gap:12px;margin-top:18px}.tooth-editor select{min-width:160px}
.messenger{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:520px;overflow:hidden;padding:0}.messenger-contacts{padding:18px;border-right:1px solid var(--line)}.messenger-contacts h2,.messenger-thread h2{margin:0 0 12px;font-size:16.2px}.messenger-contacts button{display:grid;width:100%;gap:3px;margin:5px 0;padding:11px;border:0;border-radius:10px;background:transparent;text-align:left;color:var(--ink)}.messenger-contacts button.selected,.messenger-contacts button:hover{background:#e8f4ee}.messenger-contacts small,.message-bubble small{color:var(--muted);font-size:10.8px}.messenger-thread{display:flex;min-width:0;flex-direction:column;padding:18px}.messenger-thread header{border-bottom:1px solid var(--line)}.messenger-thread header p{margin:0 0 12px}.message-thread{display:flex;flex:1;flex-direction:column;gap:10px;overflow:auto;padding:16px 3px}.message-bubble{align-self:flex-start;max-width:min(78%,520px);padding:10px 13px;border-radius:14px 14px 14px 4px;background:#eef2f5}.message-bubble.outgoing{align-self:flex-end;border-radius:14px 14px 4px 14px;background:#e4f6ed}.message-bubble p{margin:4px 0 0;color:var(--ink);font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}.message-composer{display:flex;align-items:end;gap:10px;padding-top:12px;border-top:1px solid var(--line)}.message-composer textarea{flex:1;min-width:0;border:1px solid var(--line);border-radius:11px;padding:10px;background:var(--surface);color:var(--ink);font:inherit;resize:vertical}.contact-preview{overflow:hidden;color:var(--muted);font-size:10.8px;text-overflow:ellipsis;white-space:nowrap}.contact-time{color:var(--muted);font-size:9.7px}.messenger-contacts button.has-unread:not(.selected){border:1px solid #f1c5cb;background:#fff7f8}.messenger-contacts button.has-unread:not(.selected) strong{font-weight:800}.messenger-contacts button.has-unread:not(.selected) small{color:#bd3c51;font-weight:700}@media(max-width:700px){.messenger{grid-template-columns:1fr}.messenger-contacts{display:flex;flex-wrap:wrap;gap:5px;border-right:0;border-bottom:1px solid var(--line)}.messenger-contacts h2{width:100%}.messenger-contacts button{width:auto}.messenger-thread{min-height:420px;padding:13px}}
.delivery-status{display:block;margin-top:5px;text-align:right;color:#5d8a78!important;font-size:10.8px!important}
.contact-summary{display:flex;align-items:center;justify-content:space-between;gap:8px}.unread-count{display:inline-grid;min-width:20px;height:20px;place-items:center;padding:0 6px;border-radius:999px;background:#d34f61;color:#fff;font-size:10.8px;font-weight:750}.messenger-contacts button:not(.selected):has(.unread-count) strong{font-weight:800}.messenger-contacts button:not(.selected):has(.unread-count) small{color:#bd3c51;font-weight:700}
</style>
