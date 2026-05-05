const { Router } = require('express');
const { snsLogin, refreshToken } = require('../controllers/authController');

const router = Router();

router.post('/sns', snsLogin);
router.post('/refresh', refreshToken);

module.exports = router;
