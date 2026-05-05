import { client } from './client';

export const routesApi = {
  list: (params = {}) => client.get('/routes', { params }),
  get: (id) => client.get(`/routes/${id}`),
  update: (id, formData) => client.put(`/routes/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (id) => client.delete(`/routes/${id}`),
  toggleLike: (id) => client.post(`/routes/${id}/like`),
  toggleBookmark: (id) => client.post(`/routes/${id}/bookmark`),
  comments: (id) => client.get(`/routes/${id}/comments`),
  addComment: (id, content) => client.post(`/routes/${id}/comments`, { content }),
  updateComment: (id, commentId, content) => client.patch(`/routes/${id}/comments/${commentId}`, { content }),
  deleteComment: (id, commentId) => client.delete(`/routes/${id}/comments/${commentId}`),
};
