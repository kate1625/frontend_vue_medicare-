<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, getPortalRole, signIn } from '../services/api'
import UiIcon from '../components/UiIcon.vue'

const identity = ref('')
const password = ref('')
const passwordVisible = ref(false)
const error = ref('')
const pending = ref(false)
const showNotice = ref(false)
const mascotMessage = ref('')
const mascotMessageIndex = ref(0)
const route = useRoute()
const router = useRouter()
let noticeTimer: number | undefined
let mascotTimer: number | undefined

const mascotMessages = [
  'Hi, I’m Totooth! Ready for a brighter smile?',
  'A healthy smile starts with a little care every day.',
  'Book your next dental visit when you are ready!',
  'Remember to brush gently for two minutes.',
  'Flossing helps keep those hidden spaces clean.',
  'Your smile deserves a little extra love today.',
  'Do not forget your regular dental checkup.',
  'Small habits make a big difference for your teeth.',
  'I am here to make your clinic visit feel easier.',
  'Keep smiling—you are doing great!',
]

onMounted(() => {
  showNotice.value = route.query.notice === 'registered' || route.query.notice === 'already-verified'
  if (showNotice.value) {
    noticeTimer = window.setTimeout(() => {
      showNotice.value = false
    }, 7000)
  }
})

onBeforeUnmount(() => {
  if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
  if (mascotTimer !== undefined) window.clearTimeout(mascotTimer)
})

function dismissNotice() {
  showNotice.value = false
  if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
}

function speakMascot() {
  mascotMessage.value = mascotMessages[mascotMessageIndex.value]
  mascotMessageIndex.value = (mascotMessageIndex.value + 1) % mascotMessages.length
  if (mascotTimer !== undefined) window.clearTimeout(mascotTimer)
  mascotTimer = window.setTimeout(() => {
    mascotMessage.value = ''
  }, 4200)
}

