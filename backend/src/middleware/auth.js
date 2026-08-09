const jwt = require('jsonwebtoken');

const DEFAULT_USER = { id: 1, nickname: '나' };

function isAuthEnabled() {
  return process.env.AUTH_ENABLED === 'true';
}

// 이메일 토큰: { id, nickname }
// OAuth 토큰: { userId, email }   ← @workspace/auth-oauth 어댑터가 서명
// 두 형식 모두 req.user.id 로 정규화
function decodeToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return { ...decoded, id: decoded.id ?? decoded.userId };
}

// 인증 필수
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증 토큰이 필요합니다.', data: null });
  }
  try {
    req.user = decodeToken(header.split(' ')[1]);
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? '토큰이 만료되었습니다.' : '유효하지 않은 토큰입니다.';
    return res.status(401).json({ success: false, message, data: null });
  }
}

// 옵셔널 인증 — AUTH_ENABLED=false일 때 디폴트 user 자동 주입
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = decodeToken(header.split(' ')[1]);
    } catch {
      /* 토큰 무효는 무시 */
    }
  }

  if (!req.user) {
    if (isAuthEnabled()) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.', data: null });
    }
    req.user = { ...DEFAULT_USER };
  }
  next();
}

module.exports = { authenticate, optionalAuth, isAuthEnabled, DEFAULT_USER };
