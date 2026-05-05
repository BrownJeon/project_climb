import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ColorBadge, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import RouteCard from '../components/RouteCard';
import { routesApi } from '../api/routes';
import { fmtRouteTitle, colorMeta } from '../utils/colors';

export default function RouteDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [route, setRoute] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [others, setOthers] = useState([]);

  useEffect(() => {
    routesApi.get(id).then((r) => {
      setRoute(r.data);
      // 같은 색의 다른 영상
      if (r.data?.problem?.color) {
        routesApi.list({ limit: 3 }).then((res) => {
          const list = (res.data?.routes || [])
            .filter((x) => x.id !== r.data.id && x.problem?.color === r.data.problem.color)
            .slice(0, 3);
          setOthers(list);
        }).catch(() => {});
      }
    }).catch(() => setRoute(null));
    routesApi.comments(id).then((r) => setComments(r.data?.comments || [])).catch(() => {});
  }, [id]);

  if (route === null) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>
        영상을 찾을 수 없거나 불러오는 중...
      </div>
    );
  }

  const meta = colorMeta(route.problem?.color || route.color);
  const title = fmtRouteTitle(route.problem?.color || route.color, route.problem?.level || route.level);
  const dot = meta.dot;
  const cleared = route.cleared ?? null;
  const attempts = route.attempts ?? null;

  async function toggleLike() {
    const r = await routesApi.toggleLike(id);
    setRoute({ ...route, isLiked: r.data?.liked, like_count: route.like_count + (r.data?.liked ? 1 : -1) });
  }
  async function toggleBookmark() {
    const r = await routesApi.toggleBookmark(id);
    setRoute({ ...route, isBookmarked: r.data?.bookmarked });
  }
  async function postComment() {
    if (!comment.trim()) return;
    const r = await routesApi.addComment(id, comment.trim());
    setComments((p) => [...p, r.data]);
    setComment('');
  }
  async function removeSelf() {
    if (!confirm('이 영상을 삭제할까요?')) return;
    await routesApi.remove(id);
    nav('/');
  }

  const tags = route.tags?.techniques?.length || route.tags?.wall_type
    ? [
        ...(route.tags?.wall_type ? [`#${route.tags.wall_type}`] : []),
        ...(route.tags?.techniques || []).map((t) => `#${t}`),
        ...(route.tags?.custom || []).map((t) => `#${t}`),
      ]
    : ['#슬랩', '#하이스텝', '#밸런스'];

  return (
    <>
      {/* Video block — handoff hi-fi 디자인 */}
      <div style={{
        position: 'relative', aspectRatio: '9 / 13.5',
        background: `linear-gradient(160deg, ${dot}55, ${dot}aa)`,
      }}>
        <div style={{ position: 'absolute', top: 14, left: 14 }}>
          <button onClick={() => nav(-1)} aria-label="뒤로" style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)',
            color: '#fff', display: 'grid', placeItems: 'center',
          }}>{I.chev(16, 'left')}</button>
        </div>
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <button aria-label="더보기" style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)',
            color: '#fff', display: 'grid', placeItems: 'center',
          }}>{I.more(18)}</button>
        </div>

        {/* 가짜 holds (영상 미리보기 placeholder) */}
        {[[20, 30, 12], [40, 55, 16], [55, 42, 12], [70, 28, 14], [78, 55, 12]].map(([t, l, s], i) => (
          <div key={i} style={{
            position: 'absolute', top: `${t}%`, left: `${l}%`,
            width: s, height: s + 4, borderRadius: 5, background: dot,
            boxShadow: '0 2px 6px rgba(0,0,0,.3)',
          }} />
        ))}

        {/* 실제 video — overlay 위에 배치 */}
        {route.video_url && (
          <video
            src={route.video_url}
            controls
            playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', zIndex: 1 }}
          />
        )}
        {!route.video_url && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(10px)',
              color: '#fff', display: 'grid', placeItems: 'center',
            }}>{I.play(22)}</div>
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: '14px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <ColorBadge color={route.problem?.color || route.color} level={route.problem?.level || route.level} />
          {cleared !== null && (
            <Pill tone={cleared ? 'success' : 'warn'}>
              {cleared ? '✓ 완등' : '진행중'}{attempts ? ` · ${attempts}회 시도` : ''}
            </Pill>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {I.pin(13)} {route.problem?.gym?.name || '암장 미지정'}
          {' · '}
          {(route.created_at || route.date || '').slice(0, 10)}
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
            {tags.map((t, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '4px 9px', borderRadius: 'var(--r-pill)',
                background: 'var(--surface-2)', color: 'var(--ink-2)', fontWeight: 500,
              }}>{t}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <button onClick={toggleLike} style={{
            flex: 1, height: 42, borderRadius: 'var(--r-sm)',
            background: 'var(--surface-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: route.isLiked ? 'var(--primary)' : 'var(--ink-2)',
          }}>
            {I.heart(16, !!route.isLiked)}
            <span>좋아요 {route.like_count ?? 0}</span>
          </button>
          <button onClick={toggleBookmark} style={{
            flex: 1, height: 42, borderRadius: 'var(--r-sm)',
            background: 'var(--surface-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: route.isBookmarked ? 'var(--primary)' : 'var(--ink-2)',
          }}>
            {I.bookmark(16, !!route.isBookmarked)}
            <span>{route.isBookmarked ? '스크랩됨' : '스크랩'}</span>
          </button>
        </div>
      </div>

      {/* Memo */}
      {route.description && (
        <div style={{ padding: '14px 16px', background: 'var(--surface)', marginTop: 8, borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: .4 }}>메모</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{route.description}</div>
        </div>
      )}

      {/* 댓글 */}
      <div style={{ padding: '14px 16px', background: 'var(--surface)', marginTop: 8, borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: .4 }}>댓글 ({comments.length})</div>
        {comments.map((c) => (
          <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
            <strong style={{ marginRight: 6 }}>{c.author?.nickname || '?'}</strong>
            <span style={{ color: 'var(--ink-2)' }}>{c.content}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input
            value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="댓글 입력..." style={{
              flex: 1, padding: '8px 12px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line)', background: 'var(--surface-2)',
              fontSize: 13,
            }}
          />
          <button onClick={postComment} style={{
            padding: '8px 14px', borderRadius: 'var(--r-sm)',
            background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600,
          }}>등록</button>
        </div>
      </div>

      {/* 같은 색 다른 영상 */}
      {others.length > 0 && (
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>같은 색 다른 영상</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{others.length}개</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {others.map((o) => (
              <RouteCard key={o.id} route={{
                id: o.id, color: o.problem?.color, level: o.problem?.level,
                date: o.created_at, cleared: o.cleared, attempts: o.attempts, saved: o.saved,
              }} compact />
            ))}
          </div>
        </div>
      )}

      {/* 본인 영상이면 삭제 옵션 */}
      {route.user_id === 1 && (
        <div style={{ padding: '14px 16px' }}>
          <button onClick={removeSelf} style={{
            width: '100%', height: 42, borderRadius: 'var(--r-sm)',
            border: '1px solid var(--line-2)', background: 'transparent',
            color: 'var(--danger)', fontSize: 13, fontWeight: 600,
          }}>영상 삭제</button>
        </div>
      )}
    </>
  );
}
