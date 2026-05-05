const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');

const router = Router();

function isKeySet() {
  const k = process.env.KAKAO_REST_API_KEY;
  return !!k && !k.startsWith('your_');
}

router.get('/status', optionalAuth, (req, res) => {
  res.json({ success: true, data: { kakao_enabled: isKeySet() }, message: null });
});

// GET /api/geo/search?q=더클라임 강남
// 카카오 Local 키워드 검색 (장소명·상호명·지명)
router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: { results: [] }, message: null });

    if (!isKeySet()) {
      return res.status(503).json({
        success: false,
        message: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다. backend/.env에 카카오 디벨로퍼스에서 발급한 REST API 키를 등록해 주세요.',
        data: null,
      });
    }

    const params = new URLSearchParams({ query: q, size: '10' });
    if (req.query.lat && req.query.lng) {
      params.set('y', String(req.query.lat));
      params.set('x', String(req.query.lng));
      params.set('radius', '20000');
    }
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;
    const r = await fetch(url, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return res.status(r.status).json({
        success: false,
        message: `카카오 API ${r.status} ${txt.slice(0, 200)}`,
        data: null,
      });
    }
    const data = await r.json();
    const results = (data.documents || []).map((d) => ({
      id: d.id,
      place_name: d.place_name,
      category_name: d.category_name,
      address_name: d.address_name,
      road_address_name: d.road_address_name,
      phone: d.phone,
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
    }));
    return res.json({ success: true, data: { results }, message: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/geo/backfill-gym-coords — 좌표 누락 암장에 카카오 주소 검색으로 lat/lng 채움
router.post('/backfill-gym-coords', optionalAuth, async (req, res, next) => {
  try {
    if (!isKeySet()) {
      return res.status(503).json({ success: false, message: 'KAKAO_REST_API_KEY 미설정', data: null });
    }
    const { Gym } = require('../models');
    const { Op } = require('sequelize');
    const gyms = await Gym.findAll({
      where: {
        [Op.or]: [{ lat: null }, { lng: null }],
        address: { [Op.ne]: null },
      },
      limit: 200,
    });
    let updated = 0;
    let skipped = 0;
    for (const g of gyms) {
      try {
        const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(g.address)}`;
        const r = await fetch(url, { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } });
        if (!r.ok) { skipped++; continue; }
        const data = await r.json();
        const doc = data.documents?.[0];
        if (!doc) { skipped++; continue; }
        await g.update({ lat: parseFloat(doc.y), lng: parseFloat(doc.x) });
        updated++;
      } catch { skipped++; }
    }
    res.json({ success: true, data: { updated, skipped, total: gyms.length }, message: `보강 완료: ${updated}건` });
  } catch (err) {
    next(err);
  }
});

// 시작 시 자동 1회 실행용 (export 별도)
async function backfillGymCoordsOnce() {
  if (!isKeySet()) return;
  try {
    const { Gym } = require('../models');
    const { Op } = require('sequelize');
    const gyms = await Gym.findAll({
      where: {
        [Op.or]: [{ lat: null }, { lng: null }],
        address: { [Op.ne]: null },
      },
      limit: 200,
    });
    if (!gyms.length) return;
    let updated = 0;
    for (const g of gyms) {
      try {
        const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(g.address)}`;
        const r = await fetch(url, { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } });
        if (!r.ok) continue;
        const data = await r.json();
        const doc = data.documents?.[0];
        if (!doc) continue;
        await g.update({ lat: parseFloat(doc.y), lng: parseFloat(doc.x) });
        updated++;
      } catch {}
    }
    if (updated > 0) {
      console.log(`[geo] 부팅 시 암장 좌표 자동 보강: ${updated}/${gyms.length}건`);
    }
  } catch (e) {
    console.warn('[geo] backfillGymCoordsOnce 실패:', e.message);
  }
}

module.exports = router;
module.exports.backfillGymCoordsOnce = backfillGymCoordsOnce;
