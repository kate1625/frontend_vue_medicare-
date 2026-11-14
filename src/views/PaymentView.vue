<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ApiError, apiRequest, getApiData } from '../services/api'
import { useRoute } from 'vue-router'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { notify } from '../services/toast'

async function loadQr() {
  const mod = await import('qrcode')
  return mod.default
}
interface Appointment { appointment_id: number; status: string; service_name: string; price: string; appt_date: string }
interface PaymentMethod { payment_method_id: number; method_name: string; type: string; account_name: string | null; account_no: string | null; instructions: string | null; is_maintenance: boolean | number | string }
interface Payment { payment_id: number; appointment_id: number; status: string; amount: number|string; payment_plan: 'full'|'downpayment'; payment_percent: number|null }
interface Charge { appointment_id:number; appt_date:string; appt_time:string; appointment_status:string; service_name:string; amount_due:number|string; amount_paid:number|string; balance_due:number|string; latest_payment_status:string|null }
interface PaymentOverview { appointments: Appointment[]; methods: PaymentMethod[]; payments: Payment[]; charges: Charge[] }
const PAYMONGO_CHECKOUT_URL_KEY = 'medicare.paymongoCheckoutUrl'
const route = useRoute()
function isPayMongoCheckoutUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'checkout.paymongo.com'
  } catch {
    return false
  }
}
const storedCheckoutUrl = sessionStorage.getItem(PAYMONGO_CHECKOUT_URL_KEY) || ''
const appointments = ref<Appointment[]>([]); const methods = ref<PaymentMethod[]>([]); const payments = ref<Payment[]>([]); const charges = ref<Charge[]>([]); const qr = ref(''); const loading = ref(true); const saving = ref(false); const error = ref(''); const message = ref(''); const receiptPaymentId = ref<number | null>(null); const paymongoCheckoutUrl = ref(isPayMongoCheckoutUrl(storedCheckoutUrl) ? storedCheckoutUrl : '')
let paymentRefreshTimer: number | null = null
let paymentRefreshInFlight = false
const form = reactive({ appointment_id: '', payment_method_id: '', payment_plan: 'full' as 'full'|'downpayment', payment_percent: 50, reference_no: '' })
const selectedMethod = computed(() => methods.value.find((item) => item.payment_method_id === Number(form.payment_method_id)))
const paymentCardElement = ref<HTMLElement | null>(null)
const payableAppointments = computed(() => appointments.value.filter((item) => !['cancelled', 'no_show'].includes(item.status) && Number(charges.value.find((charge) => charge.appointment_id === item.appointment_id)?.balance_due ?? item.price) > 0 && !payments.value.some((payment) => payment.appointment_id === item.appointment_id && payment.status === 'pending')))
const selectedAppointment = computed(() => payableAppointments.value.find((item) => item.appointment_id === Number(form.appointment_id)))
const selectedCharge = computed(() => charges.value.find((item) => item.appointment_id === Number(form.appointment_id)))
const amountDue = computed(() => Number(selectedCharge.value?.balance_due ?? selectedAppointment.value?.price ?? 0))
const paymentAmount = computed(() => form.payment_plan === 'downpayment' ? Math.min(amountDue.value, Number(selectedAppointment.value?.price ?? 0) * form.payment_percent / 100) : amountDue.value)
const selectedOnlineMethod = computed(() => selectedMethod.value && ['ewallet', 'card'].includes(selectedMethod.value.type))
const selectedMethodAvailable = computed(() => selectedMethod.value && Number(selectedMethod.value.is_maintenance) !== 1)
function canPayCharge(charge: Charge) {
  return Number(charge.balance_due) > 0 && payableAppointments.value.some((item) => item.appointment_id === charge.appointment_id)
}
async function payCharge(charge: Charge) {
  if (!canPayCharge(charge)) return
  form.appointment_id = String(charge.appointment_id)
  form.payment_method_id = ''
  form.payment_plan = 'full'
  error.value = ''
  message.value = ''
  await nextTick()
  paymentCardElement.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
async function refresh(showLoading = true) {
  if (paymentRefreshInFlight) return
  paymentRefreshInFlight = true
  if (showLoading) loading.value = true
  error.value = ''
  try {
    const overview = await getApiData<PaymentOverview>('/api/payments/overview')
    appointments.value = overview.appointments
    methods.value = overview.methods
    payments.value = overview.payments
    charges.value = overview.charges
    const appointmentId = Number(route.query.appointment_id)
    if (Number.isInteger(appointmentId) && appointmentId > 0 && payableAppointments.value.some((item) => item.appointment_id === appointmentId)) {
      form.appointment_id = String(appointmentId)
    }
  }
  catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Unable to load payment details.' }
  finally {
    paymentRefreshInFlight = false
    if (showLoading) loading.value = false
  }
}
watch(selectedMethod, async (method) => {
  qr.value = ''
  if (method?.account_no) {
    const QRCode = await loadQr()
    qr.value = await QRCode.toDataURL(
      `Payment account: ${method.account_name || method.method_name}; account number: ${method.account_no}`,
      { width: 180, margin: 1 },
    )
  }
})
async function submit() {
  saving.value = true; error.value = ''; message.value = ''
  try { const result = await apiRequest<{ data: { payment_id: number }; message: string }>('/api/payments', { method: 'POST', body: JSON.stringify({ ...form, appointment_id: Number(form.appointment_id), payment_method_id: Number(form.payment_method_id) }) }); receiptPaymentId.value = result.data.payment_id; message.value = 'Payment submitted successfully. Your receipt is ready while the clinic verifies the payment.'; notify.success(message.value, 'Payment submitted'); form.reference_no = ''; await refresh() }
  catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Payment could not be submitted.'; notify.error(error.value, 'Payment not submitted') }
  finally { saving.value = false }
}
async function startPayMongoCheckout() {
  saving.value = true; error.value = ''; message.value = ''
  try {
    const result = await apiRequest<{ data: { checkout_url: string } }>('/api/payments/paymongo/checkout', {
      method: 'POST',
      body: JSON.stringify({ appointment_id: Number(form.appointment_id), payment_method_id: Number(form.payment_method_id), payment_plan: form.payment_plan, payment_percent: form.payment_plan === 'downpayment' ? form.payment_percent : 100 }),
    })
    if (!isPayMongoCheckoutUrl(result.data.checkout_url)) throw new Error('PayMongo returned an invalid checkout link.')
    paymongoCheckoutUrl.value = result.data.checkout_url
    sessionStorage.setItem(PAYMONGO_CHECKOUT_URL_KEY, result.data.checkout_url)
    window.location.assign(result.data.checkout_url)
  } catch (cause) {
    error.value = cause instanceof ApiError
      ? cause.message
      : 'Online checkout is temporarily unavailable. Please use “Submit for clinic review” instead.'
    notify.error(error.value, 'Online checkout unavailable')
    saving.value = false
  }
}
async function checkPayMongoReturn() {
  const params = new URLSearchParams(window.location.search)
  const paymentId = Number(params.get('payment_id'))
  if (params.get('paymongo') !== 'return' || !Number.isInteger(paymentId) || paymentId <= 0) return
  saving.value = true; error.value = ''
  try {
    const result = await apiRequest<{ data: { status: string }; message: string }>('/api/payments/paymongo/confirm', {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId, verify: false }),
    })
    message.value = result.message
    notify.success(result.message, 'Payment update')
    receiptPaymentId.value = paymentId
    if (result.data.status !== 'pending') {
      paymongoCheckoutUrl.value = ''
      sessionStorage.removeItem(PAYMONGO_CHECKOUT_URL_KEY)
    }
    await refresh()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Could not verify the PayMongo payment.'
    notify.error(error.value, 'Payment verification failed')
  } finally {
    saving.value = false
  }
}
onMounted(async () => {
  await refresh()
  await checkPayMongoReturn()
  paymentRefreshTimer = window.setInterval(() => {
    if (payments.value.some((payment) => payment.status === 'pending')) void refresh(false)
  }, 15000)
})
onBeforeUnmount(() => { if (paymentRefreshTimer) window.clearInterval(paymentRefreshTimer) })
</script>
<template>
  <div class="payment-workspace">
    <header class="payment-heading">
      <div>
        <p class="payment-eyebrow"> <span></span> </p>
        <h1>Payments</h1>
        <p>Review appointment charges and manage your clinic payments.</p>
      </div>

    </header>

    <p v-if="message" class="payment-alert payment-alert-success" role="status">{{ message }} <RouterLink v-if="receiptPaymentId" :to="{ path: '/patient/receipt', query: { id: receiptPaymentId } }">View receipt</RouterLink><RouterLink v-else to="/patient/receipt">View receipts</RouterLink></p>
    <p v-if="message && paymongoCheckoutUrl" class="payment-alert payment-alert-info"><a :href="paymongoCheckoutUrl" target="_blank" rel="noopener">Continue to PayMongo checkout</a></p>

    <SkeletonLoader v-if="loading" variant="payment" label="Loading payment options and billing details" />
    <section v-else-if="error && !methods.length" class="surface payment-state">
      <strong>Payment options unavailable</strong><p>{{ error }}</p><button>class="button button-quiet" @click="refresh">Retry</button>
    </section>
    <template v-else>
      <div class="payment-layout">
        <section ref="paymentCardElement" class="surface payment-card">
          <div class="payment-card-heading">
            <div><p class="payment-step">PAYMENT DETAILS</p><h2>Choose how to pay</h2></div>
            <span class="payment-card-caption">Appointment payment</span>
          </div>

          <div v-if="!payableAppointments.length" class="payment-empty">
            <strong>No appointment needs payment</strong>
            <p>New or already paid appointments will not be listed here.</p>
          </div>
          <form v-else class="form-grid payment-form-grid" @submit.prevent="submit">
            <div class="payment-guidance field-full">
              <span class="payment-guidance-icon">i</span>
              <div><strong>Before you submit</strong><p>Cash and bank-transfer submissions are recorded for clinic staff to review. They do not process money. For online checkout, select an e-wallet or card and use PayMongo test mode.</p></div>
            </div>

            <label class="payment-field field-full">
              <span>Appointment</span>
              <select v-model="form.appointment_id" required>
                <option value="" disabled>Select an appointment</option>
                <option v-for="item in payableAppointments" :key="item.appointment_id" :value="String(item.appointment_id)">#{{ item.appointment_id }} · {{ item.service_name }} · {{ item.appt_date }} · {{ Number(item.price).toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</option>
              </select>
              <small>Choose the visit you want to pay for.</small>
            </label>

            <div class="payment-field field-full">
              <span>Payment plan</span>
              <div class="payment-plan-options">
                <label><input v-model="form.payment_plan" type="radio" value="full"> Full payment <strong>{{ amountDue.toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</strong></label>
                <label><input v-model="form.payment_plan" type="radio" value="downpayment"> Downpayment</label>
              </div>
              <select v-if="form.payment_plan === 'downpayment'" v-model.number="form.payment_percent">
                <option v-for="percent in [50, 60, 70, 80]" :key="percent" :value="percent">{{ percent }}% downpayment — {{ paymentAmount.toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</option>
              </select>
              <small v-if="form.payment_plan === 'downpayment'">Pay now: <strong>{{ paymentAmount.toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</strong> · Pay at the clinic: <strong>{{ Math.max(amountDue - paymentAmount, 0).toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</strong></small>
            </div>

            <label class="payment-field field-full">
              <span>Payment method</span>
              <select v-model="form.payment_method_id" required>
                <option value="" disabled>Select a payment method</option>
                <option v-for="item in methods" :key="item.payment_method_id" :value="String(item.payment_method_id)" :disabled="Number(item.is_maintenance)===1">{{ item.method_name }} ({{ item.type }}){{ Number(item.is_maintenance)===1?' — Under maintenance':'' }}</option>
              </select>
              <small>Unavailable methods are marked and cannot be selected.</small>
            </label>

            <p v-if="!methods.some((item)=>Number(item.is_maintenance)!==1)" class="form-error field-full">All clinic payment methods are temporarily unavailable. Please contact the clinic.</p>

            <div v-if="selectedMethod" class="payment-instructions payment-method-details field-full">
              <div class="payment-method-details-heading"><strong>{{ selectedMethod.method_name }} instructions</strong><span v-if="Number(selectedMethod.is_maintenance)===1" class="payment-maintenance">Under maintenance</span></div>
              <p v-if="Number(selectedMethod.is_maintenance)===1" class="form-error">This payment method is under maintenance. Please choose another method.</p>
              <p v-if="selectedMethod.account_name"><strong>Account name</strong><span>{{ selectedMethod.account_name }}</span></p>
              <p v-if="selectedMethod.account_no"><strong>Account number</strong><span>{{ selectedMethod.account_no }}</span></p>
              <p v-if="selectedMethod.instructions" class="payment-method-note">{{ selectedMethod.instructions }}</p>
              <img v-if="qr" :src="qr" alt="Payment account QR code" width="180" height="180">
            </div>

            <label class="payment-field field-full">
              <span>Reference number <em>Optional</em></span>
              <input v-model="form.reference_no" maxlength="100" placeholder="Enter your transfer or transaction reference">
            </label>

            <p v-if="error" class="form-error field-full" role="alert">{{ error }}</p>
            <div class="payment-actions field-full">
              <button class="button button-primary" :disabled="saving || !selectedMethodAvailable">{{ saving ? 'Submitting…' : 'Submit for clinic review' }}</button>
              <button v-if="selectedOnlineMethod" class="button button-quiet" type="button" :disabled="saving || !form.appointment_id || !selectedMethodAvailable" @click="startPayMongoCheckout">{{ saving ? 'Connecting…' : 'Pay online · PayMongo test' }}</button>
            </div>
          </form>
        </section>

        <aside class="surface payment-summary">
          <div class="payment-card-heading">
            <div><p class="payment-step">YOUR VISIT</p><h2>Payment summary</h2></div>
          </div>
          <template v-if="selectedAppointment">
            <div class="payment-visit">
              <span class="payment-visit-label">APPOINTMENT #{{ selectedAppointment.appointment_id }}</span>
              <strong>{{ selectedAppointment.service_name }}</strong>
              <span>{{ selectedAppointment.appt_date }}</span>
            </div>
            <div class="payment-summary-lines">
              <p><span>Appointment charge</span><strong>{{ Number(selectedCharge?.amount_due ?? selectedAppointment.price).toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</strong></p>
              <p v-if="selectedCharge && Number(selectedCharge.amount_paid) > 0"><span>Verified payments</span><strong>−{{ Number(selectedCharge.amount_paid).toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</strong></p>
            </div>
            <div class="payment-total"><span>Remaining balance</span><strong>{{ amountDue.toLocaleString('en-PH',{style:'currency',currency:'PHP'}) }}</strong></div>
          </template>
          <div v-else class="payment-summary-empty">Select an appointment to see its charges and remaining balance.</div>
          <div class="payment-summary-footnote">Your payment status and balance are updated after clinic staff review and verify the payment.</div>
        </aside>
      </div>

      <section v-if="charges.length" class="surface payment-section">
        <div class="payment-section-heading"><div><p class="payment-step">BILLING OVERVIEW</p><h2>Appointment charges</h2><p>Charges and balances based on verified payments.</p></div></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Appointment</th><th>Charge</th><th>Verified</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody><tr v-for="charge in charges" :key="charge.appointment_id"><td>#{{charge.appointment_id}} · {{charge.service_name}}<small class="table-secondary">{{charge.appt_date}} · {{charge.appt_time}}</small></td><td>{{Number(charge.amount_due).toLocaleString('en-PH',{style:'currency',currency:'PHP'})}}</td><td>{{Number(charge.amount_paid).toLocaleString('en-PH',{style:'currency',currency:'PHP'})}}</td><td><strong>{{Number(charge.balance_due).toLocaleString('en-PH',{style:'currency',currency:'PHP'})}}</strong></td><td><span class="status-badge" :data-status="charge.latest_payment_status||'unpaid'">{{Number(charge.balance_due)===0?'paid':charge.latest_payment_status==='pending'?'pending verification':charge.latest_payment_status==='rejected'?'payment rejected':'unpaid'}}</span></td><td><button v-if="canPayCharge(charge)" class="button button-quiet payment-balance-action" type="button" @click="payCharge(charge)">Pay balance</button><span v-else-if="Number(charge.balance_due) > 0 && charge.latest_payment_status === 'pending'" class="payment-review-note">Awaiting review</span><span v-else>—</span></td></tr></tbody></table></div>
      </section>

      <section v-if="payments.length" class="surface payment-section">
        <div class="payment-section-heading"><div><p class="payment-step">RECENT ACTIVITY</p><h2>Payment history</h2></div><RouterLink class="payment-receipts-link" to="/patient/receipt">View all receipts</RouterLink></div>
        <div class="payment-history-list"><article v-for="item in payments" :key="item.payment_id" class="payment-history-item"><div class="payment-history-details"><strong>Payment #{{ item.payment_id }}</strong><p>Appointment #{{ item.appointment_id }}</p></div><span class="status-badge" :data-status="item.status">{{ item.status }}</span><RouterLink class="payment-history-receipt" :to="{ path: '/patient/receipt', query: { id: item.payment_id } }">View receipt <span aria-hidden="true">→</span></RouterLink></article></div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.payment-workspace {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding-bottom: 36px;
}

.payment-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
}

.payment-plan-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 8px 0;
}

.payment-plan-options label {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 12px;
  border: 1px solid #dfe9e4;
  border-radius: 10px;
  background: #f8fbf9;
  color: #355468;
  cursor: pointer;
  font-size: 12px;
}

.payment-plan-options strong {
  margin-left: auto;
  color: #397c64;
}

.payment-eyebrow,
.payment-step {
  margin: 0 0 7px;
  color: #438d75;
  font-size: 10.8px;
  font-weight: 750;
  letter-spacing: 1.15px;
}

.payment-eyebrow span {
  padding: 0 5px;
  color: #a4b0ba;
}

.payment-heading h1 {
  margin: 0;
  color: #26364a;
  font-size: clamp(26px, 3vw, 34px);
  font-weight: 750;
  letter-spacing: -1px;
  line-height: 1.2;
}

.payment-heading > div:first-child > p:last-child {
  margin: 8px 0 0;
  color: #748195;
  font-size: 14px;
}

.payment-clinic-note {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  border: 1px solid #dfece5;
  border-radius: 999px;
  background: #f5faf7;
  color: #49675a;
  font-size: 11.9px;
  font-weight: 650;
}

.payment-clinic-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4a9a75;
  box-shadow: 0 0 0 3px #e1f1e7;
}

.payment-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(270px, 0.8fr);
  align-items: start;
  gap: 20px;
}

.payment-card,
.payment-summary,
.payment-section {
  min-width: 0;
  border-radius: 16px;
  padding: clamp(20px, 2.4vw, 30px);
}

.payment-card {
  scroll-margin-top: 84px;
}

.payment-balance-action {
  min-height: 34px;
  padding: 6px 11px;
  color: #28775b;
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}

.payment-review-note {
  color: #8a6a2b;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.payment-card-heading,
.payment-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 22px;
}

.payment-card-heading h2,
.payment-section-heading h2 {
  margin: 0;
  color: #26364a;
  font-size: 20.5px;
  font-weight: 720;
  letter-spacing: -0.35px;
}

.payment-card-heading .payment-step,
.payment-section-heading .payment-step {
  margin-bottom: 5px;
}

.payment-card-caption {
  padding: 6px 9px;
  border-radius: 7px;
  background: #edf6f1;
  color: #438064;
  font-size: 10.8px;
  font-weight: 650;
  white-space: nowrap;
}

.payment-form-grid {
  gap: 18px;
}

.payment-guidance {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px 16px;
  border: 1px solid #e0ebe5;
  border-radius: 11px;
  background: #f7faf8;
}

.payment-guidance-icon {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: #e4f1e9;
  color: #438064;
  font-size: 13px;
  font-weight: 750;
}

.payment-guidance strong {
  color: #35495b;
  font-size: 13px;
}

.payment-guidance p {
  margin: 4px 0 0;
  color: #708093;
  font-size: 11.9px;
  line-height: 1.65;
}

.payment-field {
  display: grid;
  align-content: start;
  gap: 7px;
  color: #405168;
  font-size: 13px;
  font-weight: 650;
}

.payment-field em {
  margin-left: 5px;
  color: #8793a2;
  font-size: 10.8px;
  font-style: normal;
  font-weight: 500;
}

.payment-field select,
.payment-field input {
  width: 100%;
  min-height: 45px;
  padding: 0 13px;
  border: 1px solid #dce4e8;
  border-radius: 9px;
  background: #fff;
  color: #314359;
  font-size: 13px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.payment-field select:focus,
.payment-field input:focus {
  border-color: #69a98c;
  outline: 0;
  box-shadow: 0 0 0 3px rgb(67 141 117 / 13%);
}

.payment-field small {
  color: #8390a0;
  font-size: 10.8px;
  font-weight: 450;
}

.payment-method-details {
  padding: 16px;
}

.payment-method-details-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.payment-method-details-heading > strong {
  color: #35495b;
  font-size: 13px;
}

.payment-method-details > p:not(.form-error) {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 12px;
  margin: 8px 0;
  color: #617185;
  font-size: 11.9px;
}

.payment-method-details > p > strong {
  min-width: 100px;
  color: #405168;
}

.payment-method-details .payment-method-note {
  display: block !important;
  padding-top: 9px;
  border-top: 1px solid #e6ece9;
  line-height: 1.6;
}

.payment-maintenance {
  padding: 5px 8px;
  border-radius: 999px;
  background: #fff4e3;
  color: #976717;
  font-size: 10.8px;
  font-weight: 650;
}

.payment-method-details img {
  max-width: 100%;
  height: auto;
  padding: 8px;
  border: 1px solid #e3e9e7;
  border-radius: 9px;
  background: #fff;
}

.payment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 3px;
}

.payment-actions .button {
  min-height: 43px;
  padding-inline: 17px;
  border-radius: 9px;
  font-size: 11.9px;
}

.payment-summary {
  position: sticky;
  top: 24px;
  border-color: #e1e9e5;
  background: linear-gradient(155deg, #fff 0%, #fbfdfb 100%);
}

.payment-summary .payment-card-heading {
  margin-bottom: 20px;
}

.payment-visit {
  display: grid;
  gap: 7px;
  padding: 15px;
  border: 1px solid #e5ece8;
  border-radius: 11px;
  background: #f8faf9;
}

.payment-visit-label {
  color: #78889a;
  font-size: 9.7px;
  font-weight: 750;
  letter-spacing: 0.8px;
}

.payment-visit > strong {
  color: #314359;
  font-size: 14px;
}

.payment-visit > span:last-child {
  color: #768498;
  font-size: 11.9px;
}

.payment-summary-lines {
  display: grid;
  gap: 12px;
  padding: 18px 0;
}

.payment-summary-lines p,
.payment-total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  color: #748195;
  font-size: 11.9px;
}

.payment-summary-lines strong {
  color: #48586b;
  font-weight: 650;
  text-align: right;
}

.payment-total {
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #e5ebe8;
  color: #35495b;
  font-weight: 650;
}

.payment-total strong {
  color: #34745f;
  font-size: 21.6px;
  font-weight: 750;
  letter-spacing: -0.5px;
  text-align: right;
}

.payment-summary-empty {
  padding: 16px;
  border: 1px dashed #dce6e1;
  border-radius: 10px;
  color: #78879a;
  font-size: 11.9px;
  line-height: 1.6;
}

.payment-summary-footnote {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #e9eeeb;
  color: #8591a0;
  font-size: 10.8px;
  line-height: 1.6;
}

.payment-section {
  margin-top: 20px;
}

.payment-section-heading {
  align-items: center;
  margin-bottom: 17px;
}

.payment-section-heading > div > p:last-child {
  margin: 5px 0 0;
  color: #7d8999;
  font-size: 11.9px;
}

.payment-section .data-table th {
  padding: 12px 15px;
}

.payment-section .data-table td {
  padding: 13px 15px;
  font-size: 11.9px;
}

.payment-receipts-link,
.payment-alert a {
  color: #34745f;
  font-size: 11.9px;
  font-weight: 700;
}

.payment-section .appointment-card {
  padding: 14px 0;
}

.payment-history-list {
  display: grid;
  gap: 10px;
}

.payment-history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 18px;
  min-width: 0;
  padding: 15px 17px;
  border: 1px solid #e2ebe7;
  border-radius: 12px;
  background: #fbfdfc;
  transition: border-color .16s ease, background .16s ease;
}

.payment-history-item:hover {
  border-color: #9dcbb1;
  background: #f5faf6;
}

.payment-history-details {
  min-width: 0;
}

.payment-history-details strong {
  display: block;
  color: #263f35;
  font-size: 13px;
  font-weight: 750;
}

.payment-history-details p {
  margin: 4px 0 0;
  color: #718278;
  font-size: 11.5px;
}

.payment-history-receipt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #34745f;
  font-size: 11.9px;
  font-weight: 700;
  white-space: nowrap;
}

.payment-history-receipt:hover {
  color: #245c49;
  text-decoration: underline;
}

.payment-state {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 24px;
}

.payment-state p {
  margin: 0;
  color: #748195;
}

.payment-empty {
  padding: 24px 12px;
  text-align: center;
}

.payment-empty strong {
  color: #35495b;
}

.payment-empty p {
  margin: 7px 0 0;
  color: #78879a;
  font-size: 13px;
}

.payment-alert {
  margin: 0 0 16px;
  padding: 12px 15px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 13px;
}

.payment-alert-success {
  border-color: #d3eadc;
  background: #f1f8f3;
  color: #3e7054;
}

.payment-alert-info {
  border-color: #d7e7ef;
  background: #f1f7fa;
  color: #476b7e;
}

:global(.app-shell[data-theme='dark'] .payment-heading h1),
:global(.app-shell[data-theme='dark'] .payment-card-heading h2),
:global(.app-shell[data-theme='dark'] .payment-section-heading h2),
:global(.app-shell[data-theme='dark'] .payment-guidance strong),
:global(.app-shell[data-theme='dark'] .payment-method-details-heading > strong),
:global(.app-shell[data-theme='dark'] .payment-method-details > p > strong),
:global(.app-shell[data-theme='dark'] .payment-empty strong) {
  color: #e4ede9;
}

:global(.app-shell[data-theme='dark'] .payment-heading > div:first-child > p:last-child),
:global(.app-shell[data-theme='dark'] .payment-guidance p),
:global(.app-shell[data-theme='dark'] .payment-field small),
:global(.app-shell[data-theme='dark'] .payment-section-heading > div > p:last-child),
:global(.app-shell[data-theme='dark'] .payment-state p),
:global(.app-shell[data-theme='dark'] .payment-empty p) {
  color: #a3b3ae;
}

:global(.app-shell[data-theme='dark'] .payment-card),
:global(.app-shell[data-theme='dark'] .payment-section),
:global(.app-shell[data-theme='dark'] .payment-summary) {
  border-color: #354741;
  background: #1d2b26;
  color: #d2dfd8;
}

:global(.app-shell[data-theme='dark'] .payment-clinic-note),
:global(.app-shell[data-theme='dark'] .payment-card-caption),
:global(.app-shell[data-theme='dark'] .payment-guidance),
:global(.app-shell[data-theme='dark'] .payment-visit) {
  border-color: #354741;
  background: #263630;
}

:global(.app-shell[data-theme='dark'] .payment-clinic-note),
:global(.app-shell[data-theme='dark'] .payment-field),
:global(.app-shell[data-theme='dark'] .payment-visit > strong),
:global(.app-shell[data-theme='dark'] .payment-summary-lines strong),
:global(.app-shell[data-theme='dark'] .payment-total) {
  color: #d2dfd8;
}

:global(.app-shell[data-theme='dark'] .payment-guidance-icon) {
  background: #344c40;
  color: #b9e2cd;
}

:global(.app-shell[data-theme='dark'] .payment-method-details),
:global(.app-shell[data-theme='dark'] .payment-method-details .payment-method-note) {
  border-color: #354741;
  background: #263630;
}

:global(.app-shell[data-theme='dark'] .payment-method-details > p:not(.form-error)),
:global(.app-shell[data-theme='dark'] .payment-visit > span:last-child),
:global(.app-shell[data-theme='dark'] .payment-summary-lines),
:global(.app-shell[data-theme='dark'] .payment-summary-footnote),
:global(.app-shell[data-theme='dark'] .payment-summary-empty) {
  color: #a3b3ae;
}

:global(.app-shell[data-theme='dark'] .payment-summary-lines),
:global(.app-shell[data-theme='dark'] .payment-total),
:global(.app-shell[data-theme='dark'] .payment-summary-footnote) {
  border-color: #354741;
}

:global(.app-shell[data-theme='dark'] .payment-visit-label) {
  color: #a3b3ae;
}

:global(.app-shell[data-theme='dark'] .payment-summary-empty) {
  border-color: #40534b;
  background: #202e2a;
  color: #c1d0c9;
}

:global(.app-shell[data-theme='dark'] .payment-alert-success) {
  border-color: #3d5d49;
  background: #263a2f;
  color: #c5e7d6;
}

:global(.app-shell[data-theme='dark'] .payment-alert-info) {
  border-color: #3c5260;
  background: #26343b;
  color: #c4dce6;
}

:global(.app-shell[data-theme='dark'] .payment-field select),
:global(.app-shell[data-theme='dark'] .payment-field input),
:global(.app-shell[data-theme='dark'] .payment-plan-options label),
:global(.app-shell[data-theme='dark'] .payment-method-details img) {
  border-color: #496258;
  background: #202f29;
  color: #e0ece5;
}

:global(.app-shell[data-theme='dark'] .payment-field),
:global(.app-shell[data-theme='dark'] .payment-field em),
:global(.app-shell[data-theme='dark'] .payment-method-details > p > strong) {
  color: #c9ded1;
}

:global(.app-shell[data-theme='dark'] .payment-plan-options strong) {
  color: #9ed5b5;
}

:global(.app-shell[data-theme='dark'] .payment-section .data-table th) {
  border-color: #354741;
  background: #263630;
  color: #c1d0c9;
}

:global(.app-shell[data-theme='dark'] .payment-section .data-table td) {
  border-color: #354741;
  color: #d2dfd8;
}

:global(.app-shell[data-theme='dark'] .payment-balance-action) {
  border-color: #4c795f;
  background: #294b36;
  color: #dff3e5;
}

:global(.app-shell[data-theme='dark'] .payment-balance-action:hover) {
  border-color: #70a985;
  background: #315940;
}

:global(.app-shell[data-theme='dark'] .payment-review-note) {
  color: #f0d48b;
}

:global(.app-shell[data-theme='dark'] .payment-section .table-secondary) {
  color: #a3b3ae;
}

:global(.app-shell[data-theme='dark'] .payment-section .status-badge[data-status='pending']),
:global(.app-shell[data-theme='dark'] .payment-section .status-badge[data-status='pending verification']),
:global(.app-shell[data-theme='dark'] .payment-section .status-badge[data-status='unpaid']) {
  border-color: #806b3e;
  background: #403821;
  color: #f0d48b;
}

:global(.app-shell[data-theme='dark'] .payment-section .status-badge[data-status='verified']),
:global(.app-shell[data-theme='dark'] .payment-section .status-badge[data-status='paid']) {
  border-color: #426d55;
  background: #244231;
  color: #a4e2ba;
}

:global(.app-shell[data-theme='dark'] .payment-section .status-badge[data-status='rejected']),
:global(.app-shell[data-theme='dark'] .payment-section .status-badge[data-status='payment rejected']) {
  border-color: #754849;
  background: #40272a;
  color: #f0a6a6;
}

:global(.app-shell[data-theme='dark'] .payment-section .payment-receipts-link),
:global(.app-shell[data-theme='dark'] .payment-section .appointment-card a) {
  color: #9cdbb4;
}

:global(.app-shell[data-theme='dark'] .payment-history-item) {
  border-color: #3a5047;
  background: #202e28;
}

:global(.app-shell[data-theme='dark'] .payment-history-item:hover) {
  border-color: #5d9c7d;
  background: #26382e;
}

:global(.app-shell[data-theme='dark'] .payment-history-details strong) {
  color: #e4ede9;
}

:global(.app-shell[data-theme='dark'] .payment-history-details p) {
  color: #b2c2bb;
}

:global(.app-shell[data-theme='dark'] .payment-history-receipt),
:global(.app-shell[data-theme='dark'] .payment-history-receipt:hover) {
  color: #9cdbb4;
}

@media (max-width: 900px) {
  .payment-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .payment-summary {
    position: static;
    grid-row: 1;
  }
}

@media (max-width: 520px) {
  .payment-history-item {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px 12px;
  }

  .payment-history-details {
    grid-column: 1 / -1;
  }

  .payment-history-item .status-badge {
    justify-self: start;
  }
}

@media (max-width: 600px) {
  .payment-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .payment-card,
  .payment-summary,
  .payment-section {
    padding: 18px;
  }

  .payment-card-heading,
  .payment-section-heading {
    flex-wrap: wrap;
  }

  .payment-actions {
    flex-direction: column;
  }

  .payment-actions .button {
    width: 100%;
  }

  .payment-section .data-table {
    min-width: 610px;
  }
}
</style>
