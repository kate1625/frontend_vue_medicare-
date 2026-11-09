<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError, apiRequest, getApiData, getPatients, type Patient } from '../services/api'
interface Appointment { appointment_id:number; patient_id:number; service_name:string; appt_date:string; status:string; dentist_id:number|null }
interface Dentist { dentist_id:number; display_name:string; specialization:string|null }
const appointments=ref<Appointment[]>([]); const patients=ref<Patient[]>([]); const dentists=ref<Dentist[]>([]); const loading=ref(true); const saving=ref(false); const error=ref(''); const success=ref('')
const form=reactive({patient_id:'',appointment_id:'',dentist_id:'',tooth_no:'',diagnosis:'',treatment_done:'',notes:'',follow_up_date:''})
const patientAppointments = computed(() => appointments.value.filter((appointment) => appointment.patient_id === Number(form.patient_id)))
const selectedAppointment = computed(() => appointments.value.find((appointment) => appointment.appointment_id === Number(form.appointment_id)))
const selectedPatient = computed(() => patients.value.find((patient) => patient.id === Number(form.patient_id)))
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const availableDentists = computed(() => {
  const assignedDentist = dentists.value.find((dentist) => dentist.dentist_id === selectedAppointment.value?.dentist_id)
  return assignedDentist ? [assignedDentist] : dentists.value
})
async function loadOptions(){loading.value=true;error.value='';try{const [a,p,o]=await Promise.all([getApiData<Appointment[]>('/api/appointments'),getPatients(),getApiData<{dentists:Dentist[]}>('/api/public/overview')]);appointments.value=a;patients.value=p.filter((patient)=>patient.status==='active');dentists.value=o.dentists}catch(e){error.value=e instanceof ApiError?e.message:'Could not load patients, appointments, and dentists.'}finally{loading.value=false}}
function selectPatient(){form.appointment_id='';form.dentist_id=''}
function selectAppointment(){form.dentist_id=selectedAppointment.value?.dentist_id ? String(selectedAppointment.value.dentist_id) : ''}
async function save(){saving.value=true;error.value='';success.value='';if(!form.diagnosis.trim()&&!form.treatment_done.trim()){error.value='Enter a diagnosis or describe the treatment performed before saving.';saving.value=false;return}try{const result=await apiRequest<{data:{notification_sent:boolean}}>('/api/treatment-records',{method:'POST',body:JSON.stringify({...form,appointment_id:Number(form.appointment_id),dentist_id:Number(form.dentist_id)})});success.value=form.follow_up_date?(result.data.notification_sent?'Treatment record and recommended return date saved. The patient was notified in MediCare+.':'Treatment record and recommended return date saved. The date appears in the patient’s history; no linked patient account was available for an in-app notification.'):'Treatment record saved. You can view it in Dental Records and the selected patient’s record.';form.tooth_no='';form.diagnosis='';form.treatment_done='';form.notes='';form.follow_up_date=''}catch(e){error.value=e instanceof ApiError?e.message:'Could not save treatment record.'}finally{saving.value=false}}
onMounted(loadOptions)
</script>
<template>
  <section class="page-heading treatment-heading">
    <div>
      <p class="eyebrow">PATIENT CARE <span>·</span> CLINICAL RECORDS</p>
      <h1>Add treatment record</h1>
      <p class="muted">Document the diagnosis and care provided during a visit. Patient-visible tooth assessments are managed separately in Dental Records.</p>
    </div>
    <span class="treatment-private-note"><span aria-hidden="true">●</span> Clinical documentation</span>
  </section>

  <section v-if="loading" class="surface empty-state treatment-state">
    <span class="loading-dot"/><strong>Loading appointments and dentists</strong><p>We’re getting the clinic details ready.</p>
  </section>
  <section v-else-if="error && (!patients.length || !appointments.length || !dentists.length)" class="surface empty-state treatment-state">
    <strong>Could not load the treatment form</strong><p>{{ error }}</p><button class="button button-quiet" type="button" @click="loadOptions">Try again</button>
  </section>
  <section v-else-if="!patients.length || !appointments.length || !dentists.length" class="surface empty-state treatment-state">
    <strong>{{ !patients.length ? 'No active patients are available' : !appointments.length ? 'No appointments are available' : 'No dentists are available' }}</strong>
    <p>{{ !patients.length ? 'An active patient record is needed before you can add a treatment record.' : !appointments.length ? 'An appointment is needed before you can add a treatment record.' : 'Add or activate a dentist account before creating a treatment record.' }}</p>
  </section>
  <form v-else class="surface treatment-form" @submit.prevent="save">
    <header class="treatment-form-heading">
      <div><p class="treatment-kicker">VISIT DOCUMENTATION</p><h2>Record treatment details</h2><p>Choose the visit and dentist, then document the clinical care provided.</p></div>
      <span class="treatment-required-note"><i>*</i> Required fields</span>
    </header>

    <section class="treatment-form-section">
      <div class="treatment-section-title"><span>1</span><div><h3>Patient and visit</h3><p>Choose who received care, then select the matching appointment.</p></div></div>
      <div class="treatment-fields">
        <label class="treatment-field treatment-field-full">
          <span>Patient <i>Required</i></span>
          <select v-model="form.patient_id" required @change="selectPatient">
            <option value="" disabled>Select a patient</option>
            <option v-for="patient in patients" :key="patient.id" :value="String(patient.id)">{{ patient.first_name }} {{ patient.last_name }}{{ patient.phone ? ` · ${patient.phone}` : '' }}</option>
          </select>
          <small>Select the patient who received treatment. Only this patient’s appointments will be shown next.</small>
        </label>

        <label class="treatment-field treatment-field-full">
          <span>Appointment <i>Required</i></span>
          <select v-model="form.appointment_id" required :disabled="!form.patient_id" @change="selectAppointment">
            <option value="" disabled>{{ form.patient_id ? 'Select an appointment for this patient' : 'Select a patient first' }}</option>
            <option v-for="a in patientAppointments" :key="a.appointment_id" :value="String(a.appointment_id)">#{{ a.appointment_id }} · {{ a.service_name }} · {{ a.appt_date }} · {{ a.status }}</option>
          </select>
          <small>{{ form.patient_id && !patientAppointments.length ? 'This patient has no appointments available for a treatment record.' : 'Appointments are filtered to the patient selected above.' }}</small>
        </label>

        <div v-if="selectedAppointment" class="treatment-visit-summary treatment-field-full">
          <span class="treatment-visit-label">SELECTED VISIT</span>
          <strong>{{ selectedPatient?.first_name }} {{ selectedPatient?.last_name }}</strong>
          <span>{{ selectedAppointment.service_name }} <i>·</i> {{ selectedAppointment.appt_date }} <i>·</i> Appointment #{{ selectedAppointment.appointment_id }}</span>
        </div>

        <label class="treatment-field treatment-field-full">
          <span>Dentist <i>Required</i></span>
          <select v-model="form.dentist_id" required>
            <option value="" disabled>Select a dentist</option>
            <option v-for="d in availableDentists" :key="d.dentist_id" :value="String(d.dentist_id)">{{ d.display_name }}{{ d.specialization ? ` · ${d.specialization}` : '' }}</option>
          </select>
          <small>{{ selectedAppointment?.dentist_id ? 'The dentist assigned to this appointment is selected automatically.' : 'Select the dentist responsible for this clinical record.' }}</small>
        </label>
      </div>
    </section>

    <section class="treatment-form-section">
      <div class="treatment-section-title"><span>2</span><div><h3>Clinical findings and care</h3><p>Enter the assessed tooth, diagnosis, and treatment performed. A diagnosis or treatment description is required.</p></div></div>
      <div class="treatment-fields">
        <label class="treatment-field">
          <span>Tooth number <em>Optional</em></span>
          <input v-model="form.tooth_no" maxlength="10" placeholder="e.g. 16 or 24">
          <small>Use the tooth numbering convention used by your clinic.</small>
        </label>
        <label class="treatment-field">
          <span>Diagnosis <em>Optional if treatment is described</em></span>
          <input v-model="form.diagnosis" maxlength="5000" placeholder="Enter the clinical diagnosis">
          <small>Record your clinical finding or diagnosis.</small>
        </label>
        <label class="treatment-field treatment-field-full">
          <span>Treatment performed <em>Optional if diagnosis is entered</em></span>
          <textarea v-model="form.treatment_done" rows="4" maxlength="5000" placeholder="Describe the procedure or care provided during the visit."></textarea>
          <small>Include the relevant procedure details for the patient’s clinical history.</small>
        </label>
        <label class="treatment-field treatment-field-full">
          <span>Additional notes <em>Optional</em></span>
          <textarea v-model="form.notes" rows="3" maxlength="5000" placeholder="Add follow-up recommendations or other clinical notes."></textarea>
          <small>These notes are part of the treatment record.</small>
        </label>
        <label class="treatment-field treatment-field-full">
          <span>Recommended return date <em>Optional</em></span>
          <input v-model="form.follow_up_date" type="date" :min="today">
          <small>This recommendation will appear in the patient’s medical history and send an in-app notification. It does not book an appointment; the patient will need to contact the clinic or book separately.</small>
        </label>
      </div>
    </section>

    <p v-if="error" class="form-error treatment-error" role="alert">{{ error }}</p>
    <p v-if="success" class="form-success treatment-success" role="status">{{ success }} <RouterLink to="/staff/records">Open Dental Records</RouterLink></p>
    <footer class="treatment-form-footer">
      <p>Double-check the appointment and clinical details before saving.</p>
      <button class="button button-primary" :disabled="saving">{{ saving?'Saving treatment record…':'Save treatment record' }}</button>
    </footer>
  </form>
