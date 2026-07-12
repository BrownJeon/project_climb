const { Gym, GymSector, GymSectorSchedule } = require('../models');

/**
 * GET /api/gyms/:id/sectors
 * 암장의 활성 섹터 목록
 */
async function listSectors(req, res, next) {
  try {
    const { id } = req.params;

    const gym = await Gym.findByPk(id);
    if (!gym) {
      return res.status(404).json({ success: false, data: null, message: '암장을 찾을 수 없습니다.' });
    }

    const sectors = await GymSector.findAll({
      where: { gym_id: id, is_active: true },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });

    return res.json({ success: true, data: sectors, message: '' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/gyms/:id/sectors
 * 섹터 추가
 */
async function createSector(req, res, next) {
  try {
    const { id } = req.params;
    const { name, sort_order } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, data: null, message: '섹터 이름이 필요합니다.' });
    }

    const gym = await Gym.findByPk(id);
    if (!gym) {
      return res.status(404).json({ success: false, data: null, message: '암장을 찾을 수 없습니다.' });
    }

    const sector = await GymSector.create({
      gym_id: id,
      name: String(name).trim(),
      sort_order: sort_order != null ? Number(sort_order) : 0,
    });

    return res.status(201).json({ success: true, data: sector, message: '섹터가 추가되었습니다.' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/gyms/:id/sectors/:sId
 * 섹터 수정 (name, sort_order, is_active)
 */
async function updateSector(req, res, next) {
  try {
    const { id, sId } = req.params;
    const { name, sort_order, is_active } = req.body;

    const sector = await GymSector.findOne({ where: { id: sId, gym_id: id } });
    if (!sector) {
      return res.status(404).json({ success: false, data: null, message: '섹터를 찾을 수 없습니다.' });
    }

    const updates = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ success: false, data: null, message: '섹터 이름이 필요합니다.' });
      updates.name = trimmed;
    }
    if (sort_order !== undefined) updates.sort_order = Number(sort_order);
    if (is_active !== undefined) updates.is_active = !!is_active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, data: null, message: '수정할 항목이 없습니다.' });
    }

    await sector.update(updates);
    return res.json({ success: true, data: sector, message: '섹터가 수정되었습니다.' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/gyms/:id/sectors/:sId
 * 섹터 삭제
 */
async function deleteSector(req, res, next) {
  try {
    const { id, sId } = req.params;

    const sector = await GymSector.findOne({ where: { id: sId, gym_id: id } });
    if (!sector) {
      return res.status(404).json({ success: false, data: null, message: '섹터를 찾을 수 없습니다.' });
    }

    await sector.destroy();
    return res.json({ success: true, data: null, message: '섹터가 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gyms/:id/resets?year=&month=
 * 활성 스케줄에서 해당 월의 교체 날짜 계산
 */
async function listResets(req, res, next) {
  try {
    const { id } = req.params;
    const now = new Date();
    const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, data: null, message: 'year/month 파라미터가 올바르지 않습니다.' });
    }

    const schedules = await GymSectorSchedule.findAll({
      where: { gym_id: id, is_active: true },
      include: [{ model: GymSector, as: 'sector', attributes: ['id', 'name'], required: false }],
    });

    const pad = (n) => String(n).padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    const results = [];

    for (const sched of schedules) {
      const startDate = sched.start_date ? new Date(sched.start_date + 'T00:00:00') : null;

      if (sched.frequency === 'once') {
        if (!sched.start_date) continue;
        const [dy, dm] = sched.start_date.split('-').map(Number);
        if (dy === year && dm === month) {
          results.push({ reset_date: sched.start_date, sector: sched.sector, schedule_id: sched.id, frequency: sched.frequency, note: sched.note });
        }
        continue;
      }

      if (sched.frequency === 'monthly') {
        const d = sched.day_of_month;
        if (!d || d > daysInMonth) continue;
        const dateStr = `${year}-${pad(month)}-${pad(d)}`;
        if (startDate && new Date(dateStr + 'T00:00:00') < startDate) continue;
        results.push({ reset_date: dateStr, sector: sched.sector, schedule_id: sched.id, frequency: sched.frequency, note: sched.note });

      } else {
        // weekly or biweekly
        const targetDay = sched.day_of_week;
        if (targetDay === null || targetDay === undefined) continue;

        for (let d = 1; d <= daysInMonth; d++) {
          const dateObj = new Date(year, month - 1, d);
          if (dateObj.getDay() !== targetDay) continue;
          if (startDate && dateObj < startDate) continue;

          if (sched.frequency === 'biweekly' && startDate) {
            const diffDays = Math.round((dateObj.getTime() - startDate.getTime()) / 86400000);
            if (diffDays % 14 !== 0) continue;
          }

          const dateStr = `${year}-${pad(month)}-${pad(d)}`;
          results.push({ reset_date: dateStr, sector: sched.sector, schedule_id: sched.id, frequency: sched.frequency, note: sched.note });
        }
      }
    }

    results.sort((a, b) => a.reset_date.localeCompare(b.reset_date));
    return res.json({ success: true, data: results, message: '' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gyms/:id/schedules
 */
async function listSchedules(req, res, next) {
  try {
    const { id } = req.params;
    const schedules = await GymSectorSchedule.findAll({
      where: { gym_id: id, is_active: true },
      include: [{ model: GymSector, as: 'sector', attributes: ['id', 'name'], required: false }],
      order: [['id', 'ASC']],
    });
    return res.json({ success: true, data: schedules, message: '' });
  } catch (err) { next(err); }
}

/**
 * POST /api/gyms/:id/schedules
 * body: { frequency, day_of_week?, day_of_month?, start_date?, sector_id?, note? }
 */
async function createSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const { frequency, day_of_week, day_of_month, start_date, sector_id, note } = req.body;

    if (!['weekly', 'biweekly', 'monthly', 'once'].includes(frequency)) {
      return res.status(400).json({ success: false, data: null, message: 'frequency는 weekly/biweekly/monthly/once 중 하나여야 합니다.' });
    }
    if ((frequency === 'weekly' || frequency === 'biweekly') && (day_of_week === undefined || day_of_week === null)) {
      return res.status(400).json({ success: false, data: null, message: 'weekly/biweekly는 day_of_week(0-6)가 필요합니다.' });
    }
    if (frequency === 'biweekly' && !start_date) {
      return res.status(400).json({ success: false, data: null, message: 'biweekly는 start_date(앵커 날짜)가 필요합니다.' });
    }
    if (frequency === 'monthly' && (!day_of_month || day_of_month < 1 || day_of_month > 31)) {
      return res.status(400).json({ success: false, data: null, message: 'monthly는 day_of_month(1-31)가 필요합니다.' });
    }
    if (frequency === 'once' && (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date))) {
      return res.status(400).json({ success: false, data: null, message: '직접입력은 날짜(YYYY-MM-DD)가 필요합니다.' });
    }

    if (sector_id) {
      const sec = await GymSector.findOne({ where: { id: sector_id, gym_id: id } });
      if (!sec) return res.status(400).json({ success: false, data: null, message: '해당 암장의 섹터가 아닙니다.' });
    }

    const sched = await GymSectorSchedule.create({
      gym_id: id,
      sector_id: sector_id || null,
      frequency,
      day_of_week: day_of_week !== undefined ? Number(day_of_week) : null,
      day_of_month: day_of_month !== undefined ? Number(day_of_month) : null,
      start_date: start_date || null,
      note: note || null,
    });

    const result = await GymSectorSchedule.findByPk(sched.id, {
      include: [{ model: GymSector, as: 'sector', attributes: ['id', 'name'], required: false }],
    });
    return res.status(201).json({ success: true, data: result, message: '교체 주기가 등록되었습니다.' });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/gyms/:id/schedules/:scheduleId
 */
async function deleteSchedule(req, res, next) {
  try {
    const { id, scheduleId } = req.params;
    const sched = await GymSectorSchedule.findOne({ where: { id: scheduleId, gym_id: id } });
    if (!sched) return res.status(404).json({ success: false, data: null, message: '스케줄을 찾을 수 없습니다.' });
    await sched.destroy();
    return res.json({ success: true, data: null, message: '교체 주기가 삭제되었습니다.' });
  } catch (err) { next(err); }
}

module.exports = {
  listSectors,
  createSector,
  updateSector,
  deleteSector,
  listResets,
  listSchedules,
  createSchedule,
  deleteSchedule,
};
