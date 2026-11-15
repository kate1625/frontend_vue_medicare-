<script setup lang="ts">
export type IconName =
  | 'activity'
  | 'arrow-right'
  | 'bell'
  | 'briefcase-medical'
  | 'calendar'
  | 'calendar-plus'
  | 'chart-column'
  | 'check'
  | 'check-circle'
  | 'clock'
  | 'clipboard-list'
  | 'clipboard-plus'
  | 'credit-card'
  | 'credit-card-check'
  | 'droplet'
  | 'file'
  | 'file-edit'
  | 'heart'
  | 'home'
  | 'key'
  | 'layout-dashboard'
  | 'log-out'
  | 'mail'
  | 'menu'
  | 'panel-left-close'
  | 'panel-left-open'
  | 'message-circle'
  | 'reply'
  | 'moon'
  | 'pill'
  | 'plus'
  | 'receipt'
  | 'search'
  | 'settings'
  | 'shield-check'
  | 'sparkles'
  | 'sun'
  | 'stethoscope'
  | 'toothbrush'
  | 'users-round'
  | 'user-round'
  | 'user-round-plus'
  | 'alert-circle'
  | 'alert-triangle'
  | 'copy'
  | 'eye'
  | 'eye-off'
  | 'grid'
  | 'inbox'
  | 'list'
  | 'refresh-cw'
  | 'zap'
  | 'wallet'
  | 'x'

defineProps<{ name: IconName }>()

const iconPaths: Record<IconName, string[]> = {
  'alert-circle': ['M12 8v4', 'M12 16h.01', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z'],
  'alert-triangle': ['M10.3 3.9 1.8 18.1A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  copy: ['M8 8h12v12H8z', 'M16 8V4H4v12h4'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye-off': ['M10.6 10.6a2 2 0 0 0 2.8 2.8', 'M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a15.7 15.7 0 0 1-3.1 3.8', 'M6.6 6.6C3.6 8.3 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4.1-.8', 'm3 3 18 18'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  inbox: ['M4 4h16l2 11h-6l-2 3h-4l-2-3H2L4 4z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  'refresh-cw': ['M20 7v5h-5', 'M4 17v-5h5', 'M5.6 9a7 7 0 0 1 11.5-2L20 12', 'M4 12l2.9 5a7 7 0 0 0 11.5-2'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  'briefcase-medical': ['M10 6V4h4v2', 'M3 8h18v12H3z', 'M12 11v6', 'M9 14h6'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z'],
  'calendar-plus': ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z', 'M12 13v5', 'M9.5 15.5h5'],
  'chart-column': ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  check: ['m5 12 4 4L19 6'],
  'check-circle': ['M22 11.1V12a10 10 0 1 1-5.9-9.1', 'm9 11 3 3L22 4'],
  clock: ['M12 8v4l3 2', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z'],
  'clipboard-list': ['M9 5h6', 'M9 3h6v4H9z', 'M5 5H4v16h16V5h-1', 'M8 12h8', 'M8 16h8', 'M8 9h.01'],
  'clipboard-plus': ['M9 5h6', 'M9 3h6v4H9z', 'M5 5H4v16h16V5h-1', 'M12 11v6', 'M9 14h6'],
  'credit-card': ['M2 7h20', 'M4 4h16a2 2 0 0 1 2 2v12H2V6a2 2 0 0 1 2-2z', 'M6 16h3'],
  'credit-card-check': ['M2 7h20', 'M4 4h16a2 2 0 0 1 2 2v12h-8', 'M6 16h3', 'm13 17 2 2 5-5'],
  droplet: ['M12 22a8 8 0 0 0 8-8c0-4-8-12-8-12S4 10 4 14a8 8 0 0 0 8 8z'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
  'file-edit': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7', 'M14 2v6h6', 'M8 13h5', 'm16 20 5-5-2-2-5 5-1 3z'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z'],
  home: ['m3 10 9-7 9 7', 'M5 9v12h14V9', 'M9 21v-7h6v7'],
  key: ['M21 2l-2 2', 'M7.5 14.5 11 11', 'M16 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z', 'M14 9l2 2', 'M17 6l2 2'],
  'layout-dashboard': ['M3 3h8v8H3z', 'M13 3h8v5h-8z', 'M13 10h8v11h-8z', 'M3 13h8v8H3z'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 6-10 7L2 6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  'panel-left-close': ['M3 3h18v18H3z', 'M9 3v18', 'm14 9-3 3 3 3'],
  'panel-left-open': ['M3 3h18v18H3z', 'M9 3v18', 'm13 9 3 3-3 3'],
  'message-circle': ['M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z'],
  reply: ['M10 15l-5-5 5-5', 'M5 10h8a6 6 0 0 1 6 6v3'],
  moon: ['M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13z'],
  pill: ['m10.5 20.5 10-10a6 6 0 0 0-8.5-8.5l-10 10a6 6 0 0 0 8.5 8.5z', 'm8.5 8.5 7 7'],
  plus: ['M12 5v14', 'M5 12h14'],
  receipt: ['M4 2v20l4-2 4 2 4-2 4 2V2l-4 2-4-2-4 2z', 'M8 9h8', 'M8 13h8', 'M8 17h5'],
  search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z', 'm21 21-4.3-4.3'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.8.2l-.2.1h-3.6l-.1-.2a1.7 1.7 0 0 0-1.5-1.1h-.3l-.2.1-3.1-1.8.1-.2a1.7 1.7 0 0 0-.2-1.8l-.1-.2v-3.6l.2-.1a1.7 1.7 0 0 0 1.1-1.5v-.3l-.1-.2 1.8-3.1.2.1a1.7 1.7 0 0 0 1.8-.2l.2-.1h3.6l.1.2a1.7 1.7 0 0 0 1.5 1.1h.3l.2-.1 3.1 1.8-.1.2a1.7 1.7 0 0 0 .2 1.8l.1.2v3.6z'],
  'shield-check': ['M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z', 'm9 12 2 2 4-4'],
  sparkles: ['m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z', 'M19 14v4', 'M17 16h4', 'M5 3v4', 'M3 5h4'],
  sun: ['M12 3v2', 'M12 19v2', 'M5.6 5.6 7 7', 'M17 17l1.4 1.4', 'M3 12h2', 'M19 12h2', 'M5.6 18.4 7 17', 'M17 7l1.4-1.4', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'],
  stethoscope: ['M6 3v5a4 4 0 0 0 8 0V3', 'M4 3h4', 'M12 3h4', 'M10 12v2a6 6 0 0 0 12 0v-2', 'M22 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
  toothbrush: ['M4 3l16 16', 'M3 4l2-2 3 3-2 2z', 'M15 14l4-4', 'M17 16l4-4', 'M19 18l3-3'],
  'users-round': ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  'user-round': ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  'user-round-plus': ['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M19 8v6', 'M16 11h6'],
  wallet: ['M3 6h16a2 2 0 0 1 2 2v12H3a2 2 0 0 1-2-2V5a3 3 0 0 1 3-3h14v4', 'M21 12h-5a2 2 0 0 0 0 4h5', 'M16 14h.01'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
}
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(path, index) in iconPaths[name]" :key="index" :d="path" />
  </svg>
</template>
