const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { listPasses, createPass, usePass, deletePass } = require('../controllers/gymPassController');

const router = Router();

router.get('/', optionalAuth, listPasses);
router.post('/', optionalAuth, createPass);
router.post('/:id/use', optionalAuth, usePass);
router.delete('/:id', optionalAuth, deletePass);

module.exports = router;
