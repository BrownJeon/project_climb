const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET  = process.env.JWT_SECRET  || 'theroute-dev-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '30d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { email, password, nickname } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ success: false, data: null, message: '이메일과 비밀번호를 입력해주세요.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, data: null, message: '비밀번호는 6자 이상이어야 합니다.' });
    }
    const norm = email.toLowerCase().trim();
    const exists = await User.findOne({ where: { email: norm } });
    if (exists) {
      return res.status(409).json({ success: false, data: null, message: '이미 가입된 이메일입니다.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: norm,
      password: hash,
      nickname: nickname?.trim() || `클라이머_${Date.now().toString().slice(-4)}`,
      sns_provider: 'local',
      sns_id: norm,
    });
    const token = signToken({ id: user.id, nickname: user.nickname });
    return res.status(201).json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, nickname: user.nickname } },
      message: '회원가입 완료',
    });
  } catch (err) { next(err); }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ success: false, data: null, message: '이메일과 비밀번호를 입력해주세요.' });
    }
    const norm = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: norm } });
    if (!user || !user.password) {
      return res.status(401).json({ success: false, data: null, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, data: null, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const token = signToken({ id: user.id, nickname: user.nickname });
    return res.json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, nickname: user.nickname } },
      message: '로그인 완료',
    });
  } catch (err) { next(err); }
}

// GET /api/auth/me  (requires authenticate middleware)
async function me(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'nickname', 'profile_image'],
    });
    if (!user) return res.status(404).json({ success: false, data: null, message: '사용자를 찾을 수 없습니다.' });
    return res.json({ success: true, data: user, message: '' });
  } catch (err) { next(err); }
}

// POST /api/auth/refresh
async function refreshToken(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, data: null, message: 'token이 필요합니다.' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    } catch {
      return res.status(401).json({ success: false, data: null, message: '유효하지 않은 토큰입니다.' });
    }
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, data: null, message: '사용자를 찾을 수 없습니다.' });
    }
    const newToken = signToken({ id: user.id, nickname: user.nickname });
    return res.json({ success: true, data: { token: newToken }, message: '토큰 갱신 완료' });
  } catch (err) { next(err); }
}

// OAuth findOrCreateUser — @workspace/auth-oauth 어댑터용
// { provider, providerId, email, name, avatar } → User instance (id, email 필수)
async function findOrCreateUser({ provider, providerId, email, name, avatar }) {
  const norm = email.toLowerCase().trim();

  // 1. 같은 OAuth 계정 찾기
  let user = await User.findOne({ where: { sns_provider: provider, sns_id: providerId } });
  if (user) return user;

  // 2. 같은 이메일 계정 연결
  user = await User.findOne({ where: { email: norm } });
  if (user) {
    if (!user.sns_provider || user.sns_provider === 'local') {
      await user.update({ sns_provider: provider, sns_id: providerId, profile_image: avatar || user.profile_image });
    }
    return user;
  }

  // 3. 신규 생성
  return User.create({
    email: norm,
    nickname: name || `클라이머_${providerId.slice(-4)}`,
    profile_image: avatar || null,
    sns_provider: provider,
    sns_id: providerId,
  });
}

module.exports = { register, login, me, refreshToken, findOrCreateUser };
