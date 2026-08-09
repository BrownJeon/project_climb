import { useEffect, useRef, useState } from 'react';
import { Btn } from '../atoms';
import { I } from '../atoms/Icons';
import { climbLogsApi } from '../../api/climbLogs';
import { REVIEW_TAG_GROUPS, parseReviewTags, joinReviewTags, LEGACY_TAG_MAP } from '../../utils/reviewTags';
import { detectHoldsByColor, blobToCircleAnnotation } from '../../utils/holdDetection';

/**
 * 볼더링 문제 사진 + 홀드 강조 + 문제 회고 모달.
 *
 * 도구:
 *  - circle / rect: 드래그로 홀드 직접 그리기
 *  - edit: 확정 어노테이션 탭→선택, 드래그→이동, 패널→크기·색상·삭제
 *  - detect: 1초 롱프레스로 색상 감지, 감지된 blob 탭→선택·드래그·역할 지정
 */
const ANNOT_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7'];
const LONG_PRESS_MS = 1000;

if (typeof document !== 'undefined' && !document.getElementById('tr-lp-kf')) {
  const s = document.createElement('style');
  s.id = 'tr-lp-kf';
  s.textContent = `
    @keyframes tr-lp {
      0%   { transform: translate(-50%,-50%) scale(0.15); opacity: 0.9; }
      100% { transform: translate(-50%,-50%) scale(1);    opacity: 0.1; }
    }
  `;
  document.head.appendChild(s);
}

