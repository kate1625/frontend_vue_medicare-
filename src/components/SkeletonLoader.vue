<script setup lang="ts">
withDefaults(defineProps<{
  variant: 'table' | 'list' | 'cards' | 'form' | 'profile' | 'care' | 'timeline' | 'reports' | 'messages' | 'records' | 'booking' | 'patient-dashboard' | 'payment' | 'receipt' | 'patient-profile'
  rows?: number
  columns?: number
  contained?: boolean
  label?: string
}>(), {
  rows: 5,
  columns: 6,
  contained: false,
  label: 'Loading content',
})
</script>

<template>
  <section
    class="skeleton-loader"
    :class="[`skeleton-${variant}`, { 'is-contained': contained }]"
    role="status"
    :aria-label="label"
  >
    <div class="skeleton-motion" aria-hidden="true">
      <template v-if="variant === 'table'">
        <div class="skeleton-table">
          <div class="skeleton-table-head" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(90px, 1fr))` }">
            <span v-for="column in columns" :key="`head-${column}`" class="skeleton-shape" />
          </div>
          <div
            v-for="row in rows"
            :key="`row-${row}`"
            class="skeleton-table-row"
            :style="{ gridTemplateColumns: `repeat(${columns}, minmax(90px, 1fr))` }"
          >
            <span v-for="column in columns" :key="`cell-${column}`" class="skeleton-table-cell">
              <i class="skeleton-shape" />
              <i v-if="column === 1" class="skeleton-shape skeleton-subline" />
            </span>
          </div>
        </div>
      </template>

      <template v-else-if="variant === 'list' || variant === 'timeline'">
        <div v-for="row in rows" :key="`item-${row}`" class="skeleton-list-item">
          <span class="skeleton-shape skeleton-avatar" />
          <span class="skeleton-list-copy">
            <i class="skeleton-shape skeleton-list-title" />
            <i class="skeleton-shape skeleton-list-text" />
            <i class="skeleton-shape skeleton-list-meta" />
          </span>
          <i class="skeleton-shape skeleton-list-status" />
        </div>
      </template>

      <template v-else-if="variant === 'cards'">
        <div class="skeleton-card-grid">
          <article v-for="card in 3" :key="`card-${card}`" class="skeleton-card">
            <div class="skeleton-card-heading"><span class="skeleton-shape skeleton-avatar" /><span class="skeleton-shape skeleton-card-amount" /></div>
            <span class="skeleton-shape skeleton-card-title" />
            <span class="skeleton-shape skeleton-card-line" />
            <span class="skeleton-shape skeleton-card-line short" />
            <div class="skeleton-card-footer"><span class="skeleton-shape" /><span class="skeleton-shape" /></div>
          </article>
        </div>
      </template>

      <template v-else-if="variant === 'form'">
        <div class="skeleton-form-heading"><span class="skeleton-shape skeleton-form-title" /><span class="skeleton-shape skeleton-form-copy" /></div>
        <div class="skeleton-form-grid">
          <div v-for="field in 6" :key="`field-${field}`" class="skeleton-form-field" :class="{ wide: field === 1 || field === 6 }">
            <span class="skeleton-shape skeleton-form-label" />
            <span class="skeleton-shape skeleton-form-input" />
            <span class="skeleton-shape skeleton-form-help" />
          </div>
        </div>
        <div class="skeleton-form-footer"><span class="skeleton-shape skeleton-form-help" /><span class="skeleton-shape skeleton-form-button" /></div>
      </template>

      <template v-else-if="variant === 'profile'">
        <div class="skeleton-profile-hero">
          <span class="skeleton-shape skeleton-profile-avatar" />
          <span class="skeleton-profile-copy"><i class="skeleton-shape skeleton-list-meta" /><i class="skeleton-shape skeleton-profile-name" /><i class="skeleton-shape skeleton-list-status" /></span>
        </div>
        <div class="skeleton-profile-grid">
          <div v-for="item in 6" :key="`profile-${item}`" class="skeleton-profile-item"><i class="skeleton-shape skeleton-form-label" /><i class="skeleton-shape skeleton-profile-value" /></div>
        </div>
        <div class="skeleton-profile-history">
          <i v-for="item in 3" :key="`history-${item}`" class="skeleton-shape skeleton-profile-history-row" />
        </div>
      </template>

      <template v-else-if="variant === 'care'">
        <div class="skeleton-care-layout">
          <aside class="skeleton-care-picker">
            <i class="skeleton-shape skeleton-report-title" />
            <i class="skeleton-shape skeleton-search" />
            <div v-for="patient in 5" :key="`patient-${patient}`" class="skeleton-contact">
              <i class="skeleton-shape skeleton-avatar" />
              <span><i class="skeleton-shape skeleton-list-title" /><i class="skeleton-shape skeleton-list-meta" /></span>
            </div>
          </aside>
          <div class="skeleton-care-history">
            <div class="skeleton-profile-hero">
              <i class="skeleton-shape skeleton-profile-avatar" />
              <span class="skeleton-profile-copy"><i class="skeleton-shape skeleton-list-meta" /><i class="skeleton-shape skeleton-profile-name" /><i class="skeleton-shape skeleton-list-text" /></span>
            </div>
            <div class="skeleton-profile-grid">
              <div v-for="item in 4" :key="`care-profile-${item}`" class="skeleton-profile-item"><i class="skeleton-shape skeleton-form-label" /><i class="skeleton-shape skeleton-profile-value" /></div>
            </div>
            <div class="skeleton-profile-history">
              <i v-for="item in 5" :key="`care-record-${item}`" class="skeleton-shape skeleton-profile-history-row" />
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="variant === 'reports'">
        <div class="skeleton-metrics">
          <article v-for="metric in 4" :key="`metric-${metric}`" class="skeleton-metric">
            <i class="skeleton-shape skeleton-avatar" />
            <span><i class="skeleton-shape skeleton-metric-label" /><i class="skeleton-shape skeleton-metric-value" /></span>
          </article>
        </div>
        <div class="skeleton-report-grid">
          <article v-for="chart in 2" :key="`chart-${chart}`" class="skeleton-report-card">
            <i class="skeleton-shape skeleton-report-title" />
            <div class="skeleton-chart">
              <i v-for="bar in 6" :key="`bar-${bar}`" />
            </div>
          </article>
        </div>
      </template>

      <template v-else-if="variant === 'messages'">
        <div class="skeleton-messenger">
          <aside class="skeleton-contacts">
            <i class="skeleton-shape skeleton-report-title" />
            <div v-for="contact in 4" :key="`contact-${contact}`" class="skeleton-contact">
              <i class="skeleton-shape skeleton-avatar" />
              <span><i class="skeleton-shape skeleton-list-title" /><i class="skeleton-shape skeleton-list-meta" /></span>
            </div>
          </aside>
          <div class="skeleton-thread">
            <i class="skeleton-shape skeleton-thread-heading" />
            <i v-for="message in 4" :key="`message-${message}`" class="skeleton-shape skeleton-message" :class="{ outgoing: message % 2 === 0 }" />
            <i class="skeleton-shape skeleton-composer" />
          </div>
        </div>
      </template>

      <template v-else-if="variant === 'records'">
        <div class="skeleton-form-grid">
          <div v-for="field in 4" :key="`record-field-${field}`" class="skeleton-form-field">
            <span class="skeleton-shape skeleton-form-label" />
            <span class="skeleton-shape skeleton-form-input" />
          </div>
        </div>
        <article class="skeleton-tooth-card">
          <i class="skeleton-shape skeleton-report-title" />
          <div v-for="arch in 2" :key="`arch-${arch}`" class="skeleton-tooth-arch">
            <i v-for="tooth in 16" :key="`tooth-${arch}-${tooth}`" class="skeleton-shape" />
          </div>
          <i class="skeleton-shape skeleton-tooth-action" />
        </article>
        <div class="skeleton-record-list">
          <i v-for="record in 3" :key="`record-${record}`" class="skeleton-shape skeleton-profile-history-row" />
        </div>
      </template>

      <template v-else-if="variant === 'patient-dashboard'">
        <div class="skeleton-patient-shortcuts">
          <article v-for="shortcut in 3" :key="`shortcut-${shortcut}`" class="skeleton-patient-shortcut">
            <i class="skeleton-shape skeleton-avatar" />
            <span><i class="skeleton-shape skeleton-list-title" /><i class="skeleton-shape skeleton-list-meta" /></span>
          </article>
        </div>
        <div class="skeleton-patient-metrics">
          <article v-for="metric in 4" :key="`patient-metric-${metric}`" class="skeleton-patient-metric">
            <i class="skeleton-shape skeleton-avatar" />
            <i class="skeleton-shape skeleton-form-label" />
            <i class="skeleton-shape skeleton-patient-value" />
            <i class="skeleton-shape skeleton-list-meta" />
          </article>
        </div>
        <article class="skeleton-patient-section">
          <div class="skeleton-patient-section-heading"><span><i class="skeleton-shape skeleton-report-title" /><i class="skeleton-shape skeleton-list-meta" /></span><i class="skeleton-shape skeleton-section-link" /></div>
          <div v-for="visit in 2" :key="`visit-${visit}`" class="skeleton-patient-visit">
            <i class="skeleton-shape skeleton-visit-date" />
            <span><i class="skeleton-shape skeleton-list-title" /><i class="skeleton-shape skeleton-list-text" /></span>
            <i class="skeleton-shape skeleton-list-status" />
          </div>
        </article>
        <div class="skeleton-patient-lower">
          <article class="skeleton-patient-section skeleton-patient-chart">
            <i class="skeleton-shape skeleton-report-title" />
            <div class="skeleton-chart"><i v-for="bar in 6" :key="`patient-bar-${bar}`" /></div>
          </article>
          <article class="skeleton-patient-section skeleton-patient-activity">
            <span class="skeleton-patient-section-heading"><i class="skeleton-shape skeleton-report-title" /></span>
            <div v-for="activity in 4" :key="`activity-${activity}`" class="skeleton-patient-activity-row">
              <i class="skeleton-shape skeleton-activity-dot" />
              <span><i class="skeleton-shape skeleton-list-text" /><i class="skeleton-shape skeleton-list-meta" /></span>
            </div>
          </article>
        </div>
        <article class="skeleton-patient-section">
          <div class="skeleton-patient-section-heading"><span><i class="skeleton-shape skeleton-report-title" /><i class="skeleton-shape skeleton-list-meta" /></span><i class="skeleton-shape skeleton-section-link" /></div>
          <div v-for="visit in 3" :key="`recent-${visit}`" class="skeleton-patient-visit skeleton-recent-visit">
            <span><i class="skeleton-shape skeleton-list-title" /><i class="skeleton-shape skeleton-list-text" /></span>
            <i class="skeleton-shape skeleton-list-status" />
          </div>
        </article>
      </template>

      <template v-else-if="variant === 'payment'">
        <div class="skeleton-payment-layout">
          <article class="skeleton-payment-card">
            <header class="skeleton-payment-heading">
              <span><i class="skeleton-shape skeleton-payment-kicker" /><i class="skeleton-shape skeleton-payment-title" /></span>
              <i class="skeleton-shape skeleton-payment-caption" />
            </header>
            <div class="skeleton-payment-guidance">
              <i class="skeleton-shape skeleton-guidance-icon" />
              <span><i class="skeleton-shape skeleton-payment-title" /><i class="skeleton-shape skeleton-payment-line" /><i class="skeleton-shape skeleton-payment-line short" /></span>
            </div>
            <div class="skeleton-payment-fields">
              <div v-for="field in 4" :key="`payment-field-${field}`" class="skeleton-payment-field">
                <i class="skeleton-shape skeleton-form-label" />
                <i class="skeleton-shape skeleton-form-input" />
                <i class="skeleton-shape skeleton-form-help" />
              </div>
            </div>
            <footer class="skeleton-payment-actions"><i class="skeleton-shape skeleton-form-button" /><i class="skeleton-shape skeleton-form-button" /></footer>
          </article>
          <aside class="skeleton-payment-card skeleton-payment-summary">
            <header class="skeleton-payment-heading"><span><i class="skeleton-shape skeleton-payment-kicker" /><i class="skeleton-shape skeleton-payment-title" /></span></header>
            <div class="skeleton-summary-visit"><i class="skeleton-shape skeleton-payment-kicker" /><i class="skeleton-shape skeleton-payment-title" /><i class="skeleton-shape skeleton-payment-line short" /></div>
            <div class="skeleton-summary-line"><i class="skeleton-shape" /><i class="skeleton-shape" /></div>
            <div class="skeleton-summary-line"><i class="skeleton-shape" /><i class="skeleton-shape" /></div>
            <div class="skeleton-summary-total"><i class="skeleton-shape" /><i class="skeleton-shape" /></div>
            <i class="skeleton-shape skeleton-summary-note" />
          </aside>
        </div>
        <article class="skeleton-payment-card skeleton-billing">
          <header class="skeleton-payment-heading"><span><i class="skeleton-shape skeleton-payment-kicker" /><i class="skeleton-shape skeleton-payment-title" /><i class="skeleton-shape skeleton-payment-line" /></span></header>
          <div class="skeleton-table">
            <div class="skeleton-table-head" style="grid-template-columns: repeat(5, minmax(100px, 1fr))">
              <i v-for="column in 5" :key="`billing-head-${column}`" class="skeleton-shape" />
            </div>
            <div v-for="row in 3" :key="`billing-row-${row}`" class="skeleton-table-row" style="grid-template-columns: repeat(5, minmax(100px, 1fr))">
              <span v-for="column in 5" :key="`billing-cell-${column}`" class="skeleton-table-cell"><i class="skeleton-shape" /><i v-if="column === 1" class="skeleton-shape skeleton-subline" /></span>
            </div>
          </div>
        </article>
        <div class="skeleton-payment-history">
          <i v-for="item in 2" :key="`payment-history-${item}`" class="skeleton-shape skeleton-profile-history-row" />
        </div>
      </template>

      <template v-else-if="variant === 'receipt'">
        <article class="skeleton-receipt-panel">
          <header class="skeleton-receipt-heading">
            <span>
              <i class="skeleton-shape skeleton-receipt-kicker" />
              <i class="skeleton-shape skeleton-receipt-title" />
              <i class="skeleton-shape skeleton-receipt-description" />
            </span>
            <i class="skeleton-shape skeleton-receipt-action" />
          </header>
          <div class="skeleton-receipt-list">
            <div v-for="row in 3" :key="`receipt-${row}`" class="skeleton-receipt-row">
              <i class="skeleton-shape skeleton-receipt-icon" />
              <span class="skeleton-receipt-copy">
                <i class="skeleton-shape skeleton-receipt-number" />
                <i class="skeleton-shape skeleton-receipt-service" />
                <i class="skeleton-shape skeleton-receipt-meta" />
              </span>
              <i class="skeleton-shape skeleton-receipt-status" />
              <i class="skeleton-shape skeleton-receipt-link" />
            </div>
          </div>
        </article>
      </template>

      <template v-else-if="variant === 'patient-profile'">
        <article class="skeleton-patient-profile-card">
          <header class="skeleton-patient-profile-heading">
            <span>
              <i class="skeleton-shape skeleton-profile-kicker" />
              <i class="skeleton-shape skeleton-profile-name" />
            </span>
            <i class="skeleton-shape skeleton-profile-badge" />
          </header>
          <div class="skeleton-patient-profile-fields">
            <div v-for="field in 6" :key="`patient-profile-field-${field}`" class="skeleton-patient-profile-field" :class="{ wide: field === 3 || field === 6 }">
              <i class="skeleton-shape skeleton-form-label" />
              <i class="skeleton-shape skeleton-form-input" :class="{ multiline: field === 6 }" />
            </div>
          </div>
          <footer class="skeleton-patient-profile-footer">
            <i class="skeleton-shape skeleton-profile-helper" />
            <i class="skeleton-shape skeleton-form-button" />
          </footer>
        </article>
        <article class="skeleton-patient-profile-section">
          <header class="skeleton-patient-profile-section-heading">
            <i class="skeleton-shape skeleton-profile-section-title" />
            <i class="skeleton-shape skeleton-profile-section-copy" />
          </header>
          <div class="skeleton-tooth-conditions">
            <div v-for="tooth in 4" :key="`profile-tooth-${tooth}`" class="skeleton-tooth-condition">
              <i class="skeleton-shape skeleton-profile-section-title" />
              <i class="skeleton-shape skeleton-tooth-condition-line" />
              <i class="skeleton-shape skeleton-profile-section-copy" />
            </div>
          </div>
        </article>
        <article class="skeleton-patient-profile-section">
          <header class="skeleton-patient-profile-section-heading">
            <i class="skeleton-shape skeleton-profile-section-title" />
            <i class="skeleton-shape skeleton-profile-section-copy" />
          </header>
          <div class="skeleton-profile-history">
            <div v-for="record in 3" :key="`profile-history-${record}`" class="skeleton-patient-history-card">
              <div class="skeleton-patient-history-heading">
                <i class="skeleton-shape skeleton-history-title" />
                <i class="skeleton-shape skeleton-history-date" />
              </div>
              <i class="skeleton-shape skeleton-history-meta" />
              <i class="skeleton-shape skeleton-history-notes" />
            </div>
          </div>
        </article>
      </template>

      <template v-else>
        <div class="skeleton-booking-grid">
          <article v-for="card in 3" :key="`booking-${card}`" class="skeleton-booking-card">
            <i class="skeleton-shape skeleton-report-title" />
            <i class="skeleton-shape skeleton-booking-line" />
            <i class="skeleton-shape skeleton-booking-line short" />
            <i class="skeleton-shape skeleton-booking-button" />
          </article>
        </div>
        <div class="skeleton-calendar">
          <i class="skeleton-shape skeleton-calendar-heading" />
          <div v-for="week in 5" :key="`week-${week}`" class="skeleton-calendar-week">
            <i v-for="day in 7" :key="`day-${week}-${day}`" class="skeleton-shape" />
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.skeleton-loader {
  --skeleton-base: #e8efeb;
  --skeleton-shine: rgb(255 255 255 / 82%);
  --skeleton-border: #e5ede8;
  --skeleton-grid: #edf2ef;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--skeleton-border);
  border-radius: 17px;
  background: linear-gradient(145deg, #fff, #f8faf9);
  box-shadow: 0 12px 30px rgb(34 70 58 / 5%);
}
.skeleton-loader.is-contained { border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.skeleton-motion { display: grid; gap: 14px; padding: 20px; }
.skeleton-loader.is-contained .skeleton-motion { padding: 0; }
.skeleton-shape { position: relative; display: block; overflow: hidden; border-radius: 999px; background: var(--skeleton-base); }
.skeleton-shape::after {
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, var(--skeleton-shine), transparent);
  content: '';
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}
.skeleton-table { overflow-x: auto; }
.skeleton-table-head,.skeleton-table-row { display: grid; min-width: max-content; }
.skeleton-table-head { gap: 24px; align-items: center; padding: 13px 18px; border-bottom: 1px solid var(--skeleton-grid); background: #f7faf8; }
.skeleton-table-head .skeleton-shape { width: 58%; height: 9px; }
.skeleton-table-row { gap: 24px; align-items: center; min-height: 57px; padding: 10px 18px; border-bottom: 1px solid var(--skeleton-grid); }
.skeleton-table-row:last-child { border-bottom: 0; }
.skeleton-table-cell { display: grid; min-width: 0; gap: 7px; }
.skeleton-table-cell .skeleton-shape { width: 73%; height: 10px; }
.skeleton-table-cell:nth-child(2n) .skeleton-shape { width: 57%; }
.skeleton-table-cell .skeleton-subline { width: 88%; height: 8px; }
.skeleton-list-item { display: flex; min-width: 0; align-items: center; gap: 14px; padding: 13px 14px; border: 1px solid var(--skeleton-grid); border-radius: 13px; background: rgb(255 255 255 / 58%); }
.skeleton-avatar { width: 39px; height: 39px; flex: 0 0 auto; border-radius: 12px; }
.skeleton-list-copy { display: grid; min-width: 0; flex: 1; gap: 8px; }
.skeleton-list-title { width: min(230px, 62%); height: 12px; }
.skeleton-list-text { width: min(600px, 92%); height: 10px; }
.skeleton-list-meta { width: min(160px, 43%); height: 8px; }
.skeleton-list-status { width: 58px; height: 19px; }
.skeleton-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 15px; }
.skeleton-card { display: grid; gap: 14px; min-width: 0; padding: 18px; border: 1px solid var(--skeleton-grid); border-radius: 15px; background: rgb(255 255 255 / 55%); }
.skeleton-card-heading,.skeleton-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.skeleton-card-amount { width: 78px; height: 15px; }
.skeleton-card-title { width: 55%; height: 13px; }
.skeleton-card-line { width: 96%; height: 10px; }
.skeleton-card-line.short { width: 72%; }
.skeleton-card-footer .skeleton-shape { width: 70px; height: 24px; }
.skeleton-form-heading { display: grid; gap: 10px; padding-bottom: 17px; border-bottom: 1px solid var(--skeleton-grid); }
.skeleton-form-title { width: min(270px, 70%); height: 18px; }
.skeleton-form-copy { width: min(520px, 90%); height: 10px; }
.skeleton-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 18px; }
.skeleton-form-field { display: grid; gap: 9px; min-width: 0; }
.skeleton-form-field.wide { grid-column: 1 / -1; }
.skeleton-form-label { width: 34%; height: 10px; }
.skeleton-form-input { width: 100%; height: 43px; border-radius: 9px; }
.skeleton-form-help { width: 70%; height: 8px; }
.skeleton-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 16px; border-top: 1px solid var(--skeleton-grid); }
.skeleton-form-button { width: 142px; height: 40px; border-radius: 10px; }
.skeleton-profile-hero { display: flex; align-items: center; gap: 17px; padding: 19px; border: 1px solid var(--skeleton-grid); border-radius: 14px; }
.skeleton-profile-avatar { width: 66px; height: 66px; border-radius: 18px; }
.skeleton-profile-copy { display: grid; gap: 9px; }
.skeleton-profile-name { width: 230px; max-width: 60vw; height: 18px; }
.skeleton-profile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--skeleton-grid); border-radius: 13px; background: var(--skeleton-grid); }
.skeleton-profile-item { display: grid; gap: 10px; min-height: 74px; align-content: center; padding: 13px 17px; background: #fff; }
.skeleton-profile-item .skeleton-form-label { width: 30%; }
.skeleton-profile-value { width: 66%; height: 12px; }
.skeleton-profile-history { display: grid; gap: 8px; }
.skeleton-profile-history-row { width: 100%; height: 48px; border-radius: 10px; }
.skeleton-care-layout { display: grid; grid-template-columns: minmax(210px, .7fr) minmax(0, 1.8fr); gap: 14px; }
.skeleton-care-picker,.skeleton-care-history { display: grid; align-content: start; gap: 12px; min-width: 0; padding: 16px; border: 1px solid var(--skeleton-grid); border-radius: 13px; background: rgb(255 255 255 / 55%); }
.skeleton-search { width: 100%; height: 36px; border-radius: 9px; }
.skeleton-care-picker .skeleton-contact { padding-inline: 5px; background: transparent; }
.skeleton-care-history .skeleton-profile-hero { padding: 0 0 15px; border: 0; border-bottom: 1px solid var(--skeleton-grid); border-radius: 0; }
.skeleton-care-history .skeleton-profile-avatar { width: 54px; height: 54px; }
.skeleton-care-history .skeleton-profile-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.skeleton-care-history .skeleton-profile-item { min-height: 60px; padding: 10px; }
.skeleton-care-history .skeleton-profile-history-row { height: 58px; }
.skeleton-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; }
.skeleton-metric { display: flex; align-items: center; gap: 12px; padding: 15px; border: 1px solid var(--skeleton-grid); border-radius: 13px; background: rgb(255 255 255 / 60%); }
.skeleton-metric > span { display: grid; flex: 1; gap: 9px; }
.skeleton-metric-label { width: 75%; height: 9px; }
.skeleton-metric-value { width: 54%; height: 17px; }
.skeleton-report-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.skeleton-report-card { min-width: 0; padding: 17px; border: 1px solid var(--skeleton-grid); border-radius: 13px; background: rgb(255 255 255 / 55%); }
.skeleton-report-title { width: min(200px, 68%); height: 13px; }
.skeleton-chart { display: flex; height: 180px; align-items: flex-end; justify-content: space-around; gap: 12px; margin-top: 18px; padding: 0 6px; border-bottom: 1px solid var(--skeleton-grid); background: repeating-linear-gradient(to bottom, transparent 0, transparent 43px, var(--skeleton-grid) 44px, var(--skeleton-grid) 45px); }
.skeleton-chart i { width: min(9%, 30px); height: 45%; border-radius: 6px 6px 0 0; background: #dce9e2; }
.skeleton-chart i:nth-child(2) { height: 67%; }.skeleton-chart i:nth-child(3) { height: 55%; }.skeleton-chart i:nth-child(4) { height: 82%; }.skeleton-chart i:nth-child(5) { height: 61%; }.skeleton-chart i:nth-child(6) { height: 73%; }
.skeleton-messenger { display: grid; min-height: 480px; grid-template-columns: minmax(220px, .7fr) minmax(0, 1.6fr); overflow: hidden; border: 1px solid var(--skeleton-grid); border-radius: 12px; }
.skeleton-contacts { display: grid; align-content: start; gap: 13px; padding: 17px; border-right: 1px solid var(--skeleton-grid); }
.skeleton-contact { display: flex; align-items: center; gap: 10px; padding: 9px; border-radius: 10px; background: rgb(255 255 255 / 55%); }
.skeleton-contact > span { display: grid; flex: 1; gap: 7px; }
.skeleton-thread { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 18px; }
.skeleton-thread-heading { width: 45%; height: 30px; margin-bottom: auto; }
.skeleton-message { width: 62%; height: 48px; border-radius: 14px; }
.skeleton-message.outgoing { width: 48%; align-self: flex-end; }
.skeleton-composer { width: 100%; height: 48px; margin-top: 14px; border-radius: 10px; }
.skeleton-tooth-card { display: grid; gap: 16px; padding: 18px; border: 1px solid var(--skeleton-grid); border-radius: 13px; }
.skeleton-tooth-arch { display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 6px; }
.skeleton-tooth-arch .skeleton-shape { height: 43px; border-radius: 6px 6px 10px 10px; }
.skeleton-tooth-action { width: min(300px, 60%); height: 39px; border-radius: 9px; }
.skeleton-record-list { display: grid; gap: 8px; }
.skeleton-booking-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.skeleton-booking-card { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--skeleton-grid); border-radius: 13px; }
.skeleton-booking-line { width: 90%; height: 10px; }.skeleton-booking-line.short { width: 58%; }
.skeleton-booking-button { width: 100%; height: 35px; margin-top: 5px; border-radius: 9px; }
.skeleton-calendar { display: grid; gap: 10px; padding: 16px; border: 1px solid var(--skeleton-grid); border-radius: 13px; }
.skeleton-calendar-heading { width: 35%; height: 14px; margin: 0 auto 8px; }
.skeleton-calendar-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.skeleton-calendar-week .skeleton-shape { height: 29px; border-radius: 7px; }
.skeleton-patient-shortcuts,.skeleton-patient-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.skeleton-patient-shortcut,.skeleton-patient-metric,.skeleton-patient-section { min-width: 0; border: 1px solid var(--skeleton-grid); border-radius: 14px; background: rgb(255 255 255 / 55%); }
.skeleton-patient-shortcut { display: flex; min-height: 65px; align-items: center; gap: 11px; padding: 12px; }
.skeleton-patient-shortcut > span { display: grid; flex: 1; gap: 8px; }
.skeleton-patient-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.skeleton-patient-metric { display: grid; min-height: 125px; align-content: start; gap: 11px; padding: 15px; }
.skeleton-patient-value { width: 48%; height: 22px; border-radius: 7px; }
.skeleton-patient-section { padding: 17px 19px; }
.skeleton-patient-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.skeleton-patient-section-heading > span { display: grid; gap: 8px; }
.skeleton-section-link { width: 105px; height: 10px; }
.skeleton-patient-visit { display: flex; min-height: 62px; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--skeleton-grid); }
.skeleton-patient-visit > span { display: grid; flex: 1; gap: 8px; }
.skeleton-visit-date { width: 42px; height: 46px; flex: 0 0 auto; border-radius: 11px; }
.skeleton-patient-lower { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.skeleton-patient-chart .skeleton-chart { height: 160px; }
.skeleton-patient-activity { display: grid; align-content: start; gap: 5px; }
.skeleton-patient-activity-row { display: flex; align-items: flex-start; gap: 11px; padding: 10px 0; border-top: 1px solid var(--skeleton-grid); }
.skeleton-patient-activity-row > span { display: grid; flex: 1; gap: 8px; }
.skeleton-activity-dot { width: 9px; height: 9px; flex: 0 0 auto; margin: 3px 2px 0; border-radius: 50%; }
.skeleton-recent-visit > span { display: grid; flex: 1; gap: 8px; }
.skeleton-payment-layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(260px, .85fr); align-items: start; gap: 15px; }
.skeleton-payment-card { min-width: 0; overflow: hidden; border: 1px solid var(--skeleton-grid); border-radius: 14px; background: rgb(255 255 255 / 55%); }
.skeleton-payment-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 19px; border-bottom: 1px solid var(--skeleton-grid); }
.skeleton-payment-heading > span { display: grid; gap: 9px; }
.skeleton-payment-kicker { width: 88px; height: 8px; }
.skeleton-payment-title { width: min(230px, 65%); height: 15px; }
.skeleton-payment-caption { width: 108px; height: 22px; }
.skeleton-payment-guidance { display: flex; gap: 11px; margin: 16px 18px 5px; padding: 13px; border: 1px solid var(--skeleton-grid); border-radius: 11px; }
.skeleton-payment-guidance > span { display: grid; flex: 1; gap: 8px; }
.skeleton-guidance-icon { width: 25px; height: 25px; flex: 0 0 auto; border-radius: 8px; }
.skeleton-payment-line { width: 100%; height: 9px; }.skeleton-payment-line.short { width: 66%; }
.skeleton-payment-fields { display: grid; gap: 15px; padding: 15px 18px; }
.skeleton-payment-field { display: grid; gap: 8px; }
.skeleton-payment-field .skeleton-form-input { height: 40px; }
.skeleton-payment-actions { display: flex; flex-wrap: wrap; gap: 9px; padding: 15px 18px; border-top: 1px solid var(--skeleton-grid); }
.skeleton-payment-actions .skeleton-form-button { width: min(205px, 48%); }
.skeleton-payment-summary { padding-bottom: 15px; }
.skeleton-payment-summary .skeleton-payment-heading { margin-bottom: 16px; }
.skeleton-summary-visit { display: grid; gap: 10px; padding: 0 18px 15px; border-bottom: 1px solid var(--skeleton-grid); }
.skeleton-summary-line,.skeleton-summary-total { display: flex; justify-content: space-between; gap: 12px; padding: 10px 18px; }
.skeleton-summary-line .skeleton-shape:first-child { width: 54%; height: 9px; }.skeleton-summary-line .skeleton-shape:last-child { width: 25%; height: 9px; }
.skeleton-summary-total { margin: 4px 14px; padding: 14px 4px; border-top: 1px solid var(--skeleton-grid); border-bottom: 1px solid var(--skeleton-grid); }
.skeleton-summary-total .skeleton-shape:first-child { width: 47%; height: 11px; }.skeleton-summary-total .skeleton-shape:last-child { width: 33%; height: 15px; }
.skeleton-summary-note { width: calc(100% - 36px); height: 9px; margin: 5px 18px 0; }
.skeleton-billing { margin-top: 15px; }
.skeleton-billing .skeleton-payment-heading { border-bottom: 0; }
.skeleton-payment-history { display: grid; gap: 8px; }
.skeleton-receipt-panel { min-width: 0; padding: 22px; border: 1px solid var(--skeleton-grid); border-radius: 15px; background: rgb(255 255 255 / 55%); }
.skeleton-receipt-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 0 0 20px; border-bottom: 1px solid var(--skeleton-grid); }
.skeleton-receipt-heading > span { display: grid; gap: 10px; min-width: 0; }
.skeleton-receipt-kicker { width: 115px; height: 8px; }
.skeleton-receipt-title { width: min(230px, 62%); height: 19px; }
.skeleton-receipt-description { width: min(450px, 88%); height: 10px; }
.skeleton-receipt-action { width: 142px; height: 39px; flex: 0 0 auto; border-radius: 10px; }
.skeleton-receipt-list { display: grid; gap: 11px; padding-top: 18px; }
.skeleton-receipt-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto auto; align-items: center; gap: 15px; min-width: 0; padding: 15px 16px; border: 1px solid var(--skeleton-grid); border-radius: 13px; background: rgb(255 255 255 / 60%); }
.skeleton-receipt-icon { width: 44px; height: 44px; border-radius: 12px; }
.skeleton-receipt-copy { display: grid; min-width: 0; gap: 8px; }
.skeleton-receipt-number { width: min(190px, 58%); height: 12px; }
.skeleton-receipt-service { width: min(260px, 72%); height: 10px; }
.skeleton-receipt-meta { width: min(470px, 94%); height: 8px; }
.skeleton-receipt-status { width: 116px; height: 23px; }
.skeleton-receipt-link { width: 83px; height: 10px; }
.skeleton-patient-profile-card,.skeleton-patient-profile-section { min-width: 0; padding: 21px; border: 1px solid var(--skeleton-grid); border-radius: 15px; background: rgb(255 255 255 / 55%); }
.skeleton-patient-profile-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 17px; border-bottom: 1px solid var(--skeleton-grid); }
.skeleton-patient-profile-heading > span { display: grid; gap: 9px; }
.skeleton-profile-kicker { width: 100px; height: 8px; }
.skeleton-profile-name { width: min(250px, 60%); height: 19px; }
.skeleton-profile-badge { width: 66px; height: 25px; }
.skeleton-patient-profile-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 22px; padding: 20px 0; }
.skeleton-patient-profile-field { display: grid; min-width: 0; gap: 9px; }
.skeleton-patient-profile-field.wide { grid-column: 1 / -1; }
.skeleton-patient-profile-field .skeleton-form-input { height: 43px; border-radius: 9px; }
.skeleton-patient-profile-field .skeleton-form-input.multiline { height: 76px; border-radius: 10px; }
.skeleton-patient-profile-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-top: 16px; border-top: 1px solid var(--skeleton-grid); }
.skeleton-profile-helper { width: min(390px, 66%); height: 9px; }
.skeleton-patient-profile-footer .skeleton-form-button { width: 140px; }
.skeleton-patient-profile-section { display: grid; gap: 15px; }
.skeleton-patient-profile-section-heading { display: grid; gap: 9px; padding-bottom: 14px; border-bottom: 1px solid var(--skeleton-grid); }
.skeleton-profile-section-title { width: min(220px, 58%); height: 15px; }
.skeleton-profile-section-copy { width: min(490px, 82%); height: 9px; }
.skeleton-tooth-conditions { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 11px; }
.skeleton-tooth-condition { display: grid; gap: 10px; min-width: 0; padding: 14px; border: 1px solid var(--skeleton-grid); border-radius: 12px; background: rgb(255 255 255 / 55%); }
.skeleton-tooth-condition-line { width: 76%; height: 11px; }
.skeleton-patient-history-card { display: grid; gap: 11px; padding: 15px; border: 1px solid var(--skeleton-grid); border-radius: 12px; background: rgb(255 255 255 / 55%); }
.skeleton-patient-history-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.skeleton-history-title { width: min(290px, 60%); height: 12px; }
.skeleton-history-date { width: 112px; height: 9px; }
.skeleton-history-meta { width: min(270px, 66%); height: 9px; }
.skeleton-history-notes { width: min(550px, 92%); height: 9px; }
@keyframes skeleton-shimmer { to { transform: translateX(100%); } }
@media (max-width: 900px) {
  .skeleton-receipt-row { grid-template-columns: 44px minmax(0, 1fr) auto; }
  .skeleton-receipt-status { grid-column: 2; grid-row: 2; }
  .skeleton-receipt-link { grid-column: 3; grid-row: 2; }
}
@media (max-width: 760px) {
  .skeleton-card-grid,.skeleton-booking-grid { grid-template-columns: 1fr; }
  .skeleton-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .skeleton-messenger { grid-template-columns: 1fr; }
  .skeleton-care-layout { grid-template-columns: 1fr; }
  .skeleton-care-picker { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .skeleton-care-picker > .skeleton-report-title,.skeleton-care-picker > .skeleton-search { grid-column: 1 / -1; }
  .skeleton-patient-shortcuts { grid-template-columns: 1fr; }
  .skeleton-patient-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .skeleton-patient-lower { grid-template-columns: 1fr; }
  .skeleton-payment-layout { grid-template-columns: 1fr; }
  .skeleton-patient-profile-fields { grid-template-columns: 1fr; }
  .skeleton-patient-profile-field.wide { grid-column: auto; }
  .skeleton-patient-profile-footer { align-items: flex-start; flex-direction: column; }
  .skeleton-patient-profile-footer .skeleton-form-button { width: min(180px, 100%); }
  .skeleton-receipt-panel { padding: 17px; }
  .skeleton-receipt-heading { flex-direction: column; }
  .skeleton-receipt-row { grid-template-columns: 40px minmax(0, 1fr); gap: 11px; }
  .skeleton-receipt-icon { width: 40px; height: 40px; }
  .skeleton-receipt-status,.skeleton-receipt-link { grid-column: 2; grid-row: auto; }
  .skeleton-contacts { border-right: 0; border-bottom: 1px solid var(--skeleton-grid); }
  .skeleton-form-grid { grid-template-columns: 1fr; }
  .skeleton-form-field.wide { grid-column: auto; }
}
@media (max-width: 480px) {
  .skeleton-motion { padding: 13px; }
  .skeleton-loader.is-contained .skeleton-motion { padding: 0; }
  .skeleton-profile-grid { grid-template-columns: 1fr; }
  .skeleton-care-picker { grid-template-columns: 1fr; }
  .skeleton-care-history .skeleton-profile-grid { grid-template-columns: 1fr; }
  .skeleton-tooth-arch { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  .skeleton-tooth-arch .skeleton-shape:nth-child(n+9) { display: none; }
  .skeleton-list-status { display: none; }
  .skeleton-metrics { grid-template-columns: 1fr; }
  .skeleton-patient-profile-card,.skeleton-patient-profile-section { padding: 15px; }
  .skeleton-patient-profile-heading { align-items: flex-start; }
  .skeleton-history-date { width: 78px; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-shape::after { animation: none; transform: none; background: rgb(255 255 255 / 20%); }
}
:global(.app-shell[data-theme='dark'] .skeleton-loader) {
  --skeleton-base: #34473f;
  --skeleton-shine: rgb(174 214 192 / 22%);
  --skeleton-border: #354741;
  --skeleton-grid: #34473f;
  background: linear-gradient(145deg, #202e2a, #263630);
  box-shadow: 0 12px 30px rgb(0 0 0 / 12%);
}
:global(.app-shell[data-theme='dark'] .skeleton-table-head) { background: #263630; }
:global(.app-shell[data-theme='dark'] .skeleton-list-item),
:global(.app-shell[data-theme='dark'] .skeleton-card),
:global(.app-shell[data-theme='dark'] .skeleton-profile-item),
:global(.app-shell[data-theme='dark'] .skeleton-metric),
:global(.app-shell[data-theme='dark'] .skeleton-report-card),
:global(.app-shell[data-theme='dark'] .skeleton-contact),
:global(.app-shell[data-theme='dark'] .skeleton-care-picker),
:global(.app-shell[data-theme='dark'] .skeleton-care-history),
:global(.app-shell[data-theme='dark'] .skeleton-booking-card),
:global(.app-shell[data-theme='dark'] .skeleton-payment-card),
:global(.app-shell[data-theme='dark'] .skeleton-receipt-panel),
:global(.app-shell[data-theme='dark'] .skeleton-receipt-row),
:global(.app-shell[data-theme='dark'] .skeleton-patient-profile-card),
:global(.app-shell[data-theme='dark'] .skeleton-patient-profile-section),
:global(.app-shell[data-theme='dark'] .skeleton-tooth-condition),
:global(.app-shell[data-theme='dark'] .skeleton-patient-history-card),
:global(.app-shell[data-theme='dark'] .skeleton-patient-shortcut),
:global(.app-shell[data-theme='dark'] .skeleton-patient-metric),
:global(.app-shell[data-theme='dark'] .skeleton-patient-section) { background: #1d2b26; }
:global(.app-shell[data-theme='dark'] .skeleton-payment-guidance) { border-color: #34473f; background: #263630; }
:global(.app-shell[data-theme='dark'] .skeleton-chart i) { background: #3a5548; }
</style>
