<script setup lang="ts">
import { RouterLink } from 'vue-router'
import UiIcon, { type IconName } from '../components/UiIcon.vue'
const tips: { icon: IconName; tone: string; title: string; text: string }[] = [
  {icon:'toothbrush',tone:'mint',title:'Brush with a gentle touch',text:'Brush for two minutes, twice a day. Use a soft-bristled brush and small, gentle circles along the gumline.'},
  {icon:'sparkles',tone:'lav',title:'Clean between your teeth',text:'Floss or use an interdental cleaner once a day to reach the places a toothbrush cannot.'},
  {icon:'droplet',tone:'blue',title:'Choose water often',text:'Water helps rinse away food and keeps your mouth comfortable between meals.'},
  {icon:'heart',tone:'peach',title:'Keep regular checkups',text:'Routine visits help your dental team review your oral health and discuss care that fits your needs.'},
]
</script>
<template>
  <section class="page-heading"><div><p class="eyebrow">PATIENT SPACE</p><h1>Dental care tips</h1><p class="muted">Small daily habits can support a healthy smile.</p></div><RouterLink class="button button-primary" to="/patient/book">Book a visit</RouterLink></section>
  <section class="tips-grid"><article v-for="tip in tips" :key="tip.title" class="surface tip-card"><span class="tip-icon" :class="tip.tone"><UiIcon :name="tip.icon" /></span><h2>{{tip.title}}</h2><p>{{tip.text}}</p></article></section>
  <section class="surface care-note"><span><UiIcon name="stethoscope" /></span><div><strong>Questions about your care?</strong><p>Send a message to the clinic and your care team can follow up with you.</p></div><RouterLink class="button button-quiet" to="/patient/messages">Contact the clinic</RouterLink></section>
</template>
<style scoped>
.tips-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}.tip-card{padding:24px}.tip-icon{display:grid;width:46px;height:46px;place-items:center;border-radius:15px;font-size:22.7px}.tip-icon.mint{background:#e1f5eb;color:#378267}.tip-icon.lav{background:#eee9ff;color:#7566ad}.tip-icon.blue{background:#e6f3ff;color:#5781a8}.tip-icon.peach{background:#fff0e3;color:#b37b4c}.tip-card h2{margin:18px 0 7px;font-size:18.4px;color:#26364a}.tip-card p,.care-note p{margin:0;color:#7b879a;font-size:14px;line-height:1.7}.care-note{display:flex;align-items:center;gap:15px;margin-top:18px;padding:18px 22px}.care-note>span{display:grid;width:42px;height:42px;place-items:center;border-radius:14px;background:#e4f6ed;color:#438d75;font-size:24.8px}.care-note>div{flex:1}.care-note strong{font-size:14px}.care-note p{margin-top:3px}@media(max-width:650px){.tips-grid{grid-template-columns:1fr}.care-note{align-items:flex-start;flex-wrap:wrap}.care-note .button{margin-left:57px}}
</style>
