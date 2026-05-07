import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { I } from '../components/atoms/Icons';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatHeader(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}년 ${m}월 ${day}일 (${DAY_LABELS[d.getDay()]})`;
}

export default function CalendarDetailPage() {
  const { date } = useParams();
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

  return (
    <>
      <TopBar right={backBtn} />

      <div style={{ padding: '14px 16px 6px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: .4 }}>상세 기록</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, marginTop: 4 }}>
          {formatHeader(date)}
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PlaceholderSection title="🕒 시간라인">
          시간 범위(09:00 ~ 11:30) 기준의 운동 흐름이 들어갈 영역입니다.
        </PlaceholderSection>
        <PlaceholderSection title="🎯 시도/완등 요약">
          색상·V등급별 시도 횟수, 완등률, 평균 시도 횟수 통계가 표시될 영역입니다.
        </PlaceholderSection>
        <PlaceholderSection title="📹 영상 갤러리">
          이날 등록한 영상 또는 시도에 링크된 영상의 인라인 재생 갤러리가 들어갈 영역입니다.
        </PlaceholderSection>
        <PlaceholderSection title="💪 훈련 세션">
          볼더링/지구력/컨디셔닝 카테고리별 시간·항목 그래프가 표시될 영역입니다.
        </PlaceholderSection>
        <PlaceholderSection title="✨ AI 한 줄 요약">
          이날의 운동을 한 문단으로 요약 (분석 endpoint 연계 예정).
        </PlaceholderSection>
        <PlaceholderSection title="📝 메모">
          기록 메모와 시도별 메모를 확장 표시.
        </PlaceholderSection>
      </div>

      <div style={{
        margin: '4px 16px 16px', padding: '12px 14px', borderRadius: 'var(--r-md)',
        background: 'var(--surface-2)', border: '1px dashed var(--line-2)',
        fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55,
      }}>
        ℹ️ 이 화면은 placeholder입니다. 상세 설계는 <code>docs/web-design/06-calendar-detail.md</code>에서 진행 예정.
      </div>
    </>
  );
}

function PlaceholderSection({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)', padding: '14px 16px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
