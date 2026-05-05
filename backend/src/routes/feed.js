const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { getFeed, getPopularFeed } = require('../controllers/feedController');

const router = Router();

router.get('/', optionalAuth, getFeed);
router.get('/popular', getPopularFeed);

module.exports = router;
