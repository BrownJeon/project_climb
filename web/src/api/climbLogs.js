import { client } from './client';

export const climbLogsApi = {
  monthDates: (year, month) => client.get('/climb-logs', { params: { year, month } }),
  visitedGyms: () => client.get('/climb-logs/visited-gyms'),
  visitedGymsWithDetail: (limit = 20) => client.get('/climb-logs/visited-gyms', { params: { include_gym: 'true', limit } }),
  summary: (params = {}) => client.get('/climb-logs/summary', { params }),
  byDate: (date) => client.get('/climb-logs', { params: { date } }),
  byGym: (gymId, params = {}) => client.get('/climb-logs', { params: { gym_id: gymId, ...params } }),
  byRange: (from, to, params = {}) => client.get('/climb-logs', { params: { from, to, ...params } }),
  byId: (id) => client.get(`/climb-logs/${id}`),
  listProblems: (params) => client.get('/climb-logs/problems', { params }),
  create: (body) => client.post('/climb-logs', body),
  update: (id, body) => client.patch(`/climb-logs/${id}`, body),
  remove: (id) => client.delete(`/climb-logs/${id}`),
  addProblem: (logId, body) => client.post(`/climb-logs/${logId}/problems`, body),
  updateProblem: (logId, cpId, body) => client.patch(`/climb-logs/${logId}/problems/${cpId}`, body),
  removeProblem: (logId, cpId) => client.delete(`/climb-logs/${logId}/problems/${cpId}`),
  uploadProblemVideo: (logId, cpId, file, { quality = 'standard', onUploadProgress } = {}) => {
    const fd = new FormData();
    fd.append('video', file);
    fd.append('quality', quality);
    return client.post(`/climb-logs/${logId}/problems/${cpId}/video`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
  },
  getProblemVideoStatus: (pvId) =>
    client.get(`/climb-logs/personal-videos/${pvId}/status`),
  deletePersonalVideo: (logId, cpId, pvId) =>
    client.delete(`/climb-logs/${logId}/problems/${cpId}/personal-videos/${pvId}`),
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
