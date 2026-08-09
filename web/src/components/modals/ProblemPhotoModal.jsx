import { useEffect, useRef, useState } from 'react';
import { Btn } from '../atoms';
import { I } from '../atoms/Icons';
import { climbLogsApi } from '../../api/climbLogs';
import { REVIEW_TAG_GROUPS, parseReviewTags, joinReviewTags, LEGACY_TAG_MAP } from '../../utils/reviewTags';
import { detectHoldsByColor, blobToCircleAnnotation } from '../../utils/holdDetection';

/**
 * 볼더링 문제 사진 + 홀드 강조 + 문제 회고 모달.
 * - logId, cpId 필수 (저장 대상)
 * - photo: 기존 사진(편집) | null (신규 업로드)
 * - onSaved(updatedPhoto), onDeleted(photoId)
 *
 * 도구: 원(circle), 사각형(rect), 선택삭제(select), 색상감지(detect)
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
  const [tool, setTool] = useState('circle'); // 'circle' | 'rect' | 'select' | 'detect'
  const [color, setColor] = useState(ANNOT_COLORS[0]);
  const [drawing, setDrawing] = useState(null); // { startX, startY, idx }
  const [tags, setTags] = useState(() => {
    if (photo?.review_tags) return parseReviewTags(photo.review_tags);
    if (photo?.failure_tags) {
      // 레거시 failure_tags → review_tags 변환 초기값 제안
      const legacyList = photo.failure_tags.split(',').map(s => s.trim()).filter(Boolean);
      return legacyList.map(k => LEGACY_TAG_MAP[k] || k).filter(Boolean);
    }
    return [];
  });
  const [memo, setMemo] = useState(photo?.failure_memo || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  // detect 모드 상태
  const [detecting, setDetecting] = useState(false);
  const [detectedBlobs, setDetectedBlobs] = useState([]);  // {centerX, centerY, minX, minY, maxX, maxY, area, role:null|'start'|'top'}
  const [detectedCanvasSize, setDetectedCanvasSize] = useState({ w: 0, h: 0 }); // 감지 시 사용한 canvas 크기
  const [threshold, setThreshold] = useState(50);
  const [sampledColor, setSampledColor] = useState(null); // {r, g, b}
  const [lastClickClient, setLastClickClient] = useState(null); // {x, y} for re-detect on slider change

  const imgWrapRef = useRef(null);
  const imgRef = useRef(null);  // <img> 요소 직접 참조 (detectHoldsByColor용)
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

  async function handleDetectClick(e) {
    if (!imgRef.current || detecting) return;
    const clickX = e.clientX;
    const clickY = e.clientY;
    setLastClickClient({ x: clickX, y: clickY });
    setDetecting(true);
    try {
      const imgRect = imgRef.current.getBoundingClientRect();
      const result = await detectHoldsByColor(imgRef.current, clickX, clickY, imgRect, threshold);
      setDetectedBlobs(result.blobs);
      setSampledColor(result.sampledColor);
      setDetectedCanvasSize({ w: result.canvasW, h: result.canvasH });
    } catch (err) {
      console.warn('홀드 감지 실패:', err);
    } finally {
      setDetecting(false);
    }
  }

  async function handleThresholdChange(newThreshold) {
    setThreshold(newThreshold);
    if (!lastClickClient || !imgRef.current) return;
    setDetecting(true);
    try {
      const imgRect = imgRef.current.getBoundingClientRect();
      const result = await detectHoldsByColor(imgRef.current, lastClickClient.x, lastClickClient.y, imgRect, newThreshold);
      setDetectedBlobs(result.blobs);
      setSampledColor(result.sampledColor);
      setDetectedCanvasSize({ w: result.canvasW, h: result.canvasH });
    } catch (err) {
      console.warn('재감지 실패:', err);
    } finally {
      setDetecting(false);
    }
  }

  function cycleDetectedBlobRole(idx) {
    setDetectedBlobs(prev => {
      const cur = prev[idx].role;
      if (cur === null) return prev.map((b, i) => i === idx ? { ...b, role: 'start' } : b);
      if (cur === 'start') return prev.map((b, i) => i === idx ? { ...b, role: 'top' } : b);
      // top → 제거
      return prev.filter((_, i) => i !== idx);
    });
  }

  function applyDetectedBlobs() {
    const newAnnotations = detectedBlobs.map(blob => ({
      ...blobToCircleAnnotation(blob, detectedCanvasSize.w, detectedCanvasSize.h, color),
      role: blob.role,
    }));
    setAnnotations(prev => [...prev, ...newAnnotations]);
    setDetectedBlobs([]);
    setSampledColor(null);
  }

  function onDown(e) {
    if (!previewUrl) return;
    if (tool === 'detect') {
      handleDetectClick(e);
      return;
    }
    if (tool === 'select') return;
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
          review_tags: joinReviewTags(tags),
          failure_memo: memo,
        });
        onSaved?.(r.data);
      } else {
        if (!pendingFile) throw new Error('사진을 선택하세요.');
        const r = await climbLogsApi.uploadProblemPhoto(logId, cpId, pendingFile, {
          hold_annotations: annotations,
          review_tags: joinReviewTags(tags),
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
          <span style={{ fontSize: 15, fontWeight: 700 }}>문제 회고</span>
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
                <img ref={imgRef} src={previewUrl} alt="문제 사진"
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
                  {/* 감지된 blob — 점선 원 + 역할 표시 */}
                  {detectedBlobs.map((blob, i) => {
                    const cx = (blob.centerX / detectedCanvasSize.w) * 100;
                    const cy = (blob.centerY / detectedCanvasSize.h) * 100;
                    const rw = (blob.maxX - blob.minX) / detectedCanvasSize.w * 100 / 2 * 1.25;
                    const rh = (blob.maxY - blob.minY) / detectedCanvasSize.h * 100 / 2 * 1.25;
                    const r = Math.max(rw, rh);
                    const strokeColor = blob.role === 'start' ? '#22c55e' : blob.role === 'top' ? '#3b82f6' : '#f97316';
                    return (
                      <g key={i} style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={() => cycleDetectedBlobRole(i)}>
                        <circle cx={`${cx}%`} cy={`${cy}%`} r={`${r}%`}
                          fill="none" stroke={strokeColor} strokeWidth={3}
                          strokeDasharray={blob.role ? 'none' : '6 3'} />
                        {blob.role && (
                          <text x={`${cx}%`} y={`${cy}%`}
                            textAnchor="middle" dominantBaseline="central"
                            fill={strokeColor} fontSize="3%" fontWeight="bold">
                            {blob.role === 'start' ? 'S' : 'T'}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 도구 모음 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {[['circle', '◯ 원'], ['rect', '▭ 사각'], ['select', '🗑 선택삭제'], ['detect', '🎨 색상 감지']].map(([k, l]) => (
                  <button key={k} onClick={() => { setTool(k); if (k !== 'detect') setDetectedBlobs([]); }}
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
                {tool === 'select'
                  ? '삭제할 도형을 클릭하세요.'
                  : tool === 'detect'
                    ? detecting ? '감지 중...' : '홀드를 클릭하면 같은 색상의 홀드를 자동 감지합니다.'
                    : '이미지 위에서 드래그해 홀드를 강조하세요.'}
                {' '}({annotations.length}개 확정)
              </div>
              {/* 감지 결과 컨트롤 */}
              {tool === 'detect' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sampledColor && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>감지 색상</span>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: `rgb(${sampledColor.r},${sampledColor.g},${sampledColor.b})`,
                        border: '1px solid var(--line)',
                        display: 'inline-block',
                      }} />
                    </div>
                  )}
                  {detectedBlobs.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <span style={{ color: 'var(--ink-3)', minWidth: 40 }}>민감도</span>
                        <input type="range" min={20} max={100} value={threshold}
                          onChange={(e) => handleThresholdChange(Number(e.target.value))}
                          disabled={detecting}
                          style={{ flex: 1 }} />
                        <span style={{ color: 'var(--ink-3)', minWidth: 24, textAlign: 'right' }}>{threshold}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {detectedBlobs.length}개 감지됨 · 탭: 일반→S(시작)→T(종료)→제거
                      </div>
                      <button onClick={applyDetectedBlobs}
                        style={{
                          padding: '8px 14px', fontSize: 13, fontWeight: 600,
                          borderRadius: 'var(--r-pill)',
                          background: 'var(--primary)', color: 'var(--primary-fg, #fff)',
                          border: 'none', cursor: 'pointer',
                        }}>
                        감지 결과 적용 ({detectedBlobs.length}개)
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* 회고 태그 — 2그룹 */}
          {REVIEW_TAG_GROUPS.map((group) => (
            <div key={group.key}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                <span style={{ color: group.color }}>{group.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {group.tags.map(([k, l]) => {
                  const active = tags.includes(k);
                  return (
                    <button key={k} onClick={() => toggleTag(k)}
                      style={{
                        padding: '6px 10px', fontSize: 12, fontWeight: 600,
                        borderRadius: 'var(--r-pill)',
                        border: '1px solid ' + (active ? group.color : 'var(--line-2)'),
                        background: active ? group.softBg : 'var(--surface)',
                        color: active ? group.color : 'var(--ink-2)',
                      }}>{l}</button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 }}>회고 메모</div>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3}
              placeholder="이 문제를 기억하고 싶은 이유, 핵심 베타, 다음번 시도 계획 등"
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
