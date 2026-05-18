const { User, Follow, ArRoute, Gym, Problem, UserMainGym, ClimbLogProblem, Like, Bookmark, sequelize } = require('../models');

// helper: route 객체에 climb_attempts에서 cleared/attempts 평탄화
function attachAttemptSummary(routes) {
  return routes.map((r) => {
    const json = typeof r.toJSON === 'function' ? r.toJSON() : { ...r };
    const attempts = json.climb_attempts || [];
    let cleared = null;
    let attemptCount = null;
    if (attempts.length) {
      cleared = attempts.some((a) => a.is_cleared);
      attemptCount = attempts.reduce((s, a) => s + (a.attempts || 0), 0) || null;
    }
    json.cleared = cleared;
    json.attempts = attemptCount;
    delete json.climb_attempts;
    return json;
  });
}

// GET /api/users/:id  (id='me' 가능)
async function getProfile(req, res, next) {
  try {
    const idParam = req.params.id === 'me' ? req.user?.id : req.params.id;
    const user = await User.findByPk(idParam, {
      attributes: { exclude: ['sns_id'] },
      include: [
        { model: Gym, as: 'main_gyms', attributes: ['id', 'name'], through: { attributes: [] } },
        { model: Gym, as: 'max_level_gym', attributes: ['id', 'name'] },
      ],
    });
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.', data: null });
    }

    const [followerCount, followingCount, routeCount] = await Promise.all([
      Follow.count({ where: { following_id: user.id } }),
      Follow.count({ where: { follower_id: user.id } }),
      ArRoute.count({ where: { user_id: user.id } }),
    ]);

    let isFollowing = false;
    if (req.user && req.user.id !== user.id) {
      const follow = await Follow.findOne({
        where: { follower_id: req.user.id, following_id: user.id },
      });
      isFollowing = !!follow;
    }

    return res.json({
      success: true,
      message: null,
      data: { ...user.toJSON(), followerCount, followingCount, routeCount, isFollowing },
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/me
async function updateProfile(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const {
      nickname, bio, max_level,
      max_level_color, max_level_grade, max_level_gym_id,
      climbing_started_at, main_gym_ids, main_gym_id,
    } = req.body;

    const user = await User.findByPk(req.user.id, { transaction: t });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ success: false, message: '사용자 없음', data: null });
    }

    const updates = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (bio !== undefined) updates.bio = bio;
    if (max_level !== undefined) updates.max_level = max_level;
    if (main_gym_id !== undefined) updates.main_gym_id = main_gym_id || null;
    if (req.file) updates.profile_image = `${process.env.MEDIA_BASE_URL}/${req.file.filename}`;

    // 신규 컬럼 (07 마이페이지)
    if (max_level_color !== undefined) updates.max_level_color = max_level_color || null;
    if (max_level_grade !== undefined) updates.max_level_grade = max_level_grade || null;
    if (max_level_gym_id !== undefined) {
      const v = max_level_gym_id === '' ? null : max_level_gym_id;
      if (v !== null) {
        const exists = await Gym.findByPk(v, { transaction: t });
        if (!exists) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'max_level_gym_id 유효하지 않음', data: null });
        }
      }
      updates.max_level_gym_id = v;
    }
    if (climbing_started_at !== undefined) {
      const v = climbing_started_at === '' ? null : climbing_started_at;
      if (v) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const sd = new Date(v); sd.setHours(0, 0, 0, 0);
        if (sd > today) {
          await t.rollback();
          return res.status(400).json({ success: false, message: '클라이밍 시작일은 오늘 이전이어야 합니다.', data: null });
        }
      }
      updates.climbing_started_at = v;
    }

    await user.update(updates, { transaction: t });

    // main_gym_ids 처리 (복수 주 암장)
    if (main_gym_ids !== undefined) {
      let ids = main_gym_ids;
      if (typeof ids === 'string') {
        try { ids = JSON.parse(ids); } catch { ids = []; }
      }
      if (!Array.isArray(ids)) ids = [];
      ids = [...new Set(ids.map(Number).filter(Boolean))];

      if (ids.length) {
        const gyms = await Gym.findAll({ where: { id: ids }, transaction: t });
        if (gyms.length !== ids.length) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'main_gym_ids에 존재하지 않는 암장이 포함됨', data: null });
        }
      }

      await UserMainGym.destroy({ where: { user_id: req.user.id }, transaction: t });
      if (ids.length) {
        await UserMainGym.bulkCreate(
          ids.map((gid, i) => ({ user_id: req.user.id, gym_id: gid, sort_order: i })),
          { transaction: t }
        );
      }
    }

    await t.commit();

    // 갱신 후 응답: getProfile 형태로 반환
    const updated = await User.findByPk(req.user.id, {
      attributes: { exclude: ['sns_id'] },
      include: [
        { model: Gym, as: 'main_gyms', attributes: ['id', 'name'], through: { attributes: [] } },
        { model: Gym, as: 'max_level_gym', attributes: ['id', 'name'] },
      ],
    });
    return res.json({ success: true, message: '프로필이 수정되었습니다.', data: updated });
  } catch (err) {
    await t.rollback().catch(() => {});
    next(err);
  }
}

