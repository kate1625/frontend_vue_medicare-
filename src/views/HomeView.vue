<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError, getApiData } from '../services/api'
import UiIcon from '../components/UiIcon.vue'
import { setTheme } from '../services/theme'
import orthodonticCareImage from '../assets/orthodontic-care.webp'
import veneersImage from '../assets/smile-veneers.jpg'

interface ClinicOverview {
  services: Array<{ service_id: number; service_name: string; category: string | null; description: string | null; price: string | number; duration_min: number | null }>
  dentists: Array<{ dentist_id: number; specialization: string | null; display_name: string }>
}

const overview = ref<ClinicOverview | null>(null)
const loading = ref(true)
const error = ref('')
const catalogStale = ref(false)
const darkMode = ref(localStorage.getItem('medicare-theme') === 'dark')
const landingTips = [
  { title: 'Brush gently for two minutes', text: 'Use a soft-bristled brush twice a day and clean along the gumline.' },
  { title: 'Clean between teeth daily', text: 'Floss or use an interdental cleaner to reach areas a toothbrush misses.' },
  { title: 'Choose water often', text: 'Water helps rinse away food and keeps your mouth comfortable.' },
]
const landingGallery = [
  { src: '/images/landing/dental-care-moment.webp', alt: 'A dental care moment in a clinic', category: 'DENTAL CARE', title: 'Thoughtful care', text: 'A little attention can make every visit feel more comfortable.' },
  { src: '/images/landing/smile-restoration.webp', alt: 'A dental care team with a patient at the clinic', category: 'OUR TEAM', title: 'Meet your care team', text: 'A welcoming team to support you at every visit.', layout: 'profile' },
  { src: '/images/landing/smile-care-comparison.webp', alt: 'Portrait of a dental care professional', category: 'OUR DENTISTS', title: 'Care that feels personal', text: 'Get to know the people guiding your dental care.', layout: 'profile-reverse' },
  { src: '/images/landing/cosmetic-dentistry.webp', alt: 'A close-up reference photo of cosmetic dental care', category: 'COSMETIC CARE', title: 'Details matter', text: 'Learn about cosmetic options with your dental team.' },
  { src: '/images/landing/dentist-at-work.webp', alt: 'Illustrative before-and-after photographs of a smile restoration', category: 'RESTORATIVE CARE', title: 'Explore restorative care', text: 'Ask your dentist about options suited to your dental needs.' },
  { src: '/images/landing/dental-care-detail.webp', alt: 'Illustrative before-and-after close-ups of a smile', category: 'SMILE CARE', title: 'A smile that feels like you', text: 'Discuss your personal goals and care options with your dentist.' },
  { src: '/images/landing/veneers.webp', alt: 'An illustrative reference photo of veneer treatment', category: 'VENEER CARE', title: 'Explore your options', text: 'Ask your dentist whether veneers may suit your goals.' },
  { src: '/images/landing/gum-contouring.webp', alt: 'An illustrative reference photo of gum contouring', category: 'GUM CARE', title: 'Care for every detail', text: 'Get personalized guidance for your gums and smile.' },
]
const treatmentHighlights = landingGallery.slice(3)
const portalMarqueeTracks = [
  {
    direction: 'forward',
    items: [
      { icon: 'calendar-plus', label: 'Appointment booking' },
      { icon: 'users-round', label: 'Patient records' },
      { icon: 'clipboard-list', label: 'Treatment history' },
      { icon: 'pill', label: 'Prescriptions' },
      { icon: 'credit-card-check', label: 'Payment tracking' },
    ],
  },
  {
    direction: 'reverse',
    items: [
      { icon: 'bell', label: 'Appointment updates' },
      { icon: 'message-circle', label: 'Clinic messaging' },
      { icon: 'chart-column', label: 'Clinic reports' },
      { icon: 'shield-check', label: 'Secure patient access' },
      { icon: 'receipt', label: 'Digital receipts' },
    ],
  },
] as const
const mascotMessage = ref('')
const mascotMessageIndex = ref(0)
const mascotMessages = [
  'Hi, I’m Kate! Ready for a brighter smile?',
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
let mascotTimer: number | undefined

async function loadOverview() {
  loading.value = true
  error.value = ''
  try {
    overview.value = await getApiData<ClinicOverview>('/api/public/overview')
    await nextTick()
    stopScrollObserver()
    stopScrollObserver = observeScrollSections()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Clinic information could not be loaded.'
    if (overview.value) catalogStale.value = true
  } finally {
    loading.value = false
  }
}

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function toggleTheme(event: MouseEvent) {
  darkMode.value = !darkMode.value
  const theme = darkMode.value ? 'dark' : 'light'
  setTheme(theme, event.currentTarget instanceof HTMLElement ? event.currentTarget : null)
}

function markCatalogStale() {
  catalogStale.value = true
}

function markCatalogFresh() {
  catalogStale.value = false
}

function observeScrollSections() {
  const sections = document.querySelectorAll<HTMLElement>('.scroll-reveal')
  if (!('IntersectionObserver' in window)) {
    sections.forEach((section) => section.classList.add('is-visible'))
    return () => undefined
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('is-visible', entry.isIntersecting)
    })
  }, { threshold: 0.08, rootMargin: '-5% 0px -5% 0px' })
  sections.forEach((section) => observer.observe(section))
  return () => observer.disconnect()
}

