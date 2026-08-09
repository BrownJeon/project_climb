import { client } from './client';

export function login(email, password) {
  return client.post('/auth/login', { email, password });
}

export function register(email, password, nickname) {
  return client.post('/auth/register', { email, password, nickname });
}

export function getMe() {
  return client.get('/auth/me');
}
