import axios from 'axios';

const TOKEN_KEY = 'theroute_token';

export const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || { success: false, message: err.message })
);
