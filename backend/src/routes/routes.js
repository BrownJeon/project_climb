const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { videoUpload } = require('../middleware/upload');
const {
  listRoutes, getRoute, createRoute, deleteRoute,
  toggleLike, toggleBookmark, getComments, createComment,
} = require('../controllers/routeController');

const router = Router();

router.get('/', optionalAuth, listRoutes);
router.post('/', optionalAuth, videoUpload.single('video'), createRoute);
router.get('/:id', optionalAuth, getRoute);
router.delete('/:id', optionalAuth, deleteRoute);
router.post('/:id/like', optionalAuth, toggleLike);
router.post('/:id/bookmark', optionalAuth, toggleBookmark);
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', optionalAuth, createComment);

module.exports = router;
