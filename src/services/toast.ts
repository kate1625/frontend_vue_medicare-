export type ToastKind = 'success' | 'error' | 'info' | 'warning'
export type ToastCategory = 'message' | 'appointment' | 'payment' | 'general'

export interface ToastPayload {
  id: number
  kind: ToastKind
  category?: ToastCategory
  title: string
  message: string
  duration: number
  actionPath?: string
  actionLabel?: string
}

let nextToastId = 1

function show(
  kind: ToastKind,
  message: string,
  title?: string,
  duration?: number,
  options?: Pick<ToastPayload, 'category' | 'actionPath' | 'actionLabel'>,
) {
  const cleanMessage = message.trim()
  if (!cleanMessage) return

  const defaults: Record<ToastKind, { title: string; duration: number }> = {
    success: { title: 'Success', duration: 3800 },
    error: { title: 'Something went wrong', duration: 6000 },
    info: { title: 'Information', duration: 4500 },
    warning: { title: 'Please note', duration: 5000 },
  }
  const fallback = defaults[kind]
  const detail: ToastPayload = {
    id: nextToastId++,
    kind,
    title: title?.trim() || fallback.title,
    message: cleanMessage,
    duration: duration ?? fallback.duration,
    ...options,
  }

  window.dispatchEvent(new CustomEvent<ToastPayload>('medicare:toast', { detail }))
}

export const notify = {
  success: (message: string, title?: string) => show('success', message, title),
  error: (message: string, title?: string) => show('error', message, title),
  info: (message: string, title?: string) => show('info', message, title),
  warning: (message: string, title?: string) => show('warning', message, title),
  incoming: (
    message: string,
    title: string,
    category: ToastCategory,
    actionPath?: string,
  ) => show('info', message, title, 6500, {
    category,
    actionPath,
    actionLabel: actionPath ? 'View' : undefined,
  }),
}
