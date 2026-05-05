import client from './client';

export const getLogDates = (year, month) =>
  client.get('/climb-logs', { params: { year, month } });

export const getLogsByDate = (date) =>
  client.get('/climb-logs', { params: { date } });

export const createClimbLog = (body) =>
  client.post('/climb-logs', body);

export const deleteClimbLog = (id) =>
  client.delete(`/climb-logs/${id}`);
