const STORAGE_KEY = 'theroute:video_quality';

export const VIDEO_QUALITY_PRESETS = [
  {
    key: 'original',
    label: '원본',
    desc: '압축 없이 업로드',
    targetMB: null,
    maxResolution: null,
    fps: null,
  },
  {
    key: 'high',
    label: '고화질',
    desc: '약 100MB 기준 · 1080p 30fps',
    targetMB: 100,
    maxResolution: 1920,
    fps: 30,
  },
  {
    key: 'standard',
    label: '표준',
    desc: '약 50MB 기준 · 1080p 30fps',
    targetMB: 50,
    maxResolution: 1920,
    fps: 30,
  },
  {
    key: 'low',
    label: '저화질',
    desc: '약 20MB 기준 · 720p 30fps',
    targetMB: 20,
    maxResolution: 1280,
    fps: 30,
  },
];

export function getVideoQualityKey() {
  return localStorage.getItem(STORAGE_KEY) || 'standard';
}

export function setVideoQualityKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function getVideoQualityPreset(key) {
  return VIDEO_QUALITY_PRESETS.find((p) => p.key === (key || getVideoQualityKey()))
    || VIDEO_QUALITY_PRESETS[2];
}
