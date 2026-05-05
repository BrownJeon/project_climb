import client from './client';

export const listRoutes = (params = {}) =>
  client.get('/routes', { params });

export const getRoute = (id) =>
  client.get(`/routes/${id}`);

export const toggleLike = (id) =>
  client.post(`/routes/${id}/like`);

export const toggleBookmark = (id) =>
  client.post(`/routes/${id}/bookmark`);

export const getComments = (id) =>
  client.get(`/routes/${id}/comments`);

export const createComment = (id, content) =>
  client.post(`/routes/${id}/comments`, { content });
