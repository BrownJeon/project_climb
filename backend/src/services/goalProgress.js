/**
 * 운동 기록 변경 시 사용자의 활성 목표(in_progress + auto_sync)에 대해
 * current_value / progress_percent 를 자동 재계산.
 *
 * 카테고리별 매핑:
 *  - bouldering : metric_label(=색상 키, 예 "red"/"yellow")의 완등 개수 합산
 *                 (climb_log_problems.is_cleared && problem.color === metric_label)
 *  - conditioning: metric_label = "종목 (회|초)" → 종목+단위가 일치하는
 *                  training_session_items.reps_or_seconds 의 최대값
 *  - endurance  : metric_label = YDS 난이도(예 "5.10d") → 같은 난이도의
 *                  지구력 항목 등록 횟수
 *  - general    : 자유 입력이라 자동 매핑 불가 (사용자 수동 갱신)
 */
const {
  TrainingGoal, TrainingSession, TrainingSessionItem,
  ClimbLog, ClimbLogProblem, Problem, Gym,
} = require('../models');

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function computePct(target, current, label) {
  const t = Number(target), c = Number(current);
  if (!Number.isFinite(t) || t === 0 || !Number.isFinite(c)) return 0;
  const reversed = /이하|이내|미만|under|<=|≤/.test(label || '');
  const pct = reversed
    ? (c <= t ? 100 : (t / c) * 100)
    : (c / t) * 100;
  return clamp(Math.round(pct), 0, 100);
}

function parseConditioningLabel(label) {
  const m = (label || '').match(/^(.*?)\s*\((회|초)\)\s*$/);
  if (!m) return null;
  return { base: m[1].trim(), unit: m[2] };
}

async function computeBoulderingCurrent(userId, color, { targetGymId, targetBrand, targetLevel } = {}) {
  if (!color) return 0;
  const climbLogWhere = { user_id: userId };
  if (targetGymId) climbLogWhere.gym_id = Number(targetGymId);

  const climbLogInclude = {
    model: ClimbLog, required: true, attributes: [],
    where: climbLogWhere,
  };
  if (!targetGymId && targetBrand) {
    climbLogInclude.include = [{
      model: Gym, as: 'gym', required: true, attributes: [],
      where: { brand: targetBrand },
    }];
  }

  // 색상/V등급 매칭: problem.color 또는 cp.custom_color, 같은 식으로 level
  const { Op } = require('sequelize');
  const cps = await ClimbLogProblem.findAll({
    attributes: ['cleared_count', 'is_cleared', 'problem_id', 'custom_color', 'custom_level'],
    where: {
      [Op.and]: [
        // 색상 매칭: custom_color 우선, problem.color도 허용
        {
          [Op.or]: [
            { custom_color: color },
            { '$problem.color$': color },
          ],
        },
        ...(targetLevel ? [{
          [Op.or]: [
            { custom_level: targetLevel },
            { '$problem.level$': targetLevel },
          ],
        }] : []),
      ],
    },
    include: [
      climbLogInclude,
      { model: Problem, as: 'problem', attributes: [], required: false },
    ],
  });
  // cleared_count가 있으면 그 값, 없으면 is_cleared(1/0)
  return cps.reduce((acc, cp) => acc + (cp.cleared_count != null ? Number(cp.cleared_count) : (cp.is_cleared ? 1 : 0)), 0);
}

async function computeEnduranceCurrent(userId, level) {
  if (!level) return 0;
  const exerciseName = `지구력 등반 (${level})`;
  const count = await TrainingSessionItem.count({
    where: { exercise_name: exerciseName },
    include: [{
      model: TrainingSession, as: 'session', required: true,
      attributes: [], where: { user_id: userId, category: 'endurance' },
    }],
  });
  return count;
}

async function computeConditioningCurrent(userId, base, unit) {
  if (!base) return 0;
  const items = await TrainingSessionItem.findAll({
    attributes: ['reps_or_seconds'],
    where: { exercise_name: base, metric_unit: unit },
    include: [{
      model: TrainingSession, as: 'session', required: true,
      attributes: [], where: { user_id: userId },
    }],
  });
  let max = 0;
  items.forEach((it) => {
    const v = Number(it.reps_or_seconds);
    if (Number.isFinite(v) && v > max) max = v;
  });
  return max;
}

async function recomputeUserGoals(userId) {
  if (!userId) return;
  let goals;
  try {
    goals = await TrainingGoal.findAll({
      where: { user_id: userId, status: 'in_progress', auto_sync: true },
    });
  } catch {
    return; // auto_sync 컬럼이 아직 없는 부팅 직후 등
  }
  for (const g of goals) {
    let current = null;
    try {
      if (g.category === 'bouldering' && g.metric_label) {
        current = await computeBoulderingCurrent(userId, g.metric_label, {
          targetGymId: g.target_gym_id,
          targetBrand: g.target_brand,
          targetLevel: g.target_level,
        });
      } else if (g.category === 'conditioning' && g.metric_label) {
        const parsed = parseConditioningLabel(g.metric_label);
        if (parsed) current = await computeConditioningCurrent(userId, parsed.base, parsed.unit);
      } else if (g.category === 'endurance' && g.metric_label) {
        current = await computeEnduranceCurrent(userId, g.metric_label);
      }
    } catch (err) {
      console.warn('[goalProgress] compute fail goal=', g.id, err.message);
      continue;
    }
    if (current === null) continue;
    const target = Number(g.target_value);
    const pct = computePct(target, current, `${g.metric_label || ''} ${g.current_metric_label || ''}`);
    if (Number(g.current_value) !== current || g.progress_percent !== pct) {
      try {
        await g.update({ current_value: current, progress_percent: pct });
      } catch (err) {
        console.warn('[goalProgress] update fail goal=', g.id, err.message);
      }
    }
  }
}

module.exports = { recomputeUserGoals, computePct, parseConditioningLabel };
