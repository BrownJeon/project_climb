import { client } from './client';

export const geoApi = {
  search: (q, opts = {}) => client.get('/geo/search', { params: { q, ...opts } }),
  status: () => client.get('/geo/status'),
};
