import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// authStore는 순환참조 방지를 위해 런타임에 가져옴
function triggerSessionExpired() {
  // eslint-disable-next-line global-require
  require('../store/authStore').default.getState().sessionExpired();
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3100/api';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터: JWT 토큰 자동 첨부
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 토큰 갱신 중복 요청 방지 플래그
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

// 응답 인터셉터: 토큰 만료 시 자동 갱신 후 재시도
client.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // 401이고 refresh 요청 자체가 실패한 경우 → 로그아웃 처리
    if (error.response?.status === 401 && originalRequest._retry) {
      triggerSessionExpired();
      return Promise.reject(new Error('세션이 만료되었습니다. 다시 로그인해주세요.'));
    }

    // 401이고 아직 재시도 안 한 요청
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // 이미 갱신 중이면 큐에 넣고 대기
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        const expiredToken = await AsyncStorage.getItem('access_token');
        const response = await axios.post(`${BASE_URL}/auth/refresh`, { token: expiredToken });
        const newToken = response.data.data.token;

        await AsyncStorage.setItem('access_token', newToken);
        client.defaults.headers.common.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        triggerSessionExpired();
        return Promise.reject(new Error('세션이 만료되었습니다. 다시 로그인해주세요.'));
      } finally {
        isRefreshing = false;
      }
    }

    const message = error.response?.data?.message || '네트워크 오류가 발생했습니다.';
    return Promise.reject(new Error(message));
  }
);

export default client;
