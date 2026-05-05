const { Op } = require('sequelize');
const { Gym, Problem, ArRoute, sequelize } = require('../models');

// GET /api/gyms?lat=&lng=&radius=&q=&page=&include_recent_routes=true
async function listGyms(req, res, next) {
  try {
    const { lat, lng, q, page = 1, limit = 20, include_recent_routes } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { brand: { [Op.like]: `%${q}%` } },
        { branch: { [Op.like]: `%${q}%` } },
      ];
    }

    if (lat && lng) {
      const radius = parseFloat(req.query.radius) || 5;
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos((parseFloat(lat) * Math.PI) / 180));
      where.lat = { [Op.between]: [parseFloat(lat) - latDelta, parseFloat(lat) + latDelta] };
      where.lng = { [Op.between]: [parseFloat(lng) - lngDelta, parseFloat(lng) + lngDelta] };
    }

    // ids 파라미터 (콤마 구분) — 주 암장/최근 방문 등 클라이언트 필터에 사용
    if (req.query.ids) {
      const idsArr = String(req.query.ids).split(',').map((s) => parseInt(s, 10)).filter(Boolean);
      if (idsArr.length === 0) {
        return res.json({ success: true, message: null, data: { total: 0, page: parseInt(page), gyms: [] } });
      }
      where.id = { [Op.in]: idsArr };
    }

    const { count, rows } = await Gym.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']],
    });

    const gymsJson = rows.map((g) => g.toJSON());

    // 최근 영상 미리보기·route_count 첨부
    if (include_recent_routes === 'true' && gymsJson.length) {
      const gymIds = gymsJson.map((g) => g.id);
      // 1) gym 별 ar_routes count
      const [counts] = await sequelize.query(
        `SELECT p.gym_id AS gym_id, COUNT(r.id) AS cnt
           FROM ar_routes r JOIN problems p ON r.problem_id = p.id
          WHERE p.gym_id IN (:ids) GROUP BY p.gym_id`,
        { replacements: { ids: gymIds } }
      );
      const countMap = {};
      counts.forEach((c) => { countMap[c.gym_id] = parseInt(c.cnt, 10); });

      // 2) 각 gym 별 최근 영상 3건
      const recentByGym = {};
      const gymsWithRoutes = await ArRoute.findAll({
        include: [{
          model: Problem, as: 'problem',
          where: { gym_id: { [Op.in]: gymIds } },
          attributes: ['id', 'gym_id', 'level', 'color'],
          required: true,
        }],
        attributes: ['id', 'title', 'video_url', 'thumbnail_url', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 200,
      });
      for (const r of gymsWithRoutes) {
        const gid = r.problem?.gym_id;
        if (!gid) continue;
        if (!recentByGym[gid]) recentByGym[gid] = [];
        if (recentByGym[gid].length < 3) {
          recentByGym[gid].push({
            id: r.id,
            title: r.title,
            video_url: r.video_url,
            thumbnail_url: r.thumbnail_url,
            color: r.problem?.color,
            level: r.problem?.level,
          });
        }
      }
      gymsJson.forEach((g) => {
        g.route_count = countMap[g.id] || 0;
        g.recent_routes = recentByGym[g.id] || [];
      });
    }

    // 영상 난이도(color/level)별 집계 + 사용자별 최근 방문일
    if (req.query.include_summary === 'true' && gymsJson.length) {
      const gymIds = gymsJson.map((g) => g.id);
      const [breakdown] = await sequelize.query(
        `SELECT p.gym_id, p.color, p.level, COUNT(r.id) AS cnt
           FROM ar_routes r JOIN problems p ON r.problem_id = p.id
          WHERE p.gym_id IN (:ids)
          GROUP BY p.gym_id, p.color, p.level
          ORDER BY p.gym_id ASC, p.level ASC, p.color ASC`,
        { replacements: { ids: gymIds } }
      );
      const byGym = {};
      let total = {};
      breakdown.forEach((b) => {
        if (!byGym[b.gym_id]) byGym[b.gym_id] = [];
        byGym[b.gym_id].push({ color: b.color, level: b.level, count: parseInt(b.cnt, 10) });
        total[b.gym_id] = (total[b.gym_id] || 0) + parseInt(b.cnt, 10);
      });

      let lastVisitedMap = {};
      if (req.user?.id) {
        const [visits] = await sequelize.query(
          `SELECT gym_id, MAX(visited_at) AS last_visited
             FROM climb_logs
            WHERE user_id = :uid AND gym_id IN (:ids)
            GROUP BY gym_id`,
          { replacements: { uid: req.user.id, ids: gymIds } }
        );
        visits.forEach((v) => { lastVisitedMap[v.gym_id] = v.last_visited; });
      }

      gymsJson.forEach((g) => {
        g.routes_breakdown = byGym[g.id] || [];
        if (g.route_count == null) g.route_count = total[g.id] || 0;
        g.last_visited_at = lastVisitedMap[g.id] || null;
      });
    }

    return res.json({
      success: true,
      message: null,
      data: { total: count, page: parseInt(page), gyms: gymsJson },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/gyms/:id
async function getGym(req, res, next) {
  try {
    const gym = await Gym.findByPk(req.params.id);
    if (!gym) {
      return res.status(404).json({ success: false, message: '클라이밍장을 찾을 수 없습니다.', data: null });
    }
    return res.json({ success: true, message: null, data: gym });
  } catch (err) {
    next(err);
  }
}

// GET /api/gyms/:id/problems?active=true&color=
async function getGymProblems(req, res, next) {
  try {
    const where = { gym_id: req.params.id };
    if (req.query.active === 'true') where.is_active = true;
    if (req.query.color) where.color = req.query.color;

    const problems = await Problem.findAll({
      where,
      order: [['level', 'ASC'], ['color', 'ASC']],
    });

    return res.json({ success: true, message: null, data: { problems } });
  } catch (err) {
    next(err);
  }
}

// POST /api/gyms (관리자용 - 추후 권한 분리)
async function createGym(req, res, next) {
  try {
    const { brand, branch, name: nameInput, address, lat, lng, phone, hours, price_info } = req.body;
    const finalBrand = (brand || '').trim() || null;
    const finalBranch = (branch || '').trim() || null;
    if (!finalBrand && !nameInput) {
      return res.status(400).json({ success: false, data: null, message: '암장명(brand)이 필요합니다.' });
    }
    const composedName = finalBrand
      ? (finalBranch ? `${finalBrand} ${finalBranch}` : finalBrand)
      : nameInput;
    const gym = await Gym.create({
      name: composedName,
      brand: finalBrand,
      branch: finalBranch,
      address: address || '', lat, lng, phone, hours, price_info,
    });
    return res.status(201).json({ success: true, message: '클라이밍장이 등록되었습니다.', data: gym });
  } catch (err) {
    next(err);
  }
}

// POST /api/gyms/:id/problems
async function createProblem(req, res, next) {
  try {
    const gym = await Gym.findByPk(req.params.id);
    if (!gym) {
      return res.status(404).json({ success: false, message: '클라이밍장을 찾을 수 없습니다.', data: null });
    }

    const { level, color, section } = req.body;
    const problem = await Problem.create({ gym_id: gym.id, level, color, section });
    return res.status(201).json({ success: true, message: '문제가 등록되었습니다.', data: problem });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/gyms/:gymId/problems/:problemId  (세팅 종료 등 상태 변경)
async function updateProblem(req, res, next) {
  try {
    const problem = await Problem.findOne({
      where: { id: req.params.problemId, gym_id: req.params.gymId },
    });
    if (!problem) {
      return res.status(404).json({ success: false, message: '문제를 찾을 수 없습니다.', data: null });
    }

    const { level, color, section, is_active } = req.body;
    const updates = {};
    if (level !== undefined) updates.level = level;
    if (color !== undefined) updates.color = color;
    if (section !== undefined) updates.section = section;
    if (is_active !== undefined) updates.is_active = is_active;

    await problem.update(updates);
    return res.json({ success: true, message: '문제가 수정되었습니다.', data: problem });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/gyms/:id
async function updateGym(req, res, next) {
  try {
    const gym = await Gym.findByPk(req.params.id);
    if (!gym) {
      return res.status(404).json({ success: false, message: '클라이밍장을 찾을 수 없습니다.', data: null });
    }
    const { brand, branch, name, address, lat, lng, phone, hours, price_info } = req.body;
    const updates = {};
    let nextBrand = gym.brand;
    let nextBranch = gym.branch;
    if (brand !== undefined) { updates.brand = (brand || '').trim() || null; nextBrand = updates.brand; }
    if (branch !== undefined) { updates.branch = (branch || '').trim() || null; nextBranch = updates.branch; }
    if (brand !== undefined || branch !== undefined) {
      updates.name = nextBrand
        ? (nextBranch ? `${nextBrand} ${nextBranch}` : nextBrand)
        : (name || gym.name);
    } else if (name !== undefined) {
      updates.name = name;
    }
    if (address !== undefined) updates.address = address || null;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;
    if (phone !== undefined) updates.phone = phone || null;
    if (hours !== undefined) updates.hours = hours || null;
    if (price_info !== undefined) updates.price_info = price_info || null;

    await gym.update(updates);
    return res.json({ success: true, data: gym, message: '클라이밍장이 수정되었습니다.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/gyms/:id
async function deleteGym(req, res, next) {
  try {
    const gym = await Gym.findByPk(req.params.id);
    if (!gym) {
      return res.status(404).json({ success: false, message: '클라이밍장을 찾을 수 없습니다.', data: null });
    }
    await gym.destroy();
    return res.json({ success: true, data: null, message: '클라이밍장이 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listGyms, getGym, getGymProblems, createGym, updateGym, deleteGym, createProblem, updateProblem };