</template>

<style scoped>
.treatment-heading .eyebrow span { padding: 0 4px; color: #a4b0ba; }
.treatment-heading > div:first-child { max-width: 760px; }
.treatment-private-note { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 8px; padding: 9px 13px; border: 1px solid #dfece5; border-radius: 999px; background: #f5faf7; color: #49675a; font-size: 10.8px; font-weight: 650; }
.treatment-private-note > span { color: #438d75; font-size: 8.6px; }
.treatment-form { padding: clamp(20px, 2.5vw, 30px); border-radius: 16px; }
.treatment-form-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.treatment-kicker { margin: 0 0 6px; color: #438d75; font-size: 10.8px; font-weight: 750; letter-spacing: 1px; }
.treatment-form-heading h2 { margin: 0; color: #26364a; font-size: 20.5px; font-weight: 720; letter-spacing: -.3px; }
.treatment-form-heading > div > p:last-child { margin: 6px 0 0; color: #78879a; font-size: 13px; }
.treatment-required-note { flex: 0 0 auto; color: #78879a; font-size: 10.8px; }
.treatment-required-note i { color: #bd5960; font-style: normal; font-weight: 750; }
.treatment-form-section + .treatment-form-section { margin-top: 25px; padding-top: 23px; border-top: 1px solid #edf0f2; }
.treatment-section-title { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 17px; }
.treatment-section-title > span { display: grid; width: 25px; height: 25px; flex: 0 0 auto; place-items: center; border-radius: 8px; background: #edf6f1; color: #438064; font-size: 11.9px; font-weight: 750; }
.treatment-section-title h3 { margin: 0; color: #35495b; font-size: 14px; font-weight: 700; }
.treatment-section-title p { margin: 4px 0 0; color: #8390a0; font-size: 10.8px; }
.treatment-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px 20px; }
.treatment-field { display: grid; align-content: start; gap: 7px; color: #405168; font-size: 11.9px; font-weight: 650; }
.treatment-field > span:first-child { color: #405168; font-size: 11.9px; font-weight: 700; }
.treatment-field i,.treatment-field em { margin-left: 5px; color: #8793a2; font-size: 9.7px; font-style: normal; font-weight: 500; }
.treatment-field > span:first-child i { color: #bd5960; }
.treatment-field input,.treatment-field select,.treatment-field textarea { width: 100%; min-width: 0; min-height: 43px; padding: 10px 12px; border: 1px solid #dce4e8; border-radius: 9px; background: #fff; color: #314359; font: inherit; font-size: 13px; }
.treatment-field textarea { min-height: 86px; resize: vertical; line-height: 1.6; }
.treatment-field input::placeholder,.treatment-field textarea::placeholder { color: #9aa5b2; font-weight: 400; }
.treatment-field input:focus,.treatment-field select:focus,.treatment-field textarea:focus { border-color: #69a98c; outline: 0; box-shadow: 0 0 0 3px rgb(67 141 117 / 13%); }
.treatment-field small { color: #8390a0; font-size: 10.8px; font-weight: 450; line-height: 1.5; }
.treatment-field-full { grid-column: 1 / -1; }
.treatment-visit-summary { display: grid; justify-items: start; gap: 5px; padding: 13px 15px; border: 1px solid #e1e9e4; border-radius: 10px; background: #f8faf9; }
.treatment-visit-label { color: #78889a !important; font-size: 9.7px !important; font-weight: 750 !important; letter-spacing: .8px; }
.treatment-visit-summary > strong { color: #35495b; font-size: 13px; }
.treatment-visit-summary > span:last-child { color: #78879a; font-size: 10.8px; font-weight: 450; }
.treatment-visit-summary > span:last-child i { margin: 0 3px; }
.treatment-error,.treatment-success { margin: 18px 0 0; }
.treatment-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 22px; padding-top: 17px; border-top: 1px solid #edf0f2; }
.treatment-form-footer p { max-width: 480px; margin: 0; color: #78879a; font-size: 10.8px; line-height: 1.6; }
.treatment-form-footer .button { min-height: 43px; flex: 0 0 auto; padding-inline: 18px; border-radius: 9px; }
.treatment-state { min-height: 140px; justify-items: center; gap: 9px; padding: 25px; text-align: center; }
.treatment-state p { margin: 0; color: #78879a; font-size: 11.9px; }
:global(:root[data-theme='dark']) .treatment-form-heading h2,:global(:root[data-theme='dark']) .treatment-section-title h3,:global(:root[data-theme='dark']) .treatment-field > span:first-child,:global(:root[data-theme='dark']) .treatment-visit-summary > strong { color: #e4ede9; }
:global(:root[data-theme='dark']) .treatment-form-heading > div > p:last-child,:global(:root[data-theme='dark']) .treatment-section-title p,:global(:root[data-theme='dark']) .treatment-field small,:global(:root[data-theme='dark']) .treatment-required-note,:global(:root[data-theme='dark']) .treatment-form-footer p,:global(:root[data-theme='dark']) .treatment-state p { color: #a3b3ae; }
:global(:root[data-theme='dark']) .treatment-private-note { border-color: #40534b; background: #263630; color: #c1d0c9; }
:global(:root[data-theme='dark']) .treatment-form-section + .treatment-form-section,:global(:root[data-theme='dark']) .treatment-form-footer { border-color: #354741; }
:global(:root[data-theme='dark']) .treatment-section-title > span { background: #2b4037; color: #b9e2cd; }
:global(:root[data-theme='dark']) .treatment-field { color: #d2dfd8; }
:global(:root[data-theme='dark']) .treatment-field input,:global(:root[data-theme='dark']) .treatment-field select,:global(:root[data-theme='dark']) .treatment-field textarea { border-color: #40534b; background: #1d2a25; color: #e4ede9; }
:global(:root[data-theme='dark']) .treatment-visit-summary { border-color: #40534b; background: #263630; }
:global(:root[data-theme='dark']) .treatment-visit-summary > span:last-child { color: #a3b3ae; }
@media (max-width: 760px) {
  .treatment-heading { align-items: flex-start; flex-direction: column; gap: 13px; }
  .treatment-fields { grid-template-columns: minmax(0, 1fr); gap: 15px; }
  .treatment-field-full { grid-column: auto; }
  .treatment-form-footer { align-items: stretch; flex-direction: column; }
  .treatment-form-footer .button { width: 100%; }
}
@media (max-width: 480px) {
  .treatment-form-heading { flex-direction: column; }
}
</style>
