import { useEffect, useRef, useState } from 'react';
import { Btn, ColorBadge, Chip } from '../atoms';
import { COLOR_KEYS, COLORS, fmtRouteTitle } from '../../utils/colors';
import { gymsApi } from '../../api/gyms';
import { routesApi } from '../../api/routes';
import GymSearchCombobox from '../GymSearchCombobox';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
const WALL_TYPES = ['오버행', '슬랩', '버티컬', '루프', '볼륨'];
const TECHNIQUES = ['다이나믹', '스태틱', '사이퍼', '하이스텝', '밸런스', '맨틀', '크림프', '포켓', '슬로퍼', '풋워크'];

export default function VideoUploadModal({ onClose, onSaved }) {
  const [color, setColor] = useState('');
  const [level, setLevel] = useState('');
  const [gymId, setGymId] = useState('');
  const [gyms, setGyms] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [wallType, setWallType] = useState('');
  const [techniques, setTechniques] = useState([]);
  const [customTags, setCustomTags] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    gymsApi.list({ limit: 200 }).then((r) => setGyms(r.data?.gyms || [])).catch(() => {});
  }, []);

  function toggleTechnique(t) {
    setTechniques((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) { setError('영상 파일만 가능합니다.'); return; }
    if (f.size > 200 * 1024 * 1024) { setError('영상은 200MB 이하만 가능합니다.'); return; }
    setError(null);
    setFile(f); setFileName(f.name);
  }

  const canSubmit = !!file && !!color && !!level;

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('video', file);
      fd.append('title', title.trim() || fmtRouteTitle(color, level));
      fd.append('color', color);
      fd.append('level', level);
      if (gymId) fd.append('gym_id', String(gymId));
      if (description) fd.append('description', description);
      const customs = customTags.split(',').map((s) => s.trim()).filter(Boolean);
      fd.append('tags', JSON.stringify({
        wall_type: wallType || null,
        techniques,
        custom: customs,
      }));
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
          <Field label="암장">
            <GymSearchCombobox
              value={gymId}
              onChange={(id) => setGymId(id || '')}
              gyms={gyms}
              placeholder="암장 검색 (선택)"
            />
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

          <Field label="V등급" required>
            <select value={level} onChange={(e) => setLevel(e.target.value)} style={inputStyle}>
              <option value="">선택하세요</option>
              {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          {(color && level) && (
            <div style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>미리보기</span>
              <ColorBadge color={color} level={level} />
              <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                자동 제목: {fmtRouteTitle(color, level)}
              </span>
            </div>
          )}

          <Field label="제목">
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={color && level ? fmtRouteTitle(color, level) : '비워두면 자동 생성'}
                style={{ ...inputStyle, flex: 1 }} />
              {color && level && (
                <button type="button"
                  onClick={() => setTitle(fmtRouteTitle(color, level))}
                  style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '0 10px', borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--line-2)', background: 'var(--surface)',
                    color: 'var(--ink-2)', whiteSpace: 'nowrap',
                  }}>자동 채우기</button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
              비워두면 자동 포맷으로 저장됩니다.
            </div>
          </Field>

          <Field label="메모">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="자세한 풀이·느낀 점 (선택)"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>

          <Field label="벽 형태">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WALL_TYPES.map((w) => (
                <Chip key={w} active={wallType === w} onClick={() => setWallType(wallType === w ? '' : w)}>{w}</Chip>
              ))}
            </div>
          </Field>

          <Field label="기술 태그">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TECHNIQUES.map((t) => (
                <Chip key={t} active={techniques.includes(t)} onClick={() => toggleTechnique(t)}>{t}</Chip>
              ))}
            </div>
          </Field>

          <Field label="커스텀 태그">
            <input value={customTags} onChange={(e) => setCustomTags(e.target.value)}
              placeholder="쉼표로 구분 (예: 아침, 컨디션좋음)"
              style={inputStyle} />
          </Field>

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
              {file && (
                <button type="button"
                  onClick={() => { setFile(null); setFileName(''); if (fileRef.current) fileRef.current.value = ''; }}
                  style={{ fontSize: 11, color: 'var(--ink-3)', background: 'transparent', padding: 4 }}>
                  취소
                </button>
              )}
            </div>
          </Field>
        </div>

        <style>{`@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
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