let stopScrollObserver = () => undefined

onMounted(() => {
  window.addEventListener('medicare:catalog-stale', markCatalogStale)
  window.addEventListener('medicare:catalog-fresh', markCatalogFresh)
  window.addEventListener('online', loadOverview)
  stopScrollObserver = observeScrollSections()
  void loadOverview()
})

onBeforeUnmount(() => {
  window.removeEventListener('medicare:catalog-stale', markCatalogStale)
  window.removeEventListener('medicare:catalog-fresh', markCatalogFresh)
  window.removeEventListener('online', loadOverview)
  stopScrollObserver()
  if (mascotTimer !== undefined) window.clearTimeout(mascotTimer)
})

function speakMascot() {
  mascotMessage.value = mascotMessages[mascotMessageIndex.value]
  mascotMessageIndex.value = (mascotMessageIndex.value + 1) % mascotMessages.length
  if (mascotTimer !== undefined) window.clearTimeout(mascotTimer)
  mascotTimer = window.setTimeout(() => { mascotMessage.value = '' }, 4200)
}
</script>

<template>
  <main id="top" class="public-home">
    <header class="public-nav">
      <RouterLink class="brand public-brand" to="/">
        <span class="brand-mark" aria-hidden="true"><UiIcon name="plus" /></span>
        <span>MediCare<span class="brand-accent">+</span></span>
      </RouterLink>
      <nav aria-label="Public navigation">
        <a href="#care">Our care</a>
        <a href="#team">Our dentists</a>
        <a href="#process">How it works</a>
        <a href="#tips">Dental tips</a>
        <button class="theme-toggle public-theme-toggle" type="button" :aria-pressed="darkMode" @click="toggleTheme">{{ darkMode ? 'Light mode' : 'Dark mode' }}</button>
        <RouterLink to="/login">Sign in</RouterLink>
        <RouterLink class="button button-primary" to="/register">Book an appointment</RouterLink>
      </nav>
    </header>

    <section class="public-hero">
      <div class="public-hero-copy">
        <p class="eyebrow">YOUR DENTAL CARE PORTAL</p>
        <h1>Better care starts with a <span>simpler visit.</span></h1>
        <p>Book appointments, keep track of your dental care, and stay connected with your clinic—all in one secure place.</p>
        <div class="public-actions">
          <RouterLink class="button button-primary" to="/register">Create your patient account <UiIcon name="arrow-right" /></RouterLink>
          <RouterLink class="text-link" to="/login">Already have an account? Sign in</RouterLink>
        </div>
        <div class="public-trust-points" aria-label="Patient portal benefits">
          <span><UiIcon name="shield-check" /> Private patient access</span>
          <span><UiIcon name="calendar" /> Care on your schedule</span>
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-image-frame">
          <img :src="orthodonticCareImage" alt="Close-up of a patient's braces during orthodontic care" />
          <div class="hero-image-label"><span class="hero-image-label-icon"><UiIcon name="sparkles" /></span><span><strong>Specialized care</strong><small>Made for your smile</small></span></div>
        </div>
        <aside class="hero-note" aria-label="What you can do in the patient portal">
          <div class="hero-note-heading">
            <span class="hero-plus" aria-hidden="true"><UiIcon name="heart" /></span>
            <div><small>MEDICARE+ PATIENT PORTAL</small><strong>Your care, connected.</strong></div>
          </div>
          <p class="hero-note-intro">Everything you need to manage your dental visits, from request to follow-up.</p>
          <ul class="hero-feature-list">
            <li><span><UiIcon name="calendar-plus" /></span><div><strong>Book a visit</strong><small>Choose a service and request a time.</small></div><UiIcon class="hero-feature-arrow" name="arrow-right" /></li>
            <li><span><UiIcon name="clipboard-list" /></span><div><strong>Follow your care</strong><small>Review appointments and care records.</small></div><UiIcon class="hero-feature-arrow" name="arrow-right" /></li>
            <li><span><UiIcon name="message-circle" /></span><div><strong>Stay in touch</strong><small>Get updates and contact your clinic.</small></div><UiIcon class="hero-feature-arrow" name="arrow-right" /></li>
          </ul>
          <div class="hero-note-secure"><UiIcon name="shield-check" /> Private patient access</div>
        </aside>
      </div>
    </section>
    <section class="portal-marquee" aria-label="MediCare+ portal features">
      <p class="portal-marquee-heading">ONE CONNECTED CLINIC EXPERIENCE</p>
      <div
        v-for="track in portalMarqueeTracks"
        :key="track.direction"
        class="portal-marquee-lane"
        :class="`portal-marquee-lane--${track.direction}`"
      >
        <div class="portal-marquee-track">
          <div v-for="copy in 2" :key="copy" class="portal-marquee-group" :aria-hidden="copy === 2">
            <template v-for="sequence in 3" :key="sequence">
              <span
                v-for="item in track.items"
                :key="`${sequence}-${item.label}`"
                class="portal-marquee-item"
                :aria-hidden="sequence > 1"
              >
                <UiIcon :name="item.icon" aria-hidden="true" />
                {{ item.label }}
              </span>
            </template>
          </div>
        </div>
      </div>
    </section>

    <section id="care" class="public-info scroll-reveal">
      <div><p class="eyebrow">OUR CARE</p><h2>Dental services</h2></div>
      <p>Service information is kept up to date by the clinic. Register or sign in to request a visit.</p>
    </section>
    <section class="catalog-section" aria-live="polite">
      <p v-if="catalogStale" class="catalog-message" role="status">Showing saved clinic services and dentist profiles. This information may be out of date.</p>
      <div v-if="loading && !overview" class="catalog-message">Loading clinic services…</div>
      <div v-else-if="error && !overview" class="catalog-message alert alert-error">{{ error }} <button class="text-button" type="button" @click="loadOverview">Retry</button></div>
      <div v-else-if="!overview?.services.length" class="catalog-message">The clinic has not published services yet.</div>
      <div v-else class="catalog-grid">
        <article v-for="(service, index) in overview.services" :key="service.service_id" class="catalog-card scroll-reveal" :style="{ '--reveal-delay': `${index * 140}ms` }">
          <span class="catalog-category">{{ service.category || 'Dental care' }}</span>
          <h3>{{ service.service_name }}</h3>
          <p>{{ service.description || 'Contact the clinic for details about this service.' }}</p>
          <small v-if="service.duration_min">{{ service.duration_min }} minutes</small>
        </article>
      </div>
      <p v-if="loading && overview" class="catalog-message" role="status">Refreshing clinic information…</p>
      <div v-else-if="error && overview" class="catalog-message alert alert-error" role="status">
        The latest clinic information could not be refreshed. The saved catalog is still shown. {{ error }}
        <button class="text-button" type="button" @click="loadOverview">Retry</button>
      </div>
    </section>
    <section class="smile-showcase scroll-reveal" aria-labelledby="smile-showcase-title">
      <div class="smile-showcase-copy">
        <p class="eyebrow">CARE THAT SHOWS</p>
        <h2 id="smile-showcase-title">A confident smile starts with thoughtful care.</h2>
        <p>From orthodontic alignment to smile enhancement, your treatment plan should feel personal, clear, and comfortable from the first visit.</p>
        <div class="smile-showcase-points">
          <span><UiIcon name="check-circle" /> Personalized treatment plans</span>
          <span><UiIcon name="check-circle" /> Clear guidance at every step</span>
        </div>
        <RouterLink class="text-link" to="/register">Explore your care options <UiIcon name="arrow-right" /></RouterLink>
      </div>
      <div class="smile-showcase-gallery" aria-label="Examples of dental care">
        <figure class="smile-gallery-card smile-gallery-card-main">
          <img :src="veneersImage" alt="Close-up of a bright, natural-looking smile" />
          <figcaption><strong>Smile enhancement</strong><small>Care designed around you</small></figcaption>
        </figure>
        <figure class="smile-gallery-card smile-gallery-card-small">
          <img :src="orthodonticCareImage" alt="Orthodontic braces during treatment" />
          <figcaption><strong>Orthodontic care</strong><small>Progress you can feel</small></figcaption>
        </figure>
      </div>
    </section>
    <section id="smile-gallery" class="public-treatment-gallery" aria-labelledby="smile-gallery-title">
      <header class="public-treatment-heading scroll-reveal">
        <p class="eyebrow">YOUR SMILE, YOUR WAY</p>
        <h2 id="smile-gallery-title">Explore care for every kind of smile.</h2>
        <p>Get to know some of the care options you can discuss with your dentist. Your treatment plan is always personal to you.</p>
      </header>
      <div class="public-treatment-grid">
        <article
          v-for="(item, index) in landingGallery.slice(0, 3)"
          :key="item.src"
          class="public-treatment-card scroll-reveal"
          :class="item.layout ? `public-treatment-card--${item.layout}` : ''"
          :style="{ '--gallery-delay': `${index * 65}ms` }"
        >
          <img :src="item.src" :alt="item.alt" loading="lazy" decoding="async" />
          <div class="public-treatment-shade"></div>
          <div class="public-treatment-caption">
            <span>{{ item.category }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.text }}</p>
          </div>
        </article>
        <div class="public-treatment-lineup" aria-label="Featured dental care options">
          <article
            v-for="(item, index) in treatmentHighlights"
            :key="item.src"
            class="public-treatment-card public-treatment-lineup-card scroll-reveal"
            :class="{ 'public-treatment-lineup-card--center': index === 2 }"
            :style="{ '--gallery-delay': `${index * 65}ms` }"
            tabindex="0"
          >
            <img :src="item.src" :alt="item.alt" loading="lazy" decoding="async" />
            <img class="public-treatment-lineup-full-image" :src="item.src" alt="" aria-hidden="true" loading="lazy" decoding="async" />
            <div class="public-treatment-shade"></div>
            <div class="public-treatment-caption">
              <span>{{ item.category }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </div>
          </article>
        </div>
      </div>
      <p class="public-treatment-note">Images are for general information. Treatment options and results vary for each patient.</p>
      <RouterLink class="button button-primary public-treatment-cta" to="/register">
        Find the right care for you <UiIcon name="arrow-right" />
      </RouterLink>
    </section>
    <section id="team" class="public-info dentist-info scroll-reveal">
      <div><p class="eyebrow">OUR TEAM</p><h2>Meet the dentists</h2></div>
      <div v-if="overview?.dentists.length" class="dentist-list">
        <article v-for="dentist in overview.dentists" :key="dentist.dentist_id"><strong>{{ dentist.display_name }}</strong><span>{{ dentist.specialization || 'General dentistry' }}</span></article>
      </div>
      <p v-else-if="!loading">Dentist profiles are not available right now.</p>
      <p v-else>Loading dentist profiles…</p>
    </section>
    <section id="process" class="public-process scroll-reveal">
      <article><span>01</span><h3>Create your account</h3><p>Register with your contact details to access the patient portal.</p></article>
      <article><span>02</span><h3>Choose a visit</h3><p>View available appointment times and submit your request.</p></article>
      <article><span>03</span><h3>Stay connected</h3><p>Review appointment and payment updates through your account.</p></article>
    </section>
    <section id="tips" class="public-tips scroll-reveal">
      <div class="public-info public-tips-heading"><div><p class="eyebrow">A HEALTHIER SMILE</p><h2>Small habits, lasting care</h2></div><p>Everyday tips to support your dental health. Your dentist can help tailor care to your needs.</p></div>
      <div class="public-tips-grid">
        <article v-for="tip in landingTips" :key="tip.title"><span>DAILY CARE</span><h3>{{ tip.title }}</h3><p>{{ tip.text }}</p></article>
      </div>
    </section>
    <section class="public-cta">
      <div>
        <p class="eyebrow">YOUR NEXT VISIT, MADE SIMPLE</p>
        <h2>Ready to put your care in motion?</h2>
        <p>Create your patient account to request an appointment and stay connected with your clinic.</p>
      </div>
      <RouterLink class="button button-primary" to="/register">Get started <UiIcon name="arrow-right" /></RouterLink>
    </section>
    <footer class="public-footer">
      <div class="public-footer-main">
        <div class="public-footer-brand">
          <RouterLink class="brand public-brand" to="/">
            <span class="brand-mark" aria-hidden="true"><UiIcon name="plus" /></span>
            <span>MediCare<span class="brand-accent">+</span></span>
          </RouterLink>
          <p>Thoughtful dental care, with the tools to make every visit feel simpler.</p>
        </div>
        <div class="public-footer-column">
          <h2>Explore</h2>
          <a href="#care">Dental services</a>
          <a href="#smile-gallery">Smile gallery</a>
          <a href="#team">Our dentists</a>
          <a href="#process">How it works</a>
        </div>
        <div class="public-footer-column">
          <h2>Patient access</h2>
          <RouterLink to="/register">Create an account</RouterLink>
          <RouterLink to="/login">Sign in</RouterLink>
          <RouterLink to="/reset-password">Reset password</RouterLink>
        </div>
        <div class="public-footer-note">
          <span aria-hidden="true"><UiIcon name="shield-check" /></span>
          <div><strong>Your care stays personal.</strong><p>Use your secure patient account to manage appointments and stay in touch with the clinic.</p></div>
        </div>
      </div>
      <div class="public-footer-bottom">
        <span>© {{ new Date().getFullYear() }} MediCare+ · Tooth Doctor Dental Clinic</span>
        <a href="#top" @click.prevent="backToTop">Back to top <UiIcon name="arrow-right" /></a>
      </div>
    </footer>
    <button class="public-mascot" type="button" aria-label="Talk to Totooth" @click="speakMascot">
      <span v-if="mascotMessage" class="public-mascot-bubble" role="status">{{ mascotMessage }}</span>
      <svg viewBox="0 0 64 58" fill="none" aria-hidden="true">
        <path class="public-mascot-tooth" d="M17 9c5-5 10-3 15 0 5-3 10-5 15 0 7 7 4 17 2 24-2 7-3 15-8 15-4 0-5-7-9-7s-5 7-9 7c-5 0-6-8-8-15-2-7-5-17 2-24Z" />
        <path class="public-mascot-face" d="M25 25h1m12 0h1M28 32c3 3 6 3 9 0" />
        <path class="public-mascot-shadow" d="M14 54c10 3 26 3 37 0" />
      </svg>
      <span class="public-mascot-spark"></span>
    </button>
  </main>
</template>
