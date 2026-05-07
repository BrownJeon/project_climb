import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import RouteCard from '../components/RouteCard';
import { Btn, ColorBadge } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import ProblemAddModal from '../components/modals/ProblemAddModal';
import GymAddModal from '../components/modals/GymAddModal';
import { gymsApi } from '../api/gyms';
import { routesApi } from '../api/routes';

export default function GymDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const backBtn = (
    <button onClick={() => nav(-1)} aria-label="뒤로"
      style={{
        width: 36, height: 36, borderRadius: 'var(--r-pill)',
        display: 'grid', placeItems: 'center',
        color: 'var(--ink-2)', background: 'var(--surface-2)',
      }}>
      {I.chev(16, 'left')}
    </button>
  );
  const [gym, setGym] = useState(null);
  const [tab, setTab] = useState('routes');
  const [routes, setRoutes] = useState([]);
  const [problems, setProblems] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function handleDeleteGym() {
    if (!confirm(`'${gym.name}' 암장을 삭제할까요?\n관련 문제·영상·이용권 등에 영향이 있을 수 있습니다.`)) return;
    try {
      await gymsApi.remove(id);
      nav('/gyms');
    } catch (e) {
      alert(e?.response?.data?.message || '삭제 실패');
    }
  }

  function loadProblems() {
    gymsApi.problems(id).then((r) => setProblems(r.data?.problems || [])).catch(() => {});
  }

  useEffect(() => {
    gymsApi.get(id).then((r) => setGym(r.data)).catch(() => setGym(null));
  }, [id]);

  useEffect(() => {
    if (tab === 'routes') {
      routesApi.list({ gym_id: id, sort: 'latest', limit: 20 })
        .then((r) => setRoutes(r.data?.routes || []))
        .catch(() => {});
    } else {
      loadProblems();
    }
  }, [id, tab]);

  if (gym === null) {
    return (
      <>
        <TopBar right={backBtn} />
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>암장을 찾을 수 없습니다</div>
      </>
    );
  }

  return (
    <>
      <TopBar right={backBtn} />

      {/* Header block */}
      <div style={{ padding: '16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -.4, flex: 1, minWidth: 0 }}>{gym.name}</div>
          <button onClick={() => setEditOpen(true)} style={{
            fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
            padding: '5px 10px', borderRadius: 'var(--r-pill)',
            border: '1px solid var(--line-2)', background: 'var(--surface)',
          }}>수정</button>
          <button onClick={handleDeleteGym} style={{
            fontSize: 12, fontWeight: 600, color: 'var(--danger)',
            padding: '5px 10px', borderRadius: 'var(--r-pill)',
            border: '1px solid var(--line-2)', background: 'var(--surface)',
          }}>삭제</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{gym.address}</div>
        {gym.hours && (
          <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: 'var(--ink-2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.clock(13)} {gym.hours}</span>
          </div>
        )}
        {gym.price_info && (
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>💴 {gym.price_info}</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="ghost" size="sm" icon={I.pin(13)}>지도 보기</Btn>
          <Btn variant="soft" size="sm" icon={I.star(13, true)}>주 암장</Btn>
        </div>
      </div>

      {/* Tabs (sticky) */}
      <div style={{
        display: 'flex', gap: 18, padding: '0 16px',
        borderBottom: '1px solid var(--line)', background: 'var(--surface)',
        position: 'sticky', top: 54, zIndex: 4,
      }}>
        {[['routes', `영상 (${routes.length})`], ['problems', `문제 (${problems.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '12px 0', borderBottom: tab === k ? '2px solid var(--ink-1)' : '2px solid transparent',
            fontSize: 13, fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'routes' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px 6px', fontSize: 12 }}>
            <span style={{ color: 'var(--ink-3)' }}>정렬: <b style={{ color: 'var(--ink-1)' }}>최신순</b></span>
            <span style={{ color: 'var(--ink-3)' }}>필터: 전체</span>
          </div>
          {routes.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              등록된 영상이 없습니다.
            </div>
          ) : (
            <div style={{ padding: '4px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {routes.map((r) => (
                <RouteCard key={r.id} route={{
                  id: r.id, color: r.problem?.color, level: r.problem?.level,
                  thumbnail_url: r.thumbnail_url,
                  date: r.created_at, cleared: r.cleared, attempts: r.attempts,
                  likes: r.like_count ?? 0, bookmarks: r.bookmarks ?? 0, saved: r.saved,
                }} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {problems.map((p) => (
            <div key={p.id} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <ColorBadge color={p.color} level={p.level} />
              {p.section && <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>· {p.section}</span>}
              {!p.section && <span style={{ flex: 1 }} />}
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.route_count ?? 0}개 영상</span>
              <span style={{ color: 'var(--ink-4)' }}>{I.chev(13)}</span>
            </div>
          ))}
          <button onClick={() => setAddOpen(true)} style={{
            marginTop: 6, padding: '12px', borderRadius: 'var(--r-md)',
            border: '1px dashed var(--line-2)', color: 'var(--ink-2)',
            fontSize: 13, fontWeight: 600, background: 'transparent',
          }}>+ 새 문제 등록</button>
        </div>
      )}

      {addOpen && (
        <ProblemAddModal
          gymId={id}
          onClose={() => setAddOpen(false)}
          onSaved={() => loadProblems()}
        />
      )}
      {editOpen && (
        <GymAddModal
          gym={gym}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            if (updated) setGym(updated);
            else gymsApi.get(id).then((r) => setGym(r.data)).catch(() => {});
          }}
        />
      )}
    </>
  );
}
