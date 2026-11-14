<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, apiRequest } from '../services/api'
import UiIcon from '../components/UiIcon.vue'
import { notify } from '../services/toast'

const router = useRouter()
const form = reactive({ username: '', email: '', password: '', first_name: '', last_name: '' })
const busy = ref(false)
const error = ref('')
const message = ref('')
const emailSent = ref(false)
const passwordVisible = ref(false)
const passwordStrength = computed(() => {
  const password = form.password
  const score = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password) && /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length
  const level = score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong'
  const label = !password ? 'Not set' : level.charAt(0).toUpperCase() + level.slice(1)
  return { score, level, label }
})

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
    notify.success(result.data.message, 'Account created')
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
    notify.error(error.value, 'Registration failed')
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

          <h1>Your smile<br><span class="brand-accent">starts here.</span></h1>
          <div class="signup-benefits">


          </div>
        </div>
        <div class="signup-secure"><span><UiIcon name="shield-check" /></span><p><strong>Private by better smile</strong><small>Email verification keeps your account secure.</small></p></div>
        <div class="signup-orbit signup-orbit-one"></div><div class="signup-orbit signup-orbit-two"></div>
      </section>

      <section class="signup-panel">
        <form class="signup-card" @submit.prevent="submit">
          <div class="signup-card-heading"><p class="eyebrow">PATIENT REGISTRATION</p><h2>Create your account</h2><p>Your care journey starts with a few details.</p></div>

          <div class="signup-form-grid">
            <label class="signup-field"><span>First name</span><input v-model.trim="form.first_name" required maxlength="50" autocomplete="given-name" placeholder="e.g. Alex"></label>
            <label class="signup-field"><span>Last name</span><input v-model.trim="form.last_name" required maxlength="50" autocomplete="family-name" placeholder="e.g. Santos"></label>
            <label class="signup-field"><span>Username</span><input v-model.trim="form.username" required minlength="3" maxlength="50" pattern="[A-Za-z0-9._-]{3,50}" title="Use 3–50 letters, numbers, dots, underscores, or hyphens." autocomplete="username" placeholder="Choose a username"></label>
            <label class="signup-field"><span>Email address</span><input v-model.trim="form.email" required type="email" maxlength="100" autocomplete="email" placeholder="you@example.com"></label>
            <div class="signup-field signup-field-wide">
              <label class="signup-field-label" for="signup-password"><span>Password</span></label>
              <div class="signup-password">
                <input id="signup-password" v-model="form.password" required :type="passwordVisible ? 'text' : 'password'" minlength="8" autocomplete="new-password" placeholder="Create a strong password" aria-describedby="signup-password-hint signup-password-strength">
                <button type="button" :aria-label="passwordVisible ? 'Hide password' : 'Show password'" @click="passwordVisible=!passwordVisible"><UiIcon :name="passwordVisible ? 'eye-off' : 'eye'" /></button>
              </div>
              <div class="signup-strength" :class="`is-${passwordStrength.level}`">
                <div class="signup-strength-bars" aria-hidden="true">
                  <span v-for="index in 4" :key="index" :class="index <= passwordStrength.score ? 'is-filled' : ''"></span>
                </div>
                <span id="signup-password-strength" class="signup-strength-label" aria-live="polite">{{ passwordStrength.label }}</span>
              </div>
              <small id="signup-password-hint">8+ characters · mix letters, numbers &amp; symbols</small>
            </div>
          </div>

          <p v-if="error" class="signup-message error" role="alert">{{ error }}</p>
          <p v-if="message" class="signup-message" :class="emailSent ? 'success' : 'error'" role="status">{{ message }}</p>
          <button class="button button-primary signup-submit" :class="{ 'is-loading': busy }" type="submit" :disabled="busy" :aria-busy="busy"><span>{{ busy ? 'Creating your account…' : 'Create patient account' }}</span><UiIcon name="arrow-right" /></button>
          <p class="signup-signin">Already have an account? <RouterLink to="/login">Sign in</RouterLink></p>
          <p class="signup-terms">By joining, you agree to keep your account details private.</p>
        </form>
        <footer class="signup-footer">© MediCare+ <span>·</span> Here for your smile.</footer>
      </section>
    </div>
  </main>
