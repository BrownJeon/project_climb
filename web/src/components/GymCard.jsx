import { I } from './atoms/Icons';
import { colorMeta } from '../utils/colors';
import { formatDateKR } from '../utils/climbingTenure';

/**
 * GymCard — 암장 카드 아이템. GymListPage(암장 관리)·MyPage(최근 방문 미리보기) 공용.
 *  썸네일(9:13.5) + 이름/주소 + 영업시간·영상수·최근방문일 메타 + 난이도별 breakdown 칩.
 *  showActions=true(기본)면 수정/삭제 버튼 노출(onEdit/onDelete 콜백에 gym 전달), false면 미리보기 전용(버튼 숨김).
 *
 * gym: { id, name, address, thumbnail_url, hours, route_count, last_visited_at, routes_breakdown }
 */
export default function GymCard({ gym: g, onClick, showActions = true, onEdit, onDelete }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)', padding: '14px 14px 12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {g.thumbnail_url && (
          <div style={{
            width: 64, aspectRatio: '9 / 13', flexShrink: 0,
            borderRadius: 'var(--r-sm)', overflow: 'hidden',
            background: `#000 center/cover no-repeat url("${g.thumbnail_url}")`,
            border: '1px solid var(--line)',
          }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</span>
            {/* TODO: 주 암장 판정은 user.main_gyms 기반 */}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {g.address}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--ink-3)' }}>
            {g.hours && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {I.clock(11)} <span>{typeof g.hours === 'string' ? g.hours : '영업시간'}</span>
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {I.film(11)} <span className="tabnum">{g.route_count ?? 0}</span>
            </span>
            {g.last_visited_at && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--ink-2)' }}>
                {I.cal(11)} <span>최근 방문 {formatDateKR(g.last_visited_at)}</span>
              </span>
            )}
          </div>
        </div>
        {showActions && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => onEdit?.(g)}
              style={{
                fontSize: 11, fontWeight: 600, color: 'var(--ink-2)',
                padding: '4px 8px', borderRadius: 'var(--r-pill)',
                border: '1px solid var(--line-2)', background: 'var(--surface)',
              }}>수정</button>
            <button onClick={() => onDelete?.(g)}
              style={{
                fontSize: 11, fontWeight: 600, color: 'var(--danger)',
                padding: '4px 8px', borderRadius: 'var(--r-pill)',
                border: '1px solid var(--line-2)', background: 'var(--surface)',
              }}>삭제</button>
          </div>
        )}
        <span style={{ color: 'var(--ink-4)', marginTop: 2 }}>{I.chev(14)}</span>
      </div>

      {/* 영상 난이도(색상·V등급)별 개수 */}
      {g.routes_breakdown?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
          {g.routes_breakdown.map((b, i) => {
            const m = colorMeta(b.color || 'gray');
            return (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 'var(--r-pill)',
                background: 'var(--surface-2)', border: '1px solid var(--line)',
                fontSize: 11, color: 'var(--ink-1)', fontWeight: 600,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: m.dot,
                  border: b.color === 'white' ? '1px solid var(--line-2)' : 'none',
                }} />
                {b.level || '미지정'}
                <span className="tabnum" style={{ color: 'var(--ink-3)' }}>×{b.count}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