export default function ProblemPhotoModal({ logId, cpId, photo, onSaved, onDeleted, onClose }) {
  const isEdit = !!photo;
  const [pendingFile, setPendingFile]   = useState(null);
  const [previewUrl, setPreviewUrl]     = useState(photo?.photo_url || null);
  const [annotations, setAnnotations]   = useState(() =>
    photo?.hold_annotations ? (Array.isArray(photo.hold_annotations) ? photo.hold_annotations : []) : []
  );
  const [tool, setTool]   = useState('circle');
  const [color, setColor] = useState(ANNOT_COLORS[0]);
  const [drawing, setDrawing] = useState(null);
  const [tags, setTags] = useState(() => {
    if (photo?.review_tags) return parseReviewTags(photo.review_tags);
    if (photo?.failure_tags) {
      const legacyList = photo.failure_tags.split(',').map(s => s.trim()).filter(Boolean);
      return legacyList.map(k => LEGACY_TAG_MAP[k] || k).filter(Boolean);
    }
    return [];
  });
  const [memo, setMemo]     = useState(photo?.failure_memo || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  // 확정 어노테이션 선택 (edit 모드)
  const [selectedAnnotIdx, setSelectedAnnotIdx] = useState(null);

  // detect 모드 상태
  const [detecting, setDetecting]               = useState(false);
  const [detectedBlobs, setDetectedBlobs]       = useState([]);
  const [detectedCanvasSize, setDetectedCanvasSize] = useState({ w: 0, h: 0 });
  const [threshold, setThreshold]               = useState(50);
  const [sampledColor, setSampledColor]         = useState(null);
  const [lastClickClient, setLastClickClient]   = useState(null);
  const [selectedBlobIdx, setSelectedBlobIdx]   = useState(null);
  const [longPressPos, setLongPressPos]         = useState(null);

  const imgWrapRef     = useRef(null);
  const imgRef         = useRef(null);
  const drawingRef     = useRef(null);

  // 롱프레스
  const longPressTimer    = useRef(null);
  const longPressStartPos = useRef(null);

  // 확정 어노테이션 드래그
  const isDraggingAnnot = useRef(false);
  const dragAnnotIdx    = useRef(null);
  const dragAnnotMoved  = useRef(false);

  // 감지 blob 드래그
  const isDragging  = useRef(false);
  const dragIdx     = useRef(null);
  const dragMoved   = useRef(false);

  useEffect(() => {
    if (!pendingFile) return;
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (f) { setPendingFile(f); setAnnotations([]); }
    e.target.value = '';
  }

  function clientToPercent(clientX, clientY) {
    const wrap = imgWrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  // ── 감지 실행 ──────────────────────────────────────────────────────────────
  async function runDetect(clientX, clientY) {
    if (!imgRef.current || detecting) return;
    setLastClickClient({ x: clientX, y: clientY });
    setDetecting(true);
    try {
      const imgRect = imgRef.current.getBoundingClientRect();
      const result = await detectHoldsByColor(imgRef.current, clientX, clientY, imgRect, threshold);
      setDetectedBlobs(result.blobs.map(b => ({ ...b, sizeScale: 1 })));
      setSampledColor(result.sampledColor);
      setDetectedCanvasSize({ w: result.canvasW, h: result.canvasH });
      setSelectedBlobIdx(null);
    } catch { /* 감지 실패 무시 */ }
    finally { setDetecting(false); }
  }

  async function handleThresholdChange(v) {
    setThreshold(v);
    if (!lastClickClient || !imgRef.current || detectedBlobs.length === 0) return;
    setDetecting(true);
    try {
      const imgRect = imgRef.current.getBoundingClientRect();
      const result = await detectHoldsByColor(imgRef.current, lastClickClient.x, lastClickClient.y, imgRect, v);
      setDetectedBlobs(result.blobs.map(b => ({ ...b, sizeScale: 1 })));
      setSampledColor(result.sampledColor);
      setDetectedCanvasSize({ w: result.canvasW, h: result.canvasH });
      setSelectedBlobIdx(null);
    } catch { /* ignore */ }
    finally { setDetecting(false); }
  }

  // ── 롱프레스 ───────────────────────────────────────────────────────────────
  function startLongPress(clientX, clientY) {
    if (detecting) return;
    const pos = clientToPercent(clientX, clientY);
    if (!pos) return;
    longPressStartPos.current = { clientX, clientY };
    setLongPressPos(pos);
    longPressTimer.current = setTimeout(() => {
      setLongPressPos(null);
      longPressStartPos.current = null;
      runDetect(clientX, clientY);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressStartPos.current = null;
    setLongPressPos(null);
  }

  // ── 확정 어노테이션 조작 ────────────────────────────────────────────────────
  function removeAnnotation(idx) {
    setAnnotations(arr => arr.filter((_, i) => i !== idx));
    setSelectedAnnotIdx(null);
  }

  function moveAnnotTo(idx, clientX, clientY) {
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setAnnotations(prev => prev.map((a, i) => i !== idx ? a : { ...a, x: xPct, y: yPct }));
  }

  function resizeAnnotBy(idx, factor) {
    setAnnotations(prev => prev.map((a, i) => {
      if (i !== idx) return a;
      if (a.type === 'circle') return { ...a, r: Math.max(0.5, Math.min(30, a.r * factor)) };
      if (a.type === 'rect')   return { ...a, w: Math.max(0.5, a.w * factor), h: Math.max(0.5, a.h * factor) };
      return a;
    }));
  }

  function changeAnnotColor(idx, c) {
    setAnnotations(prev => prev.map((a, i) => i !== idx ? a : { ...a, color: c }));
  }

  // ── 감지 blob 조작 ──────────────────────────────────────────────────────────
  function setDetectedBlobRole(idx, role) {
    setDetectedBlobs(prev => prev.map((b, i) => i === idx ? { ...b, role } : b));
  }

  function setBlobSizeScale(idx, scale) {
    setDetectedBlobs(prev => prev.map((b, i) => i === idx ? { ...b, sizeScale: Math.max(0.3, Math.min(3.0, scale)) } : b));
  }

  function moveBlobTo(idx, clientX, clientY) {
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setDetectedBlobs(prev => prev.map((b, bi) => bi !== idx ? b : {
      ...b,
      centerX: (xPct / 100) * detectedCanvasSize.w,
      centerY: (yPct / 100) * detectedCanvasSize.h,
    }));
  }

  function applyDetectedBlobs() {
    const newAnnotations = detectedBlobs.map(blob => ({
      ...blobToCircleAnnotation(blob, detectedCanvasSize.w, detectedCanvasSize.h, color),
      role: blob.role,
    }));
    setAnnotations(prev => [...prev, ...newAnnotations]);
    setDetectedBlobs([]);
    setSampledColor(null);
    setSelectedBlobIdx(null);
  }

  // ── 이미지 영역 이벤트 핸들러 ─────────────────────────────────────────────
  function onDown(clientX, clientY) {
    if (!previewUrl) return;
    if (tool === 'detect') { startLongPress(clientX, clientY); return; }
    if (tool === 'edit')   return; // 편집: SVG 요소 이벤트로만 처리
    const pt = clientToPercent(clientX, clientY);
    if (!pt) return;
    if (tool === 'circle') {
      const next = { type: 'circle', x: pt.x, y: pt.y, r: 0, color, stroke: 3 };
      const d = { startX: pt.x, startY: pt.y };
      drawingRef.current = d;
      setAnnotations(arr => { d.idx = arr.length; drawingRef.current = { ...d }; return [...arr, next]; });
      setDrawing({ ...d });
    } else if (tool === 'rect') {
      const next = { type: 'rect', x: pt.x, y: pt.y, w: 0, h: 0, color, stroke: 3 };
      const d = { startX: pt.x, startY: pt.y };
      drawingRef.current = d;
      setAnnotations(arr => { d.idx = arr.length; drawingRef.current = { ...d }; return [...arr, next]; });
      setDrawing({ ...d });
    }
  }

  function onMove(clientX, clientY) {
    // 확정 어노테이션 드래그
    if (isDraggingAnnot.current && dragAnnotIdx.current != null) {
      dragAnnotMoved.current = true;
      moveAnnotTo(dragAnnotIdx.current, clientX, clientY);
      return;
    }
    // 감지 blob 드래그
    if (isDragging.current && dragIdx.current != null) {
      dragMoved.current = true;
      moveBlobTo(dragIdx.current, clientX, clientY);
      return;
    }
    // 롱프레스 중 이동: 10px 초과 시만 취소
    if (longPressTimer.current && longPressStartPos.current) {
      const dx = clientX - longPressStartPos.current.clientX;
      const dy = clientY - longPressStartPos.current.clientY;
      if (dx * dx + dy * dy > 100) cancelLongPress();
      return;
    }
    // 도형 드로잉
    const d = drawingRef.current;
    if (!d || d.idx == null) return;
    const pt = clientToPercent(clientX, clientY);
    if (!pt) return;
    setAnnotations(arr => arr.map((a, i) => {
      if (i !== d.idx) return a;
      if (a.type === 'circle') {
        const dx2 = pt.x - d.startX, dy2 = pt.y - d.startY;
        return { ...a, r: Math.sqrt(dx2 * dx2 + dy2 * dy2) };
      }
      if (a.type === 'rect') {
        return { ...a, x: Math.min(d.startX, pt.x), y: Math.min(d.startY, pt.y), w: Math.abs(pt.x - d.startX), h: Math.abs(pt.y - d.startY) };
      }
      return a;
    }));
  }

  function onUp() {
    cancelLongPress();
    if (isDraggingAnnot.current) {
      isDraggingAnnot.current = false;
      dragAnnotIdx.current = null;
      return;
    }
    if (isDragging.current) {
      isDragging.current = false;
      dragIdx.current = null;
      return;
    }
    drawingRef.current = null;
    setDrawing(null);
  }

  function switchTool(k) {
    setTool(k);
    if (k !== 'detect') { setDetectedBlobs([]); setSelectedBlobIdx(null); }
    if (k !== 'edit')   setSelectedAnnotIdx(null);
  }

  // ── 태그 / 저장 / 삭제 ────────────────────────────────────────────────────
  function toggleTag(k) {
    setTags(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  }

  async function save() {
    setSaving(true); setErr(null);
    try {
      if (isEdit) {
        const r = await climbLogsApi.updateProblemPhoto(logId, cpId, photo.id, {
          hold_annotations: annotations, review_tags: joinReviewTags(tags), failure_memo: memo,
        });
        onSaved?.(r.data);
      } else {
        if (!pendingFile) throw new Error('사진을 선택하세요.');
        const r = await climbLogsApi.uploadProblemPhoto(logId, cpId, pendingFile, {
          hold_annotations: annotations, review_tags: joinReviewTags(tags), failure_memo: memo,
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

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  const selAnnot = annotations[selectedAnnotIdx] ?? null;
  const selBlob  = detectedBlobs[selectedBlobIdx] ?? null;
  const curScale = selBlob?.sizeScale ?? 1;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 400,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', width: '100%', maxWidth: 'var(--max-w, 480px)',
        maxHeight: '95%', borderRadius: '20px 20px 0 0', overflow: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 헤더 */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2,
          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', borderBottom: '1px solid var(--line)',
        }}>
          <button onClick={save} disabled={saving} style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
            {saving ? '저장 중...' : '저장'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>문제 회고</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {err && <div style={{ padding: '10px 16px', background: 'var(--danger)', color: '#fff', fontSize: 12 }}>{err}</div>}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── 이미지 영역 ── */}
          {!previewUrl ? (
            <label style={{
              border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)',
              padding: '40px 16px', textAlign: 'center',
              background: 'var(--surface)', color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer',
            }}>
              <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
              {I.plus(20)} 사진 선택
            </label>
          ) : (
            <>
              {/* 이미지 + SVG 오버레이 */}
              <div ref={imgWrapRef}
                onMouseDown={e => { e.preventDefault(); onDown(e.clientX, e.clientY); }}
                onMouseMove={e => onMove(e.clientX, e.clientY)}
                onMouseUp={onUp} onMouseLeave={onUp}
                onTouchStart={e => { e.preventDefault(); onDown(e.touches[0].clientX, e.touches[0].clientY); }}
                onTouchMove={e => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); }}
                onTouchEnd={onUp}
                onTouchCancel={onUp}
                style={{
                  position: 'relative', width: '100%',
                  background: '#000', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
                  cursor: tool === 'edit' ? 'default' : 'crosshair',
                  userSelect: 'none', touchAction: 'none',
                }}>
                <img ref={imgRef} src={previewUrl} alt="문제 사진"
                  draggable={false} style={{
                    width: '100%', display: 'block', pointerEvents: 'none',
                    WebkitTouchCallout: 'none', WebkitUserSelect: 'none',
                  }} />

                {/* 롱프레스 시각 피드백 */}
                {longPressPos && (
                  <div key={`${longPressPos.x}-${longPressPos.y}`} style={{
                    position: 'absolute',
                    left: `${longPressPos.x}%`, top: `${longPressPos.y}%`,
                    width: 64, height: 64, borderRadius: '50%',
                    border: '3px solid var(--primary)',
                    background: 'rgba(255,90,60,0.08)',
                    pointerEvents: 'none',
                    animation: `tr-lp ${LONG_PRESS_MS}ms linear forwards`,
                  }} />
                )}

                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>

                  {/* ── 확정 annotations ── */}
                  {annotations.map((a, i) => {
                    const stroke = a.color || '#ef4444';
                    const sw = a.stroke || 3;
                    const isAnnotSel = tool === 'edit' && selectedAnnotIdx === i;
                    const evProps = tool === 'edit' ? {
                      style: { pointerEvents: 'auto', cursor: isAnnotSel ? 'grab' : 'pointer' },
                      onMouseDown: e => {
                        e.stopPropagation();
                        if (isAnnotSel) { isDraggingAnnot.current = true; dragAnnotIdx.current = i; dragAnnotMoved.current = false; }
                      },
                      onTouchStart: e => {
                        e.stopPropagation();
                        if (isAnnotSel) { isDraggingAnnot.current = true; dragAnnotIdx.current = i; dragAnnotMoved.current = false; }
                      },
                      onTouchMove: e => {
                        if (isDraggingAnnot.current && dragAnnotIdx.current === i) {
                          dragAnnotMoved.current = true;
                          moveAnnotTo(i, e.touches[0].clientX, e.touches[0].clientY);
                        }
                      },
                      onTouchEnd: () => {
                        if (isDraggingAnnot.current && dragAnnotIdx.current === i) {
                          isDraggingAnnot.current = false;
                          dragAnnotIdx.current = null;
                        }
                      },
                      onClick: () => {
                        if (dragAnnotMoved.current) { dragAnnotMoved.current = false; return; }
                        setSelectedAnnotIdx(isAnnotSel ? null : i);
                      },
                    } : { style: { pointerEvents: 'none' } };

                    if (a.type === 'circle') return (
                      <g key={i} {...evProps}>
                        {isAnnotSel && <>
                          <circle cx={`${a.x}%`} cy={`${a.y}%`} r={`${a.r + 1.5}%`}
                            fill="none" stroke={stroke} strokeWidth={6} opacity={0.25} />
                          <circle cx={`${a.x}%`} cy={`${a.y}%`} r={`${a.r + 0.9}%`}
                            fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9} />
                        </>}
                        <circle cx={`${a.x}%`} cy={`${a.y}%`} r={`${a.r}%`}
                          fill="transparent" stroke={stroke} strokeWidth={isAnnotSel ? sw + 1 : sw} />
                      </g>
                    );
                    if (a.type === 'rect') return (
                      <g key={i} {...evProps}>
                        {isAnnotSel && (
                          <rect x={`${a.x - 1}%`} y={`${a.y - 1}%`}
                            width={`${a.w + 2}%`} height={`${a.h + 2}%`}
                            fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9} />
                        )}
                        <rect x={`${a.x}%`} y={`${a.y}%`} width={`${a.w}%`} height={`${a.h}%`}
                          fill="transparent" stroke={stroke} strokeWidth={isAnnotSel ? sw + 1 : sw} />
                      </g>
                    );
                    return null;
                  })}

                  {/* ── 감지된 blobs ── */}
                  {detectedBlobs.map((blob, i) => {
                    const cx = (blob.centerX / detectedCanvasSize.w) * 100;
                    const cy = (blob.centerY / detectedCanvasSize.h) * 100;
                    const rBase = Math.max(
                      (blob.maxX - blob.minX) / detectedCanvasSize.w * 100 / 2 * 1.25,
                      (blob.maxY - blob.minY) / detectedCanvasSize.h * 100 / 2 * 1.25,
                    );
                    const r = rBase * (blob.sizeScale ?? 1);
                    const sc = blob.role === 'start' ? '#22c55e' : blob.role === 'top' ? '#3b82f6' : '#f97316';
                    const isSel = selectedBlobIdx === i;

                    return (
                      <g key={i}
                        style={{ pointerEvents: 'auto', cursor: isSel ? 'grab' : 'pointer' }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          if (isSel) { isDragging.current = true; dragIdx.current = i; dragMoved.current = false; }
                        }}
                        onTouchStart={e => {
                          e.stopPropagation();
                          if (isSel) { isDragging.current = true; dragIdx.current = i; dragMoved.current = false; }
                        }}
                        onTouchMove={e => {
                          if (isDragging.current && dragIdx.current === i) {
                            dragMoved.current = true;
                            moveBlobTo(i, e.touches[0].clientX, e.touches[0].clientY);
                          }
                        }}
                        onTouchEnd={() => {
                          if (isDragging.current && dragIdx.current === i) {
                            isDragging.current = false;
                            dragIdx.current = null;
                          }
                        }}
                        onClick={() => {
                          if (dragMoved.current) { dragMoved.current = false; return; }
                          setSelectedBlobIdx(isSel ? null : i);
                        }}>
                        {isSel && <>
                          <circle cx={`${cx}%`} cy={`${cy}%`} r={`${r + 1.8}%`}
                            fill="none" stroke={sc} strokeWidth={6} opacity={0.25} />
                          <circle cx={`${cx}%`} cy={`${cy}%`} r={`${r + 1.1}%`}
                            fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9} />
                        </>}
                        <circle cx={`${cx}%`} cy={`${cy}%`} r={`${r}%`}
                          fill="transparent" stroke={sc} strokeWidth={isSel ? 4 : 3}
                          strokeDasharray={blob.role ? 'none' : '6 3'} />
                        {blob.role && (
                          <text x={`${cx}%`} y={`${cy}%`}
                            textAnchor="middle" dominantBaseline="central"
                            fill={sc} fontSize="3%" fontWeight="bold">
                            {blob.role === 'start' ? 'S' : 'T'}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* ── 편집 패널 (확정 어노테이션) ── */}
              {tool === 'edit' && selAnnot && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--r-md)',
                  background: 'var(--surface-2)', border: `2px solid ${selAnnot.color || '#ef4444'}`,
                }}>
                  {/* 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: selAnnot.color || '#ef4444' }}>
                      ● {selAnnot.type === 'circle' ? '원' : '사각형'} #{selectedAnnotIdx + 1} 선택됨 — 드래그로 위치 이동
                    </span>
                    <button
                      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                      onClick={() => removeAnnotation(selectedAnnotIdx)}
                      style={{ fontSize: 12, color: '#ef4444', padding: '2px 8px', background: 'none', border: '1px solid #ef444455', borderRadius: 'var(--r-pill)', cursor: 'pointer' }}>
                      🗑 삭제
                    </button>
                  </div>

                  {/* 크기 조절 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 28 }}>크기</span>
                    <button
                      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                      onClick={() => resizeAnnotBy(selectedAnnotIdx, 0.85)}
                      style={{ width: 32, height: 32, fontSize: 18, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', flexShrink: 0 }}>−</button>
                    <div style={{ flex: 1, height: 4, background: 'var(--line)', borderRadius: 2, position: 'relative' }}>
                      <div style={{ height: '100%', width: '50%', background: selAnnot.color || '#ef4444', borderRadius: 2 }} />
                    </div>
                    <button
                      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                      onClick={() => resizeAnnotBy(selectedAnnotIdx, 1.15)}
                      style={{ width: 32, height: 32, fontSize: 18, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', flexShrink: 0 }}>+</button>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', minWidth: 40, textAlign: 'right' }}>
                      {selAnnot.type === 'circle'
                        ? `r=${selAnnot.r.toFixed(1)}%`
                        : `${selAnnot.w.toFixed(0)}×${selAnnot.h.toFixed(0)}%`}
                    </span>
                  </div>

                  {/* 색상 변경 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 28 }}>색상</span>
                    {ANNOT_COLORS.map(c => (
                      <button key={c}
                        onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                        onClick={() => changeAnnotColor(selectedAnnotIdx, c)}
                        style={{
                          width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', flexShrink: 0,
                          border: (selAnnot.color || '#ef4444') === c ? '3px solid var(--ink-1)' : '1px solid var(--line)',
                        }} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── 선택된 blob 조작 패널 ── */}
              {tool === 'detect' && selBlob && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--r-md)',
                  background: 'var(--surface-2)', border: '2px solid var(--primary)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                      ● 홀드 #{selectedBlobIdx + 1} 선택됨 — 드래그로 위치 조정
                    </span>
                    <button onClick={() => {
                      setDetectedBlobs(prev => prev.filter((_, i) => i !== selectedBlobIdx));
                      setSelectedBlobIdx(null);
                    }} style={{ fontSize: 12, color: 'var(--ink-3)', padding: '2px 6px', background: 'none', border: '1px solid var(--line-2)', borderRadius: 'var(--r-pill)', cursor: 'pointer' }}>
                      ✕ 제거
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['start', '🟢 시작(S)', '#22c55e'], ['top', '🔵 종료(T)', '#3b82f6']].map(([role, label, c]) => {
                      const active = selBlob.role === role;
                      return (
                        <button key={role} onClick={() => setDetectedBlobRole(selectedBlobIdx, active ? null : role)}
                          style={{
                            flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
                            borderRadius: 'var(--r-pill)',
                            border: `1.5px solid ${active ? c : 'var(--line-2)'}`,
                            background: active ? `${c}22` : 'var(--surface)',
                            color: active ? c : 'var(--ink-2)',
                          }}>{label}</button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 28 }}>크기</span>
                    <button
                      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                      onClick={() => setBlobSizeScale(selectedBlobIdx, curScale - 0.15)}
                      style={{ width: 28, height: 28, fontSize: 16, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', flexShrink: 0 }}>−</button>
                    <input type="range" min={0.3} max={3.0} step={0.05}
                      value={curScale}
                      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                      onChange={e => setBlobSizeScale(selectedBlobIdx, Number(e.target.value))}
                      style={{ flex: 1 }} />
                    <button
                      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                      onClick={() => setBlobSizeScale(selectedBlobIdx, curScale + 0.15)}
                      style={{ width: 28, height: 28, fontSize: 16, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', flexShrink: 0 }}>+</button>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 32, textAlign: 'right' }}>
                      {Math.round(curScale * 100)}%
                    </span>
                  </div>
                </div>
              )}

              {/* ── 도구 모음 ── */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {[['circle', '◯ 원'], ['rect', '▭ 사각'], ['edit', '✏️ 편집'], ['detect', '🎨 색상 감지']].map(([k, l]) => (
                  <button key={k} onClick={() => switchTool(k)}
                    style={{
                      padding: '6px 10px', fontSize: 12, fontWeight: 600,
                      borderRadius: 'var(--r-pill)',
                      border: '1px solid ' + (tool === k ? 'var(--primary)' : 'var(--line)'),
                      background: tool === k ? 'var(--primary-soft)' : 'var(--surface)',
                      color: tool === k ? 'var(--primary-ink)' : 'var(--ink-2)',
                    }}>{l}</button>
                ))}
                <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>색</span>
                {ANNOT_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} aria-label={c}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: color === c ? '3px solid var(--ink-1)' : '1px solid var(--line)',
                    }} />
                ))}
                {!isEdit && (
                  <label style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                    padding: '6px 10px', borderRadius: 'var(--r-pill)',
                    border: '1px dashed var(--line-2)', color: 'var(--primary)', cursor: 'pointer',
                  }}>
                    <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
                    사진 변경
                  </label>
                )}
              </div>

              {/* 안내 문구 */}
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {tool === 'edit'
                  ? selectedAnnotIdx != null
                    ? '드래그로 이동 · +/− 로 크기 조절 · 색상 변경 · 삭제 가능'
                    : `도형을 탭하면 선택됩니다. (${annotations.length}개 확정)`
                  : tool === 'detect'
                    ? detecting
                      ? '감지 중...'
                      : longPressPos
                        ? '1초 누르고 있으면 감지합니다...'
                        : `홀드를 1초 길게 누르면 같은 색의 홀드를 자동 감지합니다. (${annotations.length}개 확정)`
                    : `이미지 위에서 드래그해 홀드를 강조하세요. (${annotations.length}개 확정)`}
              </div>

              {/* ── detect 모드 컨트롤 ── */}
              {tool === 'detect' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ color: 'var(--ink-3)', minWidth: 40 }}>민감도</span>
                    <input type="range" min={20} max={100} value={threshold}
                      onChange={e => handleThresholdChange(Number(e.target.value))}
                      disabled={detecting}
                      style={{ flex: 1 }} />
                    <span style={{ color: 'var(--ink-3)', minWidth: 24, textAlign: 'right' }}>{threshold}</span>
                  </div>
                  {sampledColor && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>감지 색상</span>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: `rgb(${sampledColor.r},${sampledColor.g},${sampledColor.b})`,
                        border: '1px solid var(--line)', display: 'inline-block',
                      }} />
                    </div>
                  )}
                  {detectedBlobs.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {detectedBlobs.length}개 감지됨 · 탭으로 선택 후 역할/크기/위치 조정
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

          {/* ── 회고 태그 ── */}
          {REVIEW_TAG_GROUPS.map(group => (
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

          {/* ── 회고 메모 ── */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 }}>회고 메모</div>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3}
              placeholder="이 문제를 기억하고 싶은 이유, 핵심 베타, 다음번 시도 계획 등"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13.5,
                borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
                background: 'var(--surface)', color: 'var(--ink-1)',
                resize: 'vertical', fontFamily: 'inherit',
              }} />
          </div>

          {isEdit && <Btn variant="danger" full onClick={remove} disabled={saving}>사진 삭제</Btn>}
        </div>
      </div>
    </div>
  );
}
