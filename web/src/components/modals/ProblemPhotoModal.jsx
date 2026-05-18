import { useEffect, useRef, useState } from 'react';
import { Btn } from '../atoms';
import { I } from '../atoms/Icons';
import { climbLogsApi } from '../../api/climbLogs';
import { FAILURE_TAGS, parseFailureTags, joinFailureTags } from '../../utils/failureTags';

/**
 * 볼더링 문제 사진 + 홀드 강조 + 실패 분석 모달.
 * - logId, cpId 필수 (저장 대상)
 * - photo: 기존 사진(편집) | null (신규 업로드)
 * - onSaved(updatedPhoto), onDeleted(photoId)
 *
 * 도구: 원(circle), 사각형(rect)
 *  좌표는 이미지 너비/높이 대비 % 단위로 저장
 */
const ANNOT_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7'];

export default function ProblemPhotoModal({ logId, cpId, photo, onSaved, onDeleted, onClose }) {
  const isEdit = !!photo;
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(photo?.photo_url || null);
  const [annotations, setAnnotations] = useState(() =>
    photo?.hold_annotations ? (Array.isArray(photo.hold_annotations) ? photo.hold_annotations : []) : []
  );
  const [tool, setTool] = useState('circle'); // 'circle' | 'rect' | 'select'
  const [color, setColor] = useState(ANNOT_COLORS[0]);
  const [drawing, setDrawing] = useState(null); // { startX, startY, idx }
  const [tags, setTags] = useState(() => parseFailureTags(photo?.failure_tags));
  const [memo, setMemo] = useState(photo?.failure_memo || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const imgWrapRef = useRef(null);
  const drawingRef = useRef(null); // stale closure 방지용 ref

  useEffect(() => {
    if (!pendingFile) return;
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (f) {
      setPendingFile(f);
      setAnnotations([]);
    }
    e.target.value = '';
  }

  function clientToPercent(e) {
    const wrap = imgWrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  function onDown(e) {
    if (tool === 'select' || !previewUrl) return;
    const pt = clientToPercent(e);
    if (!pt) return;
    // Touch 객체는 preventDefault()가 없으므로 touch wrapper에서 호출, 여기서는 생략
    if (tool === 'circle') {
      const next = { type: 'circle', x: pt.x, y: pt.y, r: 0, color, stroke: 3 };
      const d = { startX: pt.x, startY: pt.y, _pending: true };
      drawingRef.current = d;
      setAnnotations((arr) => {
        d.idx = arr.length;
        drawingRef.current = { ...d };
        return [...arr, next];
      });
      setDrawing({ ...d });
    } else if (tool === 'rect') {
      const next = { type: 'rect', x: pt.x, y: pt.y, w: 0, h: 0, color, stroke: 3 };
      const d = { startX: pt.x, startY: pt.y, _pending: true };
      drawingRef.current = d;
      setAnnotations((arr) => {
        d.idx = arr.length;
        drawingRef.current = { ...d };
        return [...arr, next];
      });
      setDrawing({ ...d });
    }
  }
  function onMove(e) {
    const d = drawingRef.current;
    if (!d || d.idx == null) return;
    const pt = clientToPercent(e);
    if (!pt) return;
    setAnnotations((arr) => arr.map((a, i) => {
      if (i !== d.idx) return a;
      if (a.type === 'circle') {
        const dx = pt.x - d.startX, dy = pt.y - d.startY;
        return { ...a, r: Math.sqrt(dx * dx + dy * dy) };
      }
      if (a.type === 'rect') {
        return {
          ...a,
          x: Math.min(d.startX, pt.x),
          y: Math.min(d.startY, pt.y),
          w: Math.abs(pt.x - d.startX),
          h: Math.abs(pt.y - d.startY),
        };
      }
      return a;
    }));
  }
  function onUp() { drawingRef.current = null; setDrawing(null); }

  function removeAnnotation(idx) {
    setAnnotations((arr) => arr.filter((_, i) => i !== idx));
  }

  function toggleTag(k) {
    setTags((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  }

  async function save() {
    setSaving(true); setErr(null);
    try {
      if (isEdit) {
        const r = await climbLogsApi.updateProblemPhoto(logId, cpId, photo.id, {
          hold_annotations: annotations,
          failure_tags: joinFailureTags(tags),
          failure_memo: memo,
        });
        onSaved?.(r.data);
      } else {
        if (!pendingFile) throw new Error('사진을 선택하세요.');
        const r = await climbLogsApi.uploadProblemPhoto(logId, cpId, pendingFile, {
          hold_annotations: annotations,
          failure_tags: joinFailureTags(tags),
          failure_memo: memo,
        });
        onSaved?.(r.data);
      }
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || '저장 실패');
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!isEdit) return;
    if (!confirm('이 사진을 삭제하시겠어요?')) return;
    setSaving(true); setErr(null);
    try {
      await climbLogsApi.removeProblemPhoto(logId, cpId, photo.id);
      onDeleted?.(photo.id);
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || '삭제 실패');
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 400,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg)', width: '100%', maxWidth: 'var(--max-w, 480px)',
        maxHeight: '95%', borderRadius: '20px 20px 0 0', overflow: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 2,
          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', borderBottom: '1px solid var(--line)',
        }}>
          <button onClick={save} disabled={saving}
            style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
            {saving ? '저장 중...' : '저장'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>문제 사진 분석</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {err && <div style={{ padding: '10px 16px', background: 'var(--danger)', color: '#fff', fontSize: 12 }}>{err}</div>}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 이미지 영역 */}
          {!previewUrl ? (
            <label style={{
              border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)',
              padding: '40px 16px', textAlign: 'center',
              background: 'var(--surface)', color: 'var(--ink-3)', fontSize: 13,
              cursor: 'pointer',
            }}>
              <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
              {I.plus(20)} 사진 선택
            </label>
          ) : (
            <>
              <div ref={imgWrapRef}
                onMouseDown={(e) => { e.preventDefault(); onDown(e); }}
                onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                onTouchStart={(e) => { e.preventDefault(); onDown(e.touches[0]); }}
                onTouchMove={(e) => { e.preventDefault(); onMove(e.touches[0]); }}
                onTouchEnd={onUp}
                style={{
                  position: 'relative', width: '100%', maxHeight: '60vh',
                  background: '#000', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
                  overflow: 'hidden', cursor: tool === 'select' ? 'default' : 'crosshair',
                  userSelect: 'none', touchAction: 'none',
                }}>
                <img src={previewUrl} alt="문제 사진"
                  draggable={false}
                  style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {annotations.map((a, i) => {
                    const stroke = a.color || '#ef4444';
                    const sw = a.stroke || 3;
                    if (a.type === 'circle') {
                      return (
                        <circle key={i} cx={`${a.x}%`} cy={`${a.y}%`} r={`${a.r}%`}
                          fill="none" stroke={stroke} strokeWidth={sw}
                          style={{ pointerEvents: tool === 'select' ? 'auto' : 'none', cursor: 'pointer' }}
                          onClick={() => tool === 'select' && removeAnnotation(i)}
                        />
                      );
                    }
                    if (a.type === 'rect') {
                      return (
                        <rect key={i} x={`${a.x}%`} y={`${a.y}%`} width={`${a.w}%`} height={`${a.h}%`}
                          fill="none" stroke={stroke} strokeWidth={sw}
                          style={{ pointerEvents: tool === 'select' ? 'auto' : 'none', cursor: 'pointer' }}
                          onClick={() => tool === 'select' && removeAnnotation(i)}
                        />
                      );
                    }
                    return null;
                  })}
                </svg>
              </div>

              {/* 도구 모음 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {[['circle', '◯ 원'], ['rect', '▭ 사각'], ['select', '🗑 선택삭제']].map(([k, l]) => (
                  <button key={k} onClick={() => setTool(k)}
                    style={{
                      padding: '6px 10px', fontSize: 12, fontWeight: 600,
                      borderRadius: 'var(--r-pill)',
                      border: '1px solid ' + (tool === k ? 'var(--primary)' : 'var(--line)'),
                      background: tool === k ? 'var(--primary-soft)' : 'var(--surface)',
                      color: tool === k ? 'var(--primary-ink)' : 'var(--ink-2)',
                    }}>{l}</button>
                ))}
                <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>색</span>
                {ANNOT_COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)}
                    aria-label={c}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: c, cursor: 'pointer',
                      border: color === c ? '3px solid var(--ink-1)' : '1px solid var(--line)',
                    }} />
                ))}
                {!isEdit && (
                  <label style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                    padding: '6px 10px', borderRadius: 'var(--r-pill)',
                    border: '1px dashed var(--line-2)', color: 'var(--primary)',
                    cursor: 'pointer',
                  }}>
                    <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
                    사진 변경
                  </label>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {tool === 'select' ? '삭제할 도형을 클릭하세요.' : '이미지 위에서 드래그해 홀드를 강조하세요.'} ({annotations.length}개)
              </div>
            </>
          )}

          {/* 실패 분석 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 }}>실패 원인</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FAILURE_TAGS.map(([k, l]) => {
                const active = tags.includes(k);
                return (
                  <button key={k} onClick={() => toggleTag(k)}
                    style={{
                      padding: '6px 10px', fontSize: 12, fontWeight: 600,
                      borderRadius: 'var(--r-pill)',
                      border: '1px solid ' + (active ? 'var(--primary)' : 'var(--line-2)'),
                      background: active ? 'var(--primary-soft)' : 'var(--surface)',
                      color: active ? 'var(--primary-ink)' : 'var(--ink-2)',
                    }}>{l}</button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 }}>분석 메모</div>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3}
              placeholder="실패 상황·시도해본 무브·다음에 시도할 베타 등"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13.5,
                borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
                background: 'var(--surface)', color: 'var(--ink-1)',
                resize: 'vertical', fontFamily: 'inherit',
              }} />
          </div>

          {isEdit && (
            <Btn variant="danger" full onClick={remove} disabled={saving}>사진 삭제</Btn>
          )}
        </div>
      </div>
    </div>
  );
}
