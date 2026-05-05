import client from './client';

export const listGyms = (params = {}) =>
  client.get('/gyms', { params });

export const getGym = (id) =>
  client.get(`/gyms/${id}`);

export const getGymProblems = (id, params = {}) =>
  client.get(`/gyms/${id}/problems`, { params });
