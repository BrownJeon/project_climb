import { client } from './client';

export const routesApi = {
  list: (params = {}) => client.get('/routes', { params }),
  get: (id) => client.get(`/routes/${id}`),
  remove: (id) => client.delete(`/routes/${id}`),
  toggleLike: (id) => client.post(`/routes/${id}/like`),
  toggleBookmark: (id) => client.post(`/routes/${id}/bookmark`),
  comments: (id) => client.get(`/routes/${id}/comments`),
  addComment: (id, content) => client.post(`/routes/${id}/comments`, { content }),
};
