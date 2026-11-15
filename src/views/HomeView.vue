<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { animate, stagger } from 'animejs'
import { ApiError, getPortalRole, getStaffUser } from '../services/api'
import { getCachedPublicOverview, loadPublicOverview, type PublicOverview } from '../services/publicCatalog'
import UiIcon from '../components/UiIcon.vue'
import { setTheme } from '../services/theme'
import orthodonticCareImage from '../assets/orthodontic-care.webp'
import veneersImage from '../assets/smile-veneers.jpg'

const overview = ref<PublicOverview | null>(getCachedPublicOverview())
const signedInUser = ref(getStaffUser())
const signedInRole = ref(getPortalRole())
const signedInInitials = computed(() => {
  const parts = (signedInUser.value?.username ?? '')
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U'
  )
})
const accountDestination = computed(() => {
  if (signedInRole.value === 'patient') {
    return signedInUser.value?.is_verified === false ? '/settings/profile' : '/patient/dashboard'
  }
  return signedInRole.value === 'admin' ? '/admin/dashboard' : '/staff/dashboard'
})
const accountActionLabel = computed(() =>
  signedInRole.value === 'patient' && signedInUser.value?.is_verified === false
    ? 'Verify account'
    : 'Go to dashboard',
)
const loading = ref(!overview.value)
const error = ref('')
const catalogStale = ref(false)
const darkMode = ref(localStorage.getItem('medicare-theme') === 'dark')
const mobileNavOpen = ref(false)
const selectedDentalToolIndex = ref(0)
const dentalTools = [
  {
    name: 'Mouth mirror',
    category: 'EXAMINATION',
    description: 'Helps your dental team see the hard-to-reach areas of your mouth.',
    art: 'mirror',
  },
  {
    name: 'Dental explorer',
    category: 'PRECISION CHECK',
    description: 'A fine instrument used to carefully examine tooth surfaces.',
    art: 'explorer',
  },
  {
    name: 'Polishing brush',
    category: 'PREVENTIVE CARE',
    description: 'A gentle finishing tool used during professional cleanings.',
    art: 'brush',
  },
] as const
const selectedDentalTool = computed(
  () => dentalTools[selectedDentalToolIndex.value] ?? dentalTools[0],
)
const landingTips = [
  {
    title: 'Brush gently for two minutes',
    text: 'Use a soft-bristled brush twice a day and clean along the gumline.',
  },
  {
    title: 'Clean between teeth daily',
    text: 'Floss or use an interdental cleaner to reach areas a toothbrush misses.',
  },
  {
    title: 'Choose water often',
    text: 'Water helps rinse away food and keeps your mouth comfortable.',
  },
]
const landingGallery = [
  {
    src: '/images/landing/dental-care-moment.webp',
    alt: 'A dental care moment in a clinic',
    category: 'DENTAL CARE',
    title: 'Thoughtful care',
    text: 'A little attention can make every visit feel more comfortable.',
  },
  {
    src: '/images/landing/smile-restoration.webp',
    alt: 'A dental care team with a patient at the clinic',
    category: 'OUR TEAM',
    title: 'Meet your care team',
    text: 'A welcoming team to support you at every visit.',
    layout: 'profile',
  },
  {
    src: '/images/landing/smile-care-comparison.webp',
    alt: 'Portrait of a dental care professional',
    category: 'OUR DENTISTS',
    title: 'Care that feels personal',
    text: 'Get to know the people guiding your dental care.',
    layout: 'profile-reverse',
  },
  {
    src: '/images/landing/cosmetic-dentistry.webp',
    alt: 'A close-up reference photo of cosmetic dental care',
    category: 'COSMETIC CARE',
    title: 'Details matter',
    text: 'Learn about cosmetic options with your dental team.',
  },
  {
    src: '/images/landing/dentist-at-work.webp',
    alt: 'Illustrative before-and-after photographs of a smile restoration',
    category: 'RESTORATIVE CARE',
    title: 'Explore restorative care',
    text: 'Ask your dentist about options suited to your dental needs.',
  },
  {
    src: '/images/landing/dental-care-detail.webp',
    alt: 'Illustrative before-and-after close-ups of a smile',
    category: 'SMILE CARE',
    title: 'A smile that feels like you',
    text: 'Discuss your personal goals and care options with your dentist.',
  },
  {
    src: '/images/landing/veneers.webp',
    alt: 'An illustrative reference photo of veneer treatment',
    category: 'VENEER CARE',
    title: 'Explore your options',
    text: 'Ask your dentist whether veneers may suit your goals.',
  },
  {
    src: '/images/landing/gum-contouring.webp',
    alt: 'An illustrative reference photo of gum contouring',
    category: 'GUM CARE',
    title: 'Care for every detail',
    text: 'Get personalized guidance for your gums and smile.',
  },
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
const landingAnimations: ReturnType<typeof animate>[] = []

function animateLandingEntrance() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const heroItems = document.querySelectorAll<HTMLElement>(
    '.public-hero-copy > .eyebrow, .public-hero-copy > h1, .public-hero-copy > .public-actions, .public-hero-copy > .public-trust-points',
  )
  if (heroItems.length) {
    landingAnimations.push(animate(heroItems, {
      opacity: [0, 1],
      y: [22, 0],
      delay: stagger(110),
      duration: 760,
      ease: 'outExpo',
    }))
  }

  const toolbox = document.querySelector<HTMLElement>('.hero-toolbox')
  if (toolbox) {
    landingAnimations.push(animate(toolbox, {
      opacity: [0, 1],
      y: [28, 0],
      scale: [0.97, 1],
      delay: 220,
      duration: 900,
      ease: 'outExpo',
    }))
  }
}

