import { useEffect, useState } from 'react';
import { Btn, ColorBadge } from '../atoms';
import { I } from '../atoms/Icons';
import { routesApi } from '../../api/routes';
import useBackHandler from '../../native/useBackHandler';

/**
 * 본인 영상 라이브러리에서 시도(attempt)에 연결할 영상 선택.
 * color/level이 주어지면 자동으로 매칭 우선순위.
 * 사용 흐름: SessionAddModal attempts row에서 "영상 검색·연결" 버튼 → 이 모달
 */
export default function VideoLinkPicker({ defaultColor, defaultLevel, onPick, onClose }) {
  useBackHandler(true, onClose);
  const [color, setColor] = useState(defaultColor || '');
  const [level, setLevel] = useState(defaultLevel || '');
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = { mine: 'true', limit: 50 };
      if (color) params.color = color;
      if (level) params.level = level;
      const r = await routesApi.list(params);
      setRoutes(r.data?.routes || []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [color, level]);

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div style={headerStyle}>
          <span style={{ width: 50 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>영상 검색·연결</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>닫기</button>
        </div>

        <div style={{ padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {color && (
            <span style={chipStyle}>색상 매칭 적용
              <button onClick={() => setColor('')} style={{ marginLeft: 4, color: 'var(--ink-4)' }}>×</button>
            </span>
          )}
          {level && (
            <span style={chipStyle}>{level} 매칭
              <button onClick={() => setLevel('')} style={{ marginLeft: 4, color: 'var(--ink-4)' }}>×</button>
            </span>
          )}
          {!color && !level && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>전체 본인 영상</span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>불러오는 중...</div>
        ) : routes.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.55 }}>
            매칭되는 영상이 없습니다.<br/>
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>마이페이지 → 내 영상에서 등록 후 다시 시도하세요.</span>
          </div>
        ) : (
          <div style={{ padding: '4px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {routes.map((r) => {
              const c = r.color || r.problem?.color;
              const lv = r.level || r.problem?.level;
              return (
                <button key={r.id} type="button" onClick={() => onPick(r)}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)', overflow: 'hidden', cursor: 'pointer',
                    padding: 0, textAlign: 'left',
                  }}>
                  <div style={{
                    aspectRatio: '9/13',
                    background: r.thumbnail_url
                      ? `#000 center/cover no-repeat url("${r.thumbnail_url}")`
                      : 'var(--surface-2)',
                  }} />
                  <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ColorBadge color={c} level={lv} size="sm" />
                    <span style={{ fontSize: 10, color: 'var(--ink-4)', marginLeft: 'auto' }}>
                      {(r.created_at || '').slice(5, 10)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 350,
};
const sheetStyle = {
  background: 'var(--bg)', width: '100%', maxWidth: 'var(--max-w)', maxHeight: '85%',
  borderRadius: '24px 24px 0 0', overflow: 'auto',
  display: 'flex', flexDirection: 'column',
  animation: 'sheetUp 280ms cubic-bezier(.32,.72,0,1)',
};
const headerStyle = {
  padding: '12px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'var(--surface)', borderBottom: '1px solid var(--line)',
  position: 'sticky', top: 0, zIndex: 2,
};
const chipStyle = {
  display: 'inline-flex', alignItems: 'center',
  fontSize: 11, padding: '4px 9px', borderRadius: 'var(--r-pill)',
  background: 'var(--primary-soft)', color: 'var(--ink-1)',
  border: '1px solid var(--primary-line)', fontWeight: 600,
};
