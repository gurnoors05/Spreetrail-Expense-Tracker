import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/auth/refresh/`,
            { refresh }
          );
          localStorage.setItem('access_token', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// ─── Auth ────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register/', data),
  login:    (data) => api.post('/auth/login/', data),
  me:       ()     => api.get('/auth/me/'),
};

// ─── Users ───────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users/'),
};

// ─── Groups ──────────────────────────────────────────────
export const groupsApi = {
  list:            ()       => api.get('/groups/'),
  create:          (data)   => api.post('/groups/', data),
  detail:          (id)     => api.get(`/groups/${id}/`),
  update:          (id, d)  => api.patch(`/groups/${id}/`, d),
  delete:          (id)     => api.delete(`/groups/${id}/`),
  balances:        (id)     => api.get(`/groups/${id}/balances/`),
};

// ─── Memberships ─────────────────────────────────────────
export const membershipApi = {
  list:   ()     => api.get('/memberships/'),
  create: (data) => api.post('/memberships/', data),
  update: (id,d) => api.patch(`/memberships/${id}/`, d),
  delete: (id)   => api.delete(`/memberships/${id}/`),
};

// ─── Expenses ────────────────────────────────────────────
export const expensesApi = {
  list:   (params) => api.get('/expenses/', { params }),
  create: (data)   => api.post('/expenses/', data),
  detail: (id)     => api.get(`/expenses/${id}/`),
  update: (id, d)  => api.patch(`/expenses/${id}/`, d),
  delete: (id)     => api.delete(`/expenses/${id}/`),
};

// ─── CSV Import ──────────────────────────────────────────
export const importApi = {
  upload: (data) => api.post('/import/', data),
  report: (id) => api.get(`/import/${id}/report/`),
  list:   (params) => api.get('/import/', { params }),
};

// ─── Anomalies ───────────────────────────────────────────
export const anomaliesApi = {
  list:    ()            => api.get('/anomalies/'),
  resolve: (id, payload) => api.post(`/anomalies/${id}/resolve/`, payload),
};

// ─── Settlements ─────────────────────────────────────────
export const settlementsApi = {
  list: (groupId) => api.get(`/settlements/?group=${groupId}`),
};

export default api;
