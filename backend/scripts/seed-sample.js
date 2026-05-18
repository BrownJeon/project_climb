'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize } = require('../src/config/database');
const { ClimbLog, ClimbLogProblem, Problem, TrainingSession } = require('../src/models');

const USER_ID = 1;
const GYM_ID = 3; // 더클라임 홍대B

// 4주 전부터 오늘까지 날짜 배열 (방문일 선택용)
function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

// 방문 패턴: 4주 28일 중 20일 방문 (주 5일 페이스)
const VISIT_OFFSETS = [
  0, 1, 2,        // 이번 주
  4, 5, 6, 7,     // 지난 주
  9, 10, 11, 12, 13,
  15, 16, 17, 18, 19,
  21, 22, 23, 24, 25,
];

// 난이도별 문제 풀 (custom 사용)
const PROBLEMS_POOL = [
  { color: 'yellow', level: 'V1', style: 'slab' },
  { color: 'yellow', level: 'V2', style: 'vertical' },
  { color: 'green',  level: 'V2', style: 'vertical' },
  { color: 'green',  level: 'V3', style: 'slab' },
  { color: 'blue',   level: 'V3', style: 'overhang' },
  { color: 'blue',   level: 'V4', style: 'vertical' },
  { color: 'red',    level: 'V4', style: 'overhang' },
  { color: 'red',    level: 'V5', style: 'cave' },
  { color: 'purple', level: 'V5', style: 'overhang' },
  { color: 'black',  level: 'V6', style: 'cave' },
];

// 방문 인덱스에 따라 난이도 점진적 상승 시뮬레이션
function pickProblems(visitIdx) {
  const count = 4 + Math.floor(Math.random() * 4); // 4~7 문제
  const result = [];
  // 초반 방문은 낮은 난이도 위주, 후반은 높은 난이도 포함
  const maxDifficulty = Math.min(4 + Math.floor(visitIdx / 5), PROBLEMS_POOL.length - 1);
  const pool = PROBLEMS_POOL.slice(0, maxDifficulty + 1);
  for (let i = 0; i < count; i++) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    const isLate = visitIdx > 12;
    const cleared = p.level <= 'V3' || Math.random() > (isLate ? 0.3 : 0.5);
    result.push({
      custom_color: p.color,
      custom_level: p.level,
      style: p.style,
      is_cleared: cleared,
      cleared_count: cleared ? 1 + Math.floor(Math.random() * 3) : 0,
      failed_count: cleared ? Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 4),
      attempts: cleared ? 1 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 5),
    });
  }
  return result;
}

// 훈련 세션 생성 (볼더링 방문 중 일부에 endurance/conditioning 병행)
function makeTrainingSessions(date, visitIdx) {
  const sessions = [];
  // 볼더링은 항상
  sessions.push({
    user_id: USER_ID, session_date: date, category: 'bouldering', gym_id: GYM_ID,
    duration_minutes: 60 + Math.floor(Math.random() * 60),
    start_time: '19:00', end_time: null,
    memo: null,
  });
  // 격주로 지구력 훈련 추가
  if (visitIdx % 3 === 0) {
    sessions.push({
      user_id: USER_ID, session_date: date, category: 'endurance', gym_id: GYM_ID,
      duration_minutes: 20 + Math.floor(Math.random() * 20),
      start_time: null, end_time: null,
      memo: '지구력 트래버스 2세트',
    });
  }
  // 주 1회 컨디셔닝
  if (visitIdx % 5 === 0) {
    sessions.push({
      user_id: USER_ID, session_date: date, category: 'conditioning', gym_id: GYM_ID,
      duration_minutes: 15,
      start_time: null, end_time: null,
      memo: '행잉/풀업 보강운동',
    });
  }
  return sessions;
}

async function main() {
  await sequelize.authenticate();
  console.log('[seed] DB 연결 성공');

  // 기존 시드 데이터 중복 방지: visited_at이 겹치는 climb_log가 있으면 스킵
  const existingLogs = await ClimbLog.findAll({ where: { user_id: USER_ID, gym_id: GYM_ID }, attributes: ['visited_at'] });
  const existingDates = new Set(existingLogs.map((l) => String(l.visited_at)));
  console.log('[seed] 기존 방문 기록:', existingDates.size, '건');

  let logCount = 0, problemCount = 0, sessionCount = 0;

  for (let i = 0; i < VISIT_OFFSETS.length; i++) {
    const date = dateStr(VISIT_OFFSETS[i]);
    if (existingDates.has(date)) {
      console.log(`[seed] 스킵 (기존): ${date}`);
      continue;
    }

    // climb_log 생성
    const log = await ClimbLog.create({
      user_id: USER_ID, gym_id: GYM_ID,
      visited_at: date, used_day_pass: true,
      duration_minutes: 90 + Math.floor(Math.random() * 60),
      start_time: '19:00', end_time: null,
      memo: i === 0 ? '오늘 컨디션 좋았음. 파랑 V4 처음 완등!' : null,
    });
    logCount++;

    // climb_log_problems 생성
    const problems = pickProblems(i);
    for (const p of problems) {
      await ClimbLogProblem.create({ log_id: log.id, ...p });
      problemCount++;
    }

    // training_sessions 생성
    const sessions = makeTrainingSessions(date, i);
    for (const s of sessions) {
      // 중복 방지
      const exists = await TrainingSession.findOne({ where: { user_id: USER_ID, session_date: date, category: s.category } });
      if (!exists) {
        await TrainingSession.create(s);
        sessionCount++;
      }
    }

    console.log(`[seed] ${date}: log=${log.id}, problems=${problems.length}, sessions=${sessions.length}`);
  }

  console.log(`\n[seed] 완료 — climb_logs: ${logCount}, problems: ${problemCount}, training_sessions: ${sessionCount}`);
  await sequelize.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