async function submit() {
  error.value = ''
  pending.value = true
  try {
    const user = await signIn(identity.value.trim(), password.value)
    const role = getPortalRole()
    const defaultPortal = role === 'patient' ? '/patient/dashboard' : role === 'admin' ? '/admin/dashboard' : '/staff/dashboard'
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : defaultPortal
    await router.replace(role === 'patient' && !user.is_verified ? '/settings/profile' : redirect)
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Unable to sign in. Please try again.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <Transition name="login-notice">
      <div v-if="showNotice" class="login-notice-toast" role="status" aria-live="polite">
        <span class="login-notice-icon" aria-hidden="true"><UiIcon name="check-circle" /></span>
        <span class="login-notice-copy">
          <strong>{{ route.query.notice === 'registered' ? 'Account registered successfully' : 'Email already verified' }}</strong>
          <small>{{ route.query.notice === 'registered' ? 'Your email is verified. Sign in to get started.' : 'Your account is ready. Sign in to continue.' }}</small>
        </span>
        <button class="login-notice-close" type="button" aria-label="Dismiss notification" @click="dismissNotice"><UiIcon name="x" /></button>
      </div>
    </Transition>
    <section class="login-intro">
      <RouterLink class="brand login-brand" to="/">
        <span class="brand-mark" aria-hidden="true"><UiIcon name="plus" /></span>
        <span>MediCare<span class="brand-accent">+</span></span>
      </RouterLink>
      <div class="login-story">
        <div class="login-message">
          <h1>Your Companion<span> Dental Clinic</span></h1>
          <div class="login-feature-points" aria-label="What you can do">
            <span><UiIcon name="calendar-plus" /> Book appointments</span>
            <span><UiIcon name="clipboard-list" /> Review care records</span>
            <span><UiIcon name="message-circle" /> Message your clinic</span>
          </div>
        </div>
        <div class="login-visual" aria-hidden="true">
          <div class="login-orbit login-orbit-one"></div>
          <div class="login-orbit login-orbit-two"></div>
          <div class="login-care-card">
            <div class="login-care-heading">
              <span class="login-care-mark"><UiIcon name="heart" /></span>
              <span>YOUR CARE, CONNECTED</span>
            </div>
            <div class="login-care-items">
              <span><UiIcon name="calendar" /> Appointments</span>
              <span><UiIcon name="clipboard-list" /> Care records</span>
              <span><UiIcon name="message-circle" /> Clinic messages</span>
            </div>
            <div class="login-heartbeat">
              <span>VISIT ACTIVITY</span>
              <svg viewBox="0 0 210 34" fill="none">
                <path class="login-heartbeat-line" d="M1 20h42l12-12 13 23 15-27 14 16h34l10-8 10 8h57" />
              </svg>
              <span class="login-activity-status"><i></i> UP TO DATE</span>
            </div>
          </div>
          <div class="login-float-card login-float-card-top"><UiIcon name="shield-check" /><span>Private &amp; secure</span></div>
          <div class="login-float-card login-float-card-bottom"><span class="login-status-dot"></span><span>Here for your smile</span></div>
        </div>
      </div>
      <p class="login-note">Secure access for patients and the clinic team.</p>
    </section>

    <section class="login-panel">
      <button class="login-mascot" type="button" aria-label="Talk to Totooth" @click="speakMascot">
        <span v-if="mascotMessage" class="login-mascot-bubble" role="status">{{ mascotMessage }}</span>
        <svg viewBox="0 0 64 58" fill="none">
          <path class="login-mascot-tooth" d="M17 9c5-5 10-3 15 0 5-3 10-5 15 0 7 7 4 17 2 24-2 7-3 15-8 15-4 0-5-7-9-7s-5 7-9 7c-5 0-6-8-8-15-2-7-5-17 2-24Z" />
          <path class="login-mascot-face" d="M25 25h1m12 0h1M28 32c3 3 6 3 9 0" />
          <path class="login-mascot-shadow" d="M14 54c10 3 26 3 37 0" />
        </svg>
        <span class="login-mascot-spark"></span>
      </button>
      <form class="login-form" @submit.prevent="submit">
        <p class="eyebrow">WELCOME BACK</p>
        <h2>Sign in to your account</h2>
        <p class="muted"></p>

        <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

        <label class="field">
          <span>Username or email</span>
          <input
            v-model="identity"
            autocomplete="username"
            required
            maxlength="255"
            placeholder="you@clinic.com"
          />
        </label>

        <label class="field">
          <span>Password</span>
          <div class="signup-password">
            <input
              v-model="password"
              :type="passwordVisible ? 'text' : 'password'"
              autocomplete="current-password"
              required
              placeholder="Enter your password"
            />
            <button type="button" @click="passwordVisible=!passwordVisible">{{ passwordVisible ? 'Hide' : 'Show' }}</button>
          </div>
        </label>

        <button class="button button-primary button-full" type="submit" :disabled="pending">
          {{ pending ? 'Signing in…' : 'Sign in' }}
        </button>
        <div class="auth-links"><RouterLink to="/register">Create a patient account</RouterLink><RouterLink to="/reset-password">Forgot password?</RouterLink></div>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-notice-toast{position:fixed;z-index:20;top:22px;right:24px;display:flex;width:min(410px,calc(100vw - 32px));align-items:center;gap:12px;padding:14px 14px 14px 16px;border:1px solid rgb(210 235 221 / 90%);border-radius:15px;background:rgb(255 255 255 / 94%);box-shadow:0 16px 42px rgb(29 58 53 / 16%);backdrop-filter:blur(16px)}
.login-notice-icon{display:grid;width:35px;height:35px;flex:none;place-items:center;border-radius:11px;background:#e4f6ed;color:#438d75;font-size:19.4px}
.login-notice-copy{display:grid;flex:1;gap:3px}
.login-notice-copy strong{color:#294a59;font-size:13px}
.login-notice-copy small{color:#718793;font-size:11.9px;line-height:1.45}
.login-notice-close{display:grid;width:30px;height:30px;flex:none;place-items:center;border:0;border-radius:9px;background:transparent;color:#84969a;cursor:pointer;font-size:17.3px}
.login-notice-close:hover{background:#f0f6f3;color:#34745f}
.login-notice-enter-active,.login-notice-leave-active{transition:opacity .24s ease,translate .24s ease}
.login-notice-enter-from,.login-notice-leave-to{opacity:0;translate:0 -8px}
.signup-password{position:relative}
.signup-password input{padding-right:60px}
.signup-password button{position:absolute;top:50%;right:11px;transform:translateY(-50%);padding:5px;border:0;background:transparent;color:#438d75;cursor:pointer;font-size:10.8px;font-weight:700}

.login-intro{position:relative;overflow:hidden;isolation:isolate}
.login-intro{background-size:190% 190%,150% 150%;animation:login-background-drift 26s ease-in-out infinite alternate}
.login-intro::before,.login-intro::after{position:absolute;z-index:-1;border:1px solid rgb(220 250 241 / 10%);border-radius:50%;content:'';pointer-events:none}
.login-intro::before{top:19%;right:-210px;width:490px;height:490px;animation:login-ring-drift 18s ease-in-out infinite alternate}
.login-intro::after{top:27%;right:-135px;width:340px;height:340px;animation:login-ring-drift 14s ease-in-out infinite alternate-reverse}
.login-story{width:100%;margin:auto 0;padding:30px 0}
.login-message{animation:login-reveal .7s cubic-bezier(.2,.7,.2,1) both}
.login-message h1 span{color:#a9e1d1}
.login-message>p:last-of-type{max-width:440px}
.login-feature-points{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.login-feature-points span{display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:0 10px;border:1px solid rgb(222 248 239 / 19%);border-radius:999px;background:rgb(245 255 251 / 7%);color:#e5f4ef;font-size:10.8px;font-weight:600;white-space:nowrap;animation:login-feature-reveal .55s both;transition:transform .2s ease,border-color .2s ease,background-color .2s ease}
.login-feature-points span:nth-child(1){animation-delay:.2s}
.login-feature-points span:nth-child(2){animation-delay:.35s}
.login-feature-points span:nth-child(3){animation-delay:.5s}
.login-feature-points span:hover{transform:translateY(-3px);border-color:rgb(222 248 239 / 38%);background:rgb(245 255 251 / 13%)}
.login-feature-points svg{color:#a9e1d1;font-size:14px}
.login-visual{position:relative;width:min(440px,100%);height:250px;margin:0 auto;animation:login-reveal .85s .12s cubic-bezier(.2,.7,.2,1) both}
.login-orbit{position:absolute;inset:24px 42px;border:1px solid rgb(218 248 238 / 12%);border-radius:50%;transform:rotate(-17deg)}
.login-orbit-one{animation:login-ring-drift 11s ease-in-out infinite alternate,login-orbit-turn 38s linear infinite}
.login-orbit-two{inset:42px 70px;transform:rotate(18deg);animation:login-ring-drift 9s ease-in-out infinite alternate-reverse,login-orbit-turn 29s linear infinite reverse}
.login-visual::before,.login-visual::after{position:absolute;z-index:2;width:6px;height:6px;border-radius:50%;background:#b9ead8;box-shadow:0 0 13px 3px rgb(185 234 216 / 30%);content:'';pointer-events:none}
.login-visual::before{top:43px;left:27px;animation:login-sparkle 3.8s ease-in-out infinite}
.login-visual::after{right:30px;bottom:29px;width:4px;height:4px;animation:login-sparkle 4.4s 1.1s ease-in-out infinite reverse}
.login-care-card{position:absolute;top:27px;left:50%;width:310px;overflow:hidden;padding:19px 20px;border:1px solid rgb(222 248 239 / 32%);border-radius:18px;background:rgb(245 255 251 / 19%);box-shadow:0 22px 55px rgb(4 31 38 / 24%);backdrop-filter:blur(11px);transform:translateX(-50%);animation:login-card-float 3.6s ease-in-out infinite,login-card-glow 4s ease-in-out infinite}
.login-care-card::after{position:absolute;inset:-30% auto -30% -55%;width:35%;background:linear-gradient(90deg,transparent,rgb(255 255 255 / 13%),transparent);content:'';pointer-events:none;animation:login-card-shimmer 7s 1s ease-in-out infinite}
.login-care-heading,.login-care-items{position:relative;z-index:1}
.login-care-heading{display:flex;align-items:center;gap:9px;color:#a9e5d4;font-size:9.7px;font-weight:750;letter-spacing:.8px}
.login-care-mark{display:grid;width:27px;height:27px;place-items:center;border-radius:9px;background:rgb(178 232 211 / 15%);color:#b1ead6;font-size:15.1px}
.login-care-items{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}
.login-care-items span{display:flex;align-items:center;gap:7px;min-height:32px;padding:0 9px;border:1px solid rgb(230 250 242 / 16%);border-radius:8px;background:rgb(255 255 255 / 7%);color:#e2f1ee;font-size:10.8px;white-space:nowrap;animation:login-item-arrive .65s both}
.login-care-items span:nth-child(1){animation-delay:.35s}
.login-care-items span:nth-child(2){animation-delay:.5s}
.login-care-items span:nth-child(3){animation-delay:.65s}
.login-care-items span:last-child{grid-column:1/-1}
.login-care-items svg{flex:none;color:#9cdeca;font-size:13px}
.login-care-mark svg{animation:login-heartbeat 2.6s 1.2s ease-in-out infinite}
.login-heartbeat{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px 10px;margin-top:14px;padding-top:11px;border-top:1px solid rgb(230 250 242 / 18%)}
.login-heartbeat>span:first-child{color:#b8dcd3;font-size:8.6px;font-weight:750;letter-spacing:.8px}
.login-heartbeat svg{width:100%;height:30px;overflow:visible}
.login-heartbeat-line{stroke:#a5e3ca;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:260;stroke-dashoffset:260;filter:drop-shadow(0 0 4px rgb(165 227 202 / 60%));animation:login-heartbeat-draw 2.8s ease-in-out infinite}
.login-activity-status{grid-column:1/-1;display:flex;align-items:center;gap:6px;color:#dcefe9;font-size:8.6px;font-weight:700;letter-spacing:.6px}
.login-activity-status i{width:6px;height:6px;border-radius:50%;background:#9ce1be;box-shadow:0 0 0 3px rgb(156 225 190 / 12%);animation:login-status-pulse 1.7s ease-out infinite}
.login-float-card{position:absolute;z-index:1;display:flex;align-items:center;gap:7px;padding:9px 11px;border:1px solid rgb(230 250 242 / 24%);border-radius:10px;background:#174c56;color:#e8f7f2;box-shadow:0 9px 24px rgb(4 31 38 / 17%);font-size:10.8px;font-weight:650;white-space:nowrap}
.login-float-card svg{color:#a4e1ca;font-size:14px}
.login-float-card-top{top:9px;right:0;animation:login-card-float 3.2s .3s ease-in-out infinite}
.login-float-card-bottom{bottom:7px;left:-54px;animation:login-card-float 3.8s .6s ease-in-out infinite reverse}
.login-status-dot{width:7px;height:7px;border-radius:50%;background:#9ce1be;box-shadow:0 0 0 4px rgb(156 225 190 / 12%)}
.login-float-card-bottom .login-status-dot{animation:login-status-pulse 2s ease-out infinite}
.login-note{animation:login-reveal .7s .42s both}
.login-form{width:min(420px,100%);animation:login-reveal .7s .08s cubic-bezier(.2,.7,.2,1) both}
.login-panel{position:relative;overflow:hidden}
.login-mascot{position:absolute;right:52px;bottom:30px;z-index:2;width:108px;height:102px;padding:0;border:0;background:transparent;color:#087f72;cursor:pointer;filter:drop-shadow(0 10px 12px rgb(5 104 91 / 35%));animation:login-mascot-crawl 9s ease-in-out infinite}
.login-mascot-bubble{position:absolute;right:72px;bottom:76px;width:190px;padding:10px 12px;border:2px solid #087f72;border-radius:14px 14px 4px 14px;background:#fff;color:#075e58;box-shadow:0 8px 20px rgb(5 104 91 / 22%);font-size:11px;font-weight:700;line-height:1.4;text-align:left;animation:login-mascot-bubble-in .22s ease-out both}
.login-mascot::before{position:absolute;inset:8px 2px 3px;border:3px solid #045d58;border-radius:48% 52% 43% 57% / 54% 43% 57% 46%;background:linear-gradient(145deg,#69f0c8 4%,#10b89d 52%,#05675f 100%);box-shadow:inset 12px 12px 18px rgb(219 255 243 / 62%),inset -12px -12px 18px rgb(0 63 61 / 38%),0 0 28px rgb(23 193 157 / 65%);content:'';animation:login-liquid-wobble 2.8s ease-in-out infinite}
.login-mascot::after{position:absolute;top:10px;left:13px;width:18px;height:8px;border-radius:50%;background:rgb(224 255 245 / 72%);content:'';filter:blur(1px);transform:rotate(-25deg);animation:login-liquid-shine 2.8s ease-in-out infinite}
.login-mascot svg{position:relative;z-index:1;display:block;width:100%;height:100%;overflow:visible}
.login-mascot-tooth{fill:#dffff4;fill-opacity:.78;stroke:#064f4e;stroke-width:2.2;stroke-linejoin:round;filter:drop-shadow(0 5px 5px rgb(3 83 73 / 20%))}
.login-mascot-face{stroke:#075e58;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.login-mascot-shadow{stroke:#4dbba3;stroke-width:2.5;stroke-linecap:round;opacity:.9}
.login-mascot-spark{position:absolute;top:1px;right:-5px;width:10px;height:10px;border-radius:50%;background:#f2bd52;box-shadow:0 0 0 5px rgb(242 189 82 / 25%),0 0 16px rgb(242 189 82 / 85%);animation:login-mascot-spark 2s ease-in-out infinite}
.login-form h2{font-size:29.2px}
.login-form .field{font-size:13px}
.login-form .field input{min-height:48px;font-size:14px}
.login-form .button{min-height:48px}
.login-form>.field{animation:login-reveal .6s both}
.login-form>.field:nth-of-type(1){animation-delay:.18s}
.login-form>.field:nth-of-type(2){animation-delay:.3s}
.login-form .field input,.login-form .signup-password button,.login-form .button{transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease,background-color .2s ease}
.login-form .field input:focus{transform:translateY(-1px)}
.login-form .button-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 9px 22px rgb(67 141 117 / 22%)}
.login-form .signup-password button:hover{transform:translateY(-50%) scale(1.04)}

@keyframes login-reveal{from{opacity:0;translate:0 14px}to{opacity:1;translate:0 0}}
@keyframes login-feature-reveal{from{opacity:0;translate:0 9px}to{opacity:1;translate:0 0}}
@keyframes login-card-float{0%,100%{translate:0 0}50%{translate:0 -12px}}
@keyframes login-card-glow{0%,100%{box-shadow:0 18px 42px rgb(4 31 38 / 20%)}50%{box-shadow:0 25px 58px rgb(4 31 38 / 31%),0 0 26px rgb(164 225 202 / 16%)}}
@keyframes login-ring-drift{from{translate:0 -5px;rotate:-2deg}to{translate:0 8px;rotate:3deg}}
@keyframes login-orbit-turn{to{rotate:360deg}}
@keyframes login-card-shimmer{0%,25%{left:-55%}60%,100%{left:125%}}
@keyframes login-sparkle{0%,100%{opacity:.25;scale:.65;translate:0 0}50%{opacity:1;scale:1.2;translate:4px -7px}}
@keyframes login-item-arrive{from{opacity:0;translate:0 8px}to{opacity:1;translate:0 0}}
@keyframes login-heartbeat{0%,35%,45%,100%{scale:1}40%,50%{scale:1.16}}
@keyframes login-heartbeat-draw{0%{stroke-dashoffset:260;opacity:.5}55%,100%{stroke-dashoffset:0;opacity:1}}
@keyframes login-status-pulse{0%{box-shadow:0 0 0 0 rgb(156 225 190 / 35%)}70%,100%{box-shadow:0 0 0 7px rgb(156 225 190 / 0%)}}
@keyframes login-background-drift{from{background-position:0% 15%,50% 50%}to{background-position:100% 85%,50% 50%}}
@keyframes login-mascot-crawl{0%,100%{translate:0 0;rotate:-2deg}20%{translate:-42px -2px;rotate:1deg}42%{translate:-82px 0;rotate:-1deg}55%{translate:-82px 0;rotate:2deg}78%{translate:-38px -2px;rotate:-1deg}}
@keyframes login-liquid-wobble{0%,100%{border-radius:48% 52% 43% 57% / 54% 43% 57% 46%;scale:1 1}35%{border-radius:57% 43% 55% 45% / 43% 57% 44% 56%;scale:1.04 .96}70%{border-radius:42% 58% 47% 53% / 58% 42% 54% 46%;scale:.97 1.03}}
@keyframes login-liquid-shine{0%,100%{opacity:.55;translate:0 0}50%{opacity:1;translate:7px 3px}}
@keyframes login-mascot-spark{0%,55%,100%{opacity:.25;scale:.7}68%{opacity:1;scale:1.2}}
@keyframes login-mascot-bubble-in{from{opacity:0;translate:0 5px;scale:.92}to{opacity:1;translate:0 0;scale:1}}

@media(max-width:700px){
  .login-intro{min-height:auto;padding:21px 23px 25px}
  .login-story{margin:0;padding:0}
  .login-message{margin:29px 0 0;padding:0}
  .login-message h1{font-size:34.6px}
  .login-feature-points{gap:6px;margin-top:13px}
  .login-feature-points span{min-height:28px;padding:0 8px;font-size:9.7px}
  .login-visual{display:none}
  .login-mascot{right:22px;bottom:18px;scale:.75}
  .login-mascot-bubble{right:62px;bottom:70px;width:170px}
  .login-intro::before{top:-120px;right:-300px}
  .login-intro::after{top:-90px;right:-220px}
}
@media(prefers-reduced-motion:reduce){
  .login-intro,.login-intro::before,.login-intro::after,.login-message,.login-feature-points span,.login-visual,.login-visual::before,.login-visual::after,.login-care-card,.login-care-card::after,.login-care-mark svg,.login-care-items span,.login-heartbeat-line,.login-activity-status i,.login-orbit,.login-float-card,.login-float-card-bottom .login-status-dot,.login-note,.login-form,.login-form>.field,.login-mascot,.login-mascot::before,.login-mascot::after,.login-mascot-spark,.login-mascot-bubble{animation:none!important}
  .login-heartbeat-line{stroke-dashoffset:0}
  .login-form .field input,.login-form .signup-password button,.login-form .button,.login-feature-points span{transition:none}
  .login-feature-points span:hover{transform:none}
  .login-form .field input:focus,.login-form .button-primary:hover:not(:disabled){transform:none}
  .login-form .signup-password button:hover{transform:translateY(-50%)}
}
</style>
