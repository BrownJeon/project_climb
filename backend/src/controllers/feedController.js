const { Op } = require('sequelize');
const { ArRoute, User, Problem, Gym, Follow } = require('../models');

const FEED_INCLUDE = [
  { model: User, as: 'author', attributes: ['id', 'nickname', 'profile_image'] },
  {
    model: Problem,
    as: 'problem',
    attributes: ['id', 'level', 'color'],
    include: [{ model: Gym, as: 'gym', attributes: ['id', 'name'] }],
  },
];

// GET /api/feed  (팔로우 피드)
async function getFeed(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 팔로잉 중인 사용자 ID 목록
    const follows = await Follow.findAll({
      where: { follower_id: req.user.id },
      attributes: ['following_id'],
    });
    const followingIds = follows.map((f) => f.following_id);

    // 팔로잉이 없으면 인기 피드(전체)로 대체
    const where = followingIds.length > 0
      ? { user_id: { [Op.in]: followingIds } }
      : {};

    const { count, rows } = await ArRoute.findAndCountAll({
      where,
      include: FEED_INCLUDE,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return res.json({
      success: true,
      message: null,
      data: {
        total: count,
        page,
        isFallback: followingIds.length === 0,
        routes: rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/feed/popular  (인기 공략 피드)
async function getPopularFeed(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const routes = await ArRoute.findAll({
      include: FEED_INCLUDE,
      limit,
      order: [
        ['like_count', 'DESC'],
        ['view_count', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    return res.json({ success: true, message: null, data: { routes } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getFeed, getPopularFeed };
