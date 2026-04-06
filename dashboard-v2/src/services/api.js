// API Base Configuration
const API_URL = ''; // Relative path (served by local node server)

export const getAuthHeaders = () => {
  const token = localStorage.getItem('mach3_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
  };
};

export const api = {
  // Auth
  login: async (email, password) => {
    const resp = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return resp.json();
  },
  
  register: async (email, password) => {
    const resp = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return resp.json();
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
    return resp.json();
  },

  deleteJob: async (id) => {
    const resp = await fetch(`${API_URL}/api/jobs/${id}`, { 
      method: 'DELETE', 
      headers: getAuthHeaders() 
    });
    return resp.json();
  },

  updateJobMaterial: async (jobId, payload) => {
    const resp = await fetch(`${API_URL}/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return resp.json();
  },

  // Materials
  getMaterials: async () => {
    const resp = await fetch(`${API_URL}/api/materials`, { 
      headers: getAuthHeaders(),
      cache: 'no-store' 
    });
    return resp.json();
  },

  addMaterial: async (name, price) => {
    const resp = await fetch(`${API_URL}/api/materials`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, price })
    });
    return resp.json();
  },

  deleteMaterial: async (id) => {
    const resp = await fetch(`${API_URL}/api/materials/${id}`, { 
      method: 'DELETE', 
      headers: getAuthHeaders() 
    });
    return resp.json();
  },

  // Payments
  createPreference: async (planType) => {
    const resp = await fetch(`${API_URL}/api/payments/create-preference`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ planType })
    });
    return resp.json();
  }
};
