import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import RouteCard from '../components/RouteCard';
import { Btn, ColorBadge, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import ProfileEditModal from '../components/modals/ProfileEditModal';
import PassAddModal from '../components/modals/PassAddModal';
import PassEditModal from '../components/modals/PassEditModal';
import VideoUploadModal from '../components/modals/VideoUploadModal';
import { usersApi } from '../api/users';
import { passesApi } from '../api/passes';
import { formatTenure, formatDateKR } from '../utils/climbingTenure';
import { VIDEO_QUALITY_PRESETS, getVideoQualityKey, setVideoQualityKey } from '../utils/videoQuality';

const PAGE_LIMIT = 12;

export default function MyPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('routes');
  const [routes, setRoutes] = useState([]);
  const [routesPage, setRoutesPage] = useState(1);
  const [routesHasMore, setRoutesHasMore] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarksPage, setBookmarksPage] = useState(1);
  const [bookmarksHasMore, setBookmarksHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [passes, setPasses] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [passAddOpen, setPassAddOpen] = useState(false);
  const [passEditTarget, setPassEditTarget] = useState(null);
  const [videoUploadOpen, setVideoUploadOpen] = useState(false);
  const [videoQuality, setVideoQualityState] = useState(getVideoQualityKey);

  function loadUser() {
    usersApi.me().then((r) => setUser(r.data)).catch(() => {});
  }
  function loadPasses() {
    passesApi.list().then((r) => setPasses(r.data?.passes || [])).catch(() => {});
  }

  async function loadRoutesPage(page, append) {
    setLoadingMore(true);
    try {
      const r = await usersApi.myRoutes({ page, limit: PAGE_LIMIT });
      const list = r.data?.routes || [];
      const total = r.data?.total ?? 0;
      setRoutes((prev) => append ? [...prev, ...list] : list);
      setRoutesPage(page);
      setRoutesHasMore(append
        ? (page * PAGE_LIMIT) < total && list.length > 0
        : page * PAGE_LIMIT < total && list.length >= PAGE_LIMIT);
    } catch {} finally { setLoadingMore(false); }
  }
  async function loadBookmarksPage(page, append) {
    setLoadingMore(true);
    try {
      const r = await usersApi.myBookmarks({ page, limit: PAGE_LIMIT });
      const list = r.data?.routes || [];
      setBookmarks((prev) => append ? [...prev, ...list] : list);
      setBookmarksPage(page);
      setBookmarksHasMore(list.length >= PAGE_LIMIT);
    } catch {} finally { setLoadingMore(false); }
  }

  useEffect(() => { loadUser(); loadPasses(); }, []);

  useEffect(() => {
    if (tab === 'routes') loadRoutesPage(1, false);
    else if (tab === 'bookmarks') loadBookmarksPage(1, false);
  }, [tab]);

  if (!user) {
    return (
      <>
        <TopBar />
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중...</div>
      </>
    );
  }

  const tenure = formatTenure(user.climbing_started_at);

  async function deletePass(id) {
    if (!confirm('이용권을 삭제하시겠습니까?')) return;
    try {
      await passesApi.remove(id);
      loadPasses();
    } catch (e) {
      alert(e?.response?.data?.message || '삭제 실패');
    }
  }

  return (
    <>
      <TopBar right={null} />

      {/* Profile block */}
      <div style={{ padding: '18px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: user.profile_image
              ? `url("${user.profile_image}") center/cover`
              : 'linear-gradient(135deg, var(--primary), oklch(58% 0.18 28))',
            display: 'grid', placeItems: 'center', color: '#fff', fontSize: 24, fontWeight: 800,
            overflow: 'hidden',
          }}>{!user.profile_image && (user.nickname?.[0] || '나')}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{user.nickname}</div>
            {user.bio && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{user.bio}</div>}
          </div>
          <button onClick={() => setEditOpen(true)} style={{
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

      {/* 암장 관리 진입 */}
      <div style={{ padding: '0 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <Link to="/gyms" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 0', textDecoration: 'none', color: 'inherit',
        }}>
          <span style={{
            width: 36, height: 36, borderRadius: 'var(--r-pill)',
            background: 'var(--surface-2)', color: 'var(--ink-2)',
            display: 'grid', placeItems: 'center',
          }}>{I.map(18)}</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>암장 관리</span>
          <span style={{ color: 'var(--ink-4)' }}>{I.chev(14)}</span>
        </Link>
      </div>

      {/* Passes section (프로필 정보 아래 별도 영역) */}
      <div style={{
        padding: '14px 16px', background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>
            이용권 {passes.length > 0 && <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>({passes.length})</span>}
          </div>
          <button onClick={() => setPassAddOpen(true)} aria-label="이용권 등록"
            style={{
              width: 32, height: 32, borderRadius: 'var(--r-pill)',
              display: 'grid', placeItems: 'center',
              color: 'var(--ink-2)', background: 'var(--surface-2)',
            }}>
            {I.plus(16)}
          </button>
        </div>

        {passes.length === 0 ? (
          <div style={{
            padding: '14px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5,
            border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)',
          }}>등록된 이용권이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {passes.map((p) => (
              <div key={p.id} style={{
                background: 'var(--bg)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)', padding: '12px 14px',
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
                    {p.pause_max > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                        일시정지 사용 <b className="tabnum">{p.pause_count_used || 0}</b> / <b className="tabnum">{p.pause_max}</b>
                        {p.is_paused && <span style={{ marginLeft: 6, color: 'var(--warn)', fontWeight: 700 }}>· 정지 중 (시작 {p.current_pause_started_at})</span>}
                      </div>
                    )}
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
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {p.pass_type === 'period' && p.pause_max > 0 && !p.is_expired && (
                    p.is_paused ? (
                      <Btn variant="soft" size="sm"
                        onClick={async () => {
                          if (!confirm('정지를 해제하면 해제일 기준으로 만료일이 자동 연장됩니다. 진행할까요?')) return;
                          try { await passesApi.resume(p.id); loadPasses(); }
                          catch (e) { alert(e?.response?.data?.message || '해제 실패'); }
                        }}>정지 해제</Btn>
                    ) : (
                      <Btn variant="ghost" size="sm"
                        disabled={(p.pause_count_used || 0) >= p.pause_max}
                        onClick={async () => {
                          const left = p.pause_max - (p.pause_count_used || 0);
                          if (!confirm(`일시정지를 시작합니다. 사용 가능 ${left}회 남음.`)) return;
                          try { await passesApi.pause(p.id); loadPasses(); }
                          catch (e) { alert(e?.response?.data?.message || '정지 실패'); }
                        }}>일시정지</Btn>
                    )
                  )}
                  <Btn variant="ghost" size="sm" onClick={() => setPassEditTarget(p)}>수정</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => deletePass(p.id)}>삭제</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 설정 섹션 */}
      <div style={{ padding: '14px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>설정</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>영상 업로드 화질</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              {VIDEO_QUALITY_PRESETS.find((p) => p.key === videoQuality)?.desc || ''}
            </div>
          </div>
          <select
            value={videoQuality}
            onChange={(e) => {
              setVideoQualityKey(e.target.value);
              setVideoQualityState(e.target.value);
            }}
            style={{
              padding: '7px 10px', fontSize: 13, borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line)', background: 'var(--surface-2)',
              color: 'var(--ink-1)',
            }}
          >
            {VIDEO_QUALITY_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs (영상/북마크) */}
      <div style={{ display: 'flex', gap: 18, padding: '0 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', alignItems: 'center' }}>
        {[
          ['routes',    `내 영상 (${user.routeCount ?? 0})`],
          ['bookmarks', '북마크'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '12px 0', borderBottom: tab === k ? '2px solid var(--ink-1)' : '2px solid transparent',
            fontSize: 13, fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)',
          }}>{l}</button>
        ))}
        {tab === 'routes' && (
          <button onClick={() => setVideoUploadOpen(true)} aria-label="영상 등록"
            style={{
              marginLeft: 'auto', width: 30, height: 30, borderRadius: 'var(--r-pill)',
              display: 'grid', placeItems: 'center',
              color: 'var(--ink-2)', background: 'var(--surface-2)',
            }}>{I.plus(16)}</button>
        )}
      </div>

      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {(tab === 'bookmarks' ? bookmarks : routes).map((r) => (
          <RouteCard key={r.id} compact route={{
            id: r.id,
            color: r.color || r.problem?.color,
            level: r.level || r.problem?.level,
            thumbnail_url: r.thumbnail_url,
            date: r.created_at, cleared: r.cleared, attempts: r.attempts,
            likes: r.like_count ?? 0, bookmarks: r.bookmarks ?? 0, saved: r.isBookmarked ?? false,
          }} />
        ))}
        {(tab === 'bookmarks' ? bookmarks : routes).length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            {tab === 'bookmarks' ? '북마크한 영상이 없습니다' : '등록한 영상이 없습니다'}
          </div>
        )}
      </div>
      {((tab === 'routes' && routesHasMore) || (tab === 'bookmarks' && bookmarksHasMore)) && (
        <div style={{ padding: '0 16px 16px' }}>
          <Btn variant="ghost" full disabled={loadingMore}
            onClick={() => tab === 'routes'
              ? loadRoutesPage(routesPage + 1, true)
              : loadBookmarksPage(bookmarksPage + 1, true)}>
            {loadingMore ? '불러오는 중...' : '더 보기'}
          </Btn>
        </div>
      )}

      {editOpen && (
        <ProfileEditModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            if (updated) setUser((prev) => ({ ...prev, ...updated }));
            else loadUser();
          }}
        />
      )}
      {passAddOpen && (
        <PassAddModal
          onClose={() => setPassAddOpen(false)}
          onSaved={() => loadPasses()}
        />
      )}
      {passEditTarget && (
        <PassEditModal
          pass={passEditTarget}
          onClose={() => setPassEditTarget(null)}
          onSaved={() => loadPasses()}
        />
      )}
      {videoUploadOpen && (
        <VideoUploadModal
          onClose={() => setVideoUploadOpen(false)}
          onSaved={() => loadRoutesPage(1, false)}
        />
      )}
    </>
  );
}
