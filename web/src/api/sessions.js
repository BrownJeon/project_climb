import { client } from './client';

export const sessionsApi = {
  /**
   * 통합 운동 기록 추가.
   * @param {object} payload
   *   - visited_at, gym_id, memo
   *   - gym_pass_id | used_day_pass (XOR, 필수)
   *   - attempts: array of rows
   *   - training: array of training items
   *   - files: { [index]: File }  // attempts[index] 영상 업로드용
   */
  create: ({ files, ...fields }) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'object') fd.append(k, JSON.stringify(v));
      else fd.append(k, String(v));
    }
    if (files) {
      for (const [idx, file] of Object.entries(files)) {
        if (file) fd.append(`video_${idx}`, file);
      }
    }
    return client.post('/sessions', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
