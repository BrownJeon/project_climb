import { client } from './client';

export const climbLogsApi = {
  monthDates: (year, month) => client.get('/climb-logs', { params: { year, month } }),
  visitedGyms: () => client.get('/climb-logs/visited-gyms'),
  summary: (from, to) => client.get('/climb-logs/summary', { params: { from, to } }),
  byDate: (date) => client.get('/climb-logs', { params: { date } }),
  byId: (id) => client.get(`/climb-logs/${id}`),
  listProblems: (params) => client.get('/climb-logs/problems', { params }),
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
  uploadProblemPhoto: (logId, cpId, file, extra = {}) => {
    const fd = new FormData();
    fd.append('photo', file);
    if (extra.hold_annotations != null)
      fd.append('hold_annotations', typeof extra.hold_annotations === 'string'
        ? extra.hold_annotations : JSON.stringify(extra.hold_annotations));
    if (extra.failure_tags != null) fd.append('failure_tags', extra.failure_tags);
    if (extra.failure_memo != null) fd.append('failure_memo', extra.failure_memo);
    return client.post(`/climb-logs/${logId}/problems/${cpId}/photos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateProblemPhoto: (logId, cpId, photoId, body) => {
    const payload = { ...body };
    if (payload.hold_annotations != null && typeof payload.hold_annotations !== 'string') {
      payload.hold_annotations = JSON.stringify(payload.hold_annotations);
    }
    return client.patch(`/climb-logs/${logId}/problems/${cpId}/photos/${photoId}`, payload);
  },
  removeProblemPhoto: (logId, cpId, photoId) =>
    client.delete(`/climb-logs/${logId}/problems/${cpId}/photos/${photoId}`),
};
