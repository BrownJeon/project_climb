const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { imageUpload } = require('../middleware/upload');
const {
  getProfile, updateProfile,
  addMainGym, removeMainGym,
  getMyRoutes, getMyBookmarks, getMyLikes,
  followUser, unfollowUser,
  getFollowers, getFollowings,
} = require('../controllers/userController');

const router = Router();

// 마이페이지 (me/* 는 /:id 보다 먼저 등록)
router.get('/me/routes', optionalAuth, getMyRoutes);
router.get('/me/bookmarks', optionalAuth, getMyBookmarks);
router.get('/me/likes', optionalAuth, getMyLikes);
router.put('/me', optionalAuth, imageUpload.single('profile_image'), updateProfile);

// 주 암장 추가/제거 (07 마이페이지)
router.post('/me/main-gyms/:gymId', optionalAuth, addMainGym);
router.delete('/me/main-gyms/:gymId', optionalAuth, removeMainGym);

// 프로필 조회 (id='me' 가능)
router.get('/:id', optionalAuth, getProfile);

// 팔로우
router.post('/:id/follow', optionalAuth, followUser);
router.delete('/:id/follow', optionalAuth, unfollowUser);
router.get('/:id/followers', getFollowers);
router.get('/:id/followings', getFollowings);

module.exports = router;
