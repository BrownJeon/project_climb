const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { videoUpload, imageUpload } = require('../middleware/upload');
const {
  getLogDates, getLogsByDate, getLogsByGym, getLogById, createLog, updateLog, deleteLog,
  updateLogProblem, deleteLogProblem, addLogProblem,
  uploadProblemVideo, removeProblemVideo, getProblemVideoStatus,
  uploadProblemPhoto, updateProblemPhoto, deleteProblemPhoto,
  listLogProblems,
  getSummary,
} = require('../controllers/climbLogController');

const router = Router();

// GET /api/climb-logs/summary?from=&to=
router.get('/summary', optionalAuth, getSummary);

// GET /api/climb-logs/problems?from=&to=&gym_id=&color=&level=&style=&limit=&offset=
router.get('/problems', optionalAuth, listLogProblems);

// GET /api/climb-logs/visited-gyms — 사용자가 방문한 distinct gym_id 목록 (최신순)
// ?include_gym=true  → gym 상세 + last_visited_at + visit_count 포함
// ?limit=20          → 최대 반환 수 (기본 20, 최대 50)
router.get('/visited-gyms', optionalAuth, async (req, res, next) => {
  try {
    const { sequelize, Gym } = require('../models');
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const [rows] = await sequelize.query(
      `SELECT gym_id, MAX(visited_at) AS last_visited, COUNT(*) AS visit_count,
              SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY visited_at DESC SEPARATOR ','), ',', 1) AS last_log_id
         FROM climb_logs
        WHERE user_id = :uid AND gym_id IS NOT NULL
        GROUP BY gym_id
        ORDER BY last_visited DESC
        LIMIT :lim`,
      { replacements: { uid: req.user.id, lim: limit } }
    );

    if (req.query.include_gym !== 'true') {
      return res.json({
        success: true,
        data: { gym_ids: rows.map((r) => r.gym_id) },
        message: null,
      });
    }

    // include_gym=true: gym 상세 병합
    const gymIds = rows.map((r) => r.gym_id);
    if (gymIds.length === 0) {
      return res.json({ success: true, data: { gyms: [] }, message: null });
    }
    const gymRows = await Gym.findAll({ where: { id: gymIds } });
    const gymMap = Object.fromEntries(gymRows.map((g) => [g.id, g.toJSON()]));

    // 마지막 방문 기록의 문제 요약 (색상별 완등/시도 수)
    const lastLogIds = rows.map((r) => r.last_log_id).filter(Boolean);
    const problemSummaryMap = {};
    if (lastLogIds.length > 0) {
      const [problems] = await sequelize.query(
        `SELECT clp.log_id,
                COALESCE(clp.custom_color, p.color) AS color,
                SUM(CASE WHEN clp.cleared_count IS NOT NULL THEN CAST(clp.cleared_count AS SIGNED)
                         ELSE IF(clp.is_cleared, 1, 0) END) AS cleared,
                COUNT(*) AS total
           FROM climb_log_problems clp
           LEFT JOIN problems p ON clp.problem_id = p.id
          WHERE clp.log_id IN (:logIds)
          GROUP BY clp.log_id, COALESCE(clp.custom_color, p.color)
          ORDER BY cleared DESC`,
        { replacements: { logIds: lastLogIds } }
      );
      for (const row of problems) {
        if (!problemSummaryMap[row.log_id]) problemSummaryMap[row.log_id] = [];
        problemSummaryMap[row.log_id].push({
          color: row.color,
          cleared: Number(row.cleared),
          total: Number(row.total),
        });
      }
    }

    const gyms = rows
      .filter((r) => gymMap[r.gym_id])
      .map((r) => ({
        ...gymMap[r.gym_id],
        last_visited_at: r.last_visited,
        visit_count: Number(r.visit_count),
        last_log_problems: problemSummaryMap[r.last_log_id] || [],
      }));
    res.json({ success: true, data: { gyms }, message: null });
  } catch (err) { next(err); }
});

// GET /api/climb-logs?year=&month=  → 월 방문 날짜 목록
// GET /api/climb-logs?date=         → 특정 날짜 기록 상세
router.get('/', optionalAuth, (req, res, next) => {
  if (req.query.date) return getLogsByDate(req, res, next);
  if (req.query.gym_id || req.query.from) return getLogsByGym(req, res, next);
  return getLogDates(req, res, next);
});
router.get('/:id', optionalAuth, getLogById);

router.post('/', optionalAuth, createLog);
router.patch('/:id', optionalAuth, updateLog);
router.delete('/:id', optionalAuth, deleteLog);
router.post('/:logId/problems', optionalAuth, addLogProblem);
router.patch('/:logId/problems/:cpId', optionalAuth, updateLogProblem);
router.delete('/:logId/problems/:cpId', optionalAuth, deleteLogProblem);
router.post('/:logId/problems/:cpId/video', optionalAuth, videoUpload.single('video'), uploadProblemVideo);
router.delete('/:logId/problems/:cpId/video', optionalAuth, removeProblemVideo);
router.get('/:logId/problems/:cpId/video-status', optionalAuth, getProblemVideoStatus);
router.post('/:logId/problems/:cpId/photos', optionalAuth, imageUpload.single('photo'), uploadProblemPhoto);
router.patch('/:logId/problems/:cpId/photos/:photoId', optionalAuth, updateProblemPhoto);
router.delete('/:logId/problems/:cpId/photos/:photoId', optionalAuth, deleteProblemPhoto);

module.exports = router;
