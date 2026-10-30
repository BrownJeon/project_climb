import { client } from './client';
import { toExchangeError } from '../native/appLogin.js';

export function login(email, password) {
  return client.post('/auth/login', { email, password });
}

export function register(email, password, nickname) {
  return client.post('/auth/register', { email, password, nickname });
}

export function getMe() {
  return client.get('/auth/me');
}

/** 교환 요청 제한 시간 — 서버·망이 응답 없이 멈추면 로그인이 끝나지 않은 채 아무 안내도 없게 된다. */
const APP_EXCHANGE_TIMEOUT_MS = 15000;

/**
 * 응답 인터셉터(client.js)는 실패 때 본문만 reject 해 HTTP 상태가 사라진다. 승인 문구(데모 v1 §4)는 401(만료·재사용·불일치)과
 * 그 밖(400 등)을 다르게 안내하므로, 이 요청에 한해 JSON 본문 객체에 `httpStatus` 를 덧붙인다(axios 1.x 는 transformResponse
 * 세 번째 인자로 상태를 준다 — node_modules/axios/lib/core/transformData.js). 기본 JSON 파싱 뒤에 붙인다.
 */
function attachHttpStatus(data, _headers, status) {
  return data && typeof data === 'object' && !Array.isArray(data) ? { ...data, httpStatus: status } : data;
}

/**
 * 앱(Android) 로그인 딥링크로 받은 1회용 코드와 PKCE verifier 를 JWT 로 바꾼다 (T009, 개정 2026-10-30 §3).
 * POST /api/auth/app-exchange { code, verifier } → { success, data: { token }, message }.
 * 응답 인터셉터가 이미 한 겹(res.data) 벗겼으므로 토큰은 **r.data.token** 이다(r.data.data 아님).
 * 실패하면 `toExchangeError`(native/appLogin.js) 가 만든 Error(kind: expired|failed|network, 승인 문구)로 reject 한다 —
 * 서버 문구를 사용자에게 그대로 보이지 않는다.
 */
export async function appExchange(code, verifier) {
  let r;
  try {
    r = await client.post('/auth/app-exchange', { code, verifier }, {
      timeout: APP_EXCHANGE_TIMEOUT_MS,
      transformResponse: [].concat(client.defaults.transformResponse || [], attachHttpStatus),
    });
  } catch (e) {
    throw toExchangeError(e);
  }
  const token = r && r.data && r.data.token;
  if (typeof token !== 'string' || token === '') {
    throw toExchangeError({ data: null, httpStatus: r && r.httpStatus }); // 200 인데 토큰 없음 → failed
  }
  return token;
}
