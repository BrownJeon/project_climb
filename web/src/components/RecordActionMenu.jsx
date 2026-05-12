import { useEffect, useRef, useState } from 'react';
import { I } from './atoms/Icons';

/**
 * 기록 카드 우측 상단 ⋯ 버튼 + 팝오버.
 * 캘린더(climb_log)와 훈련 기록(training session, synthetic 포함) 양쪽에서 동일한 UX로 사용.
 *
 * Props:
 *   onEdit?: () => void          // 메뉴에서 [수정] 클릭 시 호출
 *   onDelete: () => void         // 메뉴에서 [삭제] 클릭 시 호출 (호출자는 confirm 처리 권장)
 *   disabled?: boolean           // 자동 합성 등 수정/삭제 불가 시
 *   disabledHint?: string
 */
export default function RecordActionMenu({ onEdit, onDelete, disabled = false, disabledHint = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (!wrapRef.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="기록 메뉴"
        style={{ color: 'var(--ink-4)', padding: 4 }}
      >
        {I.more(18)}
      </button>
      {open && (
        <div role="menu" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 120,
          minWidth: 132, background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
          boxShadow: '0 6px 20px rgba(0,0,0,.08)', overflow: 'hidden',
        }}>
          {disabled && disabledHint && (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--ink-4)' }}>{disabledHint}</div>
          )}
          {!disabled && onEdit && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onEdit(); }}
              style={menuItemStyle()}
            >
              {I.pencil(14)}<span>수정</span>
            </button>
          )}
          {!disabled && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onDelete(); }}
              style={menuItemStyle('var(--danger)')}
            >
              {I.trash(14)}<span>삭제</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function menuItemStyle(color = 'var(--ink-1)') {
  return {
    width: '100%', padding: '10px 12px',
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, color, textAlign: 'left',
    background: 'transparent', border: 'none', cursor: 'pointer',
  };
}
