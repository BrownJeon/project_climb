// Atoms — handoff `app/ui.jsx` 1:1 React 변환
import { colorMeta } from '../../utils/colors';
import { I } from './Icons';

// ─────────── ColorDot ───────────
export function ColorDot({ color, size = 10 }) {
  const m = colorMeta(color);
  const isWhite = color === 'white';
  return (
    <span
      style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        background: m.dot, border: isWhite ? '1px solid var(--line-2)' : 'none',
        flexShrink: 0,
      }}
    />
  );
}

// ─────────── ColorBadge (pill) ───────────
export function ColorBadge({ color, level, size = 'md' }) {
  const m = colorMeta(color);
  const sm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: sm ? '2px 8px' : '4px 10px', borderRadius: 'var(--r-pill)',
        background: 'var(--surface-2)', border: '1px solid var(--line)',
        fontSize: sm ? 11 : 12, fontWeight: 600, color: 'var(--ink-1)', lineHeight: 1.2,
      }}
    >
      <ColorDot color={color} size={sm ? 7 : 9} />
      <span>{m.label}{level ? ` ${level}` : ''}</span>
    </span>
  );
}

// ─────────── Chip ───────────
export function Chip({ children, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '7px 12px', borderRadius: 'var(--r-pill)',
        border: `1px solid ${active ? 'var(--ink-1)' : 'var(--line)'}`,
        background: active ? 'var(--ink-1)' : 'var(--surface)',
        color: active ? 'var(--surface)' : 'var(--ink-2)',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      {icon}{children}
    </button>
  );
}

// ─────────── Pill ───────────
export function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: 'var(--surface-2)', fg: 'var(--ink-2)', bd: 'var(--line)' },
    primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-ink)', bd: 'var(--primary-line)' },
    success: { bg: 'oklch(96% 0.04 155)', fg: 'oklch(40% 0.12 155)', bd: 'oklch(88% 0.08 155)' },
    warn:    { bg: 'oklch(96% 0.04 75)',  fg: 'oklch(45% 0.13 75)',  bd: 'oklch(88% 0.08 75)' },
    danger:  { bg: 'oklch(96% 0.04 25)',  fg: 'oklch(48% 0.16 25)',  bd: 'oklch(88% 0.08 25)' },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 'var(--r-pill)',
      background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`,
      fontSize: 11, fontWeight: 600,
    }}>{children}</span>
  );
}

// ─────────── Btn ───────────
export function Btn({ children, variant = 'primary', size = 'md', icon, full, onClick, disabled, type = 'button' }) {
  const sizes = {
    sm: { p: '8px 12px', fs: 13, h: 32 },
    md: { p: '11px 16px', fs: 14, h: 42 },
    lg: { p: '14px 20px', fs: 15, h: 50 },
  }[size];
  const variants = {
    primary: { bg: 'var(--ink-1)', fg: 'var(--surface)', bd: 'var(--ink-1)' },
    accent:  { bg: 'var(--primary)', fg: '#fff', bd: 'var(--primary)' },
    ghost:   { bg: 'transparent', fg: 'var(--ink-1)', bd: 'var(--line-2)' },
    soft:    { bg: 'var(--surface-2)', fg: 'var(--ink-1)', bd: 'var(--line)' },
    danger:  { bg: 'var(--danger)', fg: '#fff', bd: 'var(--danger)' },
  }[variant];
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: sizes.p, height: sizes.h, fontSize: sizes.fs, fontWeight: 600,
        borderRadius: 'var(--r-sm)', background: variants.bg, color: variants.fg,
        border: `1px solid ${variants.bd}`, width: full ? '100%' : 'auto',
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}{children}
    </button>
  );
}

// ─────────── RadioOpt ───────────
export function RadioOpt({ label, sub, checked, disabled, mini, onClick }) {
  return (
    <label
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: mini ? '5px 0' : '8px 10px',
        borderRadius: 'var(--r-sm)',
        background: checked && !mini ? 'var(--primary-soft)' : 'transparent',
        border: checked && !mini ? '1px solid var(--primary-line)' : '1px solid transparent',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--line-2)'}`,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        {checked && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</span>
      {sub && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{sub}</span>}
    </label>
  );
}

// ─────────── Checkbox (캘린더·시도 입력 등) ───────────
export function Checkbox({ checked, onClick, label, tone = 'primary' }) {
  const accent = tone === 'success' ? 'var(--success)' : 'var(--primary)';
  return (
    <label onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 13, cursor: 'pointer' }}>
      <span style={{
        width: 18, height: 18, borderRadius: 5,
        border: `1.5px solid ${checked ? accent : 'var(--line-2)'}`,
        background: checked ? accent : 'transparent',
        display: 'grid', placeItems: 'center', color: '#fff',
      }}>
        {checked && I.check(11)}
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

// ─────────── Stepper ───────────
export function Stepper({ value, onChange, min = 1, max = 99 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <button
        onClick={() => onChange?.(Math.max(min, (value || 0) - 1))}
        style={{ width: 28, height: 28, color: 'var(--ink-3)', fontSize: 14 }}
      >−</button>
      <span className="tabnum" style={{ padding: '0 12px', minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
        {value}
      </span>
      <button
        onClick={() => onChange?.(Math.min(max, (value || 0) + 1))}
        style={{ width: 28, height: 28, color: 'var(--ink-3)', fontSize: 14 }}
      >+</button>
    </div>
  );
}

// 재export
export { I };
