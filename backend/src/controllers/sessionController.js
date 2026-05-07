/**
 * POST /api/sessions — 통합 운동 기록 추가 (영상·완등·훈련 일괄 처리)
 * 단일 트랜잭션으로 climb_logs / climb_log_problems / ar_routes / training_sessions / training_session_items / gym_passes(차감) 처리
 */
const path = require('path');
const {
  sequelize, ClimbLog, ClimbLogProblem, ArRoute, Problem, Gym, GymPass,
  TrainingSession, TrainingSessionItem,
} = require('../models');
const {
  validatePassXor, loadAndValidatePass, decrementCountPassIfNeeded,
  validateArRouteOwnership, validateAttemptsRow,
} = require('../services/sessionHelpers');
const { attachThumbnailAsync } = require('../services/thumbnail');
const { computeDurationMinutes, normalizeTime } = require('../utils/timeRange');

function formatRouteTitle({ color, level }) {
  const COLOR = {
    red: '빨강🔴', orange: '주황🟠', yellow: '노랑🟡', green: '초록🟢',
    blue: '파랑🔵', navy: '남색🟦', pink: '핑크🌸', purple: '보라🟣', black: '검정⚫',
    white: '하양⚪', gray: '회색⬛',
  };
  const c = COLOR[color] || (color ? `◯${color}` : '◯');
  const lv = level || 'V?';
  return `${c} (${lv})`;
}

