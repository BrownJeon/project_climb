import { client } from './client';

export const usersApi = {
  me: () => client.get('/users/me'),
  get: (id) => client.get(`/users/${id}`),
  updateMe: (formData) => client.put('/users/me', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  myRoutes: (params = {}) => client.get('/users/me/routes', { params }),
  myBookmarks: (params = {}) => client.get('/users/me/bookmarks', { params }),
  myLikes: (params = {}) => client.get('/users/me/likes', { params }),
  addMainGym: (gymId) => client.post(`/users/me/main-gyms/${gymId}`),
  removeMainGym: (gymId) => client.delete(`/users/me/main-gyms/${gymId}`),
};
