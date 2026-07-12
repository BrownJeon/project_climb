import { client } from './client';

export const gymSectorsApi = {
  // 섹터 CRUD
  list: (gymId) => client.get(`/gyms/${gymId}/sectors`),
  create: (gymId, body) => client.post(`/gyms/${gymId}/sectors`, body),
  update: (gymId, sectorId, body) => client.patch(`/gyms/${gymId}/sectors/${sectorId}`, body),
  remove: (gymId, sectorId) => client.delete(`/gyms/${gymId}/sectors/${sectorId}`),

  // 교체 주기 스케줄 CRUD
  listSchedules: (gymId) => client.get(`/gyms/${gymId}/schedules`),
  createSchedule: (gymId, body) => client.post(`/gyms/${gymId}/schedules`, body),
  deleteSchedule: (gymId, scheduleId) => client.delete(`/gyms/${gymId}/schedules/${scheduleId}`),

  // 달력용: 스케줄에서 계산된 날짜 목록
  listResets: (gymId, params = {}) => client.get(`/gyms/${gymId}/resets`, { params }),
};