async function createSession(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.id;
    const { visited_at, gym_id, memo, gym_pass_id, used_day_pass, duration_minutes } = req.body;
    const start_time = normalizeTime(req.body.start_time);
    const end_time = normalizeTime(req.body.end_time);
    const computedDuration = computeDurationMinutes(start_time, end_time);
    const finalDuration = computedDuration != null
      ? computedDuration
      : (duration_minutes !== undefined && duration_minutes !== '' ? Number(duration_minutes) : null);

    if (!visited_at || !gym_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'visited_at, gym_id 필수', data: null });
    }

    const attempts = req.body.attempts ? JSON.parse(req.body.attempts) : [];
    const training = req.body.training ? JSON.parse(req.body.training) : [];

    if (!Array.isArray(attempts) || !Array.isArray(training)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'attempts·training은 JSON 배열이어야 합니다.', data: null });
    }

    // 이용권 XOR (필수)
    let pass = null;
    try {
      validatePassXor(gym_pass_id, used_day_pass, { required: true });
      if (gym_pass_id) {
        pass = await loadAndValidatePass(gym_pass_id, gym_id, visited_at, userId, t);
      }
    } catch (e) {
      await t.rollback();
      return res.status(e.statusCode || 400).json({ success: false, message: e.message, data: null });
    }

    // attempts 행 검증
    try {
      attempts.forEach((row, i) => validateAttemptsRow(row, i));
    } catch (e) {
      await t.rollback();
      return res.status(e.statusCode || 400).json({ success: false, message: e.message, data: null });
    }

    const gym = await Gym.findByPk(gym_id, { transaction: t });
    if (!gym) {
      await t.rollback();
      return res.status(404).json({ success: false, message: '암장 없음', data: null });
    }

    // (1) climb_log
    const log = await ClimbLog.create({
      user_id: userId,
      gym_id, visited_at, memo: memo || null,
      gym_pass_id: gym_pass_id || null,
      used_day_pass: !!(used_day_pass === true || used_day_pass === 'true'),
      duration_minutes: finalDuration,
      start_time,
      end_time,
    }, { transaction: t });

    // (2) 횟수권 차감
    await decrementCountPassIfNeeded(pass, t);
    // (2-b) 정지 중 정기권으로 운동 등록 시 → 자동 정지 해제 + 만료일 연장
    if (pass && pass.pass_type === 'period' && pass.current_pause_started_at) {
      const { autoResumeIfPaused } = require('./gymPassController');
      await autoResumeIfPaused(pass.id, visited_at, t);
    }

    // (3) attempts 행 처리
    const filesByIndex = (req.files || []).reduce((acc, f) => {
      const m = f.fieldname.match(/^video_(\d+)$/);
      if (m) acc[Number(m[1])] = f;
      return acc;
    }, {});
    const arRouteIds = [];
    const pendingThumbnails = [];

    for (let i = 0; i < attempts.length; i++) {
      const row = attempts[i];
      let problemId = row.problem_id || null;
      let problemColor = null;
      let problemLevel = null;

      // 신규 문제 인라인 등록
      if (row.new_problem) {
        const np = await Problem.create({
          gym_id,
          color: row.new_problem.color,
          level: row.new_problem.level,
          section: row.new_problem.section || null,
        }, { transaction: t });
        problemId = np.id;
        problemColor = np.color;
        problemLevel = np.level;
      } else if (problemId) {
        const exists = await Problem.findByPk(problemId, { transaction: t });
        if (!exists) {
          await t.rollback();
          return res.status(400).json({ success: false, message: `attempts[${i}] problem_id 유효하지 않음`, data: null });
        }
        problemColor = exists.color;
        problemLevel = exists.level;
      }

      let arRouteId = null;

      if (row.video_mode === 'upload') {
        const file = filesByIndex[i];
        if (!file) {
          await t.rollback();
          return res.status(400).json({ success: false, message: `attempts[${i}] video_mode=upload인데 파일 누락 (video_${i})`, data: null });
        }
        const url = `${process.env.MEDIA_BASE_URL}/${file.filename}`;
        const ar = await ArRoute.create({
          user_id: userId,
          problem_id: problemId,
          title: formatRouteTitle({
            color: row.new_problem?.color || problemColor,
            level: row.new_problem?.level || problemLevel,
          }),
          description: row.description || null,
          video_url: url,
          tags: row.tags || null,
        }, { transaction: t });
        arRouteId = ar.id;
        arRouteIds.push(ar.id);
        pendingThumbnails.push({ arRouteId: ar.id, videoFilePath: file.path, videoFilename: file.filename });
      } else if (row.video_mode === 'link' && row.ar_route_id) {
        try {
          await validateArRouteOwnership(row.ar_route_id, userId, gym_id, t);
        } catch (e) {
          await t.rollback();
          return res.status(e.statusCode || 400).json({ success: false, message: e.message, data: null });
        }
        arRouteId = row.ar_route_id;
      }

      const clearedCount = row.cleared_count != null ? Number(row.cleared_count) : null;
      const failedCount = row.failed_count != null ? Number(row.failed_count) : null;
      // 호환: cleared_count/failed_count가 들어오면 그 값, 아니면 기존 is_cleared/attempts
      const cp = await ClimbLogProblem.create({
        log_id: log.id,
        problem_id: problemId,
        custom_level: row.new_problem?.level || row.custom_level || null,
        custom_color: row.new_problem?.color || row.custom_color || null,
        is_cleared: clearedCount != null ? clearedCount > 0 : !!row.is_cleared,
        attempts: row.attempts ? Number(row.attempts) : 1,
        cleared_count: clearedCount,
        failed_count: failedCount,
        ar_route_id: arRouteId,
      }, { transaction: t });

      // 다중 영상 link
      const videoIds = Array.isArray(row.ar_route_ids) ? row.ar_route_ids : [];
      const allLinkIds = arRouteId ? [...new Set([arRouteId, ...videoIds])] : videoIds;
      if (allLinkIds.length) {
        const { ClimbLogProblemVideo } = require('../models');
        // ownership 검증
        for (const vid of allLinkIds) {
          try { await validateArRouteOwnership(vid, userId, gym_id, t); }
          catch (e) {
            await t.rollback();
            return res.status(e.statusCode || 400).json({ success: false, message: e.message, data: null });
          }
        }
        await ClimbLogProblemVideo.bulkCreate(
          allLinkIds.map((vid, idx) => ({
            climb_log_problem_id: cp.id,
            ar_route_id: vid,
            sort_order: idx,
          })),
          { transaction: t, ignoreDuplicates: true }
        );
      }
    }

    // (4) 훈련 항목
    const trainingSessionIds = [];
    for (const tr of training) {
      const trStartTime = normalizeTime(tr.start_time);
      const trEndTime = normalizeTime(tr.end_time);
      const trDur = computeDurationMinutes(trStartTime, trEndTime);
      const ts = await TrainingSession.create({
        user_id: userId,
        session_date: visited_at,
        category: tr.category,
        gym_id,
        duration_minutes: trDur != null ? trDur : (tr.duration_minutes ?? null),
        start_time: trStartTime,
        end_time: trEndTime,
        memo: tr.memo ?? null,
      }, { transaction: t });
      trainingSessionIds.push(ts.id);
      if (Array.isArray(tr.items) && tr.items.length) {
        await TrainingSessionItem.bulkCreate(
          tr.items.map((it, idx) => ({
            session_id: ts.id,
            exercise_name: it.exercise_name,
            sets: it.sets ?? null,
            reps_or_seconds: it.reps_or_seconds ?? null,
            metric_unit: it.metric_unit ?? null,
            weight_kg: it.weight_kg ?? null,
            notes: it.notes ?? null,
            sort_order: idx,
          })),
          { transaction: t }
        );
      }
    }

    await t.commit();

    // commit 이후 비차단 썸네일 추출
    for (const p of pendingThumbnails) {
      attachThumbnailAsync({ ArRoute, ...p });
    }

    let remaining = null;
    if (pass) {
      const updated = await GymPass.findByPk(pass.id);
      remaining = updated?.pass_type === 'count' ? updated.remaining_count : null;
    }

    require('../services/goalProgress').recomputeUserGoals(userId).catch(() => {});

    return res.status(201).json({
      success: true,
      message: '운동 기록이 저장되었습니다.',
      data: {
        climb_log_id: log.id,
        ar_route_ids: arRouteIds,
        training_session_ids: trainingSessionIds,
        remaining_pass_count: remaining,
      },
    });
  } catch (err) {
    await t.rollback().catch(() => {});
    next(err);
  }
}

module.exports = { createSession };
