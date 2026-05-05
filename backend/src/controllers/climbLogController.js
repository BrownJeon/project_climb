const { Op } = require('sequelize');
const { ClimbLog, ClimbLogProblem, Problem, Gym, GymPass, ArRoute, sequelize } = require('../models');

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
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const formatted = logs.map((log) => ({
      id: log.id,
      gym_id: log.gym_id,
      gym_name: log.gym?.name || '알 수 없는 암장',
      gym_address: log.gym?.address || '',
      visited_at: log.visited_at,
      memo: log.memo,
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
        ar_route_id: p.ar_route_id,
        ar_route: p.ar_route ? p.ar_route.toJSON() : null,
      })),
    }));

    return res.json({ success: true, data: { logs: formatted }, message: null });
  } catch (err) {
    next(err);
  }
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
      if (Number(pass.gym_id) !== Number(gym_id)) { await t.rollback(); return res.status(400).json({ success: false, data: null, message: '다른 암장의 이용권은 사용할 수 없습니다.' }); }
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

    return res.json({ success: true, data: null, message: '기록이 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLogDates, getLogsByDate, createLog, deleteLog };
