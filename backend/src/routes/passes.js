const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { listPasses, createPass, usePass, deletePass, updatePass, pausePass, resumePass } = require('../controllers/gymPassController');

const router = Router();

router.get('/', optionalAuth, listPasses);
router.post('/', optionalAuth, createPass);
router.patch('/:id', optionalAuth, updatePass);
router.post('/:id/use', optionalAuth, usePass);
router.post('/:id/pause', optionalAuth, pausePass);
router.post('/:id/resume', optionalAuth, resumePass);
router.delete('/:id', optionalAuth, deletePass);

module.exports = router;
