import { Link } from 'react-router-dom';
import { colorMeta } from '../utils/colors';

/**
 * 작은 영상 칩.
 *  - thumbnail_url 있으면 9:13 박스에 cover 표시
 *  - 없으면 color 기반 그라데이션 폴백
 *  - onRemove 있으면 × 버튼(모달용), 없으면 Link로 /routes/:id 이동
 */
export default function VideoChip({ id, title, thumbnail_url, color, level, onRemove }) {
  const meta = colorMeta(color);
  const label = title || `영상 #${id}`;

  const thumb = (
    <div style={{
      width: 26, height: 38, flexShrink: 0,
      borderRadius: 4, overflow: 'hidden',
      background: thumbnail_url
        ? `#000 center/cover no-repeat url("${thumbnail_url}")`
        : `linear-gradient(155deg, ${meta.dot}33 0%, ${meta.dot}88 100%)`,
      border: '1px solid var(--line)',
    }} />
  );

  const body = (
    <span style={{
      fontSize: 11, fontWeight: 600, color: 'var(--ink-1)',
      maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {label}
      {level && <span style={{ color: 'var(--ink-3)', marginLeft: 4 }}>· {level}</span>}
    </span>
  );

  const inner = (
    <>
      {thumb}
      {body}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          aria-label="제거"
          style={{ marginLeft: 2, color: 'var(--ink-3)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>
          ×
        </button>
      )}
    </>
  );

  const baseStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 8px 3px 3px', borderRadius: 'var(--r-pill)',
    background: 'var(--surface)', border: '1px solid var(--line)',
    textDecoration: 'none',
  };

  if (onRemove) {
    return <span style={baseStyle}>{inner}</span>;
  }
  return <Link to={`/routes/${id}`} style={baseStyle}>{inner}</Link>;
}
