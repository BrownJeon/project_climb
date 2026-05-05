import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { snsLogin } from '../api/auth';

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: true,   // 앱 시작 시 토큰 복원 중
  isLoggedIn: false,
  isGuest: false,    // 비회원 여부

  // 앱 시작 시 저장된 상태 복원
  hydrate: async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userJson = await AsyncStorage.getItem('user');
      const guest = await AsyncStorage.getItem('is_guest');

      if (token && userJson) {
        set({ token, user: JSON.parse(userJson), isLoggedIn: true, isGuest: false });
      } else if (guest === 'true') {
        set({ isLoggedIn: true, isGuest: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  // SNS 로그인
  login: async (provider, accessToken) => {
    const response = await snsLogin(provider, accessToken);
    const { token, user } = response.data;

    await AsyncStorage.multiRemove(['is_guest']);
    await AsyncStorage.setItem('access_token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isLoggedIn: true, isGuest: false });
    return user;
  },

  // 비회원 로그인
  loginAsGuest: async () => {
    await AsyncStorage.setItem('is_guest', 'true');
    set({ user: null, token: null, isLoggedIn: true, isGuest: true });
  },

  // 로그아웃
  logout: async () => {
    await AsyncStorage.multiRemove(['access_token', 'user', 'is_guest']);
    set({ token: null, user: null, isLoggedIn: false, isGuest: false });
  },

  // 세션 만료 처리 (client.js에서 토큰 갱신 실패 시 호출)
  sessionExpired: async () => {
    await AsyncStorage.multiRemove(['access_token', 'user', 'is_guest']);
    set({ token: null, user: null, isLoggedIn: false, isGuest: false });
  },
}));

export default useAuthStore;
