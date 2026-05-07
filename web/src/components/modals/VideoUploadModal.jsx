import { useRef, useState } from 'react';
import { Btn, ColorBadge } from '../atoms';
import { COLOR_KEYS, COLORS, fmtRouteTitle } from '../../utils/colors';
import { routesApi } from '../../api/routes';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

export default function VideoUploadModal({ onClose, onSaved }) {
  const [color, setColor] = useState('');
  const [level, setLevel] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const canSubmit = !!file && !!color;

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) { setError('영상 파일만 가능합니다.'); return; }
    if (f.size > 200 * 1024 * 1024) { setError('영상은 200MB 이하만 가능합니다.'); return; }
    setError(null);
    setFile(f); setFileName(f.name);
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('video', file);
      fd.append('title', fmtRouteTitle(color, level));
      fd.append('color', color);
      if (level) fd.append('level', level);
      if (description) fd.append('description', description);
      const res = await routesApi.create(fd);
      onSaved?.(res.data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || '저장 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div style={headerStyle}>
          <button onClick={submit} disabled={!canSubmit || submitting}
            style={{ fontSize: 14, fontWeight: 700, color: canSubmit ? 'var(--primary)' : 'var(--ink-4)' }}>
            {submitting ? '업로드 중...' : '저장'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>새 영상 등록</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="영상 파일" required>
            <input ref={fileRef} type="file" accept="video/*" onChange={pickFile}
              style={{ display: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Btn variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                {file ? '다른 영상 선택' : '영상 선택'}
              </Btn>
              {fileName && (
                <span style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fileName}
                </span>
              )}
            </div>
          </Field>

          <Field label="색상" required>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {COLOR_KEYS.map((k) => (
                <button key={k} type="button" onClick={() => setColor(k)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: COLORS[k].dot,
                    border: color === k ? '2.5px solid var(--ink-1)' : '1.5px solid var(--line-2)',
                    cursor: 'pointer',
                  }} title={COLORS[k].label} />
              ))}
            </div>
          </Field>

          <Field label="V등급 (선택)">
            <select value={level} onChange={(e) => setLevel(e.target.value)} style={inputStyle}>
              <option value="">선택 안함</option>
              {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          {(color || level) && (
            <div style={{
              padding: '10px 12px', background: 'var(--surface)',
              borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>미리보기</span>
              <ColorBadge color={color} level={level} />
              <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                {fmtRouteTitle(color, level)}
              </span>
            </div>
          )}

          <Field label="메모">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="자세한 풀이·느낀 점 (선택)"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>

          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
            영상은 마이페이지 → 내 영상에서 관리되며, 운동 기록 추가 시 시도에 검색·연결할 수 있어요.
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300,
};
const sheetStyle = {
  background: 'var(--bg)', width: '100%', maxWidth: 'var(--max-w)', maxHeight: '90%',
  borderRadius: '24px 24px 0 0', overflow: 'auto',
  display: 'flex', flexDirection: 'column',
  animation: 'sheetUp 280ms cubic-bezier(.32,.72,0,1)',
};
const headerStyle = {
  padding: '12px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'var(--surface)', borderBottom: '1px solid var(--line)',
  position: 'sticky', top: 0, zIndex: 2,
};
const errorStyle = { padding: '10px 16px', background: 'var(--danger)', color: '#fff', fontSize: 12 };
const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--ink-1)', outline: 'none',
};

function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
