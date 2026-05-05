const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { sessionUpload } = require('../middleware/upload');
const { createSession } = require('../controllers/sessionController');

const router = Router();
router.post('/', optionalAuth, sessionUpload.any(), createSession);

module.exports = router;
