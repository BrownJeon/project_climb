const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { listGyms, getGym, getGymProblems, createGym, updateGym, deleteGym, createProblem, updateProblem } = require('../controllers/gymController');

const router = Router();

router.get('/', optionalAuth, listGyms);
router.post('/', optionalAuth, createGym);
router.get('/:id', getGym);
router.patch('/:id', optionalAuth, updateGym);
router.delete('/:id', optionalAuth, deleteGym);
router.get('/:id/problems', getGymProblems);
router.post('/:id/problems', optionalAuth, createProblem);
router.patch('/:gymId/problems/:problemId', optionalAuth, updateProblem);

module.exports = router;
