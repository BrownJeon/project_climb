import { Link, useNavigate } from 'react-router-dom';
import { I } from './atoms/Icons';

/**
 * TopBar — 좌측 "TheRoute" 브랜드 항상 고정(클릭 시 홈 라우팅)
 *  - back=true 면 brand 옆에 작은 chevron 노출 (history -1)
 *  - right: 우측 슬롯 (페이지별 커스텀 — 기본 없음)
 *  - title prop은 호환을 위해 받지만 표시 X (브랜드 우선)
 */
export default function TopBar({ back = false, right }) {
  const nav = useNavigate();

  return (
    <header
      style={{
        height: 54, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--line)', background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 5,
      }}
    >
      <Link to="/" style={{
        fontSize: 18, fontWeight: 800, letterSpacing: -0.4,
        color: 'var(--ink-1)', textDecoration: 'none',
      }} aria-label="홈으로">
        <span style={{ color: 'var(--primary)' }}>The</span>Route
      </Link>
      {back && (
        <button onClick={() => nav(-1)} style={{
          padding: 6, color: 'var(--ink-3)',
        }} aria-label="뒤로">
          {I.chev(16, 'left')}
        </button>
      )}
      <div style={{ flex: 1 }} />
      {right ?? null}
    </header>
  );
}
