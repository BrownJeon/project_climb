import { client } from './client';

export const passesApi = {
  list: (params = {}) => client.get('/passes', { params }),
  create: (body) => client.post('/passes', body),
  update: (id, body) => client.patch(`/passes/${id}`, body),
  use: (id) => client.post(`/passes/${id}/use`),
  remove: (id) => client.delete(`/passes/${id}`),
};
