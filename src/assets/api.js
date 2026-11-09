const API_BASE='http://127.0.0.1:8080/api';
async function api(path,opts={}){const res=await fetch(API_BASE+path,{credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':window.CSRF_TOKEN||''},...opts});if(res.status===401){window.location.href='/login';}if(res.status===403){alert('Access denied');}const j=await res.json();if(!j.success)throw new Error(j.message);return j.data;}
window.api=api;
