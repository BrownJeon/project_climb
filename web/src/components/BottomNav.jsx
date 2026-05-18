import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { I } from './atoms/Icons';
import { useSessionAddModal } from '../contexts/SessionAddModalContext';
import { passesApi } from '../api/passes';

/**
 * BottomNav
 *  - 5탭: 마이 / 문제↔캘린더(토글) / [+ FAB] / 훈련 / 성장↔루틴(토글)
 */
export default function BottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const { open } = useSessionAddModal();
  const [passAlert, setPassAlert] = useState(false);

  useEffect(() => {
    passesApi.list().then((r) => {
      const passes = r.data?.passes || [];
      const alert = passes.some((p) => {
        if (p.is_expired) return false;
        if (p.pass_type === 'period') return p.days_remaining != null && p.days_remaining <= 7;
        if (p.pass_type === 'count') return p.remaining_count != null && p.remaining_count <= 2;
        return false;
      });
      setPassAlert(alert);
    }).catch(() => {});
  }, []);

  const onRecords = loc.pathname.startsWith('/records');
  const onCalendar = loc.pathname.startsWith('/calendar');
  const onToggle = onRecords || onCalendar;

  function handleToggle() {
    if (onCalendar) { nav('/records'); return; }
    if (onRecords) { nav('/calendar'); return; }
    nav('/calendar');
  }

  const onGrowth = loc.pathname.startsWith('/growth');
  const onRoutine = loc.pathname.startsWith('/routine');
  const onGrowthToggle = onGrowth || onRoutine;

  function handleGrowthToggle() {
    if (onGrowth) { nav('/routine'); return; }
    if (onRoutine) { nav('/growth'); return; }
    nav('/growth');
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 'var(--max-w)',
      borderTop: '1px solid var(--line)', background: 'var(--surface)',
      padding: '8px 8px 28px',
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
      zIndex: 50,
    }}>
      {/* 마이 */}
      <NavBtn active={loc.pathname.startsWith('/me')} label="마이"
        icon={I.user(22)} onClick={() => nav('/me')} badge={passAlert} />

      {/* 문제 ↔ 캘린더 토글 */}
      <button
        onClick={handleToggle}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '4px 0',
          color: onToggle ? 'var(--ink-1)' : 'var(--ink-4)',
        }}
      >
        <span style={{ opacity: onToggle ? 1 : 0.78 }}>
          {onRecords ? I.flame(22) : I.cal(22)}
        </span>
        <span style={{ fontSize: 10, fontWeight: onToggle ? 700 : 500, letterSpacing: -0.2 }}>
          {onRecords ? '문제' : '캘린더'}
        </span>
        {/* 서브 인디케이터 — 활성 시 두 뷰 모두 점으로 표시 */}
        {onToggle && (
          <span style={{ display: 'flex', gap: 3, marginTop: -2 }}>
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: onCalendar ? 'var(--ink-1)' : 'var(--ink-4)',
            }} />
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: onRecords ? 'var(--ink-1)' : 'var(--ink-4)',
            }} />
          </span>
        )}
      </button>

      {/* FAB */}
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <button
          onClick={() => open({ mode: 'full' })}
          aria-label="추가"
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--primary)', color: '#fff',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 6px 18px color-mix(in oklch, var(--primary) 50%, transparent)',
            marginTop: -22,
          }}
        >
          {I.plus(22)}
        </button>
      </div>

      {/* 훈련 */}
      <NavBtn active={loc.pathname.startsWith('/training')} label="훈련"
        icon={I.dumbbell(22)} onClick={() => nav('/training')} />

      {/* 성장 ↔ 루틴 토글 */}
      <button
        onClick={handleGrowthToggle}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '4px 0',
          color: onGrowthToggle ? 'var(--ink-1)' : 'var(--ink-4)',
        }}
      >
        <span style={{ opacity: onGrowthToggle ? 1 : 0.78 }}>
          {onRoutine ? I.checkSquare(22) : I.barChart(22)}
        </span>
        <span style={{ fontSize: 10, fontWeight: onGrowthToggle ? 700 : 500, letterSpacing: -0.2 }}>
          {onRoutine ? '루틴' : '성장'}
        </span>
        {onGrowthToggle && (
          <span style={{ display: 'flex', gap: 3, marginTop: -2 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: onGrowth ? 'var(--ink-1)' : 'var(--ink-4)' }} />
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: onRoutine ? 'var(--ink-1)' : 'var(--ink-4)' }} />
          </span>
        )}
      </button>
    </nav>
  );
}

function NavBtn({ active, label, icon, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '4px 0',
      color: active ? 'var(--ink-1)' : 'var(--ink-4)',
    }}>
      <span style={{ position: 'relative', opacity: active ? 1 : 0.78 }}>
        {icon}
        {badge && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--warn)',
          }} />
        )}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: -0.2 }}>{label}</span>
    </button>
  );
}
