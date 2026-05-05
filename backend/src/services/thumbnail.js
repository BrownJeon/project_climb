/**
 * 영상 썸네일 자동 추출 (ffmpeg)
 *  - 영상 첫 1초 지점에서 1프레임을 jpg로 추출
 *  - 비차단(fire-and-forget): 응답을 지연시키지 않음. 실패해도 로그만 남기고 무시
 *  - 출력 경로는 영상 파일과 동일 디렉토리, 확장자만 `.jpg`로 치환
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const SEEK_SECONDS = process.env.THUMBNAIL_SEEK_SECONDS || '1';
const WIDTH = process.env.THUMBNAIL_WIDTH || '720';

function thumbnailPathFor(videoFilePath) {
  const dir = path.dirname(videoFilePath);
  const base = path.basename(videoFilePath, path.extname(videoFilePath));
  return path.join(dir, `${base}.jpg`);
}

function thumbnailUrlFor(videoFilename) {
  const base = path.basename(videoFilename, path.extname(videoFilename));
  return `${process.env.MEDIA_BASE_URL}/${base}.jpg`;
}

/**
 * @param {string} videoFilePath - 디스크에 저장된 영상 절대 경로
 * @returns {Promise<string|null>} 성공 시 썸네일 절대 경로, 실패 시 null
 */
function extractThumbnail(videoFilePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(videoFilePath)) {
      console.warn(`[thumbnail] 영상 파일 없음: ${videoFilePath}`);
      return resolve(null);
    }
    const out = thumbnailPathFor(videoFilePath);
    const args = [
      '-y', '-loglevel', 'error',
      '-ss', String(SEEK_SECONDS),
      '-i', videoFilePath,
      '-frames:v', '1',
      '-vf', `scale=${WIDTH}:-2`,
      '-q:v', '3',
      out,
    ];
    const proc = spawn(FFMPEG, args, { shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (c) => { err += c.toString(); });
    proc.on('error', (e) => {
      console.warn(`[thumbnail] ffmpeg spawn 실패: ${e.message}`);
      resolve(null);
    });
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(out)) {
        resolve(out);
      } else {
        // 영상 길이가 SEEK 미만이면 첫 프레임으로 재시도
        if (code !== 0 && SEEK_SECONDS !== '0') {
          const args2 = [...args];
          const idx = args2.indexOf('-ss');
          args2[idx + 1] = '0';
          const proc2 = spawn(FFMPEG, args2, { shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
          proc2.on('close', (code2) => {
            if (code2 === 0 && fs.existsSync(out)) resolve(out);
            else { console.warn(`[thumbnail] ffmpeg exit ${code2} (retry): ${err.slice(-200)}`); resolve(null); }
          });
          proc2.on('error', () => resolve(null));
          return;
        }
        console.warn(`[thumbnail] ffmpeg exit ${code}: ${err.slice(-200)}`);
        resolve(null);
      }
    });
  });
}

/**
 * 영상 업로드 직후 ArRoute에 썸네일을 비동기로 채움.
 * 컨트롤러는 await 없이 호출 → 응답 지연 0.
 */
function attachThumbnailAsync({ ArRoute, arRouteId, videoFilePath, videoFilename }) {
  setImmediate(async () => {
    try {
      const out = await extractThumbnail(videoFilePath);
      if (!out) return;
      const url = thumbnailUrlFor(videoFilename);
      await ArRoute.update({ thumbnail_url: url }, { where: { id: arRouteId } });
      console.log(`[thumbnail] ar_route(${arRouteId}) 썸네일 저장: ${url}`);
    } catch (e) {
      console.warn(`[thumbnail] attach 실패: ${e.message}`);
    }
  });
}

module.exports = { extractThumbnail, attachThumbnailAsync, thumbnailPathFor, thumbnailUrlFor };
