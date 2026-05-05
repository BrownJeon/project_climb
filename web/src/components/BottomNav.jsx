import { useLocation, useNavigate } from 'react-router-dom';
import { I } from './atoms/Icons';
import { useSessionAddModal } from '../contexts/SessionAddModalContext';

/**
 * BottomNav — handoff 디자인 1:1
 *  - 5탭: 홈 / 기록(=/gyms) / [+ FAB] / 훈련 / 캘린더
 *  - position fixed bottom, padding 8/8/28, surface bg, 1px top line
 *  - FAB: 52x52 원형, primary, 위로 -22px 튀어나옴, 그림자
 */
const SLOTS = [
  { key: 'home',     to: '/',         label: '홈',     icon: () => I.home(22),     match: (p) => p === '/' },
  { key: 'gyms',     to: '/gyms',     label: '기록',   icon: () => I.map(22),      match: (p) => p.startsWith('/gyms') },
  { key: 'add',      fab: true,       label: '',       icon: () => I.plus(22) },
  { key: 'training', to: '/training', label: '훈련',   icon: () => I.dumbbell(22), match: (p) => p.startsWith('/training') },
  { key: 'cal',      to: '/calendar', label: '캘린더', icon: () => I.cal(22),      match: (p) => p.startsWith('/calendar') },
];

export default function BottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const { open } = useSessionAddModal();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 'var(--max-w)',
      borderTop: '1px solid var(--line)', background: 'var(--surface)',
      padding: '8px 8px 28px',
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
      zIndex: 50,
    }}>
      {SLOTS.map((s) => {
        if (s.fab) {
          return (
            <div key={s.key} style={{ display: 'grid', placeItems: 'center' }}>
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
                {s.icon()}
              </button>
            </div>
          );
        }
        const active = s.match?.(loc.pathname);
        return (
          <button
            key={s.key} onClick={() => nav(s.to)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '4px 0',
              color: active ? 'var(--ink-1)' : 'var(--ink-4)',
            }}
          >
            <span style={{ opacity: active ? 1 : 0.78 }}>{s.icon()}</span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: -0.2 }}>{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
