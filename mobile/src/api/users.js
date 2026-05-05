import client from './client';

export const getProfile = (id) =>
  client.get(`/users/${id}`);

export const updateProfile = (formData) =>
  client.put('/users/me', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getMyRoutes = (params = {}) =>
  client.get('/users/me/routes', { params });

export const getMyBookmarks = (params = {}) =>
  client.get('/users/me/bookmarks', { params });

export const getMyLikes = (params = {}) =>
  client.get('/users/me/likes', { params });

export const followUser = (id) =>
  client.post(`/users/${id}/follow`);

export const unfollowUser = (id) =>
  client.delete(`/users/${id}/follow`);
