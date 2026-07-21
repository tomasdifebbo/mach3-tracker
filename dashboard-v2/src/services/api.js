// API Base Configuration
// In production, frontend is served by the same Express server (same-origin)
const API_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000' 
  : '';

export const getAuthHeaders = () => {
  const token = localStorage.getItem('mach3_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
  };
};

// Safe JSON parser: handles non-JSON responses (e.g., HTML error pages from proxy)
async function safeJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Resposta inválida do servidor (${resp.status})` };
  }
}

export const api = {
  // Auth
  login: async (email, password) => {
    const resp = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await safeJson(resp);
    if (!resp.ok) throw new Error(data.error || `Erro ${resp.status}`);
    return data;
  },

  recoverPassword: async (email) => {
    const resp = await fetch(`${API_URL}/api/auth/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return safeJson(resp);
  },

  resetPassword: async (token, newPassword) => {
    const resp = await fetch(`${API_URL}/api/auth/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    return safeJson(resp);
  },
  
  register: async (email, password) => {
    const resp = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await safeJson(resp);
    if (!resp.ok) throw new Error(data.error || `Erro ${resp.status}`);
    return data;
  },

  // User
  getMe: async () => {
    const resp = await fetch(`${API_URL}/api/user/me`, { 
      headers: getAuthHeaders(),
      cache: 'no-store' 
    });
    if (!resp.ok) throw new Error('Unauthorized');
    return resp.json();
  },

  // Jobs
  getJobs: async () => {
    const resp = await fetch(`${API_URL}/api/jobs`, { 
      headers: getAuthHeaders(),
      cache: 'no-store' 
    });
    if (!resp.ok) throw new Error(`Erro ao buscar jobs (${resp.status})`);
    return resp.json();
  },

  deleteJob: async (id) => {
    const resp = await fetch(`${API_URL}/api/jobs/${id}`, { 
      method: 'DELETE', 
      headers: getAuthHeaders() 
    });
    return safeJson(resp);
  },

  updateJobMaterial: async (jobId, payload) => {
    const resp = await fetch(`${API_URL}/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return safeJson(resp);
  },

  // Materials
  getMaterials: async () => {
    const resp = await fetch(`${API_URL}/api/materials`, { 
      headers: getAuthHeaders(),
      cache: 'no-store' 
    });
    if (!resp.ok) throw new Error(`Erro ao buscar materiais (${resp.status})`);
    return resp.json();
  },

  addMaterial: async (name, price, feedRate = 3000, passWidth = 100) => {
    const resp = await fetch(`${API_URL}/api/materials`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, price, feed_rate: feedRate, pass_width: passWidth })
    });
    return safeJson(resp);
  },

  updateMaterial: async (id, payload) => {
    const resp = await fetch(`${API_URL}/api/materials/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return safeJson(resp);
  },

  deleteMaterial: async (id) => {
    const resp = await fetch(`${API_URL}/api/materials/${id}`, { 
      method: 'DELETE', 
      headers: getAuthHeaders() 
    });
    return safeJson(resp);
  },

  // User Settings
  updateUserSettings: async (settings) => {
    const resp = await fetch(`${API_URL}/api/user/settings`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings)
    });
    return safeJson(resp);
  },

  // Stats
  getStats: async () => {
    const resp = await fetch(`${API_URL}/api/stats`, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (!resp.ok) throw new Error(`Erro ao buscar estatísticas (${resp.status})`);
    return resp.json();
  },

  // Payments
  createPreference: async (planType) => {
    const resp = await fetch(`${API_URL}/api/payments/create-preference`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ planType })
    });
    const data = await safeJson(resp);
    if (!resp.ok) throw new Error(data.error || `Erro ${resp.status}`);
    return data;
  },

  getPaymentStatus: async () => {
    const resp = await fetch(`${API_URL}/api/payments/status`, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    return safeJson(resp);
  },

  // Routers
  getRouters: async () => {
    const resp = await fetch(`${API_URL}/api/routers`, { 
      headers: getAuthHeaders(),
      cache: 'no-store' 
    });
    if (!resp.ok) return [];
    return resp.json();
  },

  updateRouterStatus: async (id, status, status_note) => {
    const resp = await fetch(`${API_URL}/api/routers/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, status_note })
    });
    return safeJson(resp);
  },

  getRouterStatusLog: async () => {
    const resp = await fetch(`${API_URL}/api/routers/status-log`, { 
      headers: getAuthHeaders(),
      cache: 'no-store' 
    });
    if (!resp.ok) return [];
    return resp.json();
  },

  // Maintenance Schedule
  getMaintenance: async () => {
    const resp = await fetch(`${API_URL}/api/maintenance`, { 
      headers: getAuthHeaders(),
      cache: 'no-store' 
    });
    if (!resp.ok) return [];
    return resp.json();
  },

  createMaintenance: async (payload) => {
    const resp = await fetch(`${API_URL}/api/maintenance`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return safeJson(resp);
  },

  updateMaintenance: async (id, payload) => {
    const resp = await fetch(`${API_URL}/api/maintenance/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return safeJson(resp);
  },

  deleteMaintenance: async (id) => {
    const resp = await fetch(`${API_URL}/api/maintenance/${id}`, { 
      method: 'DELETE', 
      headers: getAuthHeaders() 
    });
    return safeJson(resp);
  },

  // Generic REST methods
  get: async (url) => {
    const resp = await fetch(`${API_URL}/api${url}`, { headers: getAuthHeaders() });
    return safeJson(resp);
  },
  post: async (url, body) => {
    const resp = await fetch(`${API_URL}/api${url}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return safeJson(resp);
  },
  patch: async (url, body) => {
    const resp = await fetch(`${API_URL}/api${url}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return safeJson(resp);
  },
  deleteCustom: async (url) => {
    const resp = await fetch(`${API_URL}/api${url}`, { method: 'DELETE', headers: getAuthHeaders() });
    return safeJson(resp);
  }
};
