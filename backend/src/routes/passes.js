const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { listPasses, createPass, usePass, deletePass, updatePass } = require('../controllers/gymPassController');

const router = Router();

router.get('/', optionalAuth, listPasses);
router.post('/', optionalAuth, createPass);
router.patch('/:id', optionalAuth, updatePass);
router.post('/:id/use', optionalAuth, usePass);
router.delete('/:id', optionalAuth, deletePass);

module.exports = router;
