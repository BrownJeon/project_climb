import { useNavigate, useLocation, Link } from 'react-router-dom';
import { I } from './atoms/Icons';

/**
 * TopBar — handoff 디자인 1:1
 *  - height 54, padding 0 16, sticky top, surface bg, 1px bottom line
 *  - brand=true: 좌측 "TheRoute" 로고 (The는 primary 컬러)
 *  - back=true: 좌측 chevron (history -1)
 *  - right: 우측 슬롯 (default = 36x36 원형 user 버튼 → /me)
 */
export default function TopBar({ title = 'TheRoute', back = false, right, brand = false }) {
  const nav = useNavigate();
  const loc = useLocation();
  const onMy = loc.pathname.startsWith('/me');

  const defaultRight = onMy ? null : (
    <Link to="/me" style={{
      width: 36, height: 36, borderRadius: 'var(--r-pill)',
      display: 'grid', placeItems: 'center',
      color: 'var(--ink-2)', background: 'var(--surface-2)',
    }} aria-label="마이페이지">
      {I.user(18)}
    </Link>
  );

  return (
    <header
      style={{
        height: 54, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--line)', background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 5,
      }}
    >
      {back && (
        <button onClick={() => nav(-1)} style={{ padding: 6, marginLeft: -6, color: 'var(--ink-1)' }} aria-label="뒤로">
          {I.chev(18, 'left')}
        </button>
      )}
      <div style={{
        flex: 1, fontSize: brand ? 18 : 16, fontWeight: brand ? 800 : 700,
        letterSpacing: brand ? -0.4 : -0.2, color: 'var(--ink-1)',
      }}>
        {brand
          ? <span><span style={{ color: 'var(--primary)' }}>The</span>Route</span>
          : title}
      </div>
      {right !== undefined ? right : defaultRight}
    </header>
  );
}
