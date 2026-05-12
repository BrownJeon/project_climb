import { useEffect, useRef, useState } from 'react';
import { I } from './atoms/Icons';

function gymLabel(g) {
  return (g.brand || g.name || '') + (g.branch ? ` · ${g.branch}` : '');
}

/**
 * 암장 검색 콤보박스 — 입력으로 검색 + 드롭다운 선택.
 *  - value: gym_id (string|number|'')
 *  - onChange(id): 선택 시 호출, 빈 문자열이면 해제
 *  - gyms: 후보 목록
 *  - placeholder
 *  - allowClear (default true)
 */
export default function GymSearchCombobox({ value, onChange, gyms = [], placeholder = '암장 검색', allowClear = true }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!value) { setQuery(''); return; }
    const g = gyms.find((x) => String(x.id) === String(value));
    if (g) setQuery(gymLabel(g));
  }, [value, gyms]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (!wrapRef.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matched = gyms.filter((g) => {
    if (!q) return true;
    const hay = `${g.brand || ''} ${g.branch || ''} ${g.name || ''} ${g.address || ''}`.toLowerCase();
    return hay.includes(q);
  });

  function pick(g) {
    onChange?.(g.id);
    setQuery(gymLabel(g));
    setOpen(false);
  }

  function clear() {
    onChange?.('');
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 10px', borderRadius: 'var(--r-pill)',
        border: '1px solid var(--line)', background: 'var(--surface)',
      }}>
        <span style={{ color: 'var(--ink-4)', display: 'inline-flex' }}>{I.search(15)}</span>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange?.(''); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{
            flex: 1, minWidth: 0,
            fontSize: 13.5, fontWeight: value ? 600 : 500,
            color: value ? 'var(--ink-1)' : 'var(--ink-2)',
            border: 0, outline: 'none', background: 'transparent',
          }}
        />
        {allowClear && value && (
          <button type="button" onClick={clear} aria-label="선택 해제"
            style={{ color: 'var(--ink-4)', padding: 2 }}>
            {I.x(14)}
          </button>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="목록"
          style={{ color: 'var(--ink-3)', padding: 2 }}>
          {I.chev(14, open ? 'up' : 'down')}
        </button>
      </div>
      {open && (
        <div role="listbox" style={{
          position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)',
          maxHeight: 240, overflowY: 'auto', zIndex: 20,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)', boxShadow: '0 8px 24px rgba(0,0,0,.08)',
        }}>
          {matched.length === 0 ? (
            <div style={{ padding: '12px', fontSize: 12.5, color: 'var(--ink-4)', textAlign: 'center' }}>
              일치하는 암장이 없습니다.
            </div>
          ) : matched.map((g) => (
            <button key={g.id} type="button" onClick={() => pick(g)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', border: 'none',
                background: String(value) === String(g.id) ? 'var(--surface-2)' : 'transparent',
                cursor: 'pointer',
              }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{gymLabel(g)}</div>
              {g.address && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.address}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