async function loadOverview() {
  const cachedOverview = getCachedPublicOverview()
  if (cachedOverview) {
    overview.value = cachedOverview
    loading.value = false
    error.value = ''
    return
  }

  loading.value = true
  error.value = ''
  try {
    overview.value = await loadPublicOverview()
    await nextTick()
    stopScrollObserver()
    stopScrollObserver = observeScrollSections()
  } catch (cause) {
    error.value =
      cause instanceof ApiError ? cause.message : 'Clinic information could not be loaded.'
    if (overview.value) catalogStale.value = true
  } finally {
    loading.value = false
  }
}

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function closeMobileNav() {
  mobileNavOpen.value = false
}

function selectDentalTool(index: number) {
  selectedDentalToolIndex.value = index
}

function toggleTheme(event: MouseEvent) {
  darkMode.value = !darkMode.value
  const theme = darkMode.value ? 'dark' : 'light'
  setTheme(theme, event.currentTarget instanceof HTMLElement ? event.currentTarget : null)
  closeMobileNav()
}

function markCatalogStale() {
  catalogStale.value = true
}

function markCatalogFresh() {
  catalogStale.value = false
}

function observeScrollSections() {
  const sections = document.querySelectorAll<HTMLElement>('.scroll-reveal')
  if (
    !('IntersectionObserver' in window)
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    sections.forEach((section) => section.classList.add('is-visible'))
    return () => undefined
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const section = entry.target as HTMLElement
        if (!entry.isIntersecting) {
          section.classList.remove('is-visible')
          return
        }

        section.classList.add('is-visible')
      })
    },
    { threshold: 0.08, rootMargin: '-5% 0px -5% 0px' },
  )
  sections.forEach((section) => observer.observe(section))
  return () => observer.disconnect()
}

let stopScrollObserver = () => undefined

onMounted(() => {
  animateLandingEntrance()
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
  landingAnimations.forEach((animation) => animation.cancel())
  landingAnimations.length = 0
  if (mascotTimer !== undefined) window.clearTimeout(mascotTimer)
})

function speakMascot() {
  mascotMessage.value = mascotMessages[mascotMessageIndex.value]
  mascotMessageIndex.value = (mascotMessageIndex.value + 1) % mascotMessages.length
  if (mascotTimer !== undefined) window.clearTimeout(mascotTimer)
  mascotTimer = window.setTimeout(() => {
    mascotMessage.value = ''
  }, 4200)
}
</script>

