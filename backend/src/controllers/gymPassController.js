const { GymPass, Gym } = require('../models');

/**
 * 오늘 날짜 기준으로 정기권 상태 계산
 */
function calcPeriodStatus(pass) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(pass.end_date);
  endDate.setHours(0, 0, 0, 0);
  const diffMs = endDate - today;
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return {
    days_remaining: daysRemaining,
    is_expired: daysRemaining < 0,
  };
}

/**
 * 횟수권 상태 계산 (잔여 + 만료일)
 */
function calcCountStatus(pass) {
  let isExpired = pass.remaining_count <= 0;
  let daysRemaining = null;
  if (pass.end_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(pass.end_date);
    endDate.setHours(0, 0, 0, 0);
    daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) isExpired = true;
  }
  return { days_remaining: daysRemaining, is_expired: isExpired };
}

/**
 * GET /api/passes?status=all|active|expired
 * 내 이용권 목록
 */
async function listPasses(req, res, next) {
  try {
    const userId = req.user.id;
    const { status = 'all', gym_id, pass_type } = req.query;

    const where = { user_id: userId };
    if (gym_id) where.gym_id = gym_id;
    if (pass_type) where.pass_type = pass_type;

    const passes = await GymPass.findAll({
      where,
      include: [{ model: Gym, as: 'gym', attributes: ['id', 'name', 'address'] }],
      order: [['created_at', 'DESC']],
    });

    const formatted = passes.map((p) => {
      const base = {
        id: p.id,
        gym_id: p.gym_id,
        gym_name: p.gym?.name || '알 수 없는 암장',
        gym_address: p.gym?.address || '',
        pass_type: p.pass_type,
        label: p.label,
        is_active: p.is_active,
      };

      if (p.pass_type === 'period') {
        const { days_remaining, is_expired } = calcPeriodStatus(p);
        return {
          ...base,
          start_date: p.start_date,
          end_date: p.end_date,
          days_remaining,
          is_expired,
        };
      }
      // count
      const { days_remaining, is_expired } = calcCountStatus(p);
      return {
        ...base,
        total_count: p.total_count,
        remaining_count: p.remaining_count,
        end_date: p.end_date,
        days_remaining,
        is_expired,
      };
    });

    let result = formatted;
    if (status === 'active') result = formatted.filter((p) => !p.is_expired && p.is_active);
    else if (status === 'expired') result = formatted.filter((p) => p.is_expired || !p.is_active);

    return res.json({ success: true, data: { passes: result }, message: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/passes
 * 이용권 등록
 */
async function createPass(req, res, next) {
  try {
    const userId = req.user.id;
    const { gym_id, pass_type, label, start_date, end_date, total_count } = req.body;

    if (!gym_id || !pass_type) {
      return res.status(400).json({ success: false, data: null, message: 'gym_id와 pass_type이 필요합니다.' });
    }
    if (!['period', 'count'].includes(pass_type)) {
      return res.status(400).json({ success: false, data: null, message: 'pass_type은 period 또는 count이어야 합니다.' });
    }
    if (pass_type === 'period' && (!start_date || !end_date)) {
      return res.status(400).json({ success: false, data: null, message: '정기권은 start_date와 end_date가 필요합니다.' });
    }
    if (pass_type === 'count' && (!total_count || total_count < 1)) {
      return res.status(400).json({ success: false, data: null, message: '횟수권은 total_count가 필요합니다.' });
    }
    // count + end_date: 만료일은 오늘 이후만 허용
    if (pass_type === 'count' && end_date) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const ed = new Date(end_date); ed.setHours(0, 0, 0, 0);
      if (ed < today) {
        return res.status(400).json({ success: false, data: null, message: '만료일은 오늘 이후여야 합니다.' });
      }
    }

    const gym = await Gym.findByPk(gym_id);
    if (!gym) {
      return res.status(404).json({ success: false, data: null, message: '암장을 찾을 수 없습니다.' });
    }

    const passData = { user_id: userId, gym_id, pass_type, label };
    if (pass_type === 'period') {
      passData.start_date = start_date;
      passData.end_date = end_date;
    } else {
      passData.total_count = total_count;
      passData.remaining_count = total_count;
      if (end_date) passData.end_date = end_date;
    }

    const pass = await GymPass.create(passData);

    const responseData = {
      id: pass.id,
      gym_id: pass.gym_id,
      gym_name: gym.name,
      pass_type: pass.pass_type,
      label: pass.label,
    };
    if (pass_type === 'period') {
      const { days_remaining, is_expired } = calcPeriodStatus(pass);
      Object.assign(responseData, { start_date: pass.start_date, end_date: pass.end_date, days_remaining, is_expired });
    } else {
      const { days_remaining, is_expired } = calcCountStatus(pass);
      Object.assign(responseData, {
        total_count: pass.total_count,
        remaining_count: pass.remaining_count,
        end_date: pass.end_date,
        days_remaining,
        is_expired,
      });
    }

    return res.status(201).json({ success: true, data: responseData, message: '이용권이 등록되었습니다.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/passes/:id/use
 * 횟수권 1회 차감
 */
async function usePass(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const pass = await GymPass.findByPk(id, {
      include: [{ model: Gym, as: 'gym', attributes: ['id', 'name'] }],
    });

    if (!pass) {
      return res.status(404).json({ success: false, data: null, message: '이용권을 찾을 수 없습니다.' });
    }
    if (Number(pass.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '권한이 없습니다.' });
    }
    if (pass.pass_type !== 'count') {
      return res.status(400).json({ success: false, data: null, message: '횟수권만 차감할 수 있습니다.' });
    }
    if (pass.remaining_count <= 0) {
      return res.status(400).json({ success: false, data: null, message: '잔여 횟수가 없습니다.' });
    }

    pass.remaining_count -= 1;
    await pass.save();

    return res.json({
      success: true,
      data: {
        id: pass.id,
        gym_name: pass.gym?.name,
        remaining_count: pass.remaining_count,
        total_count: pass.total_count,
        is_expired: pass.remaining_count <= 0,
      },
      message: `이용권을 사용했습니다. 잔여: ${pass.remaining_count}회`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/passes/:id
 * 이용권 삭제
 */
async function deletePass(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const pass = await GymPass.findByPk(id);
    if (!pass) {
      return res.status(404).json({ success: false, data: null, message: '이용권을 찾을 수 없습니다.' });
    }
    if (Number(pass.user_id) !== Number(userId)) {
      return res.status(403).json({ success: false, data: null, message: '삭제 권한이 없습니다.' });
    }

    await pass.destroy();
    return res.json({ success: true, data: null, message: '이용권이 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPasses, createPass, usePass, deletePass };
