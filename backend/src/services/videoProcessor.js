/**
 * 서버 사이드 영상 처리 (압축 + 썸네일)
 * fire-and-forget: setImmediate로 응답 블로킹 없이 백그라운드 실행
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { extractThumbnail, thumbnailUrlFor } = require('./thumbnail');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

// 화질 preset → CRF + 해상도
const PRESETS = {
  high:     { crf: 23, maxRes: 1920, fps: 30 },
  standard: { crf: 28, maxRes: 1920, fps: 30 },
  low:      { crf: 33, maxRes: 1280, fps: 30 },
};

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
    let errBuf = '';
    proc.stderr.on('data', (c) => { errBuf += c.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${errBuf.slice(-300)}`));
    });
  });
}

/**
 * 영상 압축 + 썸네일 생성 + DB 갱신을 백그라운드로 실행.
 * 컨트롤러는 await 없이 호출 → 응답 지연 0.
 */
function processVideoBackground({ ClimbLogProblem, cpId, inputPath, qualityKey }) {
  setImmediate(async () => {
    try {
      const preset = qualityKey === 'original' ? null : (PRESETS[qualityKey] || PRESETS.standard);
      const dir = path.dirname(inputPath);
      const baseName = path.basename(inputPath, path.extname(inputPath));

      let finalPath = inputPath;
      let finalFilename = path.basename(inputPath);

      if (preset) {
        const compressedFilename = `c_${baseName}.mp4`;
        const compressedPath = path.join(dir, compressedFilename);

        const scale = `scale='min(${preset.maxRes},iw)':-2`;
        await runFfmpeg([
          '-y', '-loglevel', 'error',
          '-i', inputPath,
          '-vf', `${scale},fps=${preset.fps}`,
          '-c:v', 'libx264',
          '-crf', String(preset.crf),
          '-preset', 'fast',
          '-c:a', 'aac', '-b:a', '128k',
          '-movflags', '+faststart',
          compressedPath,
        ]);

        // 원본 삭제, 압축본으로 교체
        fs.unlink(inputPath, () => {});
        finalPath = compressedPath;
        finalFilename = compressedFilename;
      }

      // 썸네일
      const thumbOut = await extractThumbnail(finalPath);
      const thumbUrl = thumbOut ? thumbnailUrlFor(finalFilename) : null;
      const videoUrl = `${process.env.MEDIA_BASE_URL}/${finalFilename}`;

      await ClimbLogProblem.update(
        { video_url: videoUrl, thumbnail_url: thumbUrl, video_status: 'ready' },
        { where: { id: cpId } }
      );
      console.log(`[videoProcessor] cp(${cpId}) 완료 → ${videoUrl}`);
    } catch (e) {
      console.error(`[videoProcessor] cp(${cpId}) 실패: ${e.message}`);
      await ClimbLogProblem.update({ video_status: 'error' }, { where: { id: cpId } }).catch(() => {});
    }
  });
}

module.exports = { processVideoBackground };
