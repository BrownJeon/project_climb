import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.6';
const CDN_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

let ffmpegInstance = null;
let loadPromise = null;

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration || 60); };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(60); };
    video.src = url;
  });
}

async function loadFFmpeg(onLog) {
  if (!loadPromise) {
    loadPromise = (async () => {
      ffmpegInstance = new FFmpeg();
      if (onLog) ffmpegInstance.on('log', ({ message }) => onLog(message));
      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${CDN_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CDN_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    })().catch((e) => {
      loadPromise = null;
      ffmpegInstance = null;
      throw e;
    });
  }
  return loadPromise;
}

/**
 * 영상 파일을 품질 설정에 따라 압축합니다.
 * @param {File} file - 원본 영상 파일
 * @param {{ targetMB: number|null, maxResolution: number, fps: number }} preset
 * @param {{ onProgress: (ratio: number) => void, onStatus: (msg: string) => void }} callbacks
 * @returns {Promise<File>} - 압축된 영상 파일 (또는 원본)
 */
export async function compressVideo(file, preset, { onProgress, onStatus } = {}) {
  if (!preset || preset.targetMB == null) return file;

  onStatus?.('FFmpeg 로딩 중...');
  await loadFFmpeg();

  const ffmpeg = ffmpegInstance;

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.min(0.99, progress));
  });

  const duration = await getVideoDuration(file);
  onStatus?.('영상 분석 중...');

  // 목표 비트레이트 계산
  const targetBits = preset.targetMB * 8 * 1024 * 1024;
  const audioBits = 128 * 1024; // 128kbps audio
  const videoBitsPerSec = (targetBits / duration) - audioBits;
  const videoBitrateK = Math.max(500, Math.floor(videoBitsPerSec / 1024));

  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const inputName = `in_${Date.now()}.${ext}`;
  const outputName = `out_${Date.now()}.mp4`;

  onStatus?.('파일 준비 중...');
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const scale = `scale='min(${preset.maxResolution},iw)':-2`;
  const args = [
    '-i', inputName,
    '-vf', `${scale},fps=${preset.fps}`,
    '-c:v', 'libx264',
    '-b:v', `${videoBitrateK}k`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y',
    outputName,
  ];

  onStatus?.('압축 중...');
  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  onProgress?.(1);
  onStatus?.('완료');

  return new File(
    [data instanceof Uint8Array ? data : new Uint8Array(data)],
    `compressed_${Date.now()}.mp4`,
    { type: 'video/mp4' }
  );
}
