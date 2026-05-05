import client from './client';
import axios from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3100/api';

// SNS 로그인 (카카오/구글 accessToken → 우리 서버 JWT)
export async function snsLogin(provider, accessToken) {
  return client.post('/auth/sns', { provider, accessToken });
}

// 카카오 사용자 정보 직접 조회 (테스트용)
export async function getKakaoProfile(kakaoAccessToken) {
  const { data } = await axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${kakaoAccessToken}` },
  });
  return data;
}
