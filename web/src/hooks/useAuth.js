/**
 * 1인용 무인증 운영 — 디폴트 사용자(id=1) 반환.
 * 추후 인증 도입 시 Context Provider로 교체.
 */
const DEFAULT_USER = { id: 1, nickname: '나' };

export function useAuth() {
  return {
    user: DEFAULT_USER,
    token: null,
    isAuthenticated: true,
    login: () => {},
    logout: () => {},
  };
}

export function getAuthToken() {
  return null;
}