<template>
  <main id="top" class="public-home">
    <header class="public-nav">
      <RouterLink class="brand public-brand" to="/">
        <span class="brand-mark" aria-hidden="true"><UiIcon name="plus" /></span>
        <span>MediCare<span class="brand-accent">+</span></span>
      </RouterLink>
      <nav
        id="public-nav-menu"
        :class="{ 'is-open': mobileNavOpen }"
        aria-label="Public navigation"
      >
        <a class="public-nav-item" href="#care" @click="closeMobileNav">
          <span>Our care</span><UiIcon class="public-nav-item-arrow" name="arrow-right" />
        </a>
        <a class="public-nav-item" href="#dentists" @click="closeMobileNav">
          <span>Our dentists</span><UiIcon class="public-nav-item-arrow" name="arrow-right" />
        </a>
        <a class="public-nav-item" href="#process" @click="closeMobileNav">
          <span>How it works</span><UiIcon class="public-nav-item-arrow" name="arrow-right" />
        </a>
        <a class="public-nav-item" href="#tips" @click="closeMobileNav">
          <span>Dental tips</span><UiIcon class="public-nav-item-arrow" name="arrow-right" />
        </a>
        <RouterLink
          v-if="!signedInUser"
          class="button button-primary public-nav-mobile-create"
          to="/register"
          @click="closeMobileNav"
          >Create account</RouterLink
        >
      </nav>
      <div class="public-nav-actions">
        <RouterLink
          v-if="!signedInUser"
          class="button button-primary public-nav-desktop-create"
          to="/register"
          >Create account</RouterLink
        >
        <button
          class="public-theme-icon"
          type="button"
          :aria-pressed="darkMode"
          :aria-label="darkMode ? 'Switch to light mode' : 'Switch to dark mode'"
          :title="darkMode ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <span
            :key="darkMode ? 'sun' : 'moon'"
            class="public-theme-icon-glyph"
            :class="darkMode ? 'public-theme-icon-glyph--sun' : 'public-theme-icon-glyph--moon'"
          >
            <UiIcon :name="darkMode ? 'sun' : 'moon'" />
          </span>
        </button>
        <RouterLink v-if="!signedInUser" class="public-sign-in" to="/login" @click="closeMobileNav"
          >Sign in</RouterLink
        >
        <RouterLink
          v-else
          class="public-account-link"
          :to="accountDestination"
          :aria-label="`${signedInUser.username}, ${signedInRole ?? 'user'}. ${accountActionLabel}`"
          @click="closeMobileNav"
        >
          <span class="public-account-avatar" aria-hidden="true">{{ signedInInitials }}</span>
          <span class="public-account-copy"
            ><strong>{{ signedInUser.username }}</strong
            ><small>{{ accountActionLabel }}</small></span
          >
          <UiIcon name="arrow-right" />
        </RouterLink>
        <button
          class="public-nav-toggle"
          type="button"
          :aria-expanded="mobileNavOpen"
          aria-controls="public-nav-menu"
          :aria-label="mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>

    <section class="public-hero">
      <div class="public-hero-copy">
        <p class="eyebrow">BOOK NOW</p>
        <h1>Better care starts with a <span>simpler visit.</span></h1>
        <p></p>
        <div class="public-actions">
          <RouterLink
            class="button button-primary"
            :to="signedInUser ? accountDestination : '/register'"
          >
            {{ signedInUser ? accountActionLabel : 'Create your patient account' }}
            <UiIcon name="arrow-right" />
          </RouterLink>
          <RouterLink v-if="!signedInUser" class="text-link" to="/login"
            >Already have an account? Sign in</RouterLink
          >
          <span v-else class="text-link public-welcome"
            >Welcome back, {{ signedInUser.username }}.</span
          >
        </div>
        <div class="public-trust-points" aria-label="Patient portal benefits">
          <span><UiIcon name="shield-check" /> Private patient access</span>
          <span><UiIcon name="calendar" /> Care on your schedule</span>
        </div>
      </div>
      <div class="hero-visual">
        <section class="hero-toolbox" aria-label="Explore dental tools">
          <div class="hero-toolbox-heading">
            <div>
              <h2>Small tools.<br /><span>Thoughtful care.</span></h2>
            </div>
          </div>
          <div class="hero-tool-stage" aria-live="polite">
            <span class="hero-tool-orbit hero-tool-orbit--outer" aria-hidden="true"></span>
            <span class="hero-tool-orbit hero-tool-orbit--inner" aria-hidden="true"></span>
            <span class="hero-tool-spark hero-tool-spark--one" aria-hidden="true"
              ><UiIcon name="sparkles"
            /></span>
            <span class="hero-tool-spark hero-tool-spark--two" aria-hidden="true"
              ><UiIcon name="plus"
            /></span>
            <Transition name="hero-tool-reveal" mode="out-in">
              <div :key="selectedDentalTool.art" class="hero-tool-feature">
                <div
                  class="hero-tool-art"
                  :class="`hero-tool-art--${selectedDentalTool.art}`"
                  aria-hidden="true"
                >
                  <svg v-if="selectedDentalTool.art === 'mirror'" viewBox="0 0 120 120" fill="none">
                    <circle cx="78" cy="36" r="20" />
                    <circle class="hero-tool-art-glass" cx="78" cy="36" r="13" />
                    <path d="M64 50 31 91c-4 5-2 12 4 15s12 0 14-6l20-48" />
                    <path class="hero-tool-art-highlight" d="m69 49-32 43" />
                  </svg>
                  <svg
                    v-else-if="selectedDentalTool.art === 'explorer'"
                    viewBox="0 0 120 120"
                    fill="none"
                  >
                    <path d="m34 94 32-32c4-4 6-9 5-15l-2-12c-1-7 3-13 9-16l12-6" />
                    <path d="m90 13 5 6-5 5" />
                    <path
                      class="hero-tool-art-highlight"
                      d="m41 94 30-31c4-4 6-9 5-14l-2-12c-1-6 2-11 7-14"
                    />
                    <circle cx="34" cy="94" r="7" />
                  </svg>
                  <svg v-else viewBox="0 0 120 120" fill="none">
                    <path d="m36 93 29-34c4-5 7-11 8-18l2-13" />
                    <path d="m70 28 11-2 5 4-2 15-15-2z" />
                    <path class="hero-tool-art-bristles" d="m72 29 1 12m5-13 1 13m5-11 1 10" />
                    <path class="hero-tool-art-highlight" d="m43 91 27-32c4-5 7-11 8-17" />
                    <circle cx="36" cy="94" r="7" />
                  </svg>
                </div>
                <div class="hero-tool-feature-copy">
                  <span>{{ selectedDentalTool.category }}</span>
                  <h3>{{ selectedDentalTool.name }}</h3>
                  <p>{{ selectedDentalTool.description }}</p>
                </div>
              </div>
            </Transition>

          </div>
          <div class="hero-tool-picker" aria-label="Choose a dental tool">
            <button
              v-for="(tool, index) in dentalTools"
              :key="tool.art"
              class="hero-tool-option"
              :class="{ 'is-active': selectedDentalToolIndex === index }"
              type="button"
              :aria-pressed="selectedDentalToolIndex === index"
              :aria-label="`Explore ${tool.name}`"
              @click="selectDentalTool(index)"
            >
              <span class="hero-tool-option-icon" aria-hidden="true">
                <svg v-if="tool.art === 'mirror'" viewBox="0 0 24 24" fill="none">
                  <circle cx="16" cy="6" r="4" />
                  <path d="m13 9-9 11m6-8 5 4" />
                </svg>
                <svg v-else-if="tool.art === 'explorer'" viewBox="0 0 24 24" fill="none">
                  <path d="m5 20 8-8c1-1 2-3 2-5V5c0-2 2-3 4-4" />
                  <path d="m17 1 3 2-3 2M5 20h.01" />
                </svg>
                <UiIcon v-else name="toothbrush" />
              </span>
              <span
                ><strong>{{ tool.name }}</strong
                ><small>{{ tool.category }}</small></span
              >
              <UiIcon class="hero-tool-option-arrow" name="arrow-right" />
            </button>
          </div>
        </section>
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
      <div>
        <p class="eyebrow"></p>
        <h2>Dental services</h2>
      </div>
      <p></p>
    </section>
    <section class="catalog-section" aria-live="polite">
      <p v-if="catalogStale" class="catalog-message" role="status">
        Showing saved clinic services and dentist profiles. This information may be out of date.
      </p>
      <div v-if="loading && !overview" class="catalog-skeleton-grid" role="status" aria-label="Loading clinic services">
        <article v-for="card in 3" :key="card" class="catalog-skeleton-card" aria-hidden="true">
          <span class="catalog-skeleton-line catalog-skeleton-category"></span>
          <span class="catalog-skeleton-line catalog-skeleton-title"></span>
          <span class="catalog-skeleton-line catalog-skeleton-description"></span>
          <span class="catalog-skeleton-line catalog-skeleton-duration"></span>
        </article>
      </div>
      <div v-else-if="error && !overview" class="catalog-message alert alert-error">
        {{ error }} <button class="text-button" type="button" @click="loadOverview">Retry</button>
      </div>
      <div v-else-if="!overview?.services.length" class="catalog-message">
        The clinic has not published services yet.
      </div>
      <div v-else class="catalog-grid">
        <article
          v-for="(service, index) in overview.services"
          :key="service.service_id"
          class="catalog-card scroll-reveal"
          :style="{ '--reveal-delay': `${index * 140}ms` }"
        >
          <span class="catalog-category">{{ service.category || 'Dental care' }}</span>
          <h3>{{ service.service_name }}</h3>
          <p>{{ service.description || 'Contact the clinic for details about this service.' }}</p>
          <small v-if="service.duration_min">{{ service.duration_min }} minutes</small>
        </article>
      </div>
      <p v-if="loading && overview" class="catalog-message" role="status">
        Refreshing clinic information…
      </p>
      <div v-else-if="error && overview" class="catalog-message alert alert-error" role="status">
        The latest clinic information could not be refreshed. The saved catalog is still shown.
        {{ error }}
        <button class="text-button" type="button" @click="loadOverview">Retry</button>
      </div>
    </section>
    <section class="smile-showcase scroll-reveal" aria-labelledby="smile-showcase-title">
      <div class="smile-showcase-copy">
        <p class="eyebrow">CARE THAT SHOWS</p>
        <h2 id="smile-showcase-title">A confident smile starts with thoughtful care.</h2>
        <p></p>
        <div class="smile-showcase-points">
          <span><UiIcon name="check-circle" /> Personalized treatment plans</span>
          <span><UiIcon name="check-circle" /> Clear guidance at every step</span>
        </div>
        <RouterLink class="text-link" :to="signedInUser ? accountDestination : '/register'"
          >{{ signedInUser ? accountActionLabel : 'Explore your care options' }}
          <UiIcon name="arrow-right"
        /></RouterLink>
      </div>
      <div class="smile-showcase-gallery" aria-label="Examples of dental care">
        <figure class="smile-gallery-card smile-gallery-card-main">
          <img :src="veneersImage" alt="Close-up of a bright, natural-looking smile" />
          <figcaption>
            <strong>Smile enhancement</strong><small>Care designed around you</small>
          </figcaption>
        </figure>
        <figure class="smile-gallery-card smile-gallery-card-small">
          <img :src="orthodonticCareImage" alt="Orthodontic braces during treatment" />
          <figcaption>
            <strong>Orthodontic care</strong><small>Progress you can feel</small>
          </figcaption>
        </figure>
      </div>
    </section>
    <section
      id="smile-gallery"
      class="public-treatment-gallery"
      aria-labelledby="smile-gallery-title"
    >
      <header id="dentists" class="public-treatment-heading scroll-reveal">
        <p class="eyebrow">YOUR SMILE, YOUR WAY</p>
        <h2 id="smile-gallery-title">Explore care for every kind of smile.</h2>
        <p></p>
      </header>
      <div class="public-treatment-grid">
        <article
          v-for="(item, index) in landingGallery.slice(0, 3)"
          :key="item.src"
          class="public-treatment-card scroll-reveal"
          :class="[
            item.layout ? `public-treatment-card--${item.layout}` : '',
            { 'public-treatment-card--feature': index === 0 },
          ]"
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
            <img
              class="public-treatment-lineup-full-image"
              :src="item.src"
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
            <div class="public-treatment-shade"></div>
            <div class="public-treatment-caption">
              <span>{{ item.category }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </div>
          </article>
        </div>
      </div>
      <p class="public-treatment-note">
        Images are for general information. Treatment options and results vary for each patient.
      </p>
      <RouterLink
        class="button button-primary public-treatment-cta"
        :to="signedInUser ? accountDestination : '/register'"
      >
        {{ signedInUser ? accountActionLabel : 'Find the right care for you' }}
        <UiIcon name="arrow-right" />
      </RouterLink>
    </section>
    <section id="team" class="public-info dentist-info scroll-reveal">
      <div>
        <p class="eyebrow">OUR TEAM</p>
        <h2>Meet the dentists</h2>
      </div>
      <div v-if="overview?.dentists.length" class="dentist-list">
        <article v-for="dentist in overview.dentists" :key="dentist.dentist_id">
          <strong>{{ dentist.display_name }}</strong
          ><span>{{ dentist.specialization || 'General dentistry' }}</span>
        </article>
      </div>
      <p v-else-if="!loading">Dentist profiles are not available right now.</p>
      <p v-else>Loading dentist profiles…</p>
    </section>
    <section id="process" class="public-process scroll-reveal">
      <article>
        <span>01</span>
        <h3>Create your account</h3>
        <p>Register with your contact details to access the patient portal.</p>
      </article>
      <article>
        <span>02</span>
        <h3>Choose a visit</h3>
        <p>View available appointment times and submit your request.</p>
      </article>
      <article>
        <span>03</span>
        <h3>Stay connected</h3>
        <p>Review appointment and payment updates through your account.</p>
      </article>
    </section>
    <section id="tips" class="public-tips scroll-reveal">
      <div class="public-info public-tips-heading">
        <div>
          <p class="eyebrow">A HEALTHIER SMILE</p>
          <h2>Small habits, lasting care</h2>
        </div>
        <p></p>
      </div>
      <div class="public-tips-grid">
        <article v-for="tip in landingTips" :key="tip.title">
          <span>DAILY CARE</span>
          <h3>{{ tip.title }}</h3>
          <p>{{ tip.text }}</p>
        </article>
      </div>
    </section>
    <section class="public-cta">
      <div>
        <p class="eyebrow">YOUR NEXT VISIT, MADE SIMPLE</p>
        <h2>Ready to put your care in motion?</h2>
        <p>
          {{
            signedInUser
              ? 'Continue to your account to manage your appointments and stay connected with your clinic.'
              : 'Create your patient account to request an appointment and stay connected with your clinic.'
          }}
        </p>
      </div>
      <RouterLink
        class="button button-primary"
        :to="signedInUser ? accountDestination : '/register'"
        >{{ signedInUser ? accountActionLabel : 'Get started' }} <UiIcon name="arrow-right"
      /></RouterLink>
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
          <a href="#dentists">Our dentists</a>
          <a href="#process">How it works</a>
        </div>
        <div class="public-footer-column">
          <h2>Patient access</h2>
          <RouterLink v-if="!signedInUser" to="/register">Create an account</RouterLink>
          <RouterLink v-if="!signedInUser" to="/login">Sign in</RouterLink>
          <RouterLink v-else :to="accountDestination">{{ accountActionLabel }}</RouterLink>
          <RouterLink to="/reset-password">Reset password</RouterLink>
        </div>
        <div class="public-footer-note">
          <span aria-hidden="true"><UiIcon name="shield-check" /></span>
          <div>
            <strong>Your care stays personal.</strong>
            <p>
              Use your secure patient account to manage appointments and stay in touch with the
              clinic.
            </p>
          </div>
        </div>
      </div>
      <div class="public-footer-bottom">
        <span>© {{ new Date().getFullYear() }} MediCare+ · Tooth Doctor Dental Clinic</span>
        <a href="#top" @click.prevent="backToTop">Back to top <UiIcon name="arrow-right" /></a>
      </div>
    </footer>
    <button class="public-mascot" type="button" aria-label="Talk to Totooth" @click="speakMascot">
      <span v-if="mascotMessage" class="public-mascot-bubble" role="status">{{
        mascotMessage
      }}</span>
      <svg viewBox="0 0 64 58" fill="none" aria-hidden="true">
        <path
          class="public-mascot-tooth"
          d="M17 9c5-5 10-3 15 0 5-3 10-5 15 0 7 7 4 17 2 24-2 7-3 15-8 15-4 0-5-7-9-7s-5 7-9 7c-5 0-6-8-8-15-2-7-5-17 2-24Z"
        />
        <path class="public-mascot-face" d="M25 25h1m12 0h1M28 32c3 3 6 3 9 0" />
        <path class="public-mascot-shadow" d="M14 54c10 3 26 3 37 0" />
      </svg>
      <span class="public-mascot-spark"></span>
    </button>
  </main>
</template>
