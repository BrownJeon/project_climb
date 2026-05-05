const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { listGyms, getGym, getGymProblems, createGym, createProblem, updateProblem } = require('../controllers/gymController');

const router = Router();

router.get('/', listGyms);
router.post('/', optionalAuth, createGym);
router.get('/:id', getGym);
router.get('/:id/problems', getGymProblems);
router.post('/:id/problems', optionalAuth, createProblem);
router.patch('/:gymId/problems/:problemId', optionalAuth, updateProblem);

module.exports = router;
