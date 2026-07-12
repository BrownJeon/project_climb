const { Op } = require('sequelize');
const { ClimbLog, ClimbLogProblem, Problem, Gym, GymPass, ArRoute, TrainingSession, TrainingSessionItem, ClimbLogProblemPhoto, ClimbLogProblemPersonalVideo, sequelize, GymSector } = require('../models');
const { attachThumbnailAsync, attachThumbnailToClimbProblem } = require('../services/thumbnail');
const { processPersonalVideoBackground } = require('../services/videoProcessor');
const { recomputeUserGoals } = require('../services/goalProgress');
const { computeDurationMinutes, normalizeTime } = require('../utils/timeRange');

const COLOR_KR = {
  red: '빨강🔴', orange: '주황🟠', yellow: '노랑🟡', green: '초록🟢',
  blue: '파랑🔵', navy: '남색🟦', pink: '핑크🌸', purple: '보라🟣',
  black: '검정⚫', white: '하양⚪', gray: '회색⬛',
};
function fmtRouteTitle({ color, level }) {
  const c = COLOR_KR[color] || (color ? `◯${color}` : '◯');
  return `${c} (${level || 'V?'})`;
}

/**
 * GET /api/climb-logs?year=2025&month=4
 * 해당 월에 방문한 날짜 목록 (캘린더 dot 마커용)
 */
