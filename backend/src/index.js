// .env는 backend/ 하위에 위치 — pm2 cwd가 프로젝트 루트라도 항상 backend/.env를 로드
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { connectDB, sequelize } = require('./config/database');
const { setupDB } = require('./config/setupDB');
require('./models'); // 연관관계 등록

const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3100;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 업로드 파일 정적 서빙 (NAS 경로 또는 로컬)
const uploadPath = process.env.MEDIA_UPLOAD_PATH || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadPath));

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'TheRoute API is running', data: { env: process.env.NODE_ENV } });
});

// API 라우터
// auth 라우트는 인증 모드일 때만 마운트
if (process.env.AUTH_ENABLED === 'true') {
  app.use('/api/auth', require('./routes/auth'));
}
app.use('/api/users', require('./routes/users'));
app.use('/api/gyms', require('./routes/gyms'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/feed', require('./routes/feed'));
app.use('/api/climb-logs', require('./routes/climb-logs'));
app.use('/api/passes', require('./routes/passes'));
app.use('/api/training', require('./routes/training'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/geo', require('./routes/geo'));

// SPA 정적 서빙 (Phase 11 — web/dist 존재 시 자동 활성)
const distDir = path.join(__dirname, '../../web/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  // 앱(Android APK) 로그인 복귀 — T009. dist 정적 서빙 뒤 · SPA 폴백 앞.
  // route_app_login 쿠키(= Custom Tab 에서 시작한 앱 로그인)가 있을 때만 /oauth/callback·/login?error= 를
  // 가로채 theroute://auth/callback?code=… 로 302 하고, 쿠키가 없으면 next() — 웹 로그인 흐름은 그대로다.
  // 🔴 아래 SPA 폴백 정규식은 그대로 둔다.
  app.get(['/oauth/callback', '/login'], require('./routes/appOAuthCallback').createAppOAuthCallbackHandler());
  app.get(/^\/(?!api|uploads|health).*$/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// 404 & 에러 핸들러
app.use(notFound);
app.use(errorHandler);

async function bootstrap() {
  await connectDB();

  // 스키마 변경은 setupDB의 idempotent 마이그레이션으로 처리.
  // sequelize.sync는 사용하지 않음 (NAS ALTER가 매우 느림 + 인덱스 자동 추가가 부팅을 지연시킴)
  await setupDB();

  app.listen(PORT, () => {
    console.log(`[Server] TheRoute API 서버 시작: http://localhost:${PORT}`);
    console.log(`[Server] AUTH_ENABLED=${process.env.AUTH_ENABLED || 'false'}`);
    // 좌표 누락 암장 자동 보강 (카카오 키 없으면 no-op)
    const { backfillGymCoordsOnce } = require('./routes/geo');
    if (typeof backfillGymCoordsOnce === 'function') {
      backfillGymCoordsOnce().catch(() => {});
    }
  });
}

bootstrap();
