/**
 * 영상 업로드 + 서버 처리 대기 컨텍스트
 *
 * 흐름: 파일 선택 → 즉시 서버 업로드(진행률 표시) → 서버 백그라운드 압축/썸네일
 *       → 3초마다 폴링 → 완료 시 이벤트 dispatch
 *
 * 영속성: 업로드 완료 후 'processing' 태스크를 localStorage에 저장.
 *         브라우저 새로고침/재접속 시 복원해 폴링 재개.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { climbLogsApi } from '../api/climbLogs';
import { getVideoQualityKey } from '../utils/videoQuality';

const LS_KEY = 'theroute:videoUploads';
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 15 * 60 * 1000; // 15분

const Ctx = createContext({ addTask: () => {}, tasks: [], removeTask: () => {}, clearDone: () => {} });

// ── localStorage 헬퍼 ──────────────────────────────────────────
function loadPersisted() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { return []; }
}
function savePersisted(tasks) {
  const keep = tasks
    .filter((t) => t.status === 'processing' || t.status === 'polling')
    .map(({ id, logId, cpId, filename, addedAt }) => ({ id, logId, cpId, filename, addedAt }));
  localStorage.setItem(LS_KEY, JSON.stringify(keep));
}

// ── 초기 태스크 복원 (앱 시작 시) ────────────────────────────
function restoreTasks() {
  const now = Date.now();
  return loadPersisted()
    .filter((t) => now - (t.addedAt || 0) < POLL_TIMEOUT)
    .map((t) => ({ ...t, status: 'polling', progress: 0, statusMsg: '처리 중...(이전 세션)' }));
}

export function VideoUploadProvider({ children }) {
  const [tasks, setTasks] = useState(restoreTasks);
  const pollingRef = useRef(new Set()); // 현재 폴링 중인 taskId
  const uploadingRef = useRef(new Set()); // 현재 업로드 중인 taskId

  // tasks 변경 시 localStorage 동기화
  useEffect(() => { savePersisted(tasks); }, [tasks]);

  const patchTask = useCallback((id, patch) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);

  // ── 폴링 루프 ────────────────────────────────────────────────
  const startPolling = useCallback((task) => {
    if (pollingRef.current.has(task.id)) return;
    pollingRef.current.add(task.id);

    const startedAt = Date.now();
    const timerId = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT) {
        clearInterval(timerId);
        pollingRef.current.delete(task.id);
        patchTask(task.id, { status: 'error', statusMsg: '처리 시간 초과' });
        return;
      }
      try {
        const res = await climbLogsApi.getProblemVideoStatus(task.logId, task.cpId);
        const { video_status, video_url, thumbnail_url } = res.data?.data || {};

        if (video_status === 'ready') {
          clearInterval(timerId);
          pollingRef.current.delete(task.id);
          patchTask(task.id, { status: 'done', progress: 1, statusMsg: '완료', video_url, thumbnail_url });
          window.dispatchEvent(new CustomEvent('theroute:videoUploaded', {
            detail: { logId: task.logId, cpId: task.cpId, video_url, thumbnail_url },
          }));
        } else if (video_status === 'error') {
          clearInterval(timerId);
          pollingRef.current.delete(task.id);
          patchTask(task.id, { status: 'error', statusMsg: '서버 처리 실패' });
        }
        // 'processing' 상태면 계속 폴링
      } catch {
        // 네트워크 오류는 무시하고 폴링 계속
      }
    }, POLL_INTERVAL);
  }, [patchTask]);

  // 앱 시작 시 복원된 태스크 폴링 재개
  useEffect(() => {
    tasks
      .filter((t) => t.status === 'polling')
      .forEach((t) => startPolling(t));
  }, []); // eslint-disable-line

  // 새로 processing 상태가 된 태스크 감지 → 폴링 시작
  useEffect(() => {
    tasks
      .filter((t) => t.status === 'processing' && !pollingRef.current.has(t.id))
      .forEach((t) => startPolling(t));
  }, [tasks, startPolling]);

  // ── 업로드 실행 ──────────────────────────────────────────────
  const runUpload = useCallback(async (task) => {
    if (uploadingRef.current.has(task.id)) return;
    uploadingRef.current.add(task.id);

    const qualityKey = getVideoQualityKey();
    patchTask(task.id, { status: 'uploading', statusMsg: '업로드 중...', progress: 0 });

    try {
      const res = await climbLogsApi.uploadProblemVideo(task.logId, task.cpId, task.file, {
        quality: qualityKey,
        onUploadProgress: (evt) => {
          const ratio = evt.total ? evt.loaded / evt.total : 0;
          patchTask(task.id, { progress: ratio * 0.95, statusMsg: `업로드 중... ${Math.round(ratio * 100)}%` });
        },
      });

      const { video_status, video_url, thumbnail_url } = res.data?.data || {};
      patchTask(task.id, {
        status: 'processing',
        progress: 0.95,
        statusMsg: '서버에서 처리 중...',
        video_url,
        thumbnail_url,
        video_status,
      });
    } catch (e) {
      patchTask(task.id, { status: 'error', statusMsg: '업로드 실패: ' + (e?.message || '오류') });
    } finally {
      uploadingRef.current.delete(task.id);
    }
  }, [patchTask]);

  // 'queued' 태스크 감지 → 업로드 시작
  useEffect(() => {
    tasks
      .filter((t) => t.status === 'queued' && !uploadingRef.current.has(t.id))
      .forEach((t) => runUpload(t));
  }, [tasks, runUpload]);

  // ── 공개 API ─────────────────────────────────────────────────
  const addTask = useCallback(({ logId, cpId, file }) => {
    const id = `vup-${Date.now()}-${Math.random()}`;
    setTasks((prev) => [...prev, {
      id, logId, cpId, file,
      filename: file.name,
      status: 'queued',
      progress: 0,
      statusMsg: '대기 중',
      addedAt: Date.now(),
    }]);
    return id;
  }, []);

  const removeTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'done' && t.status !== 'error'));
  }, []);

  return (
    <Ctx.Provider value={{ addTask, tasks, removeTask, clearDone }}>
      {children}
    </Ctx.Provider>
  );
}

export function useVideoUpload() {
  return useContext(Ctx);
}
