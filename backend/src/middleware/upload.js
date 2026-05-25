const multer = require('multer');
const path = require('path');

const ALLOWED_VIDEO = ['.mp4', '.mov', '.avi', '.webm'];
const ALLOWED_IMAGE = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_VIDEO_SIZE = 800 * 1024 * 1024; // 800MB (원본 UHD 허용)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB

function fileFilter(allowed) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`허용되지 않는 파일 형식입니다. (허용: ${allowed.join(', ')})`));
    }
  };
}

// 디스크 저장 (NAS 로컬 경로 사용)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.MEDIA_UPLOAD_PATH || 'uploads';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const videoUpload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: fileFilter(ALLOWED_VIDEO),
});

const imageUpload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: fileFilter(ALLOWED_IMAGE),
});

// 통합 세션 모달용 — 임의 다중 비디오 파일 (video_0, video_1 ...)
const sessionUpload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_VIDEO.includes(ext)) cb(null, true);
    else cb(new Error(`허용되지 않는 영상 형식 (허용: ${ALLOWED_VIDEO.join(', ')})`));
  },
});

module.exports = { videoUpload, imageUpload, sessionUpload };
