const jwt = require('jsonwebtoken');

const DEFAULT_USER = { id: 1, nickname: '나' };

function isAuthEnabled() {
  return process.env.AUTH_ENABLED === 'true';
}

// 인증 필수 (auth/* 등 명시적 활성 라우트에만 사용)
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증 토큰이 필요합니다.', data: null });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? '토큰이 만료되었습니다.' : '유효하지 않은 토큰입니다.';
    return res.status(401).json({ success: false, message, data: null });
  }
}

// 옵셔널 인증 — AUTH_ENABLED=false일 때 디폴트 user 자동 주입
//  - true: 토큰 유효 시 req.user 주입, 없거나 무효면 401
//  - false: 토큰이 있으면 검증 시도(실패는 무시), 없으면 디폴트 user 주입
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      /* 토큰 무효는 무시 — 아래 분기에서 처리 */
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