async function getLogDates(req, res, next) {
  try {
    const userId = req.user.id;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10); // 월 마지막 날

    const logs = await ClimbLog.findAll({
      where: {
        user_id: userId,
        visited_at: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['visited_at'],
      raw: true,
    });

    const dates = [...new Set(logs.map((l) => l.visited_at))];

    return res.json({ success: true, data: { dates }, message: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/climb-logs?date=2025-04-10
 * 특정 날짜의 기록 상세
 */
async function getLogsByDate(req, res, next) {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, data: null, message: 'date 파라미터가 필요합니다.' });
    }

    const logs = await ClimbLog.findAll({
      where: { user_id: userId, visited_at: date },
      include: [
        { model: Gym, as: 'gym', attributes: ['id', 'name', 'address'] },
        {
          model: GymPass, as: 'gym_pass',
          attributes: ['id', 'pass_type', 'label', 'remaining_count', 'total_count', 'start_date', 'end_date'],
          required: false,
        },
        {
          model: ClimbLogProblem,
          as: 'problems',
          include: [
            { model: Problem, as: 'problem', attributes: ['id', 'level', 'color', 'section'], required: false },
            { model: ArRoute, as: 'ar_route', attributes: ['id', 'title', 'video_url', 'thumbnail_url'], required: false },
            {
              model: require('../models').ClimbLogProblemVideo, as: 'video_links',
              required: false,
              include: [{ model: ArRoute, as: 'ar_route', attributes: ['id', 'title', 'video_url', 'thumbnail_url', 'color', 'level'], required: false }],
            },
            { model: ClimbLogProblemPhoto, as: 'photos', required: false },
            { model: ClimbLogProblemPersonalVideo, as: 'personal_videos', required: false },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // 같은 날짜의 모든 훈련 세션 (수정 모달용 — 암장별 그룹핑)
    const allTraining = await TrainingSession.findAll({
      where: { user_id: userId, session_date: date },
      include: [{ model: TrainingSessionItem, as: 'items' }],
      order: [['id', 'ASC']],
    });
    const trainingByGym = new Map();
    allTraining.forEach((s) => {
      const k = String(s.gym_id || '');
      if (!trainingByGym.has(k)) trainingByGym.set(k, []);
      trainingByGym.get(k).push(s);
    });

    const formatted = logs.map((log) => ({
      id: log.id,
      gym_id: log.gym_id,
      gym_name: log.gym?.name || '알 수 없는 암장',
      gym_address: log.gym?.address || '',
      visited_at: log.visited_at,
      memo: log.memo,
      duration_minutes: log.duration_minutes,
      start_time: normalizeTime(log.start_time),
      end_time: normalizeTime(log.end_time),
      training_sessions: (trainingByGym.get(String(log.gym_id)) || []).map((s) => ({
        id: s.id, category: s.category,
        duration_minutes: s.duration_minutes,
        start_time: normalizeTime(s.start_time), end_time: normalizeTime(s.end_time),
        memo: s.memo,
        items: (s.items || []).map((it) => ({
          id: it.id, exercise_name: it.exercise_name,
          sets: it.sets, reps_or_seconds: it.reps_or_seconds,
          metric_unit: it.metric_unit, weight_kg: it.weight_kg, notes: it.notes,
        })),
      })),
      gym_pass_id: log.gym_pass_id,
      gym_pass: log.gym_pass ? log.gym_pass.toJSON() : null,
      used_day_pass: !!log.used_day_pass,
      problems: (log.problems || []).map((p) => ({
        id: p.id,
        problem_id: p.problem_id,
        level: p.problem?.level || p.custom_level || '',
        color: p.problem?.color || p.custom_color || '',
        is_cleared: p.is_cleared,
        attempts: p.attempts,
        cleared_count: p.cleared_count,
        failed_count: p.failed_count,
        style: p.style,
        ar_route_id: p.ar_route_id,
        ar_route: p.ar_route ? p.ar_route.toJSON() : null,
        videos: (p.video_links || []).map((v) => ({
          id: v.id,
          ar_route_id: v.ar_route_id,
          sort_order: v.sort_order,
          ar_route: v.ar_route ? v.ar_route.toJSON() : null,
        })),
        video_url: p.video_url || p.ar_route?.video_url || null,
        thumbnail_url: p.thumbnail_url || p.ar_route?.thumbnail_url || null,
        personal_videos: (p.personal_videos || []).map((v) => ({
          id: v.id, video_url: v.video_url,
          thumbnail_url: v.thumbnail_url, video_status: v.video_status,
          sort_order: v.sort_order,
        })),
        photos: (p.photos || []).map((ph) => ({
          id: ph.id, photo_url: ph.photo_url,
          hold_annotations: ph.hold_annotations,
          failure_tags: ph.failure_tags,
          failure_memo: ph.failure_memo,
        })),
      })),
    }));

    return res.json({ success: true, data: { logs: formatted }, message: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/climb-logs/:id
 * 단일 기록 상세 (problems + ar_route 포함)
 */
async function getLogById(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const log = await ClimbLog.findByPk(id, {
      include: [
        { model: Gym, as: 'gym', attributes: ['id', 'name', 'address'] },
        {
          model: GymPass, as: 'gym_pass',
          attributes: ['id', 'pass_type', 'label', 'remaining_count', 'total_count', 'start_date', 'end_date'],
          required: false,
        },
        {
          model: ClimbLogProblem, as: 'problems',
          include: [
            {
              model: Problem, as: 'problem',
              attributes: ['id', 'level', 'color', 'section', 'sector_id'],
              include: [{ model: GymSector, as: 'sector', attributes: ['id', 'name'], required: false }],
              required: false,
            },
            { model: ArRoute, as: 'ar_route', attributes: ['id', 'title', 'video_url', 'thumbnail_url'], required: false },
            {
              model: require('../models').ClimbLogProblemVideo, as: 'video_links',
              required: false,
              include: [{ model: ArRoute, as: 'ar_route', attributes: ['id', 'title', 'video_url', 'thumbnail_url', 'color', 'level'], required: false }],
            },
            { model: ClimbLogProblemPhoto, as: 'photos', required: false },
            { model: ClimbLogProblemPersonalVideo, as: 'personal_videos', required: false },
          ],
        },
      ],
    });
    if (!log) return res.status(404).json({ success: false, data: null, message: '기록을 찾을 수 없습니다.' });
    if (Number(log.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    // 같은 날짜·암장의 훈련 세션 (볼더링 외 카테고리 편집 지원)
    const trainingSessions = await TrainingSession.findAll({
      where: { user_id: userId, session_date: log.visited_at, gym_id: log.gym_id },
      include: [{ model: TrainingSessionItem, as: 'items' }],
      order: [['id', 'ASC']],
    });
    const formatted = {
      id: log.id,
      gym_id: log.gym_id,
      gym_name: log.gym?.name || '',
      gym_address: log.gym?.address || '',
      visited_at: log.visited_at,
      memo: log.memo,
      duration_minutes: log.duration_minutes,
      start_time: normalizeTime(log.start_time),
      end_time: normalizeTime(log.end_time),
      training_sessions: trainingSessions.map((s) => ({
        id: s.id, category: s.category,
        duration_minutes: s.duration_minutes,
        start_time: normalizeTime(s.start_time), end_time: normalizeTime(s.end_time),
        memo: s.memo,
        items: (s.items || []).map((it) => ({
          id: it.id, exercise_name: it.exercise_name,
          sets: it.sets, reps_or_seconds: it.reps_or_seconds,
          metric_unit: it.metric_unit, weight_kg: it.weight_kg, notes: it.notes,
        })),
      })),
      gym_pass_id: log.gym_pass_id,
      gym_pass: log.gym_pass ? log.gym_pass.toJSON() : null,
      used_day_pass: !!log.used_day_pass,
      problems: (log.problems || []).map((p) => ({
        id: p.id,
        problem_id: p.problem_id,
        level: p.problem?.level || p.custom_level || '',
        color: p.problem?.color || p.custom_color || '',
        is_cleared: p.is_cleared,
        attempts: p.attempts,
        cleared_count: p.cleared_count,
        failed_count: p.failed_count,
        style: p.style,
        sector_id: p.problem?.sector_id || null,
        sector_name: p.problem?.sector?.name || null,
        ar_route_id: p.ar_route_id,
        ar_route: p.ar_route ? p.ar_route.toJSON() : null,
        videos: (p.video_links || []).map((v) => ({
          id: v.id,
          ar_route_id: v.ar_route_id,
          sort_order: v.sort_order,
          ar_route: v.ar_route ? v.ar_route.toJSON() : null,
        })),
        video_url: p.video_url || p.ar_route?.video_url || null,
        thumbnail_url: p.thumbnail_url || p.ar_route?.thumbnail_url || null,
        personal_videos: (p.personal_videos || []).map((v) => ({
          id: v.id, video_url: v.video_url,
          thumbnail_url: v.thumbnail_url, video_status: v.video_status,
          sort_order: v.sort_order,
        })),
        photos: (p.photos || []).map((ph) => ({
          id: ph.id, photo_url: ph.photo_url,
          hold_annotations: ph.hold_annotations,
          failure_tags: ph.failure_tags,
          failure_memo: ph.failure_memo,
        })),
      })),
    };
    return res.json({ success: true, data: formatted, message: null });
  } catch (err) { next(err); }
}

/**
 * POST /api/climb-logs
 * 기록 추가
 */
async function createLog(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.id;
    const {
      gym_id, visited_at, memo,
      gym_pass_id, used_day_pass,
      problems = [],
    } = req.body;

    if (!gym_id || !visited_at) {
      await t.rollback();
      return res.status(400).json({ success: false, data: null, message: 'gym_id와 visited_at이 필요합니다.' });
    }

    // 이용권 XOR 검증
    if (gym_pass_id && used_day_pass) {
      await t.rollback();
      return res.status(400).json({ success: false, data: null, message: '이용권 종류는 한 가지만 선택' });
    }
    // 이용권 필수 여부는 호출 측 정책에 맡김(09 통합 모달은 필수, 호환 단일 호출은 선택)

    const gym = await Gym.findByPk(gym_id, { transaction: t });
    if (!gym) {
      await t.rollback();
      return res.status(404).json({ success: false, data: null, message: '암장을 찾을 수 없습니다.' });
    }

    // 이용권 검증
    let pass = null;
    if (gym_pass_id) {
      pass = await GymPass.findByPk(gym_pass_id, { transaction: t });
      if (!pass) { await t.rollback(); return res.status(404).json({ success: false, data: null, message: '이용권 없음' }); }
      if (Number(pass.user_id) !== Number(userId)) { await t.rollback(); return res.status(403).json({ success: false, data: null, message: '이용권 권한 없음' }); }
      const passBrand = pass.brand;
      const gymBrand = gym.brand || gym.name;
      if (passBrand && gymBrand) {
        if (String(passBrand) !== String(gymBrand)) {
          await t.rollback();
          return res.status(400).json({ success: false, data: null, message: '다른 브랜드의 이용권은 사용할 수 없습니다.' });
        }
      } else if (Number(pass.gym_id) !== Number(gym_id)) {
        await t.rollback();
        return res.status(400).json({ success: false, data: null, message: '다른 암장의 이용권은 사용할 수 없습니다.' });
      }
      if (pass.pass_type === 'count') {
        if (pass.remaining_count <= 0) { await t.rollback(); return res.status(400).json({ success: false, data: null, message: '이용권 잔여 횟수가 없습니다.' }); }
        if (pass.end_date) {
          const today = new Date(); today.setHours(0,0,0,0);
          const ed = new Date(pass.end_date); ed.setHours(0,0,0,0);
          if (ed < today) { await t.rollback(); return res.status(400).json({ success: false, data: null, message: '이용권이 만료되었습니다.' }); }
        }
      } else if (pass.pass_type === 'period') {
        const v = new Date(visited_at);
        if (new Date(pass.start_date) > v || new Date(pass.end_date) < v) {
          await t.rollback();
          return res.status(400).json({ success: false, data: null, message: '정기권 유효 기간 외입니다.' });
        }
      }
    }

    const log = await ClimbLog.create({
      user_id: userId, gym_id, visited_at, memo,
      gym_pass_id: gym_pass_id || null,
      used_day_pass: !!used_day_pass,
    }, { transaction: t });

    // 횟수권 차감
    if (pass && pass.pass_type === 'count') {
      pass.remaining_count = pass.remaining_count - 1;
      await pass.save({ transaction: t });
    }

    if (problems.length > 0) {
      // 검증
      for (const p of problems) {
        if (p.attempts !== undefined && (p.attempts < 1 || !Number.isInteger(Number(p.attempts)))) {
          await t.rollback();
          return res.status(400).json({ success: false, data: null, message: 'attempts는 1 이상의 정수여야 합니다.' });
        }
        if (p.ar_route_id) {
          const ar = await ArRoute.findByPk(p.ar_route_id, { transaction: t });
          if (!ar || Number(ar.user_id) !== Number(userId)) {
            await t.rollback();
            return res.status(400).json({ success: false, data: null, message: '연결할 수 없는 영상입니다.' });
          }
        }
      }
      const problemRows = problems.map((p) => ({
        log_id: log.id,
        problem_id: p.problem_id || null,
        custom_level: p.custom_level || null,
        custom_color: p.custom_color || null,
        is_cleared: p.is_cleared !== undefined ? p.is_cleared : true,
        attempts: p.attempts ? Number(p.attempts) : 1,
        ar_route_id: p.ar_route_id || null,
      }));
      await ClimbLogProblem.bulkCreate(problemRows, { transaction: t });
    }

    await t.commit();

    return res.status(201).json({
      success: true,
      data: {
        id: log.id,
        gym_id: log.gym_id,
        gym_name: gym.name,
        visited_at: log.visited_at,
        memo: log.memo,
        gym_pass_id: log.gym_pass_id,
        used_day_pass: log.used_day_pass,
        remaining_pass_count: pass?.pass_type === 'count' ? pass.remaining_count : null,
        problems,
      },
      message: '기록이 저장되었습니다.',
    });
  } catch (err) {
    await t.rollback().catch(() => {});
    next(err);
  }
}

/**
 * PATCH /api/climb-logs/:id
 * 기록 수정 (memo, visited_at만 허용 — 이용권 차감/복구는 복잡하므로 별도)
 */
async function updateLog(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { memo, visited_at } = req.body;

    const log = await ClimbLog.findByPk(id);
    if (!log) return res.status(404).json({ success: false, data: null, message: '기록을 찾을 수 없습니다.' });
    if (Number(log.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '수정 권한이 없습니다.' });
    }

    const updates = {};
    if (memo !== undefined) updates.memo = memo;
    if (visited_at !== undefined) updates.visited_at = visited_at;
    if (req.body.start_time !== undefined) updates.start_time = normalizeTime(req.body.start_time);
    if (req.body.end_time !== undefined) updates.end_time = normalizeTime(req.body.end_time);
    const newStart = updates.start_time !== undefined ? updates.start_time : log.start_time;
    const newEnd = updates.end_time !== undefined ? updates.end_time : log.end_time;
    const computedDur = computeDurationMinutes(newStart, newEnd);
    if (computedDur != null) {
      updates.duration_minutes = computedDur;
    } else if (req.body.duration_minutes !== undefined) {
      updates.duration_minutes = req.body.duration_minutes === null || req.body.duration_minutes === ''
        ? null : Number(req.body.duration_minutes);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, data: null, message: '수정할 항목이 없습니다.' });
    }

    await log.update(updates);
    recomputeUserGoals(userId).catch(() => {});
    return res.json({
      success: true,
      data: {
        id: log.id, memo: log.memo, visited_at: log.visited_at,
        duration_minutes: log.duration_minutes,
        start_time: normalizeTime(log.start_time), end_time: normalizeTime(log.end_time),
      },
      message: '기록이 수정되었습니다.',
    });
  } catch (err) { next(err); }
}

/**
 * PATCH /api/climb-logs/:logId/problems/:cpId
 * 기록 내 개별 문제(시도) 수정 — is_cleared, attempts
 */
async function updateLogProblem(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId, cpId } = req.params;
    const cp = await ClimbLogProblem.findByPk(cpId);
    if (!cp || Number(cp.log_id) !== Number(logId)) {
      return res.status(404).json({ success: false, data: null, message: '항목을 찾을 수 없습니다.' });
    }
    const parent = await ClimbLog.findByPk(cp.log_id, { attributes: ['user_id', 'gym_id'] });
    if (!parent || Number(parent.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    const updates = {};
    if (req.body.is_cleared !== undefined) updates.is_cleared = !!req.body.is_cleared;
    if (req.body.attempts !== undefined) {
      const n = Number(req.body.attempts);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ success: false, data: null, message: 'attempts는 1 이상의 정수' });
      }
      updates.attempts = n;
    }
    if (req.body.cleared_count !== undefined) {
      const n = Number(req.body.cleared_count);
      if (!Number.isInteger(n) || n < 0) return res.status(400).json({ success: false, data: null, message: 'cleared_count는 0 이상 정수' });
      updates.cleared_count = n;
      updates.is_cleared = n > 0;
    }
    if (req.body.failed_count !== undefined) {
      const n = Number(req.body.failed_count);
      if (!Number.isInteger(n) || n < 0) return res.status(400).json({ success: false, data: null, message: 'failed_count는 0 이상 정수' });
      updates.failed_count = n;
    }
    if (req.body.style !== undefined) updates.style = req.body.style || null;
    const sectorIdProvided = req.body.sector_id !== undefined;
    const newSectorId = sectorIdProvided ? (req.body.sector_id || null) : undefined;
    const videosProvided = Array.isArray(req.body.ar_route_ids);

    if (Object.keys(updates).length === 0 && !videosProvided && !sectorIdProvided) {
      return res.status(400).json({ success: false, data: null, message: '수정할 항목이 없습니다.' });
    }
    if (Object.keys(updates).length) await cp.update(updates);
    if (sectorIdProvided) {
      if (cp.problem_id) {
        await Problem.update({ sector_id: newSectorId }, { where: { id: cp.problem_id } });
      } else if (newSectorId && parent.gym_id) {
        const problem = await Problem.create({
          gym_id: parent.gym_id,
          sector_id: newSectorId,
          color: cp.custom_color || null,
          level: cp.custom_level || null,
          section: null,
        });
        await cp.update({ problem_id: problem.id });
      }
    }
    if (videosProvided) {
      const { ClimbLogProblemVideo, ArRoute } = require('../models');
      await ClimbLogProblemVideo.destroy({ where: { climb_log_problem_id: cp.id } });
      const ids = req.body.ar_route_ids;
      if (ids.length) {
        const valid = await ArRoute.findAll({ where: { id: ids, user_id: userId }, attributes: ['id'] });
        const validIds = valid.map((v) => v.id);
        await ClimbLogProblemVideo.bulkCreate(
          validIds.map((vid, idx) => ({ climb_log_problem_id: cp.id, ar_route_id: vid, sort_order: idx })),
          { ignoreDuplicates: true }
        );
      }
    }
    recomputeUserGoals(userId).catch(() => {});
    return res.json({ success: true, data: { id: cp.id, ...updates }, message: '항목이 수정되었습니다.' });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/climb-logs/:logId/problems/:cpId
 * 기록 내 개별 문제(시도) 삭제
 */
async function deleteLogProblem(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId, cpId } = req.params;
    const cp = await ClimbLogProblem.findByPk(cpId);
    if (!cp || Number(cp.log_id) !== Number(logId)) {
      return res.status(404).json({ success: false, data: null, message: '항목을 찾을 수 없습니다.' });
    }
    const parent = await ClimbLog.findByPk(cp.log_id, { attributes: ['user_id'] });
    if (!parent || Number(parent.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    await cp.destroy();
    recomputeUserGoals(userId).catch(() => {});
    return res.json({ success: true, data: null, message: '항목이 삭제되었습니다.' });
  } catch (err) { next(err); }
}

/**
 * POST /api/climb-logs/:logId/problems
 * 기록에 문제(시도) 추가 — color/level은 custom_*로 저장, attempts/is_cleared
 */
async function addLogProblem(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId } = req.params;
    const { color, level, style, cleared_count, failed_count, ar_route_ids, sector_id, gym_id: bodyGymId } = req.body || {};
    if (!color && !level) {
      return res.status(400).json({ success: false, data: null, message: '색상 또는 등급을 입력하세요.' });
    }
    const cc = cleared_count != null ? Number(cleared_count) : 0;
    const fc = failed_count != null ? Number(failed_count) : 0;
    if (!Number.isInteger(cc) || cc < 0 || !Number.isInteger(fc) || fc < 0) {
      return res.status(400).json({ success: false, data: null, message: 'cleared_count·failed_count는 0 이상 정수' });
    }
    const log = await ClimbLog.findByPk(logId, { attributes: ['id', 'user_id', 'gym_id'] });
    if (!log) return res.status(404).json({ success: false, data: null, message: '기록 없음' });
    if (Number(log.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    const gymId = bodyGymId || log.gym_id;
    let linkedProblemId = null;
    if (sector_id && gymId) {
      const problem = await Problem.create({
        gym_id: gymId,
        sector_id,
        color: color || null,
        level: level || null,
        section: null,
      });
      linkedProblemId = problem.id;
    }
    const cp = await ClimbLogProblem.create({
      log_id: log.id,
      problem_id: linkedProblemId,
      custom_color: linkedProblemId ? null : (color || null),
      custom_level: linkedProblemId ? null : (level || null),
      is_cleared: cc > 0,
      attempts: 1,
      cleared_count: cc, failed_count: fc,
      style: style || null,
      ar_route_id: null,
    });
    // 다중 영상 link
    if (Array.isArray(ar_route_ids) && ar_route_ids.length) {
      const { ClimbLogProblemVideo, ArRoute } = require('../models');
      const valid = await ArRoute.findAll({ where: { id: ar_route_ids, user_id: userId }, attributes: ['id'] });
      const ids = valid.map((v) => v.id);
      if (ids.length) {
        await ClimbLogProblemVideo.bulkCreate(
          ids.map((vid, idx) => ({ climb_log_problem_id: cp.id, ar_route_id: vid, sort_order: idx })),
          { ignoreDuplicates: true }
        );
      }
    }
    recomputeUserGoals(userId).catch(() => {});
    return res.status(201).json({
      success: true,
      data: {
        id: cp.id, color: cp.custom_color, level: cp.custom_level,
        cleared_count: cp.cleared_count, failed_count: cp.failed_count,
        ar_route_ids: ar_route_ids || [],
      },
      message: '항목이 추가되었습니다.',
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/climb-logs/:logId/problems/:cpId/video  (multipart `video`)
 * 개인 영상 업로드 — ClimbLogProblemPersonalVideo 레코드 생성 후 백그라운드 처리.
 */
async function uploadProblemVideo(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId, cpId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, data: null, message: '영상 파일이 필요합니다.' });
    const cp = await ClimbLogProblem.findByPk(cpId);
    if (!cp || Number(cp.log_id) !== Number(logId)) return res.status(404).json({ success: false, data: null, message: '항목을 찾을 수 없습니다.' });
    const parent = await ClimbLog.findByPk(cp.log_id, { attributes: ['user_id'] });
    if (!parent || Number(parent.user_id) !== Number(userId)) return res.status(403).json({ success: false, data: null, message: '권한 없음' });

    const qualityKey = req.body?.quality || 'standard';
    const tempVideoUrl = `${process.env.MEDIA_BASE_URL}/${req.file.filename}`;

    const pv = await ClimbLogProblemPersonalVideo.create({
      climb_log_problem_id: cp.id,
      video_url: tempVideoUrl,
      thumbnail_url: null,
      video_status: 'processing',
    });

    processPersonalVideoBackground({
      PersonalVideo: ClimbLogProblemPersonalVideo,
      pvId: pv.id,
      inputPath: req.file.path,
      qualityKey,
    });

    return res.json({
      success: true,
      data: { pvId: pv.id, video_url: tempVideoUrl, thumbnail_url: null, video_status: 'processing' },
      message: '영상이 업로드되었습니다. 서버에서 처리 중입니다.',
    });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/climb-logs/:logId/problems/:cpId/video
 * 항목의 영상 연결 해제 (ar_route_id = null). 영상 자체는 삭제하지 않음.
 */
async function removeProblemVideo(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId, cpId } = req.params;
    const cp = await ClimbLogProblem.findByPk(cpId);
    if (!cp || Number(cp.log_id) !== Number(logId)) {
      return res.status(404).json({ success: false, data: null, message: '항목을 찾을 수 없습니다.' });
    }
    const parent = await ClimbLog.findByPk(cp.log_id, { attributes: ['user_id'] });
    if (!parent || Number(parent.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    await cp.update({ ar_route_id: null, video_url: null, thumbnail_url: null, video_status: 'none' });
    return res.json({ success: true, data: null, message: '영상 연결이 해제되었습니다.' });
  } catch (err) { next(err); }
}

/**
 * GET /api/climb-logs/personal-videos/:pvId/status
 * 개인 영상 처리 상태 폴링용
 */
async function getProblemVideoStatus(req, res, next) {
  try {
    const { pvId } = req.params;
    const pv = await ClimbLogProblemPersonalVideo.findByPk(pvId, {
      attributes: ['id', 'climb_log_problem_id', 'video_url', 'thumbnail_url', 'video_status'],
    });
    if (!pv) return res.status(404).json({ success: false, data: null, message: '영상을 찾을 수 없습니다.' });
    return res.json({
      success: true,
      data: { pvId: pv.id, video_status: pv.video_status, video_url: pv.video_url, thumbnail_url: pv.thumbnail_url },
    });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/climb-logs/:logId/problems/:cpId/personal-videos/:pvId
 * 개인 영상 삭제
 */
async function deletePersonalVideo(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId, cpId, pvId } = req.params;
    const pv = await ClimbLogProblemPersonalVideo.findByPk(pvId);
    if (!pv || Number(pv.climb_log_problem_id) !== Number(cpId)) return res.status(404).json({ success: false, data: null, message: '영상을 찾을 수 없습니다.' });
    const parent = await ClimbLog.findByPk(logId, { attributes: ['user_id'] });
    if (!parent || Number(parent.user_id) !== Number(userId)) return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    await pv.destroy();
    return res.json({ success: true, data: null, message: '영상이 삭제되었습니다.' });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/climb-logs/:id
 * 기록 삭제 (본인 소유 검증)
 */
async function deleteLog(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const log = await ClimbLog.findByPk(id);
    if (!log) {
      return res.status(404).json({ success: false, data: null, message: '기록을 찾을 수 없습니다.' });
    }
    if (Number(log.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '삭제 권한이 없습니다.' });
    }

    await log.destroy(); // CASCADE로 climb_log_problems도 삭제
    recomputeUserGoals(userId).catch(() => {});

    return res.json({ success: true, data: null, message: '기록이 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/climb-logs/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&gym_id=
// 사용자별 기간 내 방문 일자 + 완등 항목(색상·V등급) 집계
async function getSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const { from, to, gym_id, sector_id } = req.query;
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'from, to 파라미터가 필요합니다.', data: null });
    }
    const summaryWhere = { user_id: userId, visited_at: { [Op.between]: [from, to] } };
    if (gym_id) summaryWhere.gym_id = Number(gym_id);
    const logs = await ClimbLog.findAll({
      where: summaryWhere,
      include: [{
        model: ClimbLogProblem, as: 'problems',
        attributes: ['id', 'is_cleared', 'cleared_count', 'failed_count', 'attempts', 'custom_color', 'custom_level'],
        include: [{
          model: Problem, as: 'problem',
          attributes: ['color', 'level', 'sector_id'],
          include: [{ model: GymSector, as: 'sector', attributes: ['id', 'name'], required: false }],
        }],
      }],
      order: [['visited_at', 'ASC']],
    });

    // dates: 캘린더 dot용 (distinct 날짜)
    const dates = [...new Set(logs.map((l) => l.visited_at))];
    const clearedByLevel = {};
    const clearedByColorLevel = {};
    const sectorBreakdown = {};
    let totalCleared = 0;
    let totalFailed = 0;
    let filteredVisits = 0;
    logs.forEach((l) => {
      let problems = l.problems || [];
      if (sector_id) {
        problems = problems.filter(cp => cp.problem && Number(cp.problem.sector_id) === Number(sector_id));
        if (problems.length === 0) return;
      }
      filteredVisits++;
      problems.forEach((cp) => {
        const cleared = cp.cleared_count != null ? Number(cp.cleared_count) : (cp.is_cleared ? 1 : 0);
        const failed = cp.failed_count != null ? Number(cp.failed_count) : 0;
        if (cleared === 0 && failed === 0) return;
        totalCleared += cleared;
        totalFailed += failed;
        if (cleared === 0) return;
        const lv = cp.problem?.level || cp.custom_level || '미지정';
        const color = cp.problem?.color || cp.custom_color || 'unknown';
        clearedByLevel[lv] = (clearedByLevel[lv] || 0) + cleared;
        const key = `${color}|${lv}`;
        clearedByColorLevel[key] = (clearedByColorLevel[key] || 0) + cleared;
        if (!sector_id) {
          const sId = cp.problem?.sector_id;
          const sName = cp.problem?.sector?.name;
          if (sId) {
            if (!sectorBreakdown[sId]) sectorBreakdown[sId] = { id: sId, name: sName || `섹터 ${sId}`, count: 0 };
            sectorBreakdown[sId].count += cleared;
          }
        }
      });
    });

    const COLOR_ORDER = ['red','orange','yellow','green','blue','navy','pink','purple','black','white','gray','unknown'];
    function levelRank(lv) {
      if (!lv || lv === '미지정' || lv === 'unknown') return 9999;
      const n = parseInt(String(lv).replace(/\D/g, ''), 10);
      return Number.isFinite(n) ? n : 9998;
    }
    const breakdown = Object.entries(clearedByColorLevel).map(([k, count]) => {
      const [color, level] = k.split('|');
      return { color, level, count };
    }).sort((a, b) => {
      const lvDiff = levelRank(a.level) - levelRank(b.level);
      if (lvDiff !== 0) return lvDiff;
      return (COLOR_ORDER.indexOf(a.color) + 1 || 99) - (COLOR_ORDER.indexOf(b.color) + 1 || 99);
    });

    // 카테고리별 카운트
    // - bouldering: climb_log_problems이 있는 climb_log 수 (training_sessions에 없음)
    // - 나머지: training_sessions를 session_date 기준으로 그룹핑 (항목 개수가 아닌 날짜 단위)
    const trainingByCategory = { bouldering: 0, endurance: 0, conditioning: 0 };
    trainingByCategory.bouldering = logs.filter((l) => (l.problems || []).length > 0).length;
    try {
      const tsessions = await TrainingSession.findAll({
        where: { user_id: userId, session_date: { [Op.between]: [from, to] } },
        attributes: ['category', 'session_date'],
      });
      // 같은 날짜에 같은 카테고리가 여러 row여도 1회만 카운트
      const catDateSets = {};
      tsessions.forEach((t) => {
        const c = t.category;
        if (!c || c === 'bouldering') return; // bouldering은 위에서 처리
        if (!catDateSets[c]) catDateSets[c] = new Set();
        catDateSets[c].add(String(t.session_date).slice(0, 10));
      });
      Object.entries(catDateSets).forEach(([c, s]) => {
        trainingByCategory[c] = s.size;
      });
    } catch {}

    const visits = sector_id ? filteredVisits : logs.length;

    res.json({
      success: true,
      data: {
        visits,
        dates,
        total_cleared: totalCleared,
        total_failed: totalFailed,
        cleared_by_level: clearedByLevel,
        breakdown,
        cleared_breakdown: breakdown,
        sector_breakdown: Object.values(sectorBreakdown).sort((a, b) => b.count - a.count),
        training_by_category: trainingByCategory,
      },
      message: null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/climb-logs/problems
 * 플랫 climb_log_problems 목록 (기록관리 메뉴 필터용)
 *  - from, to (YYYY-MM-DD), gym_id, color, level, style
 *  - limit, offset (페이지)
 *  - 각 행에 visited_at, gym_name, photos count, video count 포함
 */
async function listLogProblems(req, res, next) {
  try {
    const userId = req.user.id;
    const { from, to, gym_id, color, level, style } = req.query;
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const cpWhere = {};
    if (color) cpWhere[Op.or] = [{ custom_color: color }, { '$problem.color$': color }];
    if (level) {
      const lvCond = { [Op.or]: [{ custom_level: level }, { '$problem.level$': level }] };
      cpWhere[Op.and] = cpWhere[Op.and] ? [...cpWhere[Op.and], lvCond] : [lvCond];
    }
    if (style) cpWhere.style = style;

    const climbLogWhere = { user_id: userId };
    if (from && to) climbLogWhere.visited_at = { [Op.between]: [from, to] };
    else if (from) climbLogWhere.visited_at = { [Op.gte]: from };
    else if (to) climbLogWhere.visited_at = { [Op.lte]: to };
    if (gym_id) climbLogWhere.gym_id = Number(gym_id);

    // 1) 매칭 id + 정렬 — log alias 사용 가능
    const matched = await ClimbLogProblem.findAll({
      where: cpWhere,
      attributes: ['id'],
      include: [
        { model: Problem, as: 'problem', attributes: [], required: false },
        { model: ClimbLog, as: 'log', required: true, where: climbLogWhere, attributes: [] },
      ],
      order: [[{ model: ClimbLog, as: 'log' }, 'visited_at', 'DESC'], ['id', 'DESC']],
      subQuery: false,
    });
    const total = matched.length;
    const pageIds = matched.slice(offset, offset + limit).map((m) => m.id);

    let rows = [];
    if (pageIds.length) {
      rows = await ClimbLogProblem.findAll({
        where: { id: pageIds },
        include: [
          { model: Problem, as: 'problem', attributes: ['id', 'level', 'color'], required: false },
          {
            model: ClimbLog, as: 'log', required: true,
            include: [{ model: Gym, as: 'gym', attributes: ['id', 'name'], required: false }],
          },
          {
            model: require('../models').ClimbLogProblemVideo, as: 'video_links', required: false,
            include: [{ model: ArRoute, as: 'ar_route', attributes: ['id', 'title', 'thumbnail_url'], required: false }],
          },
          { model: ClimbLogProblemPhoto, as: 'photos', required: false, attributes: ['id'] },
          { model: ClimbLogProblemPersonalVideo, as: 'personal_videos', required: false, attributes: ['id', 'thumbnail_url', 'video_status'] },
        ],
      });
      // pageIds 순서로 정렬
      const orderMap = new Map(pageIds.map((id, i) => [id, i]));
      rows.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));
    }
    const count = total;

    const items = rows.map((p) => ({
      id: p.id,
      log_id: p.log_id,
      visited_at: p.log?.visited_at,
      gym_id: p.log?.gym_id,
      gym_name: p.log?.gym?.name || null,
      level: p.problem?.level || p.custom_level || '',
      color: p.problem?.color || p.custom_color || '',
      style: p.style,
      cleared_count: p.cleared_count,
      failed_count: p.failed_count,
      is_cleared: p.is_cleared,
      attempts: p.attempts,
      videos: (p.video_links || []).map((v) => ({
        id: v.id, ar_route_id: v.ar_route_id,
        ar_route: v.ar_route ? v.ar_route.toJSON() : null,
      })),
      thumbnail_url: p.personal_videos?.[0]?.thumbnail_url || p.thumbnail_url || p.ar_route?.thumbnail_url || null,
      photo_count: (p.photos || []).length,
    }));

    return res.json({
      success: true,
      data: { items, total: count, limit, offset },
      message: null,
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/climb-logs/:logId/problems/:cpId/photos  (multipart `photo`)
 * 볼더링 문제 사진 업로드. 본문에 hold_annotations(JSON), failure_tags(string), failure_memo(text) 동시 가능.
 */
async function uploadProblemPhoto(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId, cpId } = req.params;
    const { ClimbLogProblemPhoto } = require('../models');
    if (!req.file) return res.status(400).json({ success: false, data: null, message: '파일이 없습니다.' });
    const cp = await ClimbLogProblem.findByPk(cpId);
    if (!cp || Number(cp.log_id) !== Number(logId)) {
      return res.status(404).json({ success: false, data: null, message: '항목을 찾을 수 없습니다.' });
    }
    const parent = await ClimbLog.findByPk(cp.log_id, { attributes: ['user_id'] });
    if (!parent || Number(parent.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    const photo_url = `${process.env.MEDIA_BASE_URL}/${req.file.filename}`;
    const photo = await ClimbLogProblemPhoto.create({
      climb_log_problem_id: cp.id,
      photo_url,
      hold_annotations: req.body.hold_annotations || null,
      failure_tags: req.body.failure_tags || null,
      failure_memo: req.body.failure_memo || null,
    });
    return res.status(201).json({
      success: true,
      data: {
        id: photo.id, photo_url: photo.photo_url,
        hold_annotations: photo.hold_annotations,
        failure_tags: photo.failure_tags, failure_memo: photo.failure_memo,
      },
      message: '사진이 업로드되었습니다.',
    });
  } catch (err) { next(err); }
}

/**
 * PATCH /api/climb-logs/:logId/problems/:cpId/photos/:photoId
 * 홀드 마킹 / 실패 태그 / 메모 갱신
 */
async function updateProblemPhoto(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId, cpId, photoId } = req.params;
    const { ClimbLogProblemPhoto } = require('../models');
    const photo = await ClimbLogProblemPhoto.findByPk(photoId);
    if (!photo || Number(photo.climb_log_problem_id) !== Number(cpId)) {
      return res.status(404).json({ success: false, data: null, message: '사진을 찾을 수 없습니다.' });
    }
    const cp = await ClimbLogProblem.findByPk(cpId);
    if (!cp || Number(cp.log_id) !== Number(logId)) {
      return res.status(404).json({ success: false, data: null, message: '항목을 찾을 수 없습니다.' });
    }
    const parent = await ClimbLog.findByPk(cp.log_id, { attributes: ['user_id'] });
    if (!parent || Number(parent.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    const updates = {};
    if (req.body.hold_annotations !== undefined) updates.hold_annotations = req.body.hold_annotations;
    if (req.body.failure_tags !== undefined) updates.failure_tags = req.body.failure_tags || null;
    if (req.body.failure_memo !== undefined) updates.failure_memo = req.body.failure_memo || null;
    if (!Object.keys(updates).length)
      return res.status(400).json({ success: false, data: null, message: '수정할 항목이 없습니다.' });
    await photo.update(updates);
    return res.json({
      success: true,
      data: {
        id: photo.id, photo_url: photo.photo_url,
        hold_annotations: photo.hold_annotations,
        failure_tags: photo.failure_tags, failure_memo: photo.failure_memo,
      },
      message: '사진이 수정되었습니다.',
    });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/climb-logs/:logId/problems/:cpId/photos/:photoId
 */
async function deleteProblemPhoto(req, res, next) {
  try {
    const userId = req.user.id;
    const { logId, cpId, photoId } = req.params;
    const { ClimbLogProblemPhoto } = require('../models');
    const photo = await ClimbLogProblemPhoto.findByPk(photoId);
    if (!photo || Number(photo.climb_log_problem_id) !== Number(cpId)) {
      return res.status(404).json({ success: false, data: null, message: '사진을 찾을 수 없습니다.' });
    }
    const cp = await ClimbLogProblem.findByPk(cpId);
    if (!cp || Number(cp.log_id) !== Number(logId)) {
      return res.status(404).json({ success: false, data: null, message: '항목을 찾을 수 없습니다.' });
    }
    const parent = await ClimbLog.findByPk(cp.log_id, { attributes: ['user_id'] });
    if (!parent || Number(parent.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    await photo.destroy();
    return res.json({ success: true, data: null, message: '사진이 삭제되었습니다.' });
  } catch (err) { next(err); }
}

/**
 * GET /api/climb-logs?gym_id=:id&view=all|week|month&offset=0&page=1&limit=10
 * 특정 암장의 운동기록 목록 (기간 필터 + 페이징)
 */
async function getLogsByGym(req, res, next) {
  try {
    const userId = req.user.id;
    const gymId = parseInt(req.query.gym_id, 10);
    const view = req.query.view || 'all';
    const offsetInt = parseInt(req.query.offset || '0', 10);
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '10', 10)));

    let from = null, to = null, period = null;
    if (req.query.from && req.query.to) {
      // 직접 지정 기간
      from = req.query.from;
      to = req.query.to;
      period = { from, to, view: 'custom', offset: 0 };
    } else if (view !== 'all') {
      const now = new Date();
      if (view === 'week') {
        const dow = now.getDay();
        const monOff = dow === 0 ? -6 : 1 - dow;
        const mon = new Date(now);
        mon.setDate(now.getDate() + monOff + offsetInt * 7);
        mon.setHours(0, 0, 0, 0);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const iso = (d) => d.toISOString().slice(0, 10);
        from = iso(mon); to = iso(sun);
      } else if (view === 'month') {
        const base = new Date(now.getFullYear(), now.getMonth() + offsetInt, 1);
        const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
        const iso = (d) => d.toISOString().slice(0, 10);
        from = iso(base); to = iso(last);
      }
      period = { from, to, view, offset: offsetInt };
    }

    const where = { user_id: userId };
    if (gymId) where.gym_id = gymId;
    if (from && to) where.visited_at = { [Op.between]: [from, to] };

    const total = await ClimbLog.count({ where });
    const logs = await ClimbLog.findAll({
      where,
      include: [
        {
          model: GymPass, as: 'gym_pass',
          attributes: ['id', 'pass_type', 'label', 'remaining_count'],
          required: false,
        },
        {
          model: ClimbLogProblem, as: 'problems',
          include: [
            { model: Problem, as: 'problem', attributes: ['id', 'level', 'color'], required: false },
          ],
        },
      ],
      order: [['visited_at', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    const logDates = [...new Set(logs.map((l) => l.visited_at))];
    const trainingByDate = new Map();
    if (logDates.length > 0) {
      const allTraining = await TrainingSession.findAll({
        where: { user_id: userId, ...(gymId ? { gym_id: gymId } : {}), session_date: { [Op.in]: logDates } },
        include: [{ model: TrainingSessionItem, as: 'items' }],
        order: [['id', 'ASC']],
      });
      allTraining.forEach((s) => {
        const k = s.session_date;
        if (!trainingByDate.has(k)) trainingByDate.set(k, []);
        trainingByDate.get(k).push(s);
      });
    }

    const formatted = logs.map((log) => ({
      id: log.id,
      visited_at: log.visited_at,
      memo: log.memo,
      duration_minutes: log.duration_minutes,
      start_time: normalizeTime(log.start_time),
      end_time: normalizeTime(log.end_time),
      gym_pass_id: log.gym_pass_id,
      gym_pass: log.gym_pass ? log.gym_pass.toJSON() : null,
      used_day_pass: !!log.used_day_pass,
      problems: (log.problems || []).map((p) => ({
        id: p.id,
        level: p.problem?.level || p.custom_level || '',
        color: p.problem?.color || p.custom_color || '',
        is_cleared: p.is_cleared,
        cleared_count: p.cleared_count,
        failed_count: p.failed_count,
        style: p.style,
      })),
      training_sessions: (trainingByDate.get(log.visited_at) || []).map((s) => ({
        id: s.id, category: s.category,
        duration_minutes: s.duration_minutes,
        memo: s.memo,
        items: (s.items || []).map((it) => ({
          id: it.id, exercise_name: it.exercise_name,
          sets: it.sets, reps_or_seconds: it.reps_or_seconds,
          metric_unit: it.metric_unit,
        })),
      })),
    }));

    res.json({ success: true, data: { logs: formatted, total, period }, message: null });
  } catch (err) { next(err); }
}

module.exports = {
  getLogDates, getLogsByDate, getLogsByGym, getLogById, createLog, updateLog, deleteLog,
  updateLogProblem, deleteLogProblem,
  addLogProblem,
  uploadProblemVideo, removeProblemVideo, getProblemVideoStatus, deletePersonalVideo,
  uploadProblemPhoto, updateProblemPhoto, deleteProblemPhoto,
  listLogProblems,
  getSummary,
};
