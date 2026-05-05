// Shared UI primitives + app shell (TopBar, BottomNav, RouteCard, etc.)
const { useState, useMemo, useEffect, useRef } = React;
const C = window.MOCK.COLORS;

// ─────────── Atoms ───────────
function ColorDot({ color, size=10 }){
  const c = C[color]?.dot || '#999';
  const isWhite = color==='white';
  return <span style={{
    display:'inline-block', width:size, height:size, borderRadius:'50%',
    background:c, border: isWhite ? '1px solid var(--line-2)' : 'none',
    flexShrink:0,
  }} />;
}
function ColorBadge({ color, level, size='md' }){
  const meta = C[color] || { label:color, kr:'' };
  const sm = size==='sm';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding: sm ? '2px 8px' : '4px 10px', borderRadius:'var(--r-pill)',
      background:'var(--surface-2)', border:'1px solid var(--line)',
      fontSize: sm ? 11 : 12, fontWeight:600, color:'var(--ink-1)', lineHeight:1.2,
    }}>
      <ColorDot color={color} size={sm?7:9}/>
      <span>{meta.label}{level?` ${level}`:''}</span>
    </span>
  );
}
function Chip({ children, active, onClick, icon }){
  return (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'7px 12px', borderRadius:'var(--r-pill)',
      border:`1px solid ${active?'var(--ink-1)':'var(--line)'}`,
      background: active?'var(--ink-1)':'var(--surface)',
      color: active?'var(--surface)':'var(--ink-2)',
      fontSize:12, fontWeight:600, whiteSpace:'nowrap',
    }}>{icon}{children}</button>
  );
}
function Pill({ children, tone='neutral' }){
  const tones = {
    neutral:{ bg:'var(--surface-2)', fg:'var(--ink-2)', bd:'var(--line)' },
    primary:{ bg:'var(--primary-soft)', fg:'var(--primary-ink)', bd:'var(--primary-line)' },
    success:{ bg:'oklch(96% 0.04 155)', fg:'oklch(40% 0.12 155)', bd:'oklch(88% 0.08 155)' },
    warn:{ bg:'oklch(96% 0.04 75)', fg:'oklch(45% 0.13 75)', bd:'oklch(88% 0.08 75)' },
    danger:{ bg:'oklch(96% 0.04 25)', fg:'oklch(48% 0.16 25)', bd:'oklch(88% 0.08 25)' },
  }[tone];
  return <span style={{
    display:'inline-flex', alignItems:'center', gap:4,
    padding:'2px 8px', borderRadius:'var(--r-pill)',
    background:tones.bg, color:tones.fg, border:`1px solid ${tones.bd}`,
    fontSize:11, fontWeight:600,
  }}>{children}</span>;
}
function Btn({ children, variant='primary', size='md', icon, full, onClick, disabled }){
  const sizes = { sm:{ p:'8px 12px', fs:13, h:32 }, md:{ p:'11px 16px', fs:14, h:42 }, lg:{ p:'14px 20px', fs:15, h:50 } }[size];
  const variants = {
    primary:{ bg:'var(--ink-1)', fg:'var(--surface)', bd:'var(--ink-1)' },
    accent:{ bg:'var(--primary)', fg:'#fff', bd:'var(--primary)' },
    ghost:{ bg:'transparent', fg:'var(--ink-1)', bd:'var(--line-2)' },
    soft:{ bg:'var(--surface-2)', fg:'var(--ink-1)', bd:'var(--line)' },
  }[variant];
  return <button onClick={onClick} disabled={disabled} style={{
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
    padding:sizes.p, height:sizes.h, fontSize:sizes.fs, fontWeight:600,
    borderRadius:'var(--r-sm)', background:variants.bg, color:variants.fg,
    border:`1px solid ${variants.bd}`, width: full?'100%':'auto',
    opacity: disabled?0.4:1,
  }}>{icon}{children}</button>;
}

