import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { Chip, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { gymsApi } from '../api/gyms';
import { colorMeta } from '../utils/colors';

export default function GymListPage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [gyms, setGyms] = useState([]);
  const [filterChip, setFilterChip] = useState('near');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    gymsApi.list({
      q: debouncedQ || undefined,
      include_recent_routes: 'true',
      limit: 30,
    }).then((r) => setGyms(r.data?.gyms || [])).catch(() => {});
  }, [debouncedQ]);

  return (
    <>
      <TopBar title="기록" />

      <div style={{ padding: '12px 16px' }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 'var(--r-pill)',
        }}>
          <span style={{ color: 'var(--ink-4)' }}>{I.search(16)}</span>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="암장 이름 검색"
            style={{ flex: 1, border: 0, outline: 'none', fontSize: 14, background: 'transparent' }}
          />
        </div>

        {/* Quick filter chips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <Chip active={filterChip === 'near'}    onClick={() => setFilterChip('near')}    icon={I.pin(12)}>내 위치 5km</Chip>
          <Chip active={filterChip === 'recent'}  onClick={() => setFilterChip('recent')}>최근 방문</Chip>
          <Chip active={filterChip === 'main'}    onClick={() => setFilterChip('main')}>주 암장</Chip>
        </div>
      </div>

      <div style={{ padding: '4px 16px 16px', fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
        검색 결과 {gyms.length}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gyms.map((g) => (
          <div
            key={g.id}
            onClick={() => nav(`/gyms/${g.id}`)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', padding: '14px 14px 12px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
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
                </div>
              </div>
              <span style={{ color: 'var(--ink-4)', marginTop: 2 }}>{I.chev(14)}</span>
            </div>

            {/* 최근 영상 미리보기 (있을 때만) */}
            {g.recent_routes?.length > 0 && (
              <div style={{ display: 'flex', gap: 5, marginTop: 11, overflow: 'hidden' }}>
                {g.recent_routes.slice(0, 4).map((r, i) => {
                  const m = colorMeta(r.color || 'gray');
                  return (
                    <div key={i} style={{
                      width: 48, height: 60, flexShrink: 0, borderRadius: 8,
                      background: `linear-gradient(160deg, ${m.dot}44, ${m.dot}88)`,
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', top: 4, left: 4,
                        width: 5, height: 5, borderRadius: '50%',
                        background: m.dot, boxShadow: '0 0 0 1.5px #fff',
                      }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {gyms.length === 0 && (
          <div style={{ padding: '32px 0', color: 'var(--ink-3)', textAlign: 'center', fontSize: 13 }}>
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </>
  );
}
