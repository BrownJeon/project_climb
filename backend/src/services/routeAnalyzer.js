/**
 * 기술(ArRoute) 영상 자동 AI 분석 서비스
 *
 * createRoute()에서 영상이 존재할 때 setImmediate()로 fire-and-forget 호출.
 * 분석 결과는 ar_routes.ai_analysis(JSON) 컬럼에 저장.
 */
const { runClaude } = require('./claudeCli');
const { ArRoute, User, Problem, Gym } = require('../models');

const TIMEOUT_MS = 120 * 1000; // 2분

const COLOR_KR = {
  red: '빨강', orange: '주황', yellow: '노랑', green: '초록',
  blue: '파랑', navy: '남색', pink: '핑크', purple: '보라',
  black: '검정', white: '하양', gray: '회색',
};

function buildPrompt(route, user, gym) {
  const color = COLOR_KR[route.color] || route.color || '미지정';
  const level = route.level || '미지정';
  const techniques = route.tags?.techniques?.join(', ') || '없음';
  const wallType = route.tags?.wall_type || '미지정';
  const gymName = gym?.name || '미지정';
  const desc = route.description ? `\n영상 설명: ${route.description}` : '';

  return `당신은 클라이밍 코치입니다. 아래 클라이밍 기술 영상 정보를 바탕으로 간결한 기술 분석을 제공하세요.

## 영상 정보
- 암장: ${gymName}
- 홀드 색상: ${color}
- 난이도: ${level}
- 벽 유형: ${wallType}
- 사용 기술: ${techniques}${desc}

## 분석 요청
다음 항목을 마크다운 형식으로 작성하세요 (각 항목 3~5문장):

### 핵심 기술 포인트
이 난이도와 벽 유형에서 중요한 기술적 요소를 설명하세요.

### 초보자 주의사항
이 루트를 처음 시도하는 클라이머가 흔히 하는 실수와 주의할 점을 설명하세요.

### 훈련 팁
이 기술을 향상시키기 위한 구체적인 훈련 방법을 제안하세요.

답변은 한국어로 작성하고, 실용적이고 구체적으로 작성하세요.`;
}

async function analyzeRouteAsync(arRouteId, userId) {
  try {
    const route = await ArRoute.findByPk(arRouteId, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'nickname'] },
        {
          model: Problem,
          as: 'problem',
          attributes: ['id', 'level', 'color', 'section'],
          required: false,
          include: [{ model: Gym, as: 'gym', attributes: ['id', 'name'] }],
        },
      ],
    });

    if (!route) {
      console.warn(`[routeAnalyzer] route ${arRouteId} not found`);
      return;
    }
    if (!route.video_url) {
      console.log(`[routeAnalyzer] route ${arRouteId} has no video — skip`);
      return;
    }

    const gym = route.problem?.gym || null;
    const prompt = buildPrompt(route, route.author, gym);

    const t0 = Date.now();
    const result = await runClaude({ prompt, stream: false, timeoutMs: TIMEOUT_MS });
    const durationMs = Date.now() - t0;

    if (!result) {
      console.warn(`[routeAnalyzer] route ${arRouteId} — Claude returned empty`);
      return;
    }

    await ArRoute.update(
      {
        ai_analysis: JSON.stringify({
          result_markdown: result,
          analyzed_at: new Date().toISOString(),
          duration_ms: durationMs,
          engine: 'claude-cli',
        }),
      },
      { where: { id: arRouteId } },
    );

    console.log(`[routeAnalyzer] route ${arRouteId} analyzed in ${durationMs}ms`);
  } catch (e) {
    console.error(`[routeAnalyzer] route ${arRouteId} failed: ${e.message}`);
  }
}

module.exports = { analyzeRouteAsync };
