const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { videoUpload, imageUpload } = require('../middleware/upload');
const {
  getLogDates, getLogsByDate, getLogById, createLog, updateLog, deleteLog,
  updateLogProblem, deleteLogProblem, addLogProblem,
  uploadProblemVideo, removeProblemVideo,
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
router.get('/visited-gyms', optionalAuth, async (req, res, next) => {
  try {
    const { sequelize } = require('../models');
    const [rows] = await sequelize.query(
      `SELECT gym_id, MAX(visited_at) AS last_visited
         FROM climb_logs
        WHERE user_id = :uid AND gym_id IS NOT NULL
        GROUP BY gym_id
        ORDER BY last_visited DESC
        LIMIT 50`,
      { replacements: { uid: req.user.id } }
    );
    res.json({
      success: true,
      data: { gym_ids: rows.map((r) => r.gym_id) },
      message: null,
    });
  } catch (err) { next(err); }
});

// GET /api/climb-logs?year=&month=  → 월 방문 날짜 목록
// GET /api/climb-logs?date=         → 특정 날짜 기록 상세
router.get('/', optionalAuth, (req, res, next) => {
  if (req.query.date) return getLogsByDate(req, res, next);
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
router.post('/:logId/problems/:cpId/photos', optionalAuth, imageUpload.single('photo'), uploadProblemPhoto);
router.patch('/:logId/problems/:cpId/photos/:photoId', optionalAuth, updateProblemPhoto);
router.delete('/:logId/problems/:cpId/photos/:photoId', optionalAuth, deleteProblemPhoto);

module.exports = router;
