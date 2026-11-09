<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, apiRequest } from '../services/api'
import UiIcon from '../components/UiIcon.vue'

const router = useRouter()
const form = reactive({ username: '', email: '', password: '', first_name: '', last_name: '' })
const busy = ref(false)
const error = ref('')
const message = ref('')
const emailSent = ref(false)
const passwordVisible = ref(false)

async function submit() {
  busy.value = true
  error.value = ''
  message.value = ''
  emailSent.value = false
  form.email = form.email.trim().toLowerCase()

  try {
    const result = await apiRequest<{
      data: { message: string; email: string; email_sent: boolean }
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(form),
    })

    message.value = result.data.message
    emailSent.value = result.data.email_sent
    sessionStorage.setItem('medicare_verify_email', result.data.email)
    await router.push({
      path: '/verify-email',
      query: { email: result.data.email, delivery: result.data.email_sent ? 'sent' : 'failed' },
    })
  } catch (cause) {
    const message = cause instanceof ApiError ? cause.message : 'We could not create your account right now. Please try again.'
    if (/already registered and verified/i.test(message)) {
      await router.replace({ path: '/login', query: { notice: 'already-verified' } })
      return
    }
    error.value = message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="signup-page">
    <div class="signup-layout">
      <section class="signup-welcome">
        <RouterLink class="brand signup-brand" to="/"><span class="brand-mark" aria-hidden="true"><UiIcon name="plus" /></span><span>MediCare<span class="brand-accent">+</span></span></RouterLink>
        <div class="signup-welcome-copy">
          <span class="signup-kicker"><i></i> YOUR DENTAL CARE, MADE SIMPLE</span>
          <h1>A healthier smile starts with a little connection.</h1>
          <p>Create your patient account to book appointments, keep track of your visits, and reach your clinic in one secure place.</p>
          <div class="signup-benefits">
            <div><span>01</span><p><strong>Book with ease</strong><small>Find a service and a time that works for you.</small></p></div>
            <div><span>02</span><p><strong>Keep care close</strong><small>See your appointments and visit history.</small></p></div>
            <div><span>03</span><p><strong>Stay in touch</strong><small>Get helpful updates from your clinic.</small></p></div>
          </div>
        </div>
        <div class="signup-secure"><span><UiIcon name="shield-check" /></span><p><strong>Your information is treated with care</strong><small>We’ll use your email to verify your account.</small></p></div>
        <div class="signup-orbit signup-orbit-one"></div><div class="signup-orbit signup-orbit-two"></div>
      </section>

      <section class="signup-panel">
        <form class="signup-card" @submit.prevent="submit">
          <div class="signup-card-heading"><p class="eyebrow">PATIENT REGISTRATION</p><h2>Create your account</h2><p>It only takes a minute. You can complete your email verification next.</p></div>

          <div class="signup-form-grid">
            <label class="signup-field"><span>First name</span><input v-model.trim="form.first_name" required maxlength="50" autocomplete="given-name" placeholder="e.g. Alex"></label>
            <label class="signup-field"><span>Last name</span><input v-model.trim="form.last_name" required maxlength="50" autocomplete="family-name" placeholder="e.g. Santos"></label>
            <label class="signup-field"><span>Username</span><input v-model.trim="form.username" required minlength="3" maxlength="50" pattern="[A-Za-z0-9._-]{3,50}" title="Use 3–50 letters, numbers, dots, underscores, or hyphens." autocomplete="username" placeholder="Choose a username"><small>3–50 characters; letters, numbers, . _ or -</small></label>
            <label class="signup-field"><span>Email address</span><input v-model.trim="form.email" required type="email" maxlength="100" autocomplete="email" placeholder="you@example.com"><small>We’ll send your verification code here.</small></label>
            <label class="signup-field signup-field-wide"><span>Password</span><div class="signup-password"><input v-model="form.password" required :type="passwordVisible ? 'text' : 'password'" minlength="8" autocomplete="new-password" placeholder="At least 8 characters"><button type="button" :aria-label="passwordVisible ? 'Hide password' : 'Show password'" @click="passwordVisible=!passwordVisible">{{ passwordVisible ? 'Hide' : 'Show' }}</button></div><small>Use at least 8 characters. A mix of letters and numbers is easier to remember and harder to guess.</small></label>
          </div>

          <p v-if="error" class="signup-message error" role="alert">{{ error }}</p>
          <p v-if="message" class="signup-message" :class="emailSent ? 'success' : 'error'" role="status">{{ message }}</p>
          <button class="button button-primary signup-submit" type="submit" :disabled="busy"><span>{{ busy ? 'Creating your account…' : 'Create patient account' }}</span><UiIcon name="arrow-right" /></button>
          <p class="signup-signin">Already have an account? <RouterLink to="/login">Sign in</RouterLink></p>
          <p class="signup-terms">By creating an account, you agree to use this service for your own care and keep your sign-in details private.</p>
        </form>
        <footer class="signup-footer">© MediCare+ <span>·</span> Here for your healthier smile.</footer>
      </section>
    </div>
  </main>
</template>

<style scoped>
.signup-page{min-height:100vh;background:#f7f9fc;color:#293b52}
.signup-layout{display:grid;min-height:100vh;grid-template-columns:minmax(330px,.83fr) minmax(540px,1.17fr)}
.signup-welcome{position:relative;display:flex;min-height:100vh;flex-direction:column;justify-content:space-between;overflow:hidden;padding:clamp(28px,4vw,58px);background:radial-gradient(ellipse at 88% 12%,rgba(119,198,170,.24),transparent 35%),linear-gradient(145deg,#153e4c,#1a5260 58%,#317c70);color:#fff}
.signup-brand{z-index:1;align-self:flex-start;color:#f4fffc}
.signup-brand .brand-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,#92d7bd,#a89be5)}
.signup-brand .brand-accent{color:#91dfc6}
.signup-welcome-copy{position:relative;z-index:1;max-width:510px;margin:auto 0;padding:62px 0}
.signup-kicker{display:flex;align-items:center;gap:9px;color:#a9e1d1;font-size:10.8px;font-weight:750;letter-spacing:1.15px}
.signup-kicker i{width:7px;height:7px;border-radius:50%;background:#83d2b4;box-shadow:0 0 0 5px rgba(131,210,180,.13)}
.signup-welcome h1{max-width:480px;margin:23px 0 13px;color:#fff;font-size:clamp(32px,4vw,48px);font-weight:720;letter-spacing:-1.7px;line-height:1.08}
.signup-welcome-copy>p{max-width:440px;margin:0;color:#c8dadd;font-size:15.1px;line-height:1.8}
.signup-benefits{display:grid;gap:17px;margin-top:34px}
.signup-benefits>div{display:flex;align-items:center;gap:13px}
.signup-benefits>div>span{display:grid;width:33px;height:33px;flex:none;place-items:center;border:1px solid rgba(190,233,218,.22);border-radius:11px;background:rgba(255,255,255,.07);color:#a9e1d1;font-size:10.8px;font-weight:750}
.signup-benefits p,.signup-secure p{display:grid;gap:2px;margin:0}
.signup-benefits strong,.signup-secure strong{color:#f6fffc;font-size:13px;font-weight:650}
.signup-benefits small,.signup-secure small{color:#bed3d7;font-size:11.9px;line-height:1.5}
.signup-secure{position:relative;z-index:1;display:flex;align-items:center;gap:11px;padding-top:20px;border-top:1px solid rgba(255,255,255,.16)}
.signup-secure>span{display:grid;width:32px;height:32px;place-items:center;border-radius:50%;background:rgba(150,220,190,.16);color:#9de0c5;font-size:17.3px}
.signup-orbit{position:absolute;pointer-events:none;border:1px solid rgba(205,241,226,.08);border-radius:50%}
.signup-orbit-one{right:-170px;top:19%;width:420px;height:420px}
.signup-orbit-two{right:-110px;top:25%;width:300px;height:300px}
.signup-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:44px clamp(28px,6vw,92px)}
.signup-card{width:min(580px,100%);padding:0;border:0;background:transparent}
.signup-card-heading{margin-bottom:27px}
.signup-card-heading .eyebrow{margin:0 0 8px;color:#438d75;font-size:10.8px;letter-spacing:1.2px}
.signup-card-heading h2{margin:0 0 7px;color:#263b52;font-size:32.4px;font-weight:730;letter-spacing:-.8px}
.signup-card-heading>p:last-child{margin:0;color:#7e8ca0;font-size:13px;line-height:1.6}
.signup-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 15px}
.signup-field{display:grid;min-width:0;gap:7px;color:#465b70;font-size:11.9px;font-weight:650}
.signup-field>span{color:#40556b}
.signup-field input{width:100%;height:44px;min-width:0;padding:0 12px;border:1px solid #e0e7ee;border-radius:10px;background:#fff;color:#293b52;font:inherit;font-size:13px;font-weight:450;transition:border-color .16s,box-shadow .16s}
.signup-field input::placeholder{color:#a4afbd}
.signup-field input:focus{border-color:#78b79a;outline:0;box-shadow:0 0 0 3px rgba(67,141,117,.12)}
.signup-field small{color:#8a97a7;font-size:9.7px;font-weight:450;line-height:1.45}
.signup-field-wide{grid-column:1/-1}
.signup-password{position:relative}
.signup-password input{padding-right:60px}
.signup-password button{position:absolute;top:50%;right:11px;transform:translateY(-50%);padding:5px;border:0;background:transparent;color:#438d75;cursor:pointer;font-size:10.8px;font-weight:700}
.signup-message{margin:15px 0 0;padding:10px 12px;border-radius:9px;font-size:11.9px;line-height:1.5}
.signup-message.error{border:1px solid #f2d8d8;background:#fff7f6;color:#a44548}
.signup-message.success{border:1px solid #d5ecdc;background:#f2faf4;color:#397650}
.signup-submit{display:flex;width:100%;min-height:47px;justify-content:space-between;margin-top:21px;padding:0 16px 0 18px;border-radius:11px;background:#438d75;color:white;font-size:13px}
.signup-submit:hover:not(:disabled){background:#33745e}
.signup-submit span:last-child{font-size:18.4px;transition:transform .16s}
.signup-submit:hover span:last-child{transform:translateX(3px)}
.signup-signin{margin:17px 0 0;color:#78879a;font-size:11.9px;text-align:center}
.signup-signin a{margin-left:3px;color:#347b63;font-weight:700}
.signup-terms{max-width:450px;margin:22px auto 0;color:#9aa5b2;font-size:9.7px;line-height:1.6;text-align:center}
.signup-footer{margin-top:28px;color:#a1adba;font-size:10.8px}
.signup-footer span{padding:0 5px;color:#6aad8c}
@media(max-width:900px){.signup-layout{grid-template-columns:minmax(270px,.72fr) minmax(430px,1.28fr)}.signup-welcome{padding:30px}.signup-welcome h1{font-size:38.9px}.signup-panel{padding:36px 32px}}
@media(max-width:700px){.signup-layout{grid-template-columns:1fr}.signup-welcome{min-height:auto;padding:23px 23px 26px}.signup-welcome-copy{padding:37px 0 26px}.signup-welcome h1{max-width:520px;margin:16px 0 9px;font-size:34.6px}.signup-welcome-copy>p{font-size:13px}.signup-benefits{grid-template-columns:1fr 1fr;gap:12px;margin-top:21px}.signup-benefits>div:last-child{display:none}.signup-benefits small{font-size:10.8px}.signup-secure{padding-top:14px}.signup-secure>span{width:28px;height:28px}.signup-panel{padding:32px 22px 25px}.signup-card-heading{margin-bottom:22px}.signup-card-heading h2{font-size:28.1px}.signup-footer{margin-top:22px}}
@media(max-width:430px){.signup-form-grid{grid-template-columns:1fr;gap:14px}.signup-field-wide{grid-column:auto}.signup-welcome{padding:20px}.signup-welcome h1{font-size:31.3px}.signup-benefits{grid-template-columns:1fr}.signup-benefits>div:last-child{display:flex}.signup-panel{padding:28px 19px}.signup-field input{height:46px}}
</style>
