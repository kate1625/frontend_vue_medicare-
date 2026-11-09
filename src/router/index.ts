import { createRouter, createWebHistory } from 'vue-router'
import { getPortalRole, hasSession, type PortalRole } from '../services/api'

export interface SitemapPage {
  number: number
  title: string
  path: string
  area: 'public' | PortalRole
  endpoint?: string
}

export const sitemap: SitemapPage[] = [
  { number: 1, title: 'Landing Page', path: '/', area: 'public', endpoint: '/api/public/overview' },
  { number: 2, title: 'Register', path: '/register', area: 'public', endpoint: '/api/auth/register' },
  { number: 3, title: 'Email Verification', path: '/verify-email', area: 'public', endpoint: '/api/auth/verify-email' },
  { number: 4, title: 'Login', path: '/login', area: 'public', endpoint: '/api/auth/login' },
  { number: 5, title: 'Forgot / Reset Password', path: '/reset-password', area: 'public', endpoint: '/api/auth/password-reset' },
  { number: 6, title: 'Patient Dashboard', path: '/patient/dashboard', area: 'patient', endpoint: '/api/patient/dashboard' },
  { number: 7, title: 'Book Appointment', path: '/patient/book', area: 'patient', endpoint: '/api/appointments/availability' },
  { number: 8, title: 'My Appointments', path: '/patient/appointments', area: 'patient', endpoint: '/api/appointments' },
  { number: 9, title: 'Payment', path: '/patient/payment', area: 'patient', endpoint: '/api/payments/mine' },
  { number: 10, title: 'Payment Receipt', path: '/patient/receipt', area: 'patient', endpoint: '/api/payments/receipt' },
  { number: 11, title: 'Profile & Medical History', path: '/patient/profile', area: 'patient', endpoint: '/api/patient/profile' },
  { number: 12, title: 'Notifications', path: '/patient/notifications', area: 'patient', endpoint: '/api/notifications' },
  { number: 13, title: 'Staff Dashboard', path: '/staff/dashboard', area: 'staff', endpoint: '/api/staff/dashboard' },
  { number: 14, title: 'Appointment Management', path: '/staff/appointments', area: 'staff', endpoint: '/api/appointments' },
  { number: 15, title: 'Appointment Details', path: '/staff/appointments/:id', area: 'staff', endpoint: '/api/appointments/:id' },
  { number: 16, title: 'Patient Records', path: '/patients', area: 'staff', endpoint: '/api/patients' },
  { number: 17, title: 'Patient Record Profile', path: '/patients/:id', area: 'staff', endpoint: '/api/patients/:id' },
  { number: 18, title: 'Add / Edit Patient', path: '/staff/patients/edit', area: 'staff', endpoint: '/api/patients' },
  { number: 19, title: 'Add Treatment Record', path: '/staff/treatments/new', area: 'staff', endpoint: '/api/treatment-records' },
  { number: 20, title: 'Payment Verification', path: '/staff/payments', area: 'staff', endpoint: '/api/payments/pending' },
  { number: 21, title: 'Email & Notification Log', path: '/staff/email-log', area: 'staff', endpoint: '/api/email-notifications' },
  { number: 22, title: 'Admin Dashboard', path: '/admin/dashboard', area: 'admin', endpoint: '/api/admin/dashboard' },
  { number: 23, title: 'Services', path: '/admin/services', area: 'admin', endpoint: '/api/services' },
  { number: 25, title: 'Dentists & Schedules', path: '/admin/dentists', area: 'admin', endpoint: '/api/dentists' },
  { number: 26, title: 'Payment Methods', path: '/admin/payment-methods', area: 'admin', endpoint: '/api/payment-methods' },
  { number: 27, title: 'User Management', path: '/admin/users', area: 'admin', endpoint: '/api/users' },
  { number: 28, title: 'Audit Logs', path: '/admin/audit-logs', area: 'admin', endpoint: '/api/audit-logs' },
  { number: 30, title: 'Reports', path: '/admin/reports', area: 'admin', endpoint: '/api/reports' },
  { number: 31, title: 'Dental Records', path: '/staff/records', area: 'staff', endpoint: '/api/treatment-records' },
  { number: 32, title: 'Prescriptions', path: '/staff/prescriptions', area: 'staff', endpoint: '/api/prescriptions' },
  { number: 33, title: 'Messages', path: '/staff/messages', area: 'staff', endpoint: '/api/messages' },
  { number: 34, title: 'Clinic Settings', path: '/admin/settings', area: 'admin', endpoint: '/api/settings' },
  { number: 35, title: 'Prescriptions', path: '/patient/prescriptions', area: 'patient', endpoint: '/api/prescriptions' },
  { number: 36, title: 'Chat with the Clinic', path: '/patient/messages', area: 'patient', endpoint: '/api/messages' },
  { number: 37, title: 'Dental Tips', path: '/patient/tips', area: 'patient' },
  { number: 39, title: 'Notifications', path: '/admin/notifications', area: 'admin', endpoint: '/api/notifications' },
  { number: 40, title: 'Notifications', path: '/staff/notifications', area: 'staff', endpoint: '/api/notifications' },
  { number: 41, title: 'Prescriptions', path: '/admin/prescriptions', area: 'admin', endpoint: '/api/prescriptions' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'landing', component: () => import('../views/HomeView.vue'), meta: { title: 'Landing Page', public: true } },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: 'Login', public: true } },
    ...sitemap.filter((page) => page.number !== 1 && page.number !== 4).map((page) => ({
      path: page.path,
      name: `page-${page.number}`,
      component: page.number === 37
        ? () => import('../views/DentalTipsView.vue')
        : [32, 35, 41].includes(page.number)
          ? () => import('../views/PrescriptionView.vue')
        : page.number === 39 || page.number === 40
          ? () => import('../views/NotificationsView.vue')
        : page.number >= 31
        ? () => import('../views/WorkspaceFeaturesView.vue')
        : page.number === 30
        ? () => import('../views/ReportsView.vue')
        : page.number === 13 || page.number === 22
          ? () => import('../views/ClinicDashboardView.vue')
          : page.number === 23
            ? () => import('../views/AdminServicesView.vue')
            : page.number === 25
              ? () => import('../views/DentistsSchedulesView.vue')
              : page.number === 26
                ? () => import('../views/PaymentMethodsView.vue')
                : page.number === 27
                  ? () => import('../views/UserManagementView.vue')
                  : page.number === 28
                    ? () => import('../views/AuditLogsView.vue')
                    : page.number === 21
                      ? () => import('../views/EmailLogView.vue')
        : page.number === 2
          ? () => import('../views/RegisterView.vue')
          : page.number === 3
            ? () => import('../views/VerifyEmailView.vue')
            : page.number === 5
              ? () => import('../views/PasswordResetView.vue')
        : page.number === 6
          ? () => import('../views/PatientDashboardView.vue')
          : page.number === 9
            ? () => import('../views/PaymentView.vue')
            : page.number === 10
              ? () => import('../views/ReceiptView.vue')
          : page.number === 11
            ? () => import('../views/PatientProfileView.vue')
            : page.number === 12
              ? () => import('../views/NotificationsView.vue')
              : page.number === 19
                ? () => import('../views/TreatmentRecordView.vue')
                : page.number === 20
                  ? () => import('../views/PaymentVerificationView.vue')
        : page.number === 16 || page.number === 18
        ? () => import('../views/PatientsView.vue')
        : page.number === 17
          ? () => import('../views/PatientDetailView.vue')
          : page.number === 7
            ? () => import('../views/BookAppointmentView.vue')
            : page.number === 8 || page.number === 14
              ? () => import('../views/AppointmentsView.vue')
              : page.number === 15
                ? () => import('../views/AppointmentDetailView.vue')
          : () => import('../views/SitemapPageView.vue'),
      props: [8, 13, 14, 16, 22].includes(page.number) ? { pageNumber: page.number } : undefined,
      meta: { title: page.title, public: page.area === 'public', role: page.area === 'public' ? undefined : page.area },
    })),
    { path: '/admin/services/edit', redirect: '/admin/services' },
    { path: '/admin/email-log', redirect: '/staff/email-log' },
    { path: '/notifications', redirect: () => {
      const currentRole = getPortalRole()
      return currentRole === 'patient' ? '/patient/notifications' : currentRole === 'admin' ? '/admin/notifications' : '/staff/notifications'
    } },
    { path: '/settings/profile', name: 'profile-settings', component: () => import('../views/ProfileSettingsView.vue'), meta: { title: 'Profile & settings' } },
    { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Dashboard', role: 'staff' } },
    { path: '/access-denied', name: 'page-403', component: () => import('../views/AccessDeniedView.vue'), meta: { title: 'Access denied', public: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  if (to.name === 'page-15' && !/^\d+$/.test(String(to.params.id ?? ''))) {
    return { path: '/staff/appointments', replace: true }
  }
  if (to.name === 'page-17' && !/^\d+$/.test(String(to.params.id ?? ''))) {
    return { path: '/patients', replace: true }
  }

  const isPublic = to.meta.public === true
  if (!isPublic && !hasSession()) return { name: 'login', query: { redirect: to.fullPath } }
  const requiredRole = to.meta.role as PortalRole | undefined
  const currentRole = getPortalRole()
  if (requiredRole && currentRole !== requiredRole && !(requiredRole === 'staff' && currentRole === 'admin')) {
    return { name: 'page-403' }
  }
  if (to.name === 'login' && hasSession()) {
    return currentRole === 'patient' ? { path: '/patient/dashboard' } : currentRole === 'admin' ? { path: '/admin/dashboard' } : { name: 'dashboard' }
  }
})

export default router
