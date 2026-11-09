export type Theme = 'light' | 'dark'

interface ViewTransitionDocument extends Document {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

export function setTheme(theme: Theme, trigger?: HTMLElement | null) {
  const root = document.documentElement
  const apply = () => {
    localStorage.setItem('medicare-theme', theme)
    root.dataset.theme = theme
    window.dispatchEvent(new CustomEvent('medicare:theme-change', { detail: theme }))
  }

  if (root.dataset.theme === theme) return

  const transitionDocument = document as ViewTransitionDocument
  const startViewTransition = transitionDocument.startViewTransition
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!startViewTransition || prefersReducedMotion) {
    apply()
    return
  }

  const rect = trigger?.getBoundingClientRect()
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
  const radius = Math.max(
    Math.hypot(x, y),
    Math.hypot(window.innerWidth - x, y),
    Math.hypot(x, window.innerHeight - y),
    Math.hypot(window.innerWidth - x, window.innerHeight - y),
  )

  root.style.setProperty('--theme-transition-x', `${x}px`)
  root.style.setProperty('--theme-transition-y', `${y}px`)
  root.style.setProperty('--theme-transition-radius', `${radius}px`)

  startViewTransition.call(transitionDocument, apply)
}
