import { Link } from 'react-router-dom';
import { ColorBadge, Pill } from './atoms';
import { I } from './atoms/Icons';
import { colorMeta } from '../utils/colors';

/**
 * RouteCard — handoff `RouteCard` 1:1.
 *  thumbnail aspect 9:13, 색깔 그라데이션 + 가짜 holds + 중앙 play + corner pills.
 *
 * route: { id, color, level, cleared?, attempts, likes, bookmarks, saved, date }
 * compact=true → body는 ColorBadge만, 메타 row 생략 (3-col grid 등에서 사용)
 */
export default function RouteCard({ route, compact = false, to }) {
  const meta = colorMeta(route.color);
  const href = to ?? `/routes/${route.id}`;
  const date = (route.date || route.created_at || '').slice(5).replace(/^(\d{2})-(\d{2}).*$/, '$1.$2');

  return (
    <Link to={href} style={{
      display: 'block', background: 'var(--surface)', borderRadius: 'var(--r-md)',
      border: '1px solid var(--line)', overflow: 'hidden', color: 'inherit',
    }}>
      {/* 9:13 thumbnail */}
      <div style={{
        position: 'relative', aspectRatio: '9 / 13',
        background: route.thumbnail_url
          ? `#000 center/cover no-repeat url("${route.thumbnail_url}")`
          : `linear-gradient(155deg, ${meta.dot}33 0%, ${meta.dot}88 100%)`,
        overflow: 'hidden',
      }}>
        {!route.thumbnail_url && (
          <>
            {/* 가짜 텍스처 */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,.25), transparent 40%),
                           radial-gradient(circle at 70% 80%, rgba(0,0,0,.18), transparent 50%)`,
            }} />
            {/* holds */}
            <div style={{ position: 'absolute', top: '18%', left: '40%', width: 14, height: 14, borderRadius: 4, background: meta.dot, boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
            <div style={{ position: 'absolute', top: '42%', left: '62%', width: 10, height: 18, borderRadius: 5, background: meta.dot, transform: 'rotate(15deg)' }} />
            <div style={{ position: 'absolute', top: '68%', left: '30%', width: 18, height: 12, borderRadius: 5, background: meta.dot, transform: 'rotate(-20deg)' }} />
            <div style={{ position: 'absolute', top: '85%', left: '48%', width: 12, height: 12, borderRadius: 6, background: meta.dot }} />
          </>
        )}
        {/* play */}
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)',
            display: 'grid', placeItems: 'center', color: '#fff',
          }}>{I.play(14)}</div>
        </div>
        {/* clear pill — cleared가 null이면 미표시 */}
        {route.cleared != null && (
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <Pill tone={route.cleared ? 'success' : 'warn'}>
              {route.cleared ? '✓ 완등' : '진행중'}
              {route.attempts != null && ` · ${route.attempts}회`}
            </Pill>
          </div>
        )}
        {/* save */}
        <div style={{ position: 'absolute', top: 8, right: 8, color: '#fff' }}>
          {I.bookmark(18, !!route.saved)}
        </div>
      </div>

      <div style={{ padding: '10px 11px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <ColorBadge color={route.color} level={route.level} size="sm" />
        </div>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--ink-3)' }}>
            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
              {I.heart(12)}<span className="tabnum">{route.likes ?? route.like_count ?? 0}</span>
            </span>
            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
              {I.bookmark(12)}<span className="tabnum">{route.bookmarks ?? 0}</span>
            </span>
            <span style={{ marginLeft: 'auto' }}>{date}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
