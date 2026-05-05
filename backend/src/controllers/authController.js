const jwt = require('jsonwebtoken');
const axios = require('axios');
const { User } = require('../models');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

// POST /api/auth/sns
// body: { provider: 'kakao'|'google', accessToken: string }
async function snsLogin(req, res, next) {
  try {
    const { provider, accessToken } = req.body;
    if (!provider || !accessToken) {
      return res.status(400).json({ success: false, message: 'provider와 accessToken이 필요합니다.', data: null });
    }

    let snsId, email, nickname, profileImage;

    if (provider === 'kakao') {
      const { data } = await axios.get('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      snsId = String(data.id);
      email = data.kakao_account?.email || null;
      nickname = data.kakao_account?.profile?.nickname || `클라이머_${snsId.slice(-4)}`;
      profileImage = data.kakao_account?.profile?.profile_image_url || null;

    } else if (provider === 'google') {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      snsId = data.sub;
      email = data.email || null;
      nickname = data.name || `클라이머_${snsId.slice(-4)}`;
      profileImage = data.picture || null;

    } else {
      return res.status(400).json({ success: false, message: '지원하지 않는 provider입니다.', data: null });
    }

    const [user, created] = await User.findOrCreate({
      where: { sns_provider: provider, sns_id: snsId },
      defaults: { email, nickname, profile_image: profileImage },
    });

    const token = signToken({ id: user.id, nickname: user.nickname });

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? '회원가입 완료' : '로그인 완료',
      data: { token, user: { id: user.id, nickname: user.nickname, profile_image: user.profile_image } },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
// body: { token: string }
async function refreshToken(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'token이 필요합니다.', data: null });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    } catch {
      return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.', data: null });
    }

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다.', data: null });
    }

    const newToken = signToken({ id: user.id, nickname: user.nickname });
    return res.json({ success: true, message: '토큰 갱신 완료', data: { token: newToken } });
  } catch (err) {
    next(err);
  }
}

module.exports = { snsLogin, refreshToken };
