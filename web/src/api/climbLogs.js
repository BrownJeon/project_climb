import { client } from './client';

export const climbLogsApi = {
  monthDates: (year, month) => client.get('/climb-logs', { params: { year, month } }),
  byDate: (date) => client.get('/climb-logs', { params: { date } }),
  create: (body) => client.post('/climb-logs', body),
  remove: (id) => client.delete(`/climb-logs/${id}`),
};
