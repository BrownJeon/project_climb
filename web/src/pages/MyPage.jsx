import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import RouteCard from '../components/RouteCard';
import { Btn, ColorBadge, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { usersApi } from '../api/users';
import { passesApi } from '../api/passes';
import { formatTenure, formatDateKR } from '../utils/climbingTenure';

export default function MyPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('routes');
  const [routes, setRoutes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [passes, setPasses] = useState([]);

  useEffect(() => {
    usersApi.me().then((r) => setUser(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'routes') usersApi.myRoutes().then((r) => setRoutes(r.data?.routes || [])).catch(() => {});
    else if (tab === 'bookmarks') usersApi.myBookmarks().then((r) => setBookmarks(r.data?.routes || [])).catch(() => {});
    else if (tab === 'passes') passesApi.list().then((r) => setPasses(r.data?.passes || [])).catch(() => {});
  }, [tab]);

  if (!user) {
    return (
      <>
        <TopBar title="마이페이지" back />
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중...</div>
      </>
    );
  }

  const tenure = formatTenure(user.climbing_started_at);

  return (
    <>
      <TopBar title="마이페이지" back right={null} />

      {/* Profile block */}
      <div style={{ padding: '18px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), oklch(58% 0.18 28))',
            display: 'grid', placeItems: 'center', color: '#fff', fontSize: 24, fontWeight: 800,
          }}>{user.nickname?.[0] || '나'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{user.nickname}</div>
            {user.bio && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{user.bio}</div>}
          </div>
          <button style={{
            padding: '7px 11px', fontSize: 12, fontWeight: 600,
            color: 'var(--ink-2)', border: '1px solid var(--line-2)',
            borderRadius: 'var(--r-pill)', background: 'var(--surface)',
          }}>편집</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          {(user.max_level_color || user.max_level_grade) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)' }}>
              <span style={{ width: 18 }}>🏆</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>최고 레벨</span>
              <ColorBadge color={user.max_level_color} level={user.max_level_grade} size="sm" />
              {user.max_level_gym?.name && (
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>· {user.max_level_gym.name}</span>
              )}
            </div>
          )}
          {tenure && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)' }}>
              <span style={{ width: 18 }}>{I.flame(15)}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>경력</span>
              <span style={{ fontWeight: 600 }}>{tenure}</span>
            </div>
          )}
          {user.main_gyms?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--ink-2)' }}>
              <span style={{ width: 18 }}>{I.pin(15)}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 1 }}>주 암장</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {user.main_gyms.map((g) => (
                  <Link key={g.id} to={`/gyms/${g.id}`} style={{
                    fontSize: 12, padding: '3px 9px', borderRadius: 'var(--r-pill)',
                    background: 'var(--surface-2)', border: '1px solid var(--line)',
                    fontWeight: 600, color: 'var(--ink-1)',
                  }}>{g.name}</Link>
                ))}
              </div>
            </div>
          )}
          {user.climbing_started_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-3)', fontSize: 12 }}>
              <span style={{ width: 18 }}>📅</span>
              <span>시작일 {formatDateKR(user.climbing_started_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 18, padding: '0 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        {[
          ['routes',    `내 영상 (${user.routeCount ?? 0})`],
          ['bookmarks', '북마크'],
          ['passes',    '이용권'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '12px 0', borderBottom: tab === k ? '2px solid var(--ink-1)' : '2px solid transparent',
            fontSize: 13, fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'passes' ? (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {passes.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>등록된 이용권이 없습니다</div>}
          {passes.map((p) => (
            <div key={p.id} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', padding: '14px',
              opacity: p.is_expired ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{p.gym_name}</span>
                <Pill tone={p.pass_type === 'period' ? 'primary' : 'neutral'}>
                  {p.pass_type === 'period' ? '정기권' : '횟수권'}
                </Pill>
                {p.label && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.label}</span>}
              </div>

              {p.pass_type === 'period' ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 3 }}>📅 {p.start_date} ~ {p.end_date}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>⏳ 잔여 {p.days_remaining}일</div>
                </>
              ) : (
                <>
                  <div className="tabnum" style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    🎟️ 잔여 {p.remaining_count} / {p.total_count}회
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{
                      height: '100%', width: `${(p.remaining_count / p.total_count) * 100}%`,
                      background: 'var(--primary)', transition: 'width .3s',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    📅 {p.end_date ? `만료일: ${p.end_date}${p.days_remaining != null ? ` (${p.days_remaining}일 남음)` : ''}` : '만료일 없음 (무기한)'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <Btn variant="soft" size="sm" disabled={p.is_expired || p.remaining_count <= 0}
                      onClick={async () => {
                        await passesApi.use(p.id);
                        const r = await passesApi.list();
                        setPasses(r.data?.passes || []);
                      }}>1회 사용</Btn>
                  </div>
                </>
              )}
            </div>
          ))}
          <Btn variant="ghost" full icon={I.plus(15)}>이용권 등록</Btn>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {(tab === 'bookmarks' ? bookmarks : routes).map((r) => (
            <RouteCard key={r.id} route={{
              id: r.id, color: r.problem?.color, level: r.problem?.level,
              date: r.created_at, cleared: r.cleared, attempts: r.attempts,
              likes: r.like_count ?? 0, bookmarks: r.bookmarks ?? 0, saved: r.saved,
            }} />
          ))}
          {(tab === 'bookmarks' ? bookmarks : routes).length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              {tab === 'bookmarks' ? '북마크한 영상이 없습니다' : '등록한 영상이 없습니다'}
            </div>
          )}
        </div>
      )}
    </>
  );
}
