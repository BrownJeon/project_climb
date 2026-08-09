/**
 * holdDetection.js
 * Canvas 2D API 기반 홀드 색상 감지 유틸리티
 *
 * 클라이밍 벽 사진에서 클릭한 홀드의 색상을 기준으로
 * 같은 색상의 홀드를 자동 감지하는 순수 JavaScript 모듈
 */

/** 처리 해상도 (px 너비 기준) */
const PROC_WIDTH = 600;

/**
 * 이미지 데이터에서 특정 좌표 주변 픽셀의 평균 RGB를 반환한다.
 *
 * @param {ImageData} imageData - canvas getImageData 결과
 * @param {number} cx - 중심 X 좌표 (픽셀)
 * @param {number} cy - 중심 Y 좌표 (픽셀)
 * @param {number} [radius=6] - 평균을 낼 반경 (px)
 * @returns {{ r: number, g: number, b: number }} 평균 RGB
 */
export function sampleAverageColor(imageData, cx, cy, radius = 6) {
  const { data, width, height } = imageData;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;

  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));

  const r2 = radius * radius;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // 원 범위 체크
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;

      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha === 0) continue; // 투명 픽셀 제외

      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }

  if (count === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };
}

/**
 * 이미지 데이터에서 타깃 색상과 유사한 픽셀을 마스크로 표시한다.
 * 유사도는 유클리드 거리로 계산한다.
 *
 * @param {ImageData} imageData - canvas getImageData 결과
 * @param {number} tr - 타깃 Red
 * @param {number} tg - 타깃 Green
 * @param {number} tb - 타깃 Blue
 * @param {number} threshold - 색상 거리 임계값 (유클리드 거리)
 * @returns {Uint8Array} 마스크 (크기 = width * height, 1=유사, 0=다름)
 */
export function findSimilarPixelMask(imageData, tr, tg, tb, threshold) {
  const { data, width, height } = imageData;
  const total = width * height;
  const mask = new Uint8Array(total);
  const thresh2 = threshold * threshold;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const alpha = data[idx + 3];
    if (alpha === 0) {
      mask[i] = 0;
      continue;
    }

    const dr = data[idx] - tr;
    const dg = data[idx + 1] - tg;
    const db = data[idx + 2] - tb;
    const dist2 = dr * dr + dg * dg + db * db;

    mask[i] = dist2 <= thresh2 ? 1 : 0;
  }

  return mask;
}

/**
 * 마스크에서 BFS로 연결된 픽셀 그룹(blob)을 찾는다.
 * minArea 미만의 blob은 잡음으로 제거한다.
 *
 * @param {Uint8Array} mask - findSimilarPixelMask 결과
 * @param {number} width - 이미지 너비 (픽셀)
 * @param {number} height - 이미지 높이 (픽셀)
 * @param {number} [minArea=80] - 최소 픽셀 수
 * @returns {Array<{ centerX: number, centerY: number, minX: number, minY: number, maxX: number, maxY: number, area: number, role: null }>}
 */
export function findConnectedBlobs(mask, width, height, minArea = 80) {
  const visited = new Uint8Array(mask.length);
  const blobs = [];

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue;

    // BFS
    const queue = [i];
    visited[i] = 1;
    const pixels = [i];

    while (queue.length) {
      const cur = queue.shift();
      const x = cur % width;
      const y = Math.floor(cur / width);

      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (!mask[ni] || visited[ni]) continue;
        visited[ni] = 1;
        queue.push(ni);
        pixels.push(ni);
      }
    }

    if (pixels.length < minArea) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;

    for (const pi of pixels) {
      const px = pi % width;
      const py = Math.floor(pi / width);
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
      sumX += px;
      sumY += py;
    }

    blobs.push({
      centerX: Math.round(sumX / pixels.length),
      centerY: Math.round(sumY / pixels.length),
      minX,
      minY,
      maxX,
      maxY,
      area: pixels.length,
      role: null,
    });
  }

  return blobs;
}

