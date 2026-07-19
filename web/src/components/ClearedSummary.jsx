import { ColorBadge } from './atoms';
import VideoChip from './VideoChip';
import { styleLabel } from '../utils/style';

/**
 * climb_log.problems 배열을 난이도(색상+V등급)별로 한 줄씩 표기.
 *  - cleared_count / failed_count 우선 (신규 흐름)
 *  - 없으면 is_cleared/attempts (레거시) fallback
 *  - videos[]가 있으면 클릭 가능한 영상 칩 표시
 *  - editable=true 면 완등/실패 좌우에 −/+ 버튼 노출, onAdjust(problemId, field, delta) 호출
 */
export default function ClearedSummary({ problems = [], editable = false, onAdjust }) {
  if (!problems.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {problems.map((p, i) => {
        const cleared = p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0);
        const failed = p.failed_count != null ? Number(p.failed_count) : 0;
        const videos = p.videos || (p.ar_route ? [{ id: p.ar_route_id || p.ar_route.id, ar_route: p.ar_route }] : []);

        function adjust(e, field, delta) {
          e.stopPropagation();
          e.preventDefault();
          if (!onAdjust || !p.id) return;
          onAdjust(p.id, field, delta);
        }

        return (
          <div key={p.id || i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* 1행: 배지 + 섹터 + 벽 형태 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', minWidth: 0 }}>
              <div style={{ flexShrink: 0 }}>
                <ColorBadge color={p.color} level={p.level} size="sm" />
              </div>
              {p.sector_name && (
                <span style={{
                  flexShrink: 0,
                  fontSize: 10.5, fontWeight: 600,
                  padding: '2px 6px', borderRadius: 'var(--r-pill)',
                  background: 'var(--surface-2)', color: 'var(--ink-3)',
                  border: '1px solid var(--line-2)', whiteSpace: 'nowrap',
                }}>{p.sector_name}</span>
              )}
              {p.style && (
                <span style={{
                  flexShrink: 0,
                  fontSize: 10.5, fontWeight: 600,
                  padding: '2px 6px', borderRadius: 'var(--r-pill)',
                  background: 'var(--surface-2)', color: 'var(--ink-3)',
                  border: '1px solid var(--line-2)', whiteSpace: 'nowrap',
                }}>{styleLabel(p.style)}</span>
              )}
            </div>

            {/* 2행: 완등/실패 카운트 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', paddingLeft: 4 }}>
              {editable ? (
                <CounterChip
                  tone="success" prefix="완등" value={cleared}
                  onMinus={(e) => adjust(e, 'cleared_count', -1)}
                  onPlus={(e) => adjust(e, 'cleared_count', +1)}
                />
              ) : (
                cleared > 0 && (
                  <span className="tabnum" style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    완등 {cleared}
                  </span>
                )
              )}

              {editable ? (
                <CounterChip
                  tone="danger" prefix="실패" value={failed}
                  onMinus={(e) => adjust(e, 'failed_count', -1)}
                  onPlus={(e) => adjust(e, 'failed_count', +1)}
                />
              ) : (
                failed > 0 && (
                  <span className="tabnum" style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    실패 {failed}
                  </span>
                )
              )}

              {!editable && cleared === 0 && failed === 0 && p.attempts && (
                <span className="tabnum" style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>· {p.attempts}회</span>
              )}
            </div>
            {videos.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 4 }}>
                {videos.map((v, vi) => {
                  const ar = v.ar_route || v;
                  const id = v.ar_route_id || ar.id;
                  if (!id) return null;
                  return (
                    <VideoChip
                      key={`${id}-${vi}`}
                      id={id}
                      title={ar.title}
                      thumbnail_url={ar.thumbnail_url}
                      color={ar.color || p.color}
                      level={ar.level || p.level}
                    />
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

function CounterChip({ tone, prefix, value, onMinus, onPlus }) {
  const color = tone === 'success' ? 'var(--success)' : 'var(--danger)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 3px', borderRadius: 'var(--r-pill)',
      border: '1px solid var(--line)', background: 'var(--surface)',
    }}>
      <button type="button" onClick={onMinus}
        disabled={value <= 0}
        aria-label="감소"
        style={{
          flexShrink: 0,
          width: 20, height: 20, borderRadius: '50%',
          border: 'none', background: 'var(--surface-2)',
          color: value <= 0 ? 'var(--ink-4)' : 'var(--ink-2)',
          fontSize: 13, fontWeight: 700, lineHeight: 1, cursor: value <= 0 ? 'not-allowed' : 'pointer',
        }}>−</button>
      <span className="tabnum" style={{
        fontSize: 11.5, fontWeight: 600, color, padding: '0 4px',
      }}>{prefix} {value}</span>
      <button type="button" onClick={onPlus}
        aria-label="증가"
        style={{
          flexShrink: 0,
          width: 20, height: 20, borderRadius: '50%',
          border: 'none', background: color, color: '#fff',
          fontSize: 13, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
        }}>+</button>
    </span>
  );
}
