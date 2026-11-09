import './assets/main.css'
import './assets/landing-gallery.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, {
    scope: import.meta.env.BASE_URL,
  }).catch((error: unknown) => {
    console.error('MediCare+ Service Worker registration failed.', error)
  })
}
