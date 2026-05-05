import { client } from './client';

export const trainingApi = {
  goals: (params) => client.get('/training/goals', { params }),
  createGoal: (body) => client.post('/training/goals', body),
  updateGoal: (id, body) => client.patch(`/training/goals/${id}`, body),
  deleteGoal: (id) => client.delete(`/training/goals/${id}`),

  sessions: (params) => client.get('/training/sessions', { params }),
  updateSession: (id, body) => client.patch(`/training/sessions/${id}`, body),
  deleteSession: (id) => client.delete(`/training/sessions/${id}`),

  analyze: (body) => client.post('/training/analyze', body),
  analyses: (params) => client.get('/training/analyses', { params }),
  analysis: (id, params) => client.get(`/training/analyses/${id}`, { params }),
  deleteAnalysis: (id) => client.delete(`/training/analyses/${id}`),

  templates: (params) => client.get('/training/prompt-templates', { params }),
};

/** SSE 스트리밍 분석 — EventSource는 GET만 지원하므로 fetch + ReadableStream 사용 */
export async function* analyzeStream(body) {
  const res = await fetch('/api/training/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(errBody.message || 'analyze failed');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop() || '';
    for (const ev of events) {
      const m = ev.match(/event:\s*(\S+)\s*\ndata:\s*(.+)/s);
      if (m) {
        try { yield { event: m[1], data: JSON.parse(m[2]) }; }
        catch { yield { event: m[1], data: m[2] }; }
      }
    }
  }
}
