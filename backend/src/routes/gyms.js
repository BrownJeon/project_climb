const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { listGyms, getGym, getGymProblems, createGym, updateGym, deleteGym, createProblem, updateProblem } = require('../controllers/gymController');
const { listSectors, createSector, updateSector, deleteSector, listResets, listSchedules, createSchedule, deleteSchedule } = require('../controllers/gymSectorController');

const router = Router();

router.get('/', optionalAuth, listGyms);
router.post('/', optionalAuth, createGym);
router.get('/:id', getGym);
router.patch('/:id', optionalAuth, updateGym);
router.delete('/:id', optionalAuth, deleteGym);
router.get('/:id/problems', getGymProblems);
router.post('/:id/problems', optionalAuth, createProblem);
router.patch('/:gymId/problems/:problemId', optionalAuth, updateProblem);

// 섹터 관리
router.get('/:id/sectors', listSectors);
router.post('/:id/sectors', optionalAuth, createSector);
router.patch('/:id/sectors/:sId', optionalAuth, updateSector);
router.delete('/:id/sectors/:sId', optionalAuth, deleteSector);

// 문제 교체 날짜 계산 (스케줄 기반)
router.get('/:id/resets', listResets);

// 교체 주기 스케줄 관리
router.get('/:id/schedules', listSchedules);
router.post('/:id/schedules', optionalAuth, createSchedule);
router.delete('/:id/schedules/:scheduleId', optionalAuth, deleteSchedule);

module.exports = router;
