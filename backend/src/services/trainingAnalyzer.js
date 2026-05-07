/**
 * 훈련 분석 2단계 오케스트레이션
 *  1단계: DB 메타 템플릿 + 사용자 데이터 → CLI 호출 → 분석 프롬프트 생성
 *  2단계: 1단계 응답을 그대로 CLI에 다시 전달 → 최종 분석 마크다운
 */
const { Op } = require('sequelize');
const {
  TrainingPromptTemplate, TrainingGoal, TrainingSession, TrainingSessionItem,
  ClimbLog, ClimbLogProblem, Problem, Gym, User,
} = require('../models');
const { runClaude } = require('./claudeCli');
const { fillMetaPrompt } = require('./trainingPromptBuilder');

const STAGE1_TIMEOUT = 60 * 1000;
const STAGE2_TIMEOUT = 180 * 1000;
const MIN_DATA_POINTS = 3;

async function loadUserContext(userId) {
  return User.findByPk(userId, {
    attributes: { exclude: ['sns_id'] },
    include: [
      { model: Gym, as: 'main_gyms', attributes: ['id', 'name'], through: { attributes: [] } },
    ],
  });
}

async function collectAnalyzeData(userId, range) {
  const goals = await TrainingGoal.findAll({
    where: { user_id: userId, status: 'in_progress' },
    order: [['created_at', 'DESC']],
  });

  const trainingSessions = await TrainingSession.findAll({
    where: {
      user_id: userId,
      session_date: { [Op.between]: [range.from, range.to] },
    },
    include: [{ model: TrainingSessionItem, as: 'items' }, { model: Gym, as: 'gym', attributes: ['id', 'name'] }],
    order: [['session_date', 'ASC']],
  });

  const climbLogsRaw = await ClimbLog.findAll({
    where: {
      user_id: userId,
      visited_at: { [Op.between]: [range.from, range.to] },
    },
    include: [
      { model: Gym, as: 'gym', attributes: ['id', 'name'] },
      {
        model: ClimbLogProblem,
        as: 'problems',
        include: [{ model: Problem, as: 'problem', attributes: ['level', 'color'], required: false }],
      },
    ],
    order: [['visited_at', 'ASC']],
  });

  const climbLogs = climbLogsRaw.map((l) => ({
    visited_at: l.visited_at,
    gym_name: l.gym?.name,
    memo: l.memo,
    problems: (l.problems || []).map((p) => ({
      color: p.problem?.color || p.custom_color,
      level: p.problem?.level || p.custom_level,
      is_cleared: p.is_cleared,
      attempts: p.attempts,
    })),
  }));

  return { goals, trainingSessions, climbLogs };
}

/**
 * @param {object} opts
 * @param {object} opts.user req.user (id 포함)
 * @param {{from, to}} opts.range
 * @param {string[]} opts.perspectives
 * @param {string} [opts.extraPrompt]
 * @param {string} [opts.templateKey]
 * @param {boolean} [opts.stream]
 */
async function analyze({ user, range, perspectives, extraPrompt, templateKey, stream }) {
  // 1) 메타 템플릿 로드
  const where = templateKey ? { key: templateKey } : { is_active: true };
  const tpl = await TrainingPromptTemplate.findOne({ where });
  if (!tpl) {
    const e = new Error('NO_ACTIVE_TEMPLATE'); e.statusCode = 503; throw e;
  }

  // 2) 사용자 데이터
  const userCtx = await loadUserContext(user.id);
  const data = await collectAnalyzeData(user.id, range);

  const dataPoints = (data.trainingSessions?.length || 0) + (data.climbLogs?.length || 0);
  if (dataPoints < MIN_DATA_POINTS) {
    const e = new Error('INSUFFICIENT_DATA');
    e.statusCode = 400;
    e.detail = `분석할 데이터가 부족합니다. 최소 ${MIN_DATA_POINTS}개 이상의 세션/기록이 필요합니다. (현재: ${dataPoints})`;
    throw e;
  }

  // 3) 1단계 메타 프롬프트
  const metaPrompt = fillMetaPrompt({
    template: tpl.meta_prompt_text,
    user: userCtx, range, perspectives, extraPrompt, data,
  });

  // 4) 1단계 CLI (분석 프롬프트 생성)
  const t1 = Date.now();
  const generatedPrompt = await runClaude({
    prompt: metaPrompt, stream: false, timeoutMs: STAGE1_TIMEOUT,
  });
  const stage1Ms = Date.now() - t1;

  // 5) 2단계 CLI (실제 분석)
  // 참고: claude CLI 2.0.64의 stream-json 모드 버그(effortLevel null)로 인해
  // 스트리밍이 비어 오는 경우가 있어, stream 요청도 비스트리밍으로 호출 후
  // 결과를 단일 chunk로 yield하는 pseudo-stream으로 처리한다.
  const t2 = Date.now();
  const result = await runClaude({
    prompt: generatedPrompt, stream: false, timeoutMs: STAGE2_TIMEOUT,
  });
  const stage2Ms = Date.now() - t2;
  if (stream) {
    const iter = (async function* () {
      if (result) yield result;
    })();
    return {
      template: tpl, metaPrompt, generatedPrompt,
      stage1Ms, stage2StartedAt: t2,
      stream: iter,
      result,
    };
  }
  return {
    template: tpl, metaPrompt, generatedPrompt,
    stage1Ms, stage2Ms,
    result,
  };
}

module.exports = { analyze, MIN_DATA_POINTS };