// POST /api/users/me/main-gyms/:gymId  (개별 추가)
async function addMainGym(req, res, next) {
  try {
    const gymId = parseInt(req.params.gymId, 10);
    const exists = await Gym.findByPk(gymId);
    if (!exists) return res.status(404).json({ success: false, message: '암장 없음', data: null });

    const max = await UserMainGym.max('sort_order', { where: { user_id: req.user.id } });
    await UserMainGym.findOrCreate({
      where: { user_id: req.user.id, gym_id: gymId },
      defaults: { sort_order: (max ?? -1) + 1 },
    });

    const main_gyms = await Gym.findAll({
      include: [{ model: User, as: 'main_gym_users', where: { id: req.user.id }, attributes: [], through: { attributes: ['sort_order'] } }],
      attributes: ['id', 'name'],
    });
    return res.json({ success: true, message: '주 암장에 추가되었습니다.', data: { main_gyms } });
  } catch (err) { next(err); }
}

// DELETE /api/users/me/main-gyms/:gymId
async function removeMainGym(req, res, next) {
  try {
    const gymId = parseInt(req.params.gymId, 10);
    await UserMainGym.destroy({ where: { user_id: req.user.id, gym_id: gymId } });
    const main_gyms = await Gym.findAll({
      include: [{ model: User, as: 'main_gym_users', where: { id: req.user.id }, attributes: [], through: { attributes: [] } }],
      attributes: ['id', 'name'],
    });
    return res.json({ success: true, message: '주 암장에서 제거되었습니다.', data: { main_gyms } });
  } catch (err) { next(err); }
}

