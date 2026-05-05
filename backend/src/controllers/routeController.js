const { sequelize } = require('../config/database');
const { ArRoute, User, Problem, Gym, Like, Bookmark, Comment } = require('../models');

const ROUTE_INCLUDE = [
  { model: User, as: 'author', attributes: ['id', 'nickname', 'profile_image'] },
  {
    model: Problem,
    as: 'problem',
    attributes: ['id', 'level', 'color', 'section'],
    include: [{ model: Gym, as: 'gym', attributes: ['id', 'name'] }],
  },
];

// GET /api/routes?problem_id=&gym_id=&user_id=|mine=&sort=latest|popular&bookmarked=&page=&limit=
async function listRoutes(req, res, next) {
  try {
    const {
      problem_id, gym_id, user_id, mine, bookmarked,
      sort = 'latest', page = 1, limit = 20,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (problem_id) where.problem_id = problem_id;

    // mine=true 또는 user_id=me → 본인 영상만
    if (mine === 'true' || user_id === 'me') {
      where.user_id = req.user?.id;
    } else if (user_id) {
      where.user_id = user_id;
    }

    // gym_id 필터: Problem include에 where 추가 (Sequelize 모델 참조는 복제하지 않고 spread로 복제)
    const include = ROUTE_INCLUDE.map((inc) => {
      if (inc.as === 'problem' && gym_id) {
        return {
          ...inc,
          where: { gym_id },
          required: true,
          include: inc.include?.map((sub) => ({ ...sub })),
        };
      }
      return inc;
    });

    // 본인 북마크 영상만
    let bookmarkInclude = null;
    if (bookmarked === 'true' && req.user?.id) {
      bookmarkInclude = {
        model: Bookmark,
        as: 'bookmarkers',
        through: { where: { user_id: req.user.id } },
        required: true,
        attributes: [],
      };
    }

    // 정렬
    const order = sort === 'popular'
      ? [['like_count', 'DESC'], ['created_at', 'DESC']]
      : [['created_at', 'DESC']];

    const queryInclude = bookmarkInclude ? [...include, bookmarkInclude] : include;

    const { count, rows } = await ArRoute.findAndCountAll({
      where,
      include: queryInclude,
      limit: parseInt(limit),
      offset,
      order,
      distinct: true,
    });

    return res.json({
      success: true,
      message: null,
      data: { total: count, page: parseInt(page), routes: rows },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/routes/:id
async function getRoute(req, res, next) {
  try {
    const route = await ArRoute.findByPk(req.params.id, { include: ROUTE_INCLUDE });
    if (!route) {
      return res.status(404).json({ success: false, message: '공략을 찾을 수 없습니다.', data: null });
    }

    // 조회수 증가 (비동기 처리, 응답 지연 없음)
    route.increment('view_count').catch(() => {});

    let isLiked = false;
    let isBookmarked = false;
    if (req.user) {
      const [like, bookmark] = await Promise.all([
        Like.findOne({ where: { user_id: req.user.id, ar_route_id: route.id } }),
        Bookmark.findOne({ where: { user_id: req.user.id, ar_route_id: route.id } }),
      ]);
      isLiked = !!like;
      isBookmarked = !!bookmark;
    }

    return res.json({
      success: true,
      message: null,
      data: { ...route.toJSON(), isLiked, isBookmarked },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/routes
async function createRoute(req, res, next) {
  try {
    const { title, description, problem_id, ar_data, tags } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: '영상 파일이 필요합니다.', data: null });
    }

    const video_url = `${process.env.MEDIA_BASE_URL}/${req.file.filename}`;

    const route = await ArRoute.create({
      user_id: req.user.id,
      problem_id: problem_id || null,
      title,
      description,
      video_url,
      ar_data: ar_data ? JSON.parse(ar_data) : null,
      tags: tags ? JSON.parse(tags) : null,
    });

    return res.status(201).json({ success: true, message: 'AR 공략이 등록되었습니다.', data: route });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/routes/:id
async function deleteRoute(req, res, next) {
  try {
    const route = await ArRoute.findByPk(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: '공략을 찾을 수 없습니다.', data: null });
    }
    if (route.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.', data: null });
    }

    await route.destroy();
    return res.json({ success: true, message: '공략이 삭제되었습니다.', data: null });
  } catch (err) {
    next(err);
  }
}

// POST /api/routes/:id/like  (토글)
async function toggleLike(req, res, next) {
  try {
    const routeId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await Like.findOne({ where: { user_id: userId, ar_route_id: routeId } });

    if (existing) {
      await existing.destroy();
      await ArRoute.decrement('like_count', { where: { id: routeId } });
      return res.json({ success: true, message: '좋아요를 취소했습니다.', data: { liked: false } });
    }

    await Like.create({ user_id: userId, ar_route_id: routeId });
    await ArRoute.increment('like_count', { where: { id: routeId } });
    return res.json({ success: true, message: '좋아요를 눌렀습니다.', data: { liked: true } });
  } catch (err) {
    next(err);
  }
}

// POST /api/routes/:id/bookmark  (토글)
async function toggleBookmark(req, res, next) {
  try {
    const routeId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await Bookmark.findOne({ where: { user_id: userId, ar_route_id: routeId } });

    if (existing) {
      await existing.destroy();
      return res.json({ success: true, message: '스크랩을 취소했습니다.', data: { bookmarked: false } });
    }

    await Bookmark.create({ user_id: userId, ar_route_id: routeId });
    return res.json({ success: true, message: '스크랩했습니다.', data: { bookmarked: true } });
  } catch (err) {
    next(err);
  }
}

// GET /api/routes/:id/comments
async function getComments(req, res, next) {
  try {
    const comments = await Comment.findAll({
      where: { ar_route_id: req.params.id },
      include: [{ model: User, as: 'author', attributes: ['id', 'nickname', 'profile_image'] }],
      order: [['created_at', 'ASC']],
    });
    return res.json({ success: true, message: null, data: { comments } });
  } catch (err) {
    next(err);
  }
}

// POST /api/routes/:id/comments
async function createComment(req, res, next) {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: '댓글 내용을 입력해주세요.', data: null });
    }

    const comment = await Comment.create({
      ar_route_id: req.params.id,
      user_id: req.user.id,
      content: content.trim(),
    });

    const withAuthor = await Comment.findByPk(comment.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'nickname', 'profile_image'] }],
    });

    return res.status(201).json({ success: true, message: '댓글이 등록되었습니다.', data: withAuthor });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRoutes, getRoute, createRoute, deleteRoute,
  toggleLike, toggleBookmark, getComments, createComment,
};
