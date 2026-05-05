import client from './client';

export const getFeed = (page = 1, limit = 20) =>
  client.get('/feed', { params: { page, limit } });

export const getPopularFeed = (page = 1, limit = 20) =>
  client.get('/feed/popular', { params: { page, limit } });
