// Monorepo Vercel: frontend + FastAPI on same origin via api/index.py + vercel.json rewrites
// - Production (Vercel, Firebase Hosting, custom domain): same-origin '' => fetch('/api/auth/login') -> https://your-domain.vercel.app/api/auth/login -> api/index.py
// - Local dev (localhost:3001): fallback to http://localhost:8000 (via next.config.ts rewrites only in NODE_ENV=development)
// NEVER default to localhost in production — causes DNS_HOSTNAME_RESOLVED_PRIVATE / CORS
const API = (() => {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env !== undefined && env !== null && env !== "") return env; // explicit override: e.g. https://api.run.app or '' forced
  // No env set: same-origin in prod (Vercel/Firebase/custom domain), localhost only for local dev
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return "http://localhost:8000";
    return ""; // production same-origin
  }
  // SSR build: empty for same-origin; local server still needs rewrites via next.config.ts
  return "";
})();

function authHeader(){
  if(typeof window==='undefined') return {}
  const t = localStorage.getItem('thyroid_token')
  return t ? { 'Authorization': `Bearer ${t}` } : {}
}
async function jfetch(url: string, opts?: RequestInit){
  const headers:any = { ...(opts?.headers||{}), ...authHeader() }
  const r = await fetch(`${API}${url}`, { ...opts, headers })
  if(!r.ok){
    const t = await r.text().catch(()=> '')
    throw new Error(t || `${r.status} ${r.statusText}`)
  }
  const ct = r.headers.get('content-type')||''
  if(ct.includes('application/json')) return r.json()
  return r
}

export async function login(email:string, password:string){
  try {
    const r = await fetch(`${API}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,password})})
    if(!r.ok) {
      const t = await r.text().catch(()=> '');
      throw new Error(t || `Login failed: ${r.status} ${r.statusText} (API: ${API})`)
    }
    return r.json()
  } catch (e:any) {
    // Network/CORS error — "Failed to fetch" is the generic browser message for CORS, DNS, or offline
    if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
      throw new Error(`Cannot connect to backend at ${API}/api/auth/login — is the backend running? For local: ensure 'python -m uvicorn app.main:app --host 127.0.0.1 --port 8000' is running. For Vercel/Firebase production: set NEXT_PUBLIC_API_URL to your deployed backend URL (e.g. https://thyroid-lab-api.vercel.app) and redeploy. Current API: ${API} — ${e.message}`)
    }
    throw e
  }
}
export async function getMe(){ return jfetch('/api/auth/me') }
export async function getDashboard(){ return jfetch('/api/dashboard/stats') }
export async function uploadDataset(file:File){
  const fd = new FormData(); fd.append('file', file)
  const headers:any = authHeader()
  const r = await fetch(`${API}/api/datasets/upload`, { method:'POST', body: fd, headers})
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}
export async function analyzeDataset(batchId:string){ return jfetch(`/api/datasets/${batchId}/analyze`, { method:'POST'}) }
export async function getValidation(batchId:string){ return jfetch(`/api/datasets/${batchId}/validation`) }
export async function getResults(batchId:string, params:Record<string,any>={}){
  const q = new URLSearchParams(params).toString()
  return jfetch(`/api/datasets/${batchId}/results${q?'?'+q:''}`)
}
export async function getPatient(batchId:string, pid:string){ return jfetch(`/api/datasets/${batchId}/patient/${encodeURIComponent(pid)}`) }
export async function getAnalytics(batchId:string){ return jfetch(`/api/datasets/${batchId}/analytics`) }
export async function getHistory(limit=20, offset=0){ return jfetch(`/api/datasets/history?limit=${limit}&offset=${offset}`)}
export async function getPerformance(){ return jfetch('/api/model/performance')}
export function downloadUrl(batchId:string, segment:string){ return `${API}/api/datasets/${batchId}/downloads/${segment}` }
export function reportUrl(batchId:string){ return `${API}/api/datasets/${batchId}/report` }
