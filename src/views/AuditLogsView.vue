<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError, getApiData } from '../services/api'
import SkeletonLoader from '../components/SkeletonLoader.vue'

async function loadPdf() {
  const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF: jspdfMod.default, autoTable: autoTableMod.default }
}
interface Log {log_id:number;user_id:number|null;username:string|null;action:string;table_name:string|null;record_id:number|null;ip_address:string|null;created_at:string}
const rows=ref<Log[]>([]);const loading=ref(true);const error=ref('')
onMounted(async()=>{try{rows.value=await getApiData<Log[]>('/api/audit-logs')}catch(e){error.value=e instanceof ApiError?e.message:'Could not load audit history.'}finally{loading.value=false}})
async function exportPdf(){const { jsPDF, autoTable } = await loadPdf();const pdf=new jsPDF({orientation:'landscape'});pdf.text('Tooth Doctor Audit Log',14,16);autoTable(pdf,{startY:22,head:[['Time','User','Action','Table','Record','IP']],body:rows.value.map(x=>[x.created_at,x.username||`User ${x.user_id||'—'}`,x.action,x.table_name||'—',String(x.record_id||'—'),x.ip_address||'—'])});pdf.save('audit-logs.pdf')}
</script>
<template><section class="page-heading"><div><h1>Audit Logs</h1><p class="muted">Security and record changes saved by the API.</p></div><button class="button button-primary" :disabled="!rows.length" @click="exportPdf">Export PDF</button></section><SkeletonLoader v-if="loading" variant="table" :rows="5" :columns="6" label="Loading audit logs" /><section v-else-if="error" class="surface empty-state"><strong>Audit log unavailable</strong><p>{{ error }}</p></section><section v-else-if="!rows.length" class="surface empty-state"><strong>No audit events recorded</strong></section><section v-else class="surface table-wrap"><table class="data-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Table</th><th>Record</th><th>IP address</th></tr></thead><tbody><tr v-for="row in rows" :key="row.log_id"><td>{{ row.created_at }}</td><td>{{ row.username||'System/anonymous' }}</td><td>{{ row.action }}</td><td>{{ row.table_name||'—' }}</td><td>{{ row.record_id||'—' }}</td><td>{{ row.ip_address||'—' }}</td></tr></tbody></table></section></template>