// ─────────── Icons (line icons, 1.6 stroke) ───────────
const I = {
  search: (s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  bell: (s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M6 8a6 6 0 0112 0v5l1.5 3h-15L6 13V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  user: (s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  home: (s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  map: (s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  plus: (s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  dumbbell: (s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 9v6M6 6v12M9 9v6M15 9v6M18 6v12M21 9v6M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  cal: (s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  heart: (s=18, fill=false)=><svg width={s} height={s} viewBox="0 0 24 24" fill={fill?'currentColor':'none'}><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  bookmark: (s=18, fill=false)=><svg width={s} height={s} viewBox="0 0 24 24" fill={fill?'currentColor':'none'}><path d="M6 4a1 1 0 011-1h10a1 1 0 011 1v17l-6-4-6 4V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  chev: (s=14, dir='right')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{transform: dir==='left'?'rotate(180deg)':dir==='down'?'rotate(90deg)':dir==='up'?'rotate(-90deg)':'none'}}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  play: (s=14)=><svg width={s} height={s} viewBox="0 0 24 24"><path d="M7 4l13 8-13 8V4z" fill="currentColor"/></svg>,
  more: (s=18)=><svg width={s} height={s} viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>,
  pin: (s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 21s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6"/></svg>,
  clock: (s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  film: (s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 9h18M3 15h18M9 5v14M15 5v14" stroke="currentColor" strokeWidth="1.4"/></svg>,
  star: (s=14, fill=false)=><svg width={s} height={s} viewBox="0 0 24 24" fill={fill?'currentColor':'none'}><path d="M12 3l2.7 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.5 6.5 20.4l1.1-6.3L3 9.7l6.3-.9L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  sparkles: (s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" fill="currentColor"/></svg>,
  ticket: (s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 5v14" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2"/></svg>,
  check: (s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: (s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  flame: (s=14)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 3c2 4 5 5 5 9a5 5 0 11-10 0c0-2 1-3 2-4-1 4 2 4 2 4s-2-3 1-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
};

// ─────────── App Shell ───────────
function TopBar({ title='TheRoute', back, right, brand=false }){
  return (
    <div style={{
      height:54, padding:'0 16px', display:'flex', alignItems:'center',
      gap:8, borderBottom:'1px solid var(--line)', background:'var(--surface)',
      position:'sticky', top:0, zIndex:5,
    }}>
      {back && <button style={{padding:6, marginLeft:-6}}>{I.chev(18,'left')}</button>}
      <div style={{
        flex:1, fontSize: brand?18:16, fontWeight: brand?800:700,
        letterSpacing: brand?-0.4:-0.2, color:'var(--ink-1)',
      }}>{brand? <span><span style={{color:'var(--primary)'}}>The</span>Route</span>: title}</div>
      {right || (
        <button style={{
          width:36, height:36, borderRadius:'var(--r-pill)', display:'grid', placeItems:'center',
          color:'var(--ink-2)', background:'var(--surface-2)',
        }}>{I.user(18)}</button>
      )}
    </div>
  );
}

function BottomNav({ active='home' }){
  const items = [
    { key:'home',     label:'홈',    icon:I.home(22) },
    { key:'gyms',     label:'기록',  icon:I.map(22) },
    { key:'add',      label:'',      icon:I.plus(22), fab:true },
    { key:'training', label:'훈련',  icon:I.dumbbell(22) },
    { key:'cal',      label:'캘린더',icon:I.cal(22) },
  ];
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      borderTop:'1px solid var(--line)', background:'var(--surface)',
      padding:'8px 8px 28px', display:'grid',
      gridTemplateColumns:'repeat(5, 1fr)',
    }}>
      {items.map(it => it.fab ? (
        <div key={it.key} style={{display:'grid', placeItems:'center'}}>
          <button style={{
            width:52, height:52, borderRadius:'50%',
            background:'var(--primary)', color:'#fff',
            display:'grid', placeItems:'center',
            boxShadow:'0 6px 18px color-mix(in oklch, var(--primary) 50%, transparent)',
            marginTop:-22,
          }}>{it.icon}</button>
        </div>
      ) : (
        <button key={it.key} style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:3,
          padding:'4px 0', color: active===it.key?'var(--ink-1)':'var(--ink-4)',
        }}>
          <span style={{opacity: active===it.key?1:0.78}}>{it.icon}</span>
          <span style={{fontSize:10, fontWeight: active===it.key?700:500, letterSpacing:-0.2}}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────── RouteCard (shared in feed/gym/my) ───────────
function RouteCard({ route, compact }){
  const meta = C[route.color];
  return (
    <div style={{
      background:'var(--surface)', borderRadius:'var(--r-md)',
      border:'1px solid var(--line)', overflow:'hidden',
    }}>
      {/* 9:16 thumbnail */}
      <div style={{
        position:'relative', aspectRatio:'9 / 13',
        background:`linear-gradient(155deg, ${meta.dot}33 0%, ${meta.dot}88 100%)`,
        overflow:'hidden',
      }}>
        {/* faux climbing wall texture */}
        <div style={{
          position:'absolute', inset:0,
          background:`radial-gradient(circle at 30% 20%, rgba(255,255,255,.25), transparent 40%),
                      radial-gradient(circle at 70% 80%, rgba(0,0,0,.18), transparent 50%)`,
        }}/>
        {/* holds */}
        <div style={{position:'absolute', top:'18%', left:'40%', width:14, height:14, borderRadius:4, background:meta.dot, boxShadow:'0 1px 3px rgba(0,0,0,.3)'}}/>
        <div style={{position:'absolute', top:'42%', left:'62%', width:10, height:18, borderRadius:5, background:meta.dot, transform:'rotate(15deg)'}}/>
        <div style={{position:'absolute', top:'68%', left:'30%', width:18, height:12, borderRadius:5, background:meta.dot, transform:'rotate(-20deg)'}}/>
        <div style={{position:'absolute', top:'85%', left:'48%', width:12, height:12, borderRadius:6, background:meta.dot}}/>
        {/* play */}
        <div style={{
          position:'absolute', inset:0, display:'grid', placeItems:'center',
        }}>
          <div style={{
            width:42, height:42, borderRadius:'50%',
            background:'rgba(0,0,0,.55)', backdropFilter:'blur(8px)',
            display:'grid', placeItems:'center', color:'#fff',
          }}>{I.play(14)}</div>
        </div>
        {/* clear badge */}
        <div style={{position:'absolute', top:8, left:8}}>
          <Pill tone={route.cleared?'success':'warn'}>
            {route.cleared ? '✓ 완등' : '진행중'} · {route.attempts}회
          </Pill>
        </div>
        {/* save */}
        <div style={{position:'absolute', top:8, right:8, color:'#fff'}}>
          {I.bookmark(18, route.saved)}
        </div>
      </div>
      <div style={{padding:'10px 11px 12px'}}>
        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
          <ColorBadge color={route.color} level={route.level} size="sm"/>
        </div>
        {!compact && (
          <div style={{display:'flex', alignItems:'center', gap:10, fontSize:11, color:'var(--ink-3)'}}>
            <span style={{display:'inline-flex', gap:3, alignItems:'center'}}>{I.heart(12)}<span className="tabnum">{route.likes}</span></span>
            <span style={{display:'inline-flex', gap:3, alignItems:'center'}}>{I.bookmark(12)}<span className="tabnum">{route.bookmarks}</span></span>
            <span style={{marginLeft:'auto'}}>{route.date.slice(5).replace('-','.')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ColorDot, ColorBadge, Chip, Pill, Btn, I, TopBar, BottomNav, RouteCard });
