import axios from 'axios';
import { getAuthToken } from '../hooks/useAuth';

export const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((cfg) => {
  const token = getAuthToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || { success: false, message: err.message })
);
