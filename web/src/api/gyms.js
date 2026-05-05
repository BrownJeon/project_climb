import { client } from './client';

export const gymsApi = {
  list: (params = {}) => client.get('/gyms', { params }),
  get: (id) => client.get(`/gyms/${id}`),
  problems: (id, params = {}) => client.get(`/gyms/${id}/problems`, { params }),
  addProblem: (id, body) => client.post(`/gyms/${id}/problems`, body),
  create: (body) => client.post('/gyms', body),
};
