/** @type {import('pm2').StartOptions} */
// 이 파일은 **릴리스 디렉토리 안에서 평가된다**: /home/brownjeon/apps/theroute/releases/<타임스탬프>/
// 2026-09-19 컷오버로 운영이 NFS 편집 트리 직접 구동에서 blue/green 릴리스 구조로 옮겨졌다.
// 절차서: docs/deploy-order.md
//
// ⚠️ 종전에는 이 파일과 `backend/ecosystem.config.js` **두 개**가 같은 앱 이름(`theroute-api`)을
//    정의하고 있었고, 실제로 pm2 에 등록된 것은 backend 쪽이었다(cwd=.../TheRoute/backend).
//    어느 쪽으로 `pm2 start` 했는지에 따라 동작이 갈리므로 **이 파일 하나로 통합**하고
//    backend 쪽은 삭제했다.
//
// cwd 가 `<릴리스>/backend` 인 이유
// --------------------------------
// backend 는 `src/index.js` 를 진입점으로 하고 `.env` 를 cwd 기준으로 읽는다.
// `deploy.yml` 의 shared 에 `backend/.env` 를 두는 것과 짝이 맞아야 한다.
// 정적 SPA 경로는 cwd 와 무관하다 — `backend/src/index.js` 가 `__dirname` 기준으로
// `../../web/dist` 를 잡으므로 릴리스 안의 빌드 산출물을 가리킨다.
//
// __dirname 을 쓰는 이유: Node 가 realpath 로 해석해 **구체적인 릴리스 경로**가 된다.
// 'current' 문자열을 넣으면 심볼릭 링크가 옮겨간 뒤에도 pm2 에 적힌 값은 그대로라
// "새 릴리스처럼 보이는데 옛 코드가 도는" 거짓 성공이 된다
// (release.sh 의 ensure_current_cwd 가 이 비교에 의존한다).
const fs = require('node:fs')
const path = require('node:path')

// pm2 는 로그 상위 디렉토리를 만들어 주지 않는다 — 없으면 기동에 실패하고 그 실패가
// 어떤 로그에도 남지 않는다(VoiceVault 2026-09-02 실장애: 204회 크래시 루프 → 502).
// 로그는 릴리스가 아니라 shared/ 에 둔다 — 릴리스는 5개만 보관하고 지워진다.
const LOG_DIR = '/home/brownjeon/apps/theroute/shared/logs'
fs.mkdirSync(LOG_DIR, { recursive: true })

module.exports = {
  apps: [
    {
      name: 'theroute-api',
      script: 'src/index.js',
      cwd: path.join(__dirname, 'backend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
      },
      error_file: `${LOG_DIR}/api-error.log`,
      out_file: `${LOG_DIR}/api-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
