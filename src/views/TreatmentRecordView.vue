<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ApiError, apiRequest, getApiData, getPatients, type Patient } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'
async function loadPdf() {
  const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF: jspdfMod.default, autoTable: autoTableMod.default }
}
interface Appointment { appointment_id:number; patient_id:number; service_name:string; appt_date:string; status:string; dentist_id:number|null }
interface Dentist { dentist_id:number; display_name:string; specialization:string|null }
interface ToothChartRow { tooth_no: string; condition_name: string }
interface TreatmentRecord { record_id:number; patient_name:string; tooth_no:string|null; diagnosis:string|null; treatment_done:string|null; notes:string|null; follow_up_date:string|null; follow_up_time:string|null; created_at:string }
interface TreatmentSaveResponse { data: { record_id: number; return_notifications: { patient: boolean; dentist: boolean } } }
const appointments=ref<Appointment[]>([]); const patients=ref<Patient[]>([]); const dentists=ref<Dentist[]>([]); const loading=ref(true); const saving=ref(false); const error=ref(''); const success=ref('')
const recentTreatments=ref<TreatmentRecord[]>([]); const recordsLoading=ref(true); const recordsError=ref(''); const exportingHistory=ref(false)
const form=reactive({patient_id:'',appointment_id:'',dentist_id:'',tooth_no:'',diagnosis:'',treatment_done:'',notes:'',follow_up_date:'',follow_up_time:''})
const patientAppointments = computed(() => appointments.value.filter((appointment) => appointment.patient_id === Number(form.patient_id)))
const selectedAppointment = computed(() => appointments.value.find((appointment) => appointment.appointment_id === Number(form.appointment_id)))
const selectedPatient = computed(() => patients.value.find((patient) => patient.id === Number(form.patient_id)))
const upperTeeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28]
const lowerTeeth = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]
const toothMap = ref<Record<string, string>>({})
const selectedTooth = ref('')
const toothCondition = ref('')
const chartLoading = ref(false)
const chartSaving = ref(false)
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const availableDentists = computed(() => {
  const assignedDentist = dentists.value.find((dentist) => dentist.dentist_id === selectedAppointment.value?.dentist_id)
  return assignedDentist ? [assignedDentist] : dentists.value
})
async function loadOptions(){loading.value=true;error.value='';try{const [a,p,o]=await Promise.all([getApiData<Appointment[]>('/api/appointments'),getPatients(),getApiData<{dentists:Dentist[]}>('/api/public/overview')]);appointments.value=a;patients.value=p.filter((patient)=>patient.status==='active');dentists.value=o.dentists}catch(e){error.value=e instanceof ApiError?e.message:'Could not load patients, appointments, and dentists.'}finally{loading.value=false}}
async function loadRecentTreatments(){
  recordsLoading.value=true;recordsError.value=''
  try{recentTreatments.value=await getApiData<TreatmentRecord[]>('/api/treatment-records')}
  catch(cause){recordsError.value=cause instanceof ApiError?cause.message:'Could not load saved treatment records.'}
  finally{recordsLoading.value=false}
}
async function exportClinicHistory(){
  if(!recentTreatments.value.length)return
  exportingHistory.value=true
  try{
    const {jsPDF,autoTable}=await loadPdf()
    const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
    const pageWidth=pdf.internal.pageSize.getWidth()
    const generatedAt=new Date().toLocaleString()
    pdf.setFillColor(25,74,78)
    pdf.rect(0,0,pageWidth,35,'F')
    pdf.setTextColor(255,255,255)
    pdf.setFont('helvetica','bold')
    pdf.setFontSize(18)
    pdf.text('Clinic Treatment History',14,16)
    pdf.setFont('helvetica','normal')
    pdf.setFontSize(9)
    pdf.text(`${recentTreatments.value.length} records · Generated ${generatedAt}`,14,25)
    autoTable(pdf,{
      startY:42,
      margin:{left:10,right:10},
      head:[['Record','Patient','Date saved','Tooth','Diagnosis','Treatment','Return visit','Notes']],
      body:recentTreatments.value.map((record)=>[
        `#${record.record_id}`,
        record.patient_name,
        record.created_at,
        record.tooth_no||'—',
        record.diagnosis||'—',
        record.treatment_done||'—',
        record.follow_up_date
          ? `${record.follow_up_date}${record.follow_up_time?` · ${record.follow_up_time.slice(0,5)}`:''}`
          : '—',
        record.notes||'—',
      ]),
      styles:{fontSize:7,cellPadding:2,overflow:'linebreak',valign:'top'},
      headStyles:{fillColor:[25,74,78]},
      alternateRowStyles:{fillColor:[245,249,247]},
    })
    const localDate=new Date(Date.now()-new Date().getTimezoneOffset()*60_000).toISOString().slice(0,10)
    pdf.save(`clinic-treatment-history-${localDate}.pdf`)
    notify.success('Clinic treatment history PDF downloaded.','PDF ready')
  }catch(cause){
    const details=cause instanceof Error?cause.message:String(cause)
    notify.error(`Could not download clinic history PDF: ${details}`,'PDF export failed')
  }finally{exportingHistory.value=false}
}
function selectPatient(){form.appointment_id='';form.dentist_id='';form.tooth_no='';void loadToothChart()}
function selectAppointment(){form.dentist_id=selectedAppointment.value?.dentist_id ? String(selectedAppointment.value.dentist_id) : ''}
async function loadToothChart(){
  toothMap.value={};selectedTooth.value='';toothCondition.value=''
  if(!form.patient_id)return
  chartLoading.value=true
  try{
    const rows=await getApiData<ToothChartRow[]>(`/api/patients/${encodeURIComponent(form.patient_id)}/tooth-chart`)
    toothMap.value=Object.fromEntries(rows.map(row=>[row.tooth_no,row.condition_name]))
  }catch(cause){error.value=cause instanceof ApiError?cause.message:'Could not load the tooth chart.'}
  finally{chartLoading.value=false}
}
function chooseTooth(tooth:string){
  selectedTooth.value=tooth
  toothCondition.value=toothMap.value[tooth]??''
  form.tooth_no=tooth
}
function toothClasses(tooth:number){
  const condition=toothMap.value[String(tooth)]??'Unrecorded'
  return ['tooth',`condition-${condition.toLowerCase().replace(/\s+/g,'-')}`,{chosen:selectedTooth.value===String(tooth)}]
}
async function saveToothCondition(){
  if(!form.patient_id||!selectedTooth.value||!toothCondition.value)return
  chartSaving.value=true;error.value=''
  try{
    await apiRequest(`/api/patients/${encodeURIComponent(form.patient_id)}/tooth-chart`,{method:'PUT',body:JSON.stringify({tooth_no:selectedTooth.value,condition_name:toothCondition.value})})
    toothMap.value={...toothMap.value,[selectedTooth.value]:toothCondition.value}
    notify.success(`Tooth ${selectedTooth.value} updated.`,'Tooth chart updated')
  }catch(cause){error.value=cause instanceof ApiError?cause.message:'Could not update the tooth chart.';notify.error(error.value,'Tooth chart not updated')}
  finally{chartSaving.value=false}
}
async function save(){
  saving.value=true;error.value='';success.value=''
  if(Boolean(form.follow_up_date)!==Boolean(form.follow_up_time)){
    error.value='Choose both a return date and time, or leave both blank.'
    saving.value=false
    return
  }
  if(!form.diagnosis.trim()&&!form.treatment_done.trim()){
    error.value='Enter a diagnosis or describe the treatment performed before saving.'
    saving.value=false
    return
  }
  try{
    const result=await apiRequest<TreatmentSaveResponse>('/api/treatment-records',{method:'POST',body:JSON.stringify({...form,appointment_id:Number(form.appointment_id),dentist_id:Number(form.dentist_id)})})
    success.value=form.follow_up_date
      ? result.data.return_notifications.patient && result.data.return_notifications.dentist
        ? 'Treatment record saved. The patient and dentist were notified of the return visit.'
        : `Treatment record saved. Return visit status: ${result.data.return_notifications.patient ? 'patient calendar updated and patient notified' : 'patient account unavailable'}; ${result.data.return_notifications.dentist ? 'dentist notified' : 'dentist account unavailable'}.`
      : 'Treatment record saved. The patient can view it in Profile & Medical History.'
    form.tooth_no='';form.diagnosis='';form.treatment_done='';form.notes='';form.follow_up_date='';form.follow_up_time='';selectedTooth.value='';toothCondition.value=''
    await loadRecentTreatments()
  }catch(e){error.value=e instanceof ApiError?e.message:'Could not save treatment record.';notify.error(error.value,'Treatment record not saved')}
  finally{saving.value=false}
}
onMounted(()=>{void loadOptions();void loadRecentTreatments()})
</script>
<template>
  <section class="page-heading treatment-heading">
    <div>
      <p class="eyebrow">PATIENT CARE <span>·</span> CLINICAL RECORDS</p>
      <h1>Add treatment record</h1>
      <p class="muted">Document the diagnosis and care provided during a visit. Saved treatment details will be available to the patient in Profile &amp; Medical History.</p>
    </div>
    <span class="treatment-private-note"><span aria-hidden="true">●</span> Clinical documentation</span>
  </section>
  <p v-if="success" class="form-success treatment-success" role="status">{{ success }}</p>

  <SkeletonLoader v-if="loading" variant="form" label="Loading treatment form options" />
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
        <section class="treatment-tooth-chart treatment-field-full" aria-labelledby="treatment-chart-title">
          <div class="treatment-chart-heading">
            <div>
              <h4 id="treatment-chart-title">Interactive 32-tooth chart</h4>
              <p v-if="!form.patient_id">Choose a patient in section 1 to load their tooth conditions and enable the chart.</p>
              <p v-else-if="chartLoading">Loading this patient’s tooth conditions…</p>
              <p v-else>Select a tooth to add it to this treatment record, or update its condition.</p>
            </div>
            <span class="treatment-chart-patient" v-if="selectedPatient">{{ selectedPatient.first_name }} {{ selectedPatient.last_name }}</span>
          </div>
          <div class="treatment-arch-label">UPPER ARCH · FDI NOTATION</div>
          <div class="treatment-arch-scroll">
            <div class="treatment-tooth-grid">
              <button v-for="tooth in upperTeeth" :key="tooth" type="button" :class="toothClasses(tooth)" :aria-pressed="selectedTooth===String(tooth)" :aria-label="`Select tooth ${tooth}, ${toothMap[String(tooth)] ?? 'unrecorded'}`" :disabled="!form.patient_id||chartLoading" @click="chooseTooth(String(tooth))">{{ tooth }}</button>
            </div>
          </div>
          <div class="treatment-arch-label">LOWER ARCH · FDI NOTATION</div>
          <div class="treatment-arch-scroll">
            <div class="treatment-tooth-grid">
              <button v-for="tooth in lowerTeeth" :key="tooth" type="button" :class="toothClasses(tooth)" :aria-pressed="selectedTooth===String(tooth)" :aria-label="`Select tooth ${tooth}, ${toothMap[String(tooth)] ?? 'unrecorded'}`" :disabled="!form.patient_id||chartLoading" @click="chooseTooth(String(tooth))">{{ tooth }}</button>
            </div>
          </div>
          <div v-if="selectedTooth" class="treatment-tooth-editor">
            <strong>Tooth {{ selectedTooth }}</strong>
            <label>
              <span>Current condition</span>
              <select v-model="toothCondition">
                <option value="" disabled>Select a condition</option>
                <option v-for="condition in ['Healthy','Decayed','Filled','Crown','Root Canal','Extracted']" :key="condition" :value="condition">{{ condition }}</option>
              </select>
            </label>
            <button class="button button-quiet" type="button" :disabled="chartSaving || !toothCondition" @click="saveToothCondition">{{ chartSaving ? 'Saving…' : 'Save condition' }}</button>
          </div>
        </section>
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
        <div class="treatment-field treatment-field-full">
          <span>Return visit <em>Optional</em></span>
          <div class="treatment-return-fields">
            <label><span>Date</span><input v-model="form.follow_up_date" type="date" :min="today" aria-label="Return visit date"></label>
            <label><span>Time</span><input v-model="form.follow_up_time" type="time" aria-label="Return visit time"></label>
          </div>
          <small>Set both date and time to add a return reminder to the patient’s calendar and notify the patient and dentist. This is a reminder, not a booked appointment.</small>
        </div>
      </div>
    </section>

    <p v-if="error" class="form-error treatment-error" role="alert">{{ error }}</p>
    <footer class="treatment-form-footer">
      <p>Double-check the appointment and clinical details before saving.</p>
      <button class="button button-primary" :disabled="saving">{{ saving?'Saving treatment record…':'Save treatment record' }}</button>
    </footer>
  </form>

  <section class="surface treatment-records" aria-labelledby="recent-treatments-title">
    <header class="treatment-records-heading">
      <div>
        <p class="treatment-kicker">CLINICAL HISTORY</p>
        <h2 id="recent-treatments-title">Recently saved treatment records</h2>
        <p>Records saved here are also available to each patient in Profile &amp; Medical History.</p>
      </div>
      <div class="treatment-record-actions">
        <button class="button button-quiet" type="button" :disabled="recordsLoading" @click="loadRecentTreatments">{{ recordsLoading ? 'Refreshing…' : 'Refresh records' }}</button>
        <button class="button button-primary" type="button" :disabled="recordsLoading || exportingHistory || !recentTreatments.length" @click="exportClinicHistory">{{ exportingHistory ? 'Preparing PDF…' : 'Download history PDF' }}</button>
      </div>
    </header>
    <p v-if="recordsError" class="form-error" role="alert">{{ recordsError }} <button class="text-button" type="button" @click="loadRecentTreatments">Retry</button></p>
    <SkeletonLoader v-else-if="recordsLoading" variant="table" :rows="3" :columns="4" :contained="true" label="Loading saved treatment records" />
    <p v-else-if="!recentTreatments.length" class="empty-inline">No treatment records have been saved yet.</p>
    <div v-else class="treatment-record-list">
      <article v-for="record in recentTreatments" :key="record.record_id" class="treatment-record-item">
        <div class="treatment-record-main">
          <strong>{{ record.patient_name }} <span>· Record #{{ record.record_id }}</span></strong>
          <p>{{ record.diagnosis || 'No diagnosis recorded' }} <span>·</span> {{ record.treatment_done || 'No treatment description' }}</p>
          <small v-if="record.follow_up_date">Return visit: {{ record.follow_up_date }}{{ record.follow_up_time ? ` · ${record.follow_up_time.slice(0,5)}` : '' }}</small>
        </div>
        <div class="treatment-record-meta">
          <span v-if="record.tooth_no">Tooth {{ record.tooth_no }}</span>
          <time>{{ record.created_at }}</time>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.treatment-heading .eyebrow span { padding: 0 4px; color: #a4b0ba; }
.treatment-heading > div:first-child { max-width: 760px; }
.treatment-private-note { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 8px; padding: 9px 13px; border: 1px solid #dfece5; border-radius: 999px; background: #f5faf7; color: #49675a; font-size: 10.8px; font-weight: 650; }
.treatment-private-note > span { color: #438d75; font-size: 8.6px; }
.treatment-form { padding: clamp(20px, 2.5vw, 30px); border-radius: 16px; }
.treatment-records { margin-top: 20px; padding: clamp(18px, 2.5vw, 26px); border-radius: 16px; }
.treatment-records-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.treatment-record-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.treatment-records-heading h2 { margin: 0; color: #26364a; font-size: 18px; font-weight: 720; }
.treatment-records-heading p:last-child { margin: 6px 0 0; color: #78879a; font-size: 11px; }
.treatment-record-list { display: grid; }
.treatment-record-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid #edf0f2; }
.treatment-record-main { min-width: 0; }
.treatment-record-main > strong { color: #35495b; font-size: 12px; }
.treatment-record-main > strong span { color: #78879a; font-size: 10px; font-weight: 500; }
.treatment-record-main p { margin: 5px 0; color: #617286; font-size: 11px; overflow-wrap: anywhere; }
.treatment-record-main p span { color: #a4b0ba; }
.treatment-record-main small,.treatment-record-meta time { color: #8390a0; font-size: 10px; }
.treatment-record-meta { display: grid; justify-items: end; gap: 5px; flex: 0 0 auto; color: #49675a; font-size: 10px; }
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
.treatment-return-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.treatment-return-fields label { display: grid; gap: 6px; color: #405168; font-size: 10.8px; font-weight: 650; }
.treatment-return-fields label > span { color: #78879a; }
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
.treatment-tooth-chart { min-width: 0; padding: 17px; border: 1px solid #e1e9e4; border-radius: 12px; background: #f8fbf9; }
.treatment-chart-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.treatment-chart-heading h4 { margin: 0; color: #35495b; font-size: 13px; font-weight: 720; }
.treatment-chart-heading p { margin: 5px 0 0; color: #78879a; font-size: 10.8px; font-weight: 450; line-height: 1.5; }
.treatment-chart-patient { flex: 0 0 auto; padding: 6px 9px; border: 1px solid #dce8e1; border-radius: 999px; background: #fff; color: #49675a; font-size: 10px; font-weight: 650; }
.treatment-arch-label { margin: 17px 0 8px; color: #78889a; font-size: 9.7px; font-weight: 750; letter-spacing: .8px; }
.treatment-arch-scroll { overflow-x: auto; padding: 2px; }
.treatment-tooth-grid { display: grid; min-width: 540px; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 6px; }
.treatment-tooth-grid .tooth { min-width: 0; height: 38px; border: 1px solid #dce8e1; border-radius: 9px; background: #eef7f2; color: #39745f; font-size: 11px; font-weight: 700; cursor: pointer; transition: border-color .16s ease, transform .16s ease, box-shadow .16s ease; }
.treatment-tooth-grid .tooth:hover:not(:disabled) { transform: translateY(-1px); border-color: #69a98c; }
.treatment-tooth-grid .tooth:focus-visible { outline: 3px solid rgb(67 141 117 / 28%); outline-offset: 2px; }
.treatment-tooth-grid .tooth:disabled { cursor: wait; opacity: .65; }
.treatment-tooth-grid .tooth.condition-unrecorded { border-style: dashed; background: #f2f4f6; color: #8995a4; }
.treatment-tooth-grid .tooth.condition-healthy { background: #e4f4eb; color: #28775b; }
.treatment-tooth-grid .tooth.condition-decayed { background: #fff0e3; color: #9c6436; }
.treatment-tooth-grid .tooth.condition-filled, .treatment-tooth-grid .tooth.condition-crown { background: #eee9ff; color: #6956a2; }
.treatment-tooth-grid .tooth.condition-root-canal { background: #e8f4ff; color: #426c93; }
.treatment-tooth-grid .tooth.condition-extracted { background: #fce9eb; color: #a15460; }
.treatment-tooth-grid .tooth.chosen { outline: 2px solid #438d75; outline-offset: 1px; }
.treatment-tooth-editor { display: flex; align-items: end; gap: 12px; margin-top: 15px; padding-top: 14px; border-top: 1px solid #e1e9e4; }
.treatment-tooth-editor > strong { align-self: center; flex: 0 0 auto; color: #35495b; font-size: 12px; }
.treatment-tooth-editor label { display: grid; flex: 1; gap: 5px; color: #78879a; font-size: 10px; font-weight: 650; }
.treatment-tooth-editor select { width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid #dce4e8; border-radius: 9px; background: #fff; color: #314359; font: inherit; font-size: 12px; }
.treatment-tooth-editor .button { min-height: 40px; flex: 0 0 auto; }
.treatment-error,.treatment-success { margin: 18px 0 0; }
.treatment-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 22px; padding-top: 17px; border-top: 1px solid #edf0f2; }
.treatment-form-footer p { max-width: 480px; margin: 0; color: #78879a; font-size: 10.8px; line-height: 1.6; }
.treatment-form-footer .button { min-height: 43px; flex: 0 0 auto; padding-inline: 18px; border-radius: 9px; }
.treatment-state { min-height: 140px; justify-items: center; gap: 9px; padding: 25px; text-align: center; }
.treatment-state p { margin: 0; color: #78879a; font-size: 11.9px; }
:global(.app-shell[data-theme='dark'] .treatment-form-heading h2),
:global(.app-shell[data-theme='dark'] .treatment-records-heading h2),
:global(.app-shell[data-theme='dark'] .treatment-record-main > strong),
:global(.app-shell[data-theme='dark'] .treatment-section-title h3),
:global(.app-shell[data-theme='dark'] .treatment-field > span:first-child),
:global(.app-shell[data-theme='dark'] .treatment-visit-summary > strong) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .treatment-form-heading > div > p:last-child),
:global(.app-shell[data-theme='dark'] .treatment-records-heading p:last-child),
:global(.app-shell[data-theme='dark'] .treatment-record-main > strong span),
:global(.app-shell[data-theme='dark'] .treatment-record-main p),
:global(.app-shell[data-theme='dark'] .treatment-record-main small),
:global(.app-shell[data-theme='dark'] .treatment-record-meta time),
:global(.app-shell[data-theme='dark'] .treatment-section-title p),
:global(.app-shell[data-theme='dark'] .treatment-field small),
:global(.app-shell[data-theme='dark'] .treatment-required-note),
:global(.app-shell[data-theme='dark'] .treatment-form-footer p),
:global(.app-shell[data-theme='dark'] .treatment-state p) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .treatment-private-note) { border-color: #40534b; background: #263630; color: #c1d0c9; }
:global(.app-shell[data-theme='dark'] .treatment-form-section + .treatment-form-section),
:global(.app-shell[data-theme='dark'] .treatment-form-footer),
:global(.app-shell[data-theme='dark'] .treatment-record-item) { border-color: #354741; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-chart) { border-color: #40534b; background: #202e2a; }
:global(.app-shell[data-theme='dark'] .treatment-chart-heading h4),
:global(.app-shell[data-theme='dark'] .treatment-tooth-editor > strong) { color: #e4ede9; }
:global(.app-shell[data-theme='dark'] .treatment-chart-heading p),
:global(.app-shell[data-theme='dark'] .treatment-arch-label),
:global(.app-shell[data-theme='dark'] .treatment-tooth-editor label) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .treatment-chart-patient) { border-color: #40534b; background: #263630; color: #c1d0c9; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth) { border-color: #40534b; background: #263630; color: #c1d0c9; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth.condition-unrecorded) { border-color: #52635c; background: #202e2a; color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth.condition-healthy) { border-color: #426d55; background: #244231; color: #a4e2ba; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth.condition-decayed) { border-color: #806347; background: #403226; color: #f0c77b; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth.condition-filled),
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth.condition-crown) { border-color: #655787; background: #332c46; color: #d3c5ff; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth.condition-root-canal) { border-color: #4a6b83; background: #263947; color: #b6dcf6; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth.condition-extracted) { border-color: #754849; background: #40272a; color: #f0a3a8; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-grid .tooth.chosen) { outline-color: #70c697; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-editor) { border-color: #354741; }
:global(.app-shell[data-theme='dark'] .treatment-tooth-editor select) { border-color: #40534b; background: #1d2a25; color: #e4ede9; color-scheme: dark; }
:global(.app-shell[data-theme='dark'] .treatment-section-title > span) { background: #2b4037; color: #b9e2cd; }
:global(.app-shell[data-theme='dark'] .treatment-field) { color: #d2dfd8; }
:global(.app-shell[data-theme='dark'] .treatment-field input),
:global(.app-shell[data-theme='dark'] .treatment-field select),
:global(.app-shell[data-theme='dark'] .treatment-field textarea) { border-color: #40534b; background: #1d2a25; color: #e4ede9; color-scheme: dark; }
:global(.app-shell[data-theme='dark'] .treatment-field input::placeholder),
:global(.app-shell[data-theme='dark'] .treatment-field textarea::placeholder) { color: #82988d; }
:global(.app-shell[data-theme='dark'] .treatment-field select:disabled) { border-color: #354741; background: #263630; color: #9aaca5; opacity: 1; }
:global(.app-shell[data-theme='dark'] .treatment-field > span:first-child i) { color: #f0a3a8; }
:global(.app-shell[data-theme='dark'] .treatment-field i),
:global(.app-shell[data-theme='dark'] .treatment-field em) { color: #a3b3ae; }
:global(.app-shell[data-theme='dark'] .treatment-visit-summary) { border-color: #40534b; background: #263630; }
:global(.app-shell[data-theme='dark'] .treatment-visit-summary > span:last-child) { color: #a3b3ae; }
@media (max-width: 760px) {
  .treatment-heading { align-items: flex-start; flex-direction: column; gap: 13px; }
  .treatment-records-heading { flex-direction: column; }
  .treatment-record-actions { width: 100%; justify-content: flex-start; }
  .treatment-fields { grid-template-columns: minmax(0, 1fr); gap: 15px; }
  .treatment-field-full { grid-column: auto; }
  .treatment-form-footer { align-items: stretch; flex-direction: column; }
  .treatment-form-footer .button { width: 100%; }
  .treatment-tooth-editor { align-items: stretch; flex-direction: column; }
  .treatment-tooth-editor > strong { align-self: flex-start; }
  .treatment-tooth-editor .button { width: 100%; }
}
@media (max-width: 480px) {
  .treatment-form-heading { flex-direction: column; }
  .treatment-tooth-chart { padding: 13px; }
  .treatment-chart-heading { flex-direction: column; }
}
</style>
