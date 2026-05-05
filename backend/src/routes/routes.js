const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { videoUpload } = require('../middleware/upload');
const {
  listRoutes, getRoute, createRoute, updateRoute, deleteRoute,
  toggleLike, toggleBookmark, getComments, createComment, updateComment, deleteComment,
} = require('../controllers/routeController');

const router = Router();

router.get('/', optionalAuth, listRoutes);
router.post('/', optionalAuth, videoUpload.single('video'), createRoute);
router.get('/:id', optionalAuth, getRoute);
router.put('/:id', optionalAuth, videoUpload.single('video'), updateRoute);
router.delete('/:id', optionalAuth, deleteRoute);
router.post('/:id/like', optionalAuth, toggleLike);
router.post('/:id/bookmark', optionalAuth, toggleBookmark);
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', optionalAuth, createComment);
router.patch('/:id/comments/:commentId', optionalAuth, updateComment);
router.delete('/:id/comments/:commentId', optionalAuth, deleteComment);

module.exports = router;
