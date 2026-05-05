/**
 * 메타 프롬프트 빌더 — DB 템플릿 placeholder를 사용자 데이터로 치환
 */

const PERSPECTIVE_LABELS = {
  strength_weakness: '강점·약점',
  trend: '진행 추세',
  next_week_plan: '다음 1주 추천',
  injury_risk: '부상 리스크',
};

function toKoLabel(key) {
  return PERSPECTIVE_LABELS[key] || key;
}

function fmtDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

function serializeProfile(user) {
  const lines = [];
  lines.push(`- 닉네임: ${user.nickname || '-'}`);
  if (user.climbing_started_at) lines.push(`- 클라이밍 시작일: ${fmtDate(user.climbing_started_at)}`);
  if (user.max_level_color || user.max_level_grade) {
    lines.push(`- 최고 레벨: 색상=${user.max_level_color || '-'}, V등급=${user.max_level_grade || '-'}`);
  }
  if (user.main_gyms?.length) {
    lines.push(`- 주 암장: ${user.main_gyms.map((g) => g.name).join(', ')}`);
  }
  if (user.bio) lines.push(`- 자기소개: ${user.bio}`);
  return lines.join('\n') || '- 데이터 없음';
}

function serializeGoals(goals) {
  if (!goals || !goals.length) return '- (진행 중인 목표 없음)';
  return goals.map((g) => {
    const parts = [`- [${g.title}] (${g.category})`];
    if (g.metric_label) parts.push(`목표 ${g.metric_label}: ${g.current_value || '?'} → ${g.target_value || '?'}`);
    if (g.target_date) parts.push(`마감 ${fmtDate(g.target_date)}`);
    parts.push(`진행률 ${g.progress_percent || 0}%`);
    return parts.join(' · ');
  }).join('\n');
}

function serializeTrainingSessions(sessions) {
  if (!sessions || !sessions.length) return '- (훈련 세션 없음)';
  return sessions.map((s) => {
    const items = (s.items || s.training_session_items || []).map((it) =>
      `${it.exercise_name}` +
      (it.sets ? ` ${it.sets}세트` : '') +
      (it.reps_or_seconds ? ` × ${it.reps_or_seconds}${it.metric_unit || ''}` : '') +
      (it.weight_kg ? ` (+${it.weight_kg}kg)` : '')
    ).join(', ');
    return `- ${fmtDate(s.session_date)} [${s.category}] ${s.duration_minutes ? `${s.duration_minutes}분` : ''} :: ${items || '항목 없음'}`;
  }).join('\n');
}

function serializeClimbLogs(logs) {
  if (!logs || !logs.length) return '- (클라이밍 기록 없음)';
  return logs.map((l) => {
    const probs = (l.problems || []).map((p) => {
      const c = p.color || p.problem?.color || '?';
      const v = p.level || p.problem?.level || '?';
      return `${c}/${v}${p.is_cleared ? '✓' : '×'}${p.attempts ? `(${p.attempts}회)` : ''}`;
    }).join(', ');
    return `- ${fmtDate(l.visited_at)} [${l.gym_name || l.gym?.name || '?'}] :: ${probs || '문제 기록 없음'}` +
      (l.memo ? ` :: 메모: ${l.memo}` : '');
  }).join('\n');
}

function fillMetaPrompt({ template, user, range, perspectives, extraPrompt, data }) {
  const map = {
    '{{from}}': fmtDate(range.from),
    '{{to}}': fmtDate(range.to),
    '{{profile}}': serializeProfile(user),
    '{{goals}}': serializeGoals(data.goals),
    '{{sessions}}': serializeTrainingSessions(data.trainingSessions),
    '{{climb_logs}}': serializeClimbLogs(data.climbLogs),
    '{{perspectives}}': (perspectives || []).map(toKoLabel).join(', ') || '(미지정)',
    '{{extra_prompt}}': extraPrompt
      ? '```user_input\n' + extraPrompt + '\n```'
      : '(추가 요청 없음)',
  };
  return Object.entries(map).reduce((acc, [k, v]) => acc.split(k).join(v), template);
}

module.exports = {
  fillMetaPrompt,
  serializeProfile, serializeGoals, serializeTrainingSessions, serializeClimbLogs,
  PERSPECTIVE_LABELS,
};