// GET /api/users/me/routes
async function getMyRoutes(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await ArRoute.findAndCountAll({
      where: { user_id: req.user.id },
      limit,
      offset,
      order: [['created_at', 'DESC']],
      distinct: true,
      include: [
        {
          model: Problem, as: 'problem',
          attributes: ['id', 'color', 'level', 'gym_id'],
          include: [{ model: Gym, as: 'gym', attributes: ['id', 'name'] }],
        },
        {
          model: ClimbLogProblem, as: 'climb_attempts',
          attributes: ['id', 'is_cleared', 'attempts'],
          required: false,
        },
      ],
    });

    const summaryRows = attachAttemptSummary(rows);
    const ids = rows.map((r) => r.id);
    let likedSet = new Set();
    let bookmarkedSet = new Set();
    if (ids.length > 0) {
      const [likes, bookmarks] = await Promise.all([
        Like.findAll({ where: { user_id: req.user.id, ar_route_id: ids }, attributes: ['ar_route_id'] }),
        Bookmark.findAll({ where: { user_id: req.user.id, ar_route_id: ids }, attributes: ['ar_route_id'] }),
      ]);
      likedSet = new Set(likes.map((l) => l.ar_route_id));
      bookmarkedSet = new Set(bookmarks.map((b) => b.ar_route_id));
    }
    const routesWithFlags = summaryRows.map((r) => ({
      ...r,
      isLiked: likedSet.has(r.id),
      isBookmarked: bookmarkedSet.has(r.id),
    }));

    return res.json({
      success: true,
      message: null,
      data: { total: count, page, routes: routesWithFlags },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/me/bookmarks
async function getMyBookmarks(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const user = await User.findByPk(req.user.id);
    const routes = await user.getBookmarkedRoutes({
      limit,
      offset,
      order: [['created_at', 'DESC']],
      joinTableAttributes: [],
      include: [
        {
          model: Problem, as: 'problem',
          attributes: ['id', 'color', 'level', 'gym_id'],
          include: [{ model: Gym, as: 'gym', attributes: ['id', 'name'] }],
        },
        {
          model: ClimbLogProblem, as: 'climb_attempts',
          attributes: ['id', 'is_cleared', 'attempts'],
          required: false,
        },
      ],
    });

    const summaryRoutes = attachAttemptSummary(routes);
    const ids = routes.map((r) => r.id);
    let likedSet = new Set();
    if (ids.length > 0) {
      const likes = await Like.findAll({ where: { user_id: req.user.id, ar_route_id: ids }, attributes: ['ar_route_id'] });
      likedSet = new Set(likes.map((l) => l.ar_route_id));
    }
    const routesWithFlags = summaryRoutes.map((r) => ({
      ...r,
      isLiked: likedSet.has(r.id),
      isBookmarked: true,
    }));

    return res.json({ success: true, message: null, data: { routes: routesWithFlags } });
  } catch (err) {
    next(err);
  }
}

// POST /api/users/:id/follow
async function followUser(req, res, next) {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.id === targetId) {
      return res.status(400).json({ success: false, message: '자신을 팔로우할 수 없습니다.', data: null });
    }

    const target = await User.findByPk(targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.', data: null });
    }

    const [, created] = await Follow.findOrCreate({
      where: { follower_id: req.user.id, following_id: targetId },
    });

    return res.json({
      success: true,
      message: created ? '팔로우했습니다.' : '이미 팔로우 중입니다.',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id/follow
async function unfollowUser(req, res, next) {
  try {
    const deleted = await Follow.destroy({
      where: { follower_id: req.user.id, following_id: req.params.id },
    });

    return res.json({
      success: true,
      message: deleted ? '언팔로우했습니다.' : '팔로우 상태가 아닙니다.',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/me/likes
async function getMyLikes(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const user = await User.findByPk(req.user.id);
    const routes = await user.getLikedRoutes({
      limit,
      offset,
      order: [['created_at', 'DESC']],
      joinTableAttributes: [],
    });

    return res.json({ success: true, message: null, data: { routes } });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id/followers
async function getFollowers(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.', data: null });
    }

    const followers = await user.getFollowers({
      attributes: ['id', 'nickname', 'profile_image', 'max_level'],
      limit,
      offset,
      joinTableAttributes: [],
    });

    return res.json({ success: true, message: null, data: { followers } });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id/followings
async function getFollowings(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.', data: null });
    }

    const followings = await user.getFollowings({
      attributes: ['id', 'nickname', 'profile_image', 'max_level'],
      limit,
      offset,
      joinTableAttributes: [],
    });

    return res.json({ success: true, message: null, data: { followings } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile, updateProfile,
  addMainGym, removeMainGym,
  getMyRoutes, getMyBookmarks, getMyLikes,
  followUser, unfollowUser,
  getFollowers, getFollowings,
};