/**
 * blob의 bounding box를 기반으로 circle 어노테이션을 생성한다.
 * x, y, r 모두 이미지 너비/높이 대비 % 단위로 반환한다.
 *
 * @param {{ centerX: number, centerY: number, minX: number, minY: number, maxX: number, maxY: number }} blob
 * @param {number} canvasW - canvas 너비 (픽셀)
 * @param {number} canvasH - canvas 높이 (픽셀)
 * @param {string} [color='#ef4444'] - 어노테이션 색상
 * @param {number} [stroke=3] - 선 두께
 * @returns {{ type: 'circle', x: number, y: number, r: number, color: string, stroke: number, _detected: boolean, role: null }}
 */
export function blobToCircleAnnotation(blob, canvasW, canvasH, color = '#ef4444', stroke = 3) {
  const { centerX, centerY, minX, minY, maxX, maxY } = blob;

  // bounding box 장축 반지름 * 1.25 (20% 패딩)
  const halfW = (maxX - minX) / 2;
  const halfH = (maxY - minY) / 2;
  const longAxisRadius = Math.max(halfW, halfH);
  const radiusPx = longAxisRadius * 1.25;

  // % 단위 변환
  const x = (centerX / canvasW) * 100;
  const y = (centerY / canvasH) * 100;
  // r은 너비 기준 %로 변환 (반지름이므로 너비 대비)
  const r = (radiusPx / canvasW) * 100;

  return {
    type: 'circle',
    x,
    y,
    r,
    color,
    stroke,
    _detected: true,
    role: null,
  };
}

/**
 * 이미지에서 클릭한 색상과 유사한 홀드를 자동 감지한다.
 *
 * @param {HTMLImageElement} imgElement - <img> DOM 요소
 * @param {number} clickClientX - 클릭 이벤트 clientX
 * @param {number} clickClientY - 클릭 이벤트 clientY
 * @param {DOMRect} imgRect - imgElement.getBoundingClientRect() 결과
 * @param {number} [threshold=50] - 색상 유사도 임계값
 * @returns {{ blobs: Array, sampledColor: { r: number, g: number, b: number } | null, canvasW: number, canvasH: number }}
 */
export function detectHoldsByColor(imgElement, clickClientX, clickClientY, imgRect, threshold = 50) {
  const emptyResult = { blobs: [], sampledColor: null, canvasW: 0, canvasH: 0 };

  try {
    // 이미지 미로드 체크
    if (!imgElement || imgElement.naturalWidth === 0) {
      return emptyResult;
    }

    const naturalW = imgElement.naturalWidth;
    const naturalH = imgElement.naturalHeight;

    // 처리 해상도 결정 (자연 크기가 더 작으면 자연 크기 사용)
    const canvasW = Math.min(PROC_WIDTH, naturalW);
    const canvasH = Math.round((naturalH / naturalW) * canvasW);

    // offscreen canvas 생성
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    // 이미지 그리기
    ctx.drawImage(imgElement, 0, 0, canvasW, canvasH);

    // 클릭 위치를 이미지 내 상대 위치(%)로 계산
    const relX = (clickClientX - imgRect.left) / imgRect.width;
    const relY = (clickClientY - imgRect.top) / imgRect.height;

    // canvas 픽셀 좌표로 변환
    const canvasClickX = Math.round(relX * canvasW);
    const canvasClickY = Math.round(relY * canvasH);

    // 전체 이미지 데이터 획득
    const imageData = ctx.getImageData(0, 0, canvasW, canvasH);

    // 클릭 위치 색상 샘플링
    const sampledColor = sampleAverageColor(imageData, canvasClickX, canvasClickY);

    // 유사 픽셀 마스크 생성
    const mask = findSimilarPixelMask(
      imageData,
      sampledColor.r,
      sampledColor.g,
      sampledColor.b,
      threshold
    );

    // 연결 성분 레이블링 (BFS)
    const rawBlobs = findConnectedBlobs(mask, canvasW, canvasH);

    // role: null 초기값 추가 (findConnectedBlobs에서 이미 추가하므로 그대로 사용)
    const blobs = rawBlobs.map((blob) => ({ ...blob, role: null }));

    return { blobs, sampledColor, canvasW, canvasH };
  } catch (err) {
    console.warn('[holdDetection] detectHoldsByColor 오류:', err);
    return emptyResult;
  }
}
