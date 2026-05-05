import { ColorBadge } from './atoms';

/**
 * climb_log.problems 배열을 한 줄씩 표기.
 *  - 각 시도는 체크 개념: 완등/실패 상태를 단어로 표기
 *  - 시도 횟수(attempts)는 우측에 "· N회"로 부가 표기
 */
export default function ClearedSummary({ problems = [] }) {
  if (!problems.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
      {problems.map((p, i) => (
        <div key={p.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ColorBadge color={p.color} level={p.level} size="sm" />
          {p.is_cleared ? (
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>완등</span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>실패</span>
          )}
          <span className="tabnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            · {p.attempts || 1}회
          </span>
        </div>
      ))}
    </div>
  );
}
