import { client } from './client';

export const climbLogsApi = {
  monthDates: (year, month) => client.get('/climb-logs', { params: { year, month } }),
  visitedGyms: () => client.get('/climb-logs/visited-gyms'),
  summary: (from, to) => client.get('/climb-logs/summary', { params: { from, to } }),
  byDate: (date) => client.get('/climb-logs', { params: { date } }),
  byId: (id) => client.get(`/climb-logs/${id}`),
  create: (body) => client.post('/climb-logs', body),
  update: (id, body) => client.patch(`/climb-logs/${id}`, body),
  remove: (id) => client.delete(`/climb-logs/${id}`),
  addProblem: (logId, body) => client.post(`/climb-logs/${logId}/problems`, body),
  updateProblem: (logId, cpId, body) => client.patch(`/climb-logs/${logId}/problems/${cpId}`, body),
  removeProblem: (logId, cpId) => client.delete(`/climb-logs/${logId}/problems/${cpId}`),
  uploadProblemVideo: (logId, cpId, file) => {
    const fd = new FormData();
    fd.append('video', file);
    return client.post(`/climb-logs/${logId}/problems/${cpId}/video`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeProblemVideo: (logId, cpId) => client.delete(`/climb-logs/${logId}/problems/${cpId}/video`),
};
