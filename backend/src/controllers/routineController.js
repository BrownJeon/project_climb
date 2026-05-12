const { TrainingRoutine } = require('../models');

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** GET /api/training/routines — 요일별 그룹 반환 */
async function listRoutines(req, res, next) {
  try {
    const rows = await TrainingRoutine.findAll({
      where: { user_id: req.user.id },
      order: [['day_of_week', 'ASC'], ['sort_order', 'ASC'], ['id', 'ASC']],
    });
    // 요일별 그룹핑
    const grouped = Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      day_label: DOW_LABELS[i],
      items: [],
    }));
    rows.forEach((r) => grouped[r.day_of_week].items.push(r.toJSON()));
    return res.json({ success: true, data: { routines: grouped }, message: null });
  } catch (e) { next(e); }
}

/** POST /api/training/routines */
async function createRoutine(req, res, next) {
  try {
    const { day_of_week, category, label, target_count, target_minutes, target_color, cond_unit, sort_order } = req.body;
    if (day_of_week == null || !category) {
      return res.status(400).json({ success: false, data: null, message: 'day_of_week·category 필수' });
    }
    const row = await TrainingRoutine.create({
      user_id: req.user.id,
      day_of_week: Number(day_of_week),
      category,
      label: label || null,
      target_count: target_count != null ? Number(target_count) : null,
      target_minutes: target_minutes != null ? Number(target_minutes) : null,
      target_color: target_color || null,
      cond_unit: cond_unit || null,
      sort_order: sort_order != null ? Number(sort_order) : 0,
    });
    return res.status(201).json({ success: true, data: row.toJSON(), message: '루틴이 추가되었습니다.' });
  } catch (e) { next(e); }
}

/** PATCH /api/training/routines/:id */
async function updateRoutine(req, res, next) {
  try {
    const row = await TrainingRoutine.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, data: null, message: '루틴을 찾을 수 없습니다.' });
    if (Number(row.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    const updatable = ['day_of_week', 'category', 'label', 'target_count', 'target_minutes', 'target_color', 'cond_unit', 'sort_order'];
    const updates = {};
    for (const k of updatable) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await row.update(updates);
    return res.json({ success: true, data: row.toJSON(), message: '루틴이 수정되었습니다.' });
  } catch (e) { next(e); }
}

/** DELETE /api/training/routines/:id */
async function deleteRoutine(req, res, next) {
  try {
    const row = await TrainingRoutine.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, data: null, message: '루틴을 찾을 수 없습니다.' });
    if (Number(row.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, data: null, message: '권한 없음' });
    }
    await row.destroy();
    return res.json({ success: true, data: null, message: '루틴이 삭제되었습니다.' });
  } catch (e) { next(e); }
}

module.exports = { listRoutines, createRoutine, updateRoutine, deleteRoutine };
