export interface StaffUser {
  id: number
  username: string
  email: string
  role: string
  is_verified?: boolean
}

export type PortalRole = 'patient' | 'staff' | 'admin'

export interface Patient {
  id: number
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string
  address: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string | null
}

export interface PatientInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  gender: string
  address: string
  status: 'active' | 'inactive'
}

interface ApiErrorBody {
  error?: string
  errors?: Record<string, string>
}

export class ApiError extends Error {
  status: number
  fields: Record<string, string>

  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

const ACCESS_TOKEN_KEY = 'medicare.accessToken'
const STAFF_USER_KEY = 'medicare.staffUser'
const inFlightGetRequests = new Map<string, Promise<unknown>>()
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
let sessionVersion = 0

export function hasSession() {
  return Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY))
}

export function getStaffUser(): StaffUser | null {
  const value = sessionStorage.getItem(STAFF_USER_KEY)
  if (!value) return null

  try {
    return JSON.parse(value) as StaffUser
  } catch {
    clearSession()
    return null
  }
}

export function updateStaffUser(updates: Partial<StaffUser>) {
  const currentUser = getStaffUser()
  if (!currentUser) return
  sessionStorage.setItem(STAFF_USER_KEY, JSON.stringify({ ...currentUser, ...updates }))
}

export function getPortalRole(): PortalRole | null {
  const role = getStaffUser()?.role.toLowerCase()
  if (role === 'patient') return 'patient'
  if (role === 'staff' || role === 'healthcare worker' || role === 'moderator') return 'staff'
  if (role === 'admin' || role === 'administrator') return 'admin'
  return null
}

export function clearSession() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(STAFF_USER_KEY)
  sessionVersion += 1
}

export async function endSession() {
  if (!hasSession()) return
  try {
    await request<{ message: string }>('/api/auth/logout', { method: 'POST' })
  } finally {
    clearSession()
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const hasCustomAuthorization = new Headers(init.headers).has('Authorization')
  if (method !== 'GET' || init.signal || init.body || hasCustomAuthorization) {
    return performRequest<T>(path, init)
  }

  const key = `${sessionVersion}:${path}`
  const existingRequest = inFlightGetRequests.get(key)
  if (existingRequest) return existingRequest as Promise<T>

  const pendingRequest = performRequest<T>(path, init)
  inFlightGetRequests.set(key, pendingRequest)
  try {
    return await pendingRequest
  } finally {
    if (inFlightGetRequests.get(key) === pendingRequest) {
      inFlightGetRequests.delete(key)
    }
  }
}

async function performRequest<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, cache: 'no-store' })
  } catch {
    window.dispatchEvent(new Event('medicare:connection-error'))
    throw new ApiError('Could not connect to the MediCare+ API. Check that the backend is running.', 0)
  }

  const responseText = await response.text()
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('text/html')) {
    const preview = responseText
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\/(?:p|div|h[1-6]|pre|title)>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240)
    const detail = preview ? ` ${preview}` : ' The backend returned an HTML error page.'
    throw new ApiError(`The backend returned an unexpected response (HTTP ${response.status}).${detail}`, response.status)
  }

  let body: ApiErrorBody & T
  try {
    body = (responseText ? JSON.parse(responseText) : {}) as ApiErrorBody & T
  } catch {
    const preview = responseText
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\/(?:p|div|h[1-6]|pre|title)>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500)
    const detail = preview ? ` Server response: ${preview}` : ''
    throw new ApiError(`The API returned a non-JSON response (HTTP ${response.status}, ${contentType || 'unknown content type'}).${detail}`, response.status)
  }
  if (!response.ok) {
    if (response.status === 401 && !path.includes('/auth/login')) {
      clearSession()
      window.location.assign('/login')
    }
    throw new ApiError(body.error ?? 'The request could not be completed.', response.status, body.errors)
  }

  window.dispatchEvent(new Event('medicare:connection-restored'))

  if (path === '/api/public/overview') {
    const isStale = response.headers.get('X-MediCare-Stale') === 'true'
    const eventName = isStale
      ? 'medicare:catalog-stale'
      : 'medicare:catalog-fresh'
    window.dispatchEvent(new Event(eventName))
  }

  return body
}

export function getApiData<T>(path: string, signal?: AbortSignal) {
  return request<{ data: T }>(path, signal ? { signal } : {}).then((response) => response.data)
}

export function apiRequest<T>(path: string, init: RequestInit = {}) {
  return request<T>(path, init)
}

export async function signIn(identity: string, password: string) {
  const response = await request<{
    user: StaffUser
    tokens: { access_token: string }
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identity, password }),
  })

  sessionVersion += 1
  sessionStorage.setItem(ACCESS_TOKEN_KEY, response.tokens.access_token)
  sessionStorage.setItem(STAFF_USER_KEY, JSON.stringify(response.user))
  return response.user
}

export async function getPatients() {
  const response = await request<{ data: Patient[] }>('/api/patients')
  return response.data
}

export async function getPatient(id: string | number) {
  const response = await request<{ data: Patient }>(`/api/patients/${encodeURIComponent(id)}`)
  return response.data
}

export async function createPatient(patient: PatientInput) {
  const response = await request<{ data: Patient }>('/api/patients', {
    method: 'POST',
    body: JSON.stringify(patient),
  })
  return response.data
}

export async function updatePatient(id: number, patient: PatientInput) {
  const response = await request<{ data: Patient }>(`/api/patients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patient),
  })
  return response.data
}

export async function deletePatient(id: number) {
  await request<{ message: string }>(`/api/patients/${id}`, { method: 'DELETE' })
}