</template>

<style scoped>
.signup-page{min-height:100vh;background:#f4f7fa;color:#293b52}
.signup-layout{display:grid;min-height:100vh;grid-template-columns:minmax(330px,.83fr) minmax(540px,1.17fr);overflow:hidden}
.signup-welcome{position:relative;display:flex;min-height:100vh;flex-direction:column;justify-content:space-between;overflow:hidden;padding:clamp(28px,4vw,58px);background:radial-gradient(ellipse at 88% 12%,rgba(119,198,170,.24),transparent 35%),linear-gradient(145deg,#153e4c,#1a5260 58%,#317c70);color:#fff}
.signup-welcome{animation:signup-welcome-enter .72s cubic-bezier(.2,.8,.2,1) both}
.signup-brand{z-index:1;align-self:flex-start;color:#f4fffc}
.signup-brand .brand-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,#92d7bd,#a89be5)}
.signup-brand .brand-accent{color:#91dfc6}
.signup-welcome-copy{position:relative;z-index:1;max-width:510px;margin:auto 0;padding:62px 0}
.signup-kicker{display:flex;align-items:center;gap:9px;color:#a9e1d1;font-size:10.8px;font-weight:750;letter-spacing:1.15px}
.signup-kicker i{width:7px;height:7px;border-radius:50%;background:#83d2b4;box-shadow:0 0 0 5px rgba(131,210,180,.13)}
.signup-welcome h1{max-width:480px;margin:17px 0 13px;color:#fff;font-size:clamp(38px,4.4vw,58px);font-weight:760;letter-spacing:-2px;line-height:1.02}
.signup-welcome-copy>p{max-width:440px;margin:0;color:#c8dadd;font-size:15.1px;line-height:1.8}
.signup-benefits{display:grid;gap:14px;margin-top:30px}
.signup-benefits>div{display:flex;align-items:center;gap:13px}
.signup-benefits>div>span{display:grid;width:33px;height:33px;flex:none;place-items:center;border:1px solid rgba(190,233,218,.22);border-radius:11px;background:rgba(255,255,255,.07);color:#a9e1d1;font-size:10.8px;font-weight:750}
.signup-benefits p,.signup-secure p{display:grid;gap:2px;margin:0}
.signup-benefits strong,.signup-secure strong{color:#f6fffc;font-size:13px;font-weight:700}
.signup-benefits small,.signup-secure small{color:#bed3d7;font-size:11.9px;line-height:1.5}
.signup-secure{position:relative;z-index:1;display:flex;align-items:center;gap:11px;padding-top:20px;border-top:1px solid rgba(255,255,255,.16)}
.signup-secure>span{display:grid;width:32px;height:32px;place-items:center;border-radius:50%;background:rgba(150,220,190,.16);color:#9de0c5;font-size:17.3px}
.signup-orbit{position:absolute;pointer-events:none;border:1px solid rgba(205,241,226,.08);border-radius:50%}
.signup-orbit-one{right:-170px;top:19%;width:420px;height:420px}
.signup-orbit-two{right:-110px;top:25%;width:300px;height:300px}
.signup-panel{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:38px clamp(28px,5vw,76px);background:radial-gradient(ellipse at 82% 18%,rgba(124,194,167,.13),transparent 30%),#f4f7fa;animation:signup-panel-enter .72s .08s cubic-bezier(.2,.8,.2,1) both}
.signup-card{position:relative;z-index:1;width:min(590px,100%);animation:signup-card-enter .6s .24s cubic-bezier(.2,.8,.2,1) both}
.signup-card-heading{margin-bottom:22px}
.signup-card-heading .eyebrow{margin:0 0 8px;color:#438d75;font-size:10.8px;letter-spacing:1.2px}
.signup-card-heading h2{margin:0 0 6px;color:#263b52;font-size:clamp(27px,3vw,34px);font-weight:760;letter-spacing:-1px}
.signup-card-heading>p:last-child{margin:0;color:#7e8ca0;font-size:13px;line-height:1.6}
.signup-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 14px}
.signup-field{display:grid;min-width:0;gap:7px;color:#465b70;font-size:11.9px;font-weight:650}
.signup-field>span{color:#40556b}
.signup-field-label{color:#40556b}
.signup-field input{width:100%;height:44px;min-width:0;padding:0 12px;border:1px solid #e0e7ee;border-radius:10px;background:#fff;color:#293b52;font:inherit;font-size:13px;font-weight:450;transition:border-color .16s,box-shadow .16s}
.signup-field input::placeholder{color:#a4afbd}
.signup-field input:focus{border-color:#78b79a;outline:0;box-shadow:0 0 0 3px rgba(67,141,117,.12)}
.signup-field small{color:#8a97a7;font-size:9.7px;font-weight:450;line-height:1.45}
.signup-field-wide{grid-column:1/-1}
.signup-password{position:relative}
.signup-password input{padding-right:48px}
.signup-password button{position:absolute;top:50%;right:8px;display:grid;width:34px;height:34px;transform:translateY(-50%);place-items:center;border:0;border-radius:8px;background:transparent;color:#438d75;cursor:pointer}
.signup-password button:hover{background:#edf7f2}
.signup-password button svg{width:17px;height:17px}
.signup-strength{display:flex;align-items:center;gap:10px;margin-top:1px}
.signup-strength-bars{display:grid;flex:1;grid-template-columns:repeat(4,1fr);gap:5px}
.signup-strength-bars span{height:4px;border-radius:99px;background:#e4e9ed;transition:background .22s ease,transform .22s ease}
.signup-strength-bars span.is-filled{transform:scaleY(1.25)}
.signup-strength.is-weak .signup-strength-bars span.is-filled{background:#e2746c}
.signup-strength.is-fair .signup-strength-bars span.is-filled{background:#e2aa52}
.signup-strength.is-good .signup-strength-bars span.is-filled{background:#70ad82}
.signup-strength.is-strong .signup-strength-bars span.is-filled{background:#438d75}
.signup-strength-label{min-width:48px;color:#82909d;font-size:10px;font-weight:700;text-align:right}
.signup-strength.is-weak .signup-strength-label{color:#c25f59}
.signup-strength.is-fair .signup-strength-label{color:#b17b27}
.signup-strength.is-good .signup-strength-label{color:#538961}
.signup-strength.is-strong .signup-strength-label{color:#347b63}
.signup-field>small{font-size:9.5px}
.signup-message{margin:15px 0 0;padding:10px 12px;border-radius:9px;font-size:11.9px;line-height:1.5}
.signup-message.error{border:1px solid #f2d8d8;background:#fff7f6;color:#a44548}
.signup-message.success{border:1px solid #d5ecdc;background:#f2faf4;color:#397650}
.signup-submit{position:relative;display:flex;width:100%;min-height:49px;justify-content:space-between;margin-top:19px;padding:0 16px 0 18px;border-radius:11px;background:linear-gradient(100deg,#438d75,#36836b);color:white;font-size:13px;box-shadow:0 8px 18px rgba(48,126,99,.17);transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
.signup-submit:hover:not(:disabled){background:#33745e}
.signup-submit span:last-child{font-size:18.4px;transition:transform .16s}
.signup-submit:hover span:last-child{transform:translateX(3px)}
.signup-submit:active:not(:disabled){transform:translateY(1px) scale(.985);box-shadow:0 3px 9px rgba(48,126,99,.2)}
.signup-submit.is-loading::after{width:15px;height:15px;margin-left:auto;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;content:'';animation:signup-submit-spin .7s linear infinite}
.signup-submit.is-loading svg{display:none}
.signup-signin{margin:17px 0 0;color:#78879a;font-size:11.9px;text-align:center}
.signup-signin a{margin-left:3px;color:#347b63;font-weight:700}
.signup-terms{max-width:450px;margin:16px auto 0;color:#9aa5b2;font-size:9.7px;line-height:1.6;text-align:center}
.signup-footer{margin-top:28px;color:#a1adba;font-size:10.8px}
.signup-footer span{padding:0 5px;color:#6aad8c}
@keyframes signup-welcome-enter{from{opacity:0;transform:translateX(-22px);clip-path:inset(0 12% 0 0)}to{opacity:1;transform:translateX(0);clip-path:inset(0)}}
@keyframes signup-panel-enter{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
@keyframes signup-card-enter{from{opacity:0;transform:translateY(15px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes signup-submit-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.signup-welcome,.signup-panel,.signup-card{animation:none}.signup-submit,.signup-submit span:last-child{transition:none}.signup-submit.is-loading::after{animation-duration:1.5s}}
@media(max-width:900px){.signup-layout{grid-template-columns:minmax(270px,.72fr) minmax(430px,1.28fr)}.signup-welcome{padding:30px}.signup-welcome h1{font-size:38.9px}.signup-panel{padding:36px 32px}}
@media(max-width:700px){.signup-layout{grid-template-columns:1fr}.signup-welcome{min-height:auto;padding:23px 23px 26px}.signup-welcome-copy{padding:37px 0 26px}.signup-welcome h1{max-width:520px;margin:16px 0 9px;font-size:34.6px}.signup-benefits{grid-template-columns:1fr 1fr;gap:12px;margin-top:21px}.signup-benefits small{font-size:10.8px}.signup-secure{padding-top:14px}.signup-secure>span{width:28px;height:28px}.signup-panel{padding:32px 22px 25px}.signup-card-heading{margin-bottom:22px}.signup-card-heading h2{font-size:28.1px}.signup-footer{margin-top:22px}}
@media(max-width:430px){.signup-form-grid{grid-template-columns:1fr;gap:14px}.signup-field-wide{grid-column:auto}.signup-welcome{padding:20px}.signup-welcome h1{font-size:31.3px}.signup-benefits{grid-template-columns:1fr}.signup-benefits>div:last-child{display:flex}.signup-panel{padding:28px 19px}.signup-field input{height:46px}.signup-password button{width:48px;height:48px}}
:global(html[data-theme='dark'] .signup-page){background:#17231f;color:#e4ede9}
:global(html[data-theme='dark'] .signup-panel){background:radial-gradient(ellipse at 82% 18%,rgba(93,165,133,.13),transparent 30%),#17231f}
:global(html[data-theme='dark'] .signup-card-heading h2),
:global(html[data-theme='dark'] .signup-field>span),
:global(html[data-theme='dark'] .signup-field-label){color:#e4ede9}
:global(html[data-theme='dark'] .signup-card-heading>p:last-child),
:global(html[data-theme='dark'] .signup-signin){color:#a7b8b0}
:global(html[data-theme='dark'] .signup-field input){border-color:#40564c;background:#24372f;color:#e4ede9}
:global(html[data-theme='dark'] .signup-field input::placeholder){color:#83968c}
:global(html[data-theme='dark'] .signup-password button:hover){background:#30483c}
:global(html[data-theme='dark'] .signup-strength-bars span){background:#405249}
:global(html[data-theme='dark'] .signup-terms),
:global(html[data-theme='dark'] .signup-footer){color:#879b91}
:global(html[data-theme='dark'] .signup-signin a){color:#9ed5bd}
@media(max-width:700px){.signup-panel{background:#f4f7fa}}
</style>
