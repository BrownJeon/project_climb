import { Link } from 'react-router-dom';
import { ColorBadge } from './atoms';

/**
 * climb_log.problems 배열을 난이도(색상+V등급)별로 한 줄씩 표기.
 *  - cleared_count / failed_count 우선 (신규 흐름)
 *  - 없으면 is_cleared/attempts (레거시) fallback
 *  - videos[]가 있으면 클릭 가능한 영상 칩 표시
 */
export default function ClearedSummary({ problems = [] }) {
  if (!problems.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {problems.map((p, i) => {
        const cleared = p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0);
        const failed = p.failed_count != null ? Number(p.failed_count) : 0;
        const videos = p.videos || (p.ar_route ? [{ id: p.ar_route_id || p.ar_route.id, ar_route: p.ar_route }] : []);
        return (
          <div key={p.id || i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <ColorBadge color={p.color} level={p.level} size="sm" />
              {cleared > 0 && (
                <span className="tabnum" style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                  ✓ 완등 {cleared}
                </span>
              )}
              {failed > 0 && (
                <span className="tabnum" style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
                  ✗ 실패 {failed}
                </span>
              )}
              {cleared === 0 && failed === 0 && p.attempts && (
                <span className="tabnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {p.attempts}회</span>
              )}
            </div>
            {videos.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 4 }}>
                {videos.map((v, vi) => {
                  const ar = v.ar_route || v;
                  const id = v.ar_route_id || ar.id;
                  if (!id) return null;
                  return (
                    <Link key={`${id}-${vi}`} to={`/routes/${id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, padding: '3px 9px', borderRadius: 'var(--r-pill)',
                        background: 'var(--surface-2)', color: 'var(--ink-2)',
                        border: '1px solid var(--line)', textDecoration: 'none', fontWeight: 600,
                      }}>
                      📹 {ar.title || `영상 #${id}`}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
