import client from './client';

// SNS 로그인 (구글 accessToken → 우리 서버 JWT)
export async function snsLogin(provider, accessToken) {
  return client.post('/auth/sns', { provider, accessToken });
}
