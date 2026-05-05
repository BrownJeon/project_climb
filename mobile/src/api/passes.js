import client from './client';

export const listPasses = (status = 'all') =>
  client.get('/passes', { params: { status } });

export const createPass = (body) =>
  client.post('/passes', body);

export const usePass = (id) =>
  client.post(`/passes/${id}/use`);

export const deletePass = (id) =>
  client.delete(`/passes/${id}`);
