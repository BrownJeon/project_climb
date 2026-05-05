const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { getLogDates, getLogsByDate, createLog, deleteLog } = require('../controllers/climbLogController');

const router = Router();

// GET /api/climb-logs?year=&month=  → 월 방문 날짜 목록
// GET /api/climb-logs?date=         → 특정 날짜 기록 상세
router.get('/', optionalAuth, (req, res, next) => {
  if (req.query.date) return getLogsByDate(req, res, next);
  return getLogDates(req, res, next);
});

router.post('/', optionalAuth, createLog);
router.delete('/:id', optionalAuth, deleteLog);

module.exports = router;
